import 'dotenv/config';
import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import sharp from 'sharp';
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import dns from "node:dns";

// DNS alternativo opcional para redes que bloqueiam consultas ao MongoDB Atlas
if (process.env.DNS_SERVERS) {
  dns.setServers(
    process.env.DNS_SERVERS.split(",").map((server) => server.trim())
  );
}

import User, {
  CATEGORIAS_VALIDAS,
} from './models/User.js';
import Nutricionista from './models/Nutricionista.js';
import SolicitacaoVinculo from './models/SolicitacaoVinculo.js';
import AllergenDictionary from './models/AllergenDictionary.js';
import ScanLog, { montarMarcaPeso } from './models/ScanLog.js';
import HelpQuestion from './models/HelpQuestion.js';
import Feedback from './models/Feedback.js';
import { DICIONARIO_PADRAO } from './seeds/dicionarioPadrao.js';
import {
  normalizar,
  regexInsensivelAcentos,
  emailValido,
} from './utils/texto.js';
import { parseCrn, normalizarCrn, regexCrn } from './utils/crn.js';
import {
  autenticarJWT,
  exigirNutricionista,
  exigirPaciente,
  JWT_SECRET,
} from './middleware/auth.js';
import { extrairTextoDaImagem, analisarTextoRotulo } from './services/ocrAnalyzer.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


export const FILTRAR_HISTORICO_DESDE_VINCULO = true;

const UPLOADS_DIR = path.join(__dirname, 'uploads');
const TMP_UPLOADS_DIR = path.join(UPLOADS_DIR, 'tmp');
const SCANS_UPLOADS_DIR = path.join(UPLOADS_DIR, 'scans');

for (const dir of [UPLOADS_DIR, TMP_UPLOADS_DIR, SCANS_UPLOADS_DIR]) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));


function responderErro(res, status, mensagem, campos = undefined, extras = {}) {
  const payload = {
    mensagem,
    ...extras,
  };
  if (campos && Object.keys(campos).length > 0) {
    payload.campos = campos;
  }
  return res.status(status).json(payload);
}


const limiterVinculo = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) =>
    responderErro(
      res,
      429,
      'Muitas tentativas de consulta. Aguarde alguns minutos antes de tentar novamente.'
    ),
});


const limiterSolicitacao = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  keyGenerator: (req) => {
    if (req.userId) {
      return `paciente:${req.userId}`;
    }

    return ipKeyGenerator(req.ip || "0.0.0.0");
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) =>
    responderErro(
      res,
      429,
      "Você atingiu o limite de solicitações. Aguarde uma hora para tentar novamente."
    ),
});


const limiterAuth = rateLimit({
  windowMs: 15 * 60 * 1000,   max: Number(process.env.AUTH_RATE_LIMIT_MAX || 40),
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) =>
    responderErro(
      res,
      429,
      'Muitas tentativas de autenticação. Aguarde alguns minutos antes de tentar novamente.'
    ),
});


const upload = multer({
  dest: TMP_UPLOADS_DIR,
  limits: {
    fileSize: 12 * 1024 * 1024,   },
  fileFilter: (_req, file, cb) => {
    const mime = (file.mimetype || '').toLowerCase();
    const ext = path.extname(file.originalname || '').toLowerCase();
    const mimesAceitos = [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/webp',
      'image/heic',
      'image/heif',
    ];
    const extsAceitas = ['.jpg', '.jpeg', '.png', '.webp', '.heic', '.heif'];

    if (
      mime.startsWith('image/') ||
      mimesAceitos.includes(mime) ||
      extsAceitas.includes(ext)
    ) {
      cb(null, true);
    } else {
      cb(
        new Error(
          'Formato de arquivo inválido. Envie apenas imagens (JPG, PNG ou WebP).'
        )
      );
    }
  },
});


function formatarItemHistorico(doc, incluirDetalhes = false) {
  const obj = typeof doc.toObject === 'function' ? doc.toObject() : doc;
  const idStr = String(obj._id);
  const marca =
    typeof obj.marca === 'string' && obj.marca.trim()
      ? obj.marca.trim()
      : null;
  const peso =
    typeof obj.peso === 'string' && obj.peso.trim()
      ? obj.peso.trim()
      : null;
  const marcaPesoMontado = montarMarcaPeso(marca, peso);

  const base = {
    id: idStr,
    _id: idStr,
    userId: String(obj.userId),
    nomeProduto: obj.nomeProduto || 'Produto analisado',
    nomeAutomatico: Boolean(obj.nomeAutomatico),
    marca,
    peso,
    marcaPeso: marcaPesoMontado || null,
    intoleranciaDetectada: Array.isArray(obj.intoleranciaDetectada)
      ? obj.intoleranciaDetectada
      : [],
    nivelSensibilidade: obj.nivelSensibilidade || 'Moderado',
    confiancaOcr: obj.confiancaOcr ?? null,
    motorOcr: obj.motorOcr || 'tesseract',
    veredito: obj.veredito,
    alergicosDetectados: Array.isArray(obj.alergicosDetectados)
      ? obj.alergicosDetectados
      : [],
    curtido: Boolean(obj.curtido),
    imagemUri: obj.imagemUri || null,
    imagemUrl: `/users/historico/${idStr}/imagem`,
    imagemDemo: obj.imagemDemo || null,
    seed: Boolean(obj.seed),
    createdAt: obj.createdAt,
    updatedAt: obj.updatedAt,
  };

  if (incluirDetalhes) {
    base.ingredientesDetalhados = Array.isArray(obj.ingredientesDetalhados)
      ? obj.ingredientesDetalhados
      : [];
    base.textoBruto = obj.textoBruto || '';
  }

  return base;
}

function validarRestricoesENiveis(
  restricoes,
  niveisSensibilidade,
  exigirAoMenosUma = true
) {
  if (!Array.isArray(restricoes)) {
    return { erro: 'O campo restricoes deve ser uma lista.' };
  }

  const restricoesLimpas = [];
  for (const r of restricoes) {
    const norm = normalizar(String(r));
    if (!CATEGORIAS_VALIDAS.includes(norm)) {
      return {
        erro: `Restrição inválida: "${r}". Valores aceitos: gluten, lactose, amendoim.`,
      };
    }
    if (!restricoesLimpas.includes(norm)) {
      restricoesLimpas.push(norm);
    }
  }

  if (exigirAoMenosUma && restricoesLimpas.length === 0) {
    return { erro: 'Selecione ao menos uma intolerância' };
  }

  const niveisLimpos = {
    gluten: 1,
    lactose: 1,
    amendoim: 1,
  };

  if (niveisSensibilidade && typeof niveisSensibilidade === 'object') {
    for (const cat of CATEGORIAS_VALIDAS) {
      if (niveisSensibilidade[cat] !== undefined) {
        const val = Number(niveisSensibilidade[cat]);
        if (![0, 1, 2].includes(val)) {
          return {
            erro: `Nível de sensibilidade inválido para ${cat}. Use 0 (Leve), 1 (Moderado) ou 2 (Grave).`,
          };
        }
        niveisLimpos[cat] = val;
      }
    }
  }

  return { restricoes: restricoesLimpas, niveisSensibilidade: niveisLimpos };
}

function formatarNutricionistaVinculo(nutricionista) {
  if (!nutricionista) return null;
  return {
    nome: nutricionista.nome,
    crn: nutricionista.crn || null,
    tratamento: nutricionista.tratamento || null,
  };
}

async function buscarNutricionistaPorCrn(crn) {
  const normalizado = normalizarCrn(crn);
  if (!normalizado) return null;

  const encontrados = await Nutricionista.find({
    crn: { $regex: regexCrn(normalizado) },
  })
    .select('nome crn tratamento')
    .lean();

  if (encontrados.length > 1) {
    console.warn('Mais de um nutricionista encontrado para um CRN normalizado.');
    return null;
  }
  return encontrados[0] || null;
}

function vinculoVazio() {
  return {
    estado: 'NENHUM',
    nutricionista: null,
    solicitacaoId: null,
    vinculadoEm: null,
    atualizadoEm: null,
  };
}

async function obterVinculoPaciente(userDoc) {
  if (userDoc?.nutricionistaId) {
    const nutricionista = await Nutricionista.findById(userDoc.nutricionistaId)
      .select('nome crn tratamento')
      .lean();
    if (!nutricionista) {
      console.warn('Vínculo aponta para nutricionista inexistente.');
      return vinculoVazio();
    }

    const solicitacao = await SolicitacaoVinculo.findOne({
      pacienteId: userDoc._id,
      nutricionistaId: userDoc.nutricionistaId,
      status: 'APROVADO',
    })
      .sort({ updatedAt: -1 })
      .select('_id updatedAt')
      .lean();

    return {
      estado: 'APROVADO',
      nutricionista: formatarNutricionistaVinculo(nutricionista),
      solicitacaoId: solicitacao ? String(solicitacao._id) : null,
      vinculadoEm: userDoc.vinculadoEm || null,
      atualizadoEm: solicitacao?.updatedAt || null,
    };
  }

  const pendente = await SolicitacaoVinculo.findOne({
    pacienteId: userDoc._id,
    status: 'PENDENTE',
  })
    .sort({ createdAt: -1 })
    .select('_id nutricionistaId createdAt updatedAt')
    .lean();
  const solicitacao =
    pendente ||
    (await SolicitacaoVinculo.findOne({
      pacienteId: userDoc._id,
      status: 'RECUSADO',
    })
      .sort({ createdAt: -1 })
      .select('_id nutricionistaId createdAt updatedAt')
      .lean());

  if (!solicitacao) return vinculoVazio();

  const nutricionista = await Nutricionista.findById(
    solicitacao.nutricionistaId
  )
    .select('nome crn tratamento')
    .lean();

  return {
    estado: pendente ? 'PENDENTE' : 'RECUSADO',
    nutricionista: formatarNutricionistaVinculo(nutricionista),
    solicitacaoId: String(solicitacao._id),
    vinculadoEm: null,
    atualizadoEm: solicitacao.updatedAt || solicitacao.createdAt || null,
  };
}

/**
 * Calcula estatísticas do usuário no fuso America/Sao_Paulo:
 * - escaneamentosSegurosMes (mês calendário atual em SP)
 * - diasConsecutivos (streak de dias com ao menos 1 scan terminando hoje ou ontem em SP)
 * - totalScans
 * - metaMensal: 50
 */
async function calcularStatsUsuario(userId, desdeData = null) {
  const agora = new Date();
  const formatadorDataSP = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  const hojeSPStr = formatadorDataSP.format(agora);
  const [anoSP, mesSP] = hojeSPStr.split('-').map(Number);
  const inicioMesSP = new Date(Date.UTC(anoSP, mesSP - 1, 1, 3, 0, 0, 0));

  const baseFiltro = { userId };
  if (desdeData) {
    baseFiltro.createdAt = { $gte: new Date(desdeData) };
  }

  const dataMinimaMes =
    desdeData && new Date(desdeData) > inicioMesSP
      ? new Date(desdeData)
      : inicioMesSP;

  const [totalScans, escaneamentosSegurosMes, logsDatas] = await Promise.all([
    ScanLog.countDocuments(baseFiltro),
    ScanLog.countDocuments({
      userId,
      veredito: 'SEGURO',
      createdAt: { $gte: dataMinimaMes },
    }),
    ScanLog.find(baseFiltro)
      .select('createdAt')
      .sort({ createdAt: -1 })
      .limit(365)
      .lean(),
  ]);

  let diasConsecutivos = 0;
  if (logsDatas.length > 0) {
    const diasComScan = new Set(
      logsDatas
        .filter((l) => l.createdAt)
        .map((l) => formatadorDataSP.format(new Date(l.createdAt)))
    );

    const somarDias = (yyyyMmDd, delta) => {
      const [y, m, d] = yyyyMmDd.split('-').map(Number);
      const dt = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
      dt.setUTCDate(dt.getUTCDate() + delta);
      return dt.toISOString().slice(0, 10);
    };

    const ontemSPStr = somarDias(hojeSPStr, -1);
    let cursorDia = null;
    if (diasComScan.has(hojeSPStr)) {
      cursorDia = hojeSPStr;
    } else if (diasComScan.has(ontemSPStr)) {
      cursorDia = ontemSPStr;
    }

    while (cursorDia && diasComScan.has(cursorDia)) {
      diasConsecutivos++;
      cursorDia = somarDias(cursorDia, -1);
    }
  }

  return {
    escaneamentosSegurosMes,
    diasConsecutivos,
    totalScans,
    metaMensal: 50,
  };
}

// ============================================================================
// INICIALIZAÇÃO DO DICIONÁRIO (IDEMPOTENTE, SEM OPERAÇÕES DESTRUTIVAS)
// ============================================================================

const EXCECOES_PADRAO_POR_CATEGORIA = {
  gluten: ['trigo sarraceno', 'farinha de trigo sarraceno', 'trigo mourisco'],
  lactose: [
    'leite de coco',
    'leite de amendoas',
    'leite de amendoa',
    'leite de aveia',
    'leite de arroz',
    'leite de soja',
    'leite de castanha',
    'leite vegetal',
    'manteiga de cacau',
    'manteiga de karite',
    'acido lactico',
    'lactato de sodio',
    'lactato de calcio',
  ],
  amendoim: [],
};

async function inicializarDicionarioPadrao() {
  try {
    for (const [categoria, sinonimosPadrao] of Object.entries(DICIONARIO_PADRAO)) {
      const excecoesPadrao = EXCECOES_PADRAO_POR_CATEGORIA[categoria] || [];
      await AllergenDictionary.findOneAndUpdate(
        { categoria },
        {
          $setOnInsert: { categoria },
          $addToSet: {
            sinonimos: { $each: sinonimosPadrao },
            excecoes: { $each: excecoesPadrao },
          },
        },
        { upsert: true, returnDocument: 'after' }
      );
    }
    const totalCategorias = await AllergenDictionary.countDocuments();
    console.log(
      `Dicionário de alérgenos pronto (${totalCategorias} categorias registradas).`
    );
  } catch (err) {
    console.error('Erro ao inicializar AllergenDictionary:', err.message);
  }
}

// ============================================================================
// ROTAS DE AUTENTICAÇÃO E VÍNCULO PÚBLICO
// ============================================================================

async function handlerRegisterPaciente(req, res) {
  try {
    const {
      nome,
      email,
      senha,
      restricoes = [],
      niveisSensibilidade,
      avatar = null,
      crnNutricionista,
    } = req.body || {};

    if (!nome || typeof nome !== 'string' || !nome.trim()) {
      return responderErro(res, 400, 'Informe seu nome completo.', {
        nome: 'Informe seu nome completo.',
      });
    }
    if (nome.trim().length > 100) {
      return responderErro(res, 400, 'O nome deve ter no máximo 100 caracteres.', {
        nome: 'Máximo de 100 caracteres.',
      });
    }

    if (!emailValido(email)) {
      return responderErro(res, 400, 'Informe um endereço de e-mail válido.', {
        email: 'Informe um endereço de e-mail válido.',
      });
    }

    if (!senha || typeof senha !== 'string' || senha.length < 6) {
      return responderErro(
        res,
        400,
        'A senha deve ter pelo menos 6 caracteres.',
        { senha: 'A senha deve ter pelo menos 6 caracteres.' }
      );
    }

    const validacao = validarRestricoesENiveis(
      restricoes,
      niveisSensibilidade,
      true
    );
    if (validacao.erro) {
      return responderErro(res, 400, validacao.erro);
    }

    let nutricionistaSolicitado = null;
    if (
      crnNutricionista !== undefined &&
      crnNutricionista !== null &&
      String(crnNutricionista).trim() !== ''
    ) {
      if (!parseCrn(String(crnNutricionista))) {
        return responderErro(
          res,
          400,
          'CRN de nutricionista inválido. Ex.: CRN-3 12345',
          { crnNutricionista: 'CRN de nutricionista inválido.' }
        );
      }
      nutricionistaSolicitado = await buscarNutricionistaPorCrn(
        String(crnNutricionista)
      );
      if (!nutricionistaSolicitado) {
        return responderErro(res, 400, 'CRN de nutricionista inválido', {
          crnNutricionista: 'CRN de nutricionista inválido.',
        });
      }
    }

    const emailNorm = email.trim().toLowerCase();
    const existente = await User.findOne({ email: emailNorm });
    if (existente) {
      return responderErro(res, 409, 'Este e-mail já está cadastrado.', {
        email: 'Este e-mail já está cadastrado.',
      });
    }

    const salt = await bcrypt.genSalt(10);
    const senhaHash = await bcrypt.hash(senha, salt);
    const agora = new Date();
    const session = await mongoose.startSession();
    let novoUsuario;
    try {
      await session.withTransaction(async () => {
        [novoUsuario] = await User.create(
          [{
            nome: nome.trim(),
            email: emailNorm,
            senha: senhaHash,
            avatar,
            role: 'PACIENTE',
            nutricionistaId: null,
            vinculadoEm: null,
            consentimentoVinculoEm: nutricionistaSolicitado ? agora : null,
            restricoes: validacao.restricoes,
            niveisSensibilidade: validacao.niveisSensibilidade,
            restricoesAtualizadasEm: agora,
            restricoesAtualizadasPor: 'PACIENTE',
          }],
          { session }
        );

        if (nutricionistaSolicitado) {
          await SolicitacaoVinculo.create(
            [{
              pacienteId: novoUsuario._id,
              nutricionistaId: nutricionistaSolicitado._id,
              status: 'PENDENTE',
            }],
            { session }
          );
        }
      });
    } finally {
      await session.endSession();
    }

    const token = jwt.sign(
      {
        id: String(novoUsuario._id),
        email: novoUsuario.email,
        role: 'PACIENTE',
      },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    const publicUser = novoUsuario.toPublic();
    const vinculo = await obterVinculoPaciente(novoUsuario);

    return res.status(201).json({
      sucesso: true,
      mensagem: 'Usuário cadastrado com sucesso!',
      token,
      role: 'PACIENTE',
      usuario: {
        ...publicUser,
        vinculo,
      },
      vinculo,
    });
  } catch (err) {
    if (err?.code === 11000) {
      return responderErro(res, 409, 'Este e-mail já está cadastrado.', {
        email: 'Este e-mail já está cadastrado.',
      });
    }
    console.error('Erro no cadastro de paciente:', err);
    return responderErro(res, 500, 'Erro interno ao realizar o cadastro.');
  }
}

app.post('/auth/register', limiterAuth, handlerRegisterPaciente);
app.post('/api/cadastro', limiterAuth, handlerRegisterPaciente);

async function handlerLogin(req, res) {
  try {
    const { email, senha } = req.body || {};
    if (!email || !senha) {
      return responderErro(res, 400, 'Preencha e-mail e senha.');
    }

    const emailNorm = String(email).trim().toLowerCase();
    let user = await User.findOne({ email: emailNorm }).select('+senha');

    if (!user) {
      const nutricionista = await Nutricionista.collection.findOne(
        { email: emailNorm },
        { projection: { senha: 1 } }
      );
      if (
        nutricionista &&
        typeof nutricionista.senha === 'string' &&
        /^\$2[aby]\$/.test(nutricionista.senha) &&
        await bcrypt.compare(senha, nutricionista.senha)
      ) {
        return responderErro(
          res,
          403,
          'Esta conta é de nutricionista. Use o painel web.'
        );
      }
    }

    // Fallback transparente caso o usuário ainda esteja apenas na coleção legada `usuarios`
    if (!user && mongoose.connection.readyState === 1) {
      const legado = await mongoose.connection.db
        .collection('usuarios')
        .findOne({
          email: {
            $regex: `^${emailNorm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`,
            $options: 'i',
          },
        });

      if (legado) {
        const senhaLegada = legado.senha || '';
        const ehHash = /^\$2[aby]\$/.test(senhaLegada);
        const senhaConfere = ehHash
          ? await bcrypt.compare(senha, senhaLegada)
          : senha === senhaLegada;

        if (!senhaConfere) {
          return responderErro(res, 401, 'E-mail ou senha incorretos.');
        }

        const hashFinal = ehHash ? senhaLegada : await bcrypt.hash(senha, 10);
        const restricoesLegadas = Array.isArray(legado.restricoes)
          ? legado.restricoes
              .map((r) => normalizar(String(r)))
              .filter((r) => CATEGORIAS_VALIDAS.includes(r))
          : [];

        user = await User.create({
          nome: legado.nome || legado.name || 'Usuário',
          email: emailNorm,
          senha: hashFinal,
          role: 'PACIENTE',
          restricoes: restricoesLegadas,
          niveisSensibilidade: { gluten: 1, lactose: 1, amendoim: 1 },
          restricoesAtualizadasEm: new Date(),
          restricoesAtualizadasPor: 'PACIENTE',
        });
      }
    }

    if (!user) {
      return responderErro(res, 401, 'E-mail ou senha incorretos.');
    }

    const senhaArmazenada = user.senha || '';
    const ehBcrypt = /^\$2[aby]\$/.test(senhaArmazenada);
    let senhaValida = false;

    if (ehBcrypt) {
      senhaValida = await bcrypt.compare(senha, senhaArmazenada);
    } else if (senhaArmazenada) {
      senhaValida = senha === senhaArmazenada;
      if (senhaValida) {
        user.senha = await bcrypt.hash(senha, 10);
        await user.save();
      }
    }

    if (!senhaValida) {
      return responderErro(res, 401, 'E-mail ou senha incorretos.');
    }

    const roleUsuario = user.role || 'PACIENTE';
    const token = jwt.sign(
      { id: String(user._id), email: user.email, role: roleUsuario },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    const publicUser = user.toPublic();
    const vinculo =
      roleUsuario === 'PACIENTE' ? await obterVinculoPaciente(user) : null;

    return res.status(200).json({
      sucesso: true,
      mensagem: 'Login realizado com sucesso!',
      token,
      role: roleUsuario,
      usuario: {
        ...publicUser,
        ...(roleUsuario === 'PACIENTE' ? { vinculo } : {}),
      },
      ...(roleUsuario === 'PACIENTE' ? { vinculo } : {}),
    });
  } catch (err) {
    console.error('Erro no login:', err);
    return responderErro(
      res,
      500,
      'Erro interno no servidor ao realizar login.'
    );
  }
}

app.post('/auth/login', limiterAuth, handlerLogin);
app.post('/api/login', limiterAuth, handlerLogin);

app.get(
  '/api/vinculacoes/nutricionista/:crn',
  limiterVinculo,
  async (req, res) => {
  try {
    const crn = req.params.crn;
    if (!parseCrn(crn)) {
      return responderErro(res, 400, 'CRN inválido. Ex.: CRN-3 12345', {
        crn: 'CRN inválido. Ex.: CRN-3 12345',
      });
    }

    const nutri = await buscarNutricionistaPorCrn(crn);

    if (!nutri) {
      return responderErro(res, 404, 'Nutricionista não encontrado');
    }

    return res.json({
      nutricionista: {
        id: String(nutri._id),
        nome: nutri.nome,
        crn: nutri.crn,
        tratamento: nutri.tratamento || null,
      },
    });
  } catch (err) {
    console.error('Erro ao consultar CRN de nutricionista:', err);
    return responderErro(res, 500, 'Erro ao consultar nutricionista.');
  }
  }
);

// ============================================================================
// ROTAS DE PERFIL, RESTRIÇÕES E VÍNCULO DO PACIENTE (JWT)
// ============================================================================

app.get('/users/perfil', autenticarJWT, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return responderErro(res, 404, 'Usuário não encontrado.');
    }

    const [stats, vinculo] = await Promise.all([
      calcularStatsUsuario(user._id),
      obterVinculoPaciente(user),
    ]);
    const publicUser = user.toPublic();

    return res.json({
      ...publicUser,
      vinculo,
      usuario: {
        ...publicUser,
        vinculo,
      },
      stats,
    });
  } catch (err) {
    console.error('Erro em GET /users/perfil:', err);
    return responderErro(res, 500, 'Erro ao carregar perfil do usuário.');
  }
});

app.post(
  '/api/vinculacoes/solicitar',
  autenticarJWT,
  exigirPaciente,
  limiterSolicitacao,
  async (req, res) => {
  try {
    const { crn } = req.body || {};
    if (!parseCrn(crn)) {
      return responderErro(res, 400, 'CRN inválido. Ex.: CRN-3 12345', {
        crn: 'CRN inválido. Ex.: CRN-3 12345',
      });
    }

    const nutri = await buscarNutricionistaPorCrn(crn);
    if (!nutri) {
      return responderErro(res, 404, 'Nutricionista não encontrado');
    }

    const user = await User.findById(req.userId);
    if (!user) {
      return responderErro(res, 404, 'Usuário não encontrado.');
    }
    if (user.role !== 'PACIENTE') {
      return responderErro(res, 403, 'Acesso restrito a pacientes.');
    }
    const nutricionistaAtual = user.nutricionistaId
      ? await Nutricionista.exists({ _id: user.nutricionistaId })
      : null;
    if (nutricionistaAtual) {
      return responderErro(
        res,
        409,
        'Você já está vinculado a um nutricionista. Desvincule antes de solicitar outro.'
      );
    }
    if (
      await SolicitacaoVinculo.exists({
        pacienteId: user._id,
        status: 'PENDENTE',
      })
    ) {
      return responderErro(
        res,
        409,
        'Você já tem uma solicitação pendente. Cancele-a para solicitar outro profissional.'
      );
    }

    const agora = new Date();
    const nutricionistaLegadoId = user.nutricionistaId || null;
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        await SolicitacaoVinculo.create(
          [{
            pacienteId: user._id,
            nutricionistaId: nutri._id,
            status: 'PENDENTE',
          }],
          { session }
        );
        const resultadoAtualizacao = await User.updateOne(
          { _id: user._id, nutricionistaId: nutricionistaLegadoId },
          {
            $set: { consentimentoVinculoEm: agora },
            ...(nutricionistaLegadoId
              ? { $unset: { nutricionistaId: '', vinculadoEm: '' } }
              : {}),
          },
          { session }
        );
        if (resultadoAtualizacao.matchedCount !== 1) {
          const erro = new Error('O vínculo do paciente foi alterado.');
          erro.code = 'VINCULO_ATUALIZADO';
          throw erro;
        }
      });
    } finally {
      await session.endSession();
    }

    const usuarioAtualizado = await User.findById(user._id);
    return res.status(201).json({
      sucesso: true,
      mensagem: 'Solicitação enviada. Aguarde a aprovação do nutricionista.',
      vinculo: await obterVinculoPaciente(usuarioAtualizado),
    });
  } catch (err) {
    if (err?.code === 11000) {
      return responderErro(
        res,
        409,
        'Você já tem uma solicitação pendente. Cancele-a para solicitar outro profissional.'
      );
    }
    if (err?.code === 'VINCULO_ATUALIZADO') {
      return responderErro(
        res,
        409,
        'O estado do seu vínculo foi alterado. Atualize o perfil e tente novamente.'
      );
    }
    console.error('Erro ao criar solicitação de vínculo:', err);
    return responderErro(res, 500, 'Erro ao solicitar vínculo.');
  }
  }
);

app.get(
  '/api/vinculacoes/minha-solicitacao',
  autenticarJWT,
  exigirPaciente,
  async (req, res) => {
    try {
      const user = await User.findById(req.userId);
      if (!user) return responderErro(res, 404, 'Usuário não encontrado.');
      return res.json({ vinculo: await obterVinculoPaciente(user) });
    } catch (err) {
      console.error('Erro ao consultar solicitação de vínculo:', err);
      return responderErro(res, 500, 'Erro ao consultar solicitação.');
    }
  }
);

app.delete(
  '/api/vinculacoes/minha-solicitacao',
  autenticarJWT,
  exigirPaciente,
  async (req, res) => {
    try {
      const solicitacao = await SolicitacaoVinculo.findOneAndUpdate(
        { pacienteId: req.userId, status: 'PENDENTE' },
        {
          $set: {
            status: 'RECUSADO',
            encerradaEm: new Date(),
            encerradaPor: 'PACIENTE',
          },
        },
        { new: true }
      );
      if (!solicitacao) {
        return responderErro(res, 404, 'Não há solicitação pendente para cancelar.');
      }

      const user = await User.findById(req.userId);
      return res.json({
        sucesso: true,
        mensagem: 'Solicitação cancelada.',
        vinculo: user ? await obterVinculoPaciente(user) : vinculoVazio(),
      });
    } catch (err) {
      console.error('Erro ao cancelar solicitação de vínculo:', err);
      return responderErro(res, 500, 'Erro ao cancelar solicitação.');
    }
  }
);

app.delete(
  '/users/vinculo',
  autenticarJWT,
  exigirPaciente,
  async (req, res) => {
    const session = await mongoose.startSession();
    try {
      let resultado = 'ok';
      await session.withTransaction(async () => {
        const user = await User.findById(req.userId).session(session);
        if (!user) {
          resultado = 'usuario-inexistente';
          return;
        }
        if (!user.nutricionistaId) {
          resultado = 'sem-vinculo';
          return;
        }

        const nutricionistaId = user.nutricionistaId;
        const agora = new Date();
        await User.updateOne(
          { _id: user._id, nutricionistaId },
          { $unset: { nutricionistaId: '', vinculadoEm: '' } },
          { session }
        );
        await SolicitacaoVinculo.updateOne(
          {
            pacienteId: user._id,
            nutricionistaId,
            status: 'APROVADO',
            encerradaEm: null,
          },
          {
            $set: {
              encerradaEm: agora,
              encerradaPor: 'PACIENTE',
            },
          },
          { session }
        );
      });

      if (resultado === 'usuario-inexistente') {
        return responderErro(res, 404, 'Usuário não encontrado.');
      }
      if (resultado === 'sem-vinculo') {
        return responderErro(res, 404, 'Você não tem vínculo ativo.');
      }

      const user = await User.findById(req.userId);
      return res.json({
        sucesso: true,
        mensagem: 'Vínculo removido com sucesso.',
        vinculo: user ? await obterVinculoPaciente(user) : vinculoVazio(),
      });
    } catch (err) {
      console.error('Erro ao desvincular nutricionista:', err);
      return responderErro(res, 500, 'Erro ao desvincular nutricionista.');
    } finally {
      await session.endSession();
    }
  }
);

app.put('/users/restricoes', autenticarJWT, async (req, res) => {
  try {
    const { restricoes, niveisSensibilidade } = req.body || {};
    const validacao = validarRestricoesENiveis(
      restricoes,
      niveisSensibilidade,
      true
    );
    if (validacao.erro) {
      return responderErro(res, 400, validacao.erro);
    }

    const atualizado = await User.findByIdAndUpdate(
      req.userId,
      {
        $set: {
          restricoes: validacao.restricoes,
          niveisSensibilidade: validacao.niveisSensibilidade,
          restricoesAtualizadasEm: new Date(),
          restricoesAtualizadasPor: 'PACIENTE',
        },
      },
      { returnDocument: 'after' }
    );

    if (!atualizado) {
      return responderErro(res, 404, 'Usuário não encontrado.');
    }

    const publicUser = atualizado.toPublic();
    return res.json({
      sucesso: true,
      mensagem: 'Intolerâncias e níveis atualizados com sucesso!',
      ...publicUser,
      usuario: publicUser,
    });
  } catch (err) {
    console.error('Erro em PUT /users/restricoes:', err);
    return responderErro(res, 500, 'Erro ao atualizar intolerâncias.');
  }
});

async function handlerAtualizarPerfil(req, res) {
  try {
    const userId = req.userId || req.body?.id;
    if (!userId) {
      return responderErro(res, 401, 'Não autenticado.');
    }

    const user = await User.findById(userId).select('+senha');
    if (!user) {
      return responderErro(res, 404, 'Usuário não encontrado.');
    }

    const {
      nome,
      email,
      avatar,
      senhaAtual,
      novaSenha,
      senha,
      restricoes,
      niveisSensibilidade,
    } = req.body || {};

    if (nome !== undefined) {
      const nomeLimpo = String(nome).trim();
      if (!nomeLimpo) {
        return responderErro(res, 400, 'O nome não pode ficar vazio.', {
          nome: 'O nome não pode ficar vazio.',
        });
      }
      if (nomeLimpo.length > 100) {
        return responderErro(res, 400, 'O nome deve ter no máximo 100 caracteres.', {
          nome: 'Máximo de 100 caracteres.',
        });
      }
      user.nome = nomeLimpo;
    }

    if (email !== undefined) {
      const emailNorm = String(email).trim().toLowerCase();
      if (!emailValido(emailNorm)) {
        return responderErro(res, 400, 'Informe um e-mail válido.', {
          email: 'Informe um e-mail válido.',
        });
      }
      if (emailNorm !== user.email) {
        const duplicado = await User.findOne({
          email: emailNorm,
          _id: { $ne: user._id },
        });
        if (duplicado) {
          return responderErro(
            res,
            409,
            'Este e-mail já está em uso por outra conta.',
            { email: 'Este e-mail já está em uso por outra conta.' }
          );
        }
        user.email = emailNorm;
      }
    }

    if (avatar !== undefined) {
      user.avatar = avatar;
    }

    const senhaNovaCandidata =
      novaSenha || (senha && String(senha).trim() ? String(senha).trim() : null);
    if (senhaNovaCandidata) {
      if (senhaNovaCandidata.length < 6) {
        return responderErro(
          res,
          400,
          'A nova senha deve ter pelo menos 6 caracteres.',
          { novaSenha: 'A nova senha deve ter pelo menos 6 caracteres.' }
        );
      }
      if (!senhaAtual) {
        return responderErro(
          res,
          400,
          'Informe a senha atual para alterar a senha.',
          { senhaAtual: 'Informe a senha atual.' }
        );
      }
      const ehBcrypt = /^\$2[aby]\$/.test(user.senha || '');
      const confere = ehBcrypt
        ? await bcrypt.compare(senhaAtual, user.senha)
        : senhaAtual === user.senha;

      if (!confere) {
        return responderErro(res, 400, 'A senha atual está incorreta.', {
          senhaAtual: 'A senha atual está incorreta.',
        });
      }
      user.senha = await bcrypt.hash(senhaNovaCandidata, 10);
    }

    if (Array.isArray(restricoes)) {
      const validacao = validarRestricoesENiveis(
        restricoes,
        niveisSensibilidade || user.niveisSensibilidade,
        true
      );
      if (validacao.erro) {
        return responderErro(res, 400, validacao.erro);
      }
      user.restricoes = validacao.restricoes;
      user.niveisSensibilidade = validacao.niveisSensibilidade;
      user.restricoesAtualizadasEm = new Date();
      user.restricoesAtualizadasPor = 'PACIENTE';
    }

    await user.save();
    const publicUser = user.toPublic();
    const vinculo = await obterVinculoPaciente(user);

    return res.json({
      sucesso: true,
      mensagem: 'Perfil atualizado com sucesso!',
      ...publicUser,
      vinculo,
      usuario: {
        ...publicUser,
        vinculo,
      },
    });
  } catch (err) {
    console.error('Erro em PUT /users/perfil:', err);
    return responderErro(res, 500, 'Erro interno ao atualizar perfil.');
  }
}

app.put('/users/perfil', autenticarJWT, handlerAtualizarPerfil);
app.put('/api/usuario/atualizar', autenticarJWT, handlerAtualizarPerfil);

app.post(
  '/users/avatar',
  autenticarJWT,
  (req, res, next) => {
    upload.single('avatar')(req, res, (err) => {
      if (err) {
        return responderErro(
          res,
          400,
          err.message || 'Erro no envio do avatar.'
        );
      }
      return next();
    });
  },
  async (req, res) => {
    const caminhoTemp = req.file?.path;
    try {
      const user = await User.findById(req.userId);
      if (!user) {
        return responderErro(res, 404, 'Usuário não encontrado.');
      }

      if (caminhoTemp) {
        const bufferCompactado = await sharp(caminhoTemp)
          .rotate()
          .resize(240, 240, { fit: 'cover' })
          .jpeg({ quality: 80 })
          .toBuffer();

        user.avatar = `data:image/jpeg;base64,${bufferCompactado.toString('base64')}`;
      } else if (req.body?.avatar !== undefined) {
        user.avatar = req.body.avatar;
      } else {
        return responderErro(
          res,
          400,
          'Nenhuma imagem de avatar foi enviada.'
        );
      }

      await user.save();
      const publicUser = user.toPublic();
      return res.json({
        sucesso: true,
        mensagem: 'Foto de perfil atualizada com sucesso!',
        avatar: user.avatar,
        ...publicUser,
        usuario: publicUser,
      });
    } catch (err) {
      console.error('Erro em POST /users/avatar:', err);
      return responderErro(res, 500, 'Erro ao atualizar a foto de perfil.');
    } finally {
      try {
        if (caminhoTemp && fs.existsSync(caminhoTemp)) {
          await fs.promises.unlink(caminhoTemp);
        }
      } catch {
        // ignora erro de limpeza do temporário
      }
    }
  }
);

app.delete('/users/me', autenticarJWT, async (req, res) => {
  try {
    const userId = String(req.userId);
    const user = await User.findById(userId);
    if (!user) {
      return responderErro(res, 404, 'Usuário não encontrado.');
    }

    if (user.role === 'NUTRICIONISTA') {
      // Nutricionista: NÃO apaga pacientes; apenas limpa o vínculo deles
      await User.updateMany(
        { nutricionistaId: user._id },
        {
          $set: {
            nutricionistaId: null,
            vinculadoEm: null,
            consentimentoVinculoEm: null,
          },
        }
      );
      await Feedback.deleteMany({ userId: user._id });
      await HelpQuestion.deleteMany({ userId: user._id });
      await ScanLog.deleteMany({ userId: user._id });
      await User.findByIdAndDelete(user._id);

      return res.json({
        sucesso: true,
        mensagem:
          'Sua conta de nutricionista foi excluída e os pacientes foram desvinculados com segurança.',
      });
    }

    // Paciente: apaga ScanLogs, Feedbacks, HelpQuestions e a pasta de imagens dele
    await Promise.all([
      ScanLog.deleteMany({ userId: user._id }),
      Feedback.deleteMany({ userId: user._id }),
      HelpQuestion.deleteMany({ userId: user._id }),
    ]);

    const pastaScansUsuario = path.join(SCANS_UPLOADS_DIR, userId);
    if (fs.existsSync(pastaScansUsuario)) {
      await fs.promises.rm(pastaScansUsuario, { recursive: true, force: true });
    }

    await User.findByIdAndDelete(user._id);

    return res.json({
      sucesso: true,
      mensagem:
        'Sua conta, feedbacks e todo o histórico foram excluídos permanentemente.',
    });
  } catch (err) {
    console.error('Erro em DELETE /users/me:', err);
    return responderErro(res, 500, 'Erro ao excluir a conta.');
  }
});

// ============================================================================
// ROTAS DO PAINEL DO NUTRICIONISTA (/nutri/*)
// ============================================================================

async function obterPacienteVinculado(req, res) {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    responderErro(res, 400, 'Identificador inválido');
    return null;
  }

  const paciente = await User.findById(id);
  if (!paciente || paciente.role !== 'PACIENTE') {
    responderErro(res, 404, 'Paciente não encontrado.');
    return null;
  }

  if (
    !paciente.nutricionistaId ||
    String(paciente.nutricionistaId) !== String(req.userId)
  ) {
    responderErro(
      res,
      403,
      'Acesso negado: este paciente não está vinculado a você.'
    );
    return null;
  }

  return paciente;
}

app.get('/nutri/perfil', autenticarJWT, exigirNutricionista, async (req, res) => {
  try {
    const nutri = req.nutricionista;
    const totalPacientes = await User.countDocuments({
      nutricionistaId: nutri._id,
      role: 'PACIENTE',
    });

    const pub = nutri.toPublic();
    return res.json({
      ...pub,
      totalPacientes,
      usuario: pub,
    });
  } catch (err) {
    console.error('Erro em GET /nutri/perfil:', err);
    return responderErro(res, 500, 'Erro ao carregar perfil do nutricionista.');
  }
});

app.get(
  '/nutri/pacientes',
  autenticarJWT,
  exigirNutricionista,
  async (req, res) => {
    try {
      const pacientes = await User.find({
        nutricionistaId: req.userId,
        role: 'PACIENTE',
      })
        .sort({ vinculadoEm: -1, createdAt: -1 })
        .lean();

      const lista = await Promise.all(
        pacientes.map(async (p) => {
          const filtroVisibilidade = { userId: p._id };
          if (FILTRAR_HISTORICO_DESDE_VINCULO && p.vinculadoEm) {
            filtroVisibilidade.createdAt = { $gte: new Date(p.vinculadoEm) };
          }

          const [ultimoLog, contagemRiscos, totalScansVisiveis] =
            await Promise.all([
              ScanLog.findOne(filtroVisibilidade)
                .select('-textoBruto -ingredientesDetalhados')
                .sort({ createdAt: -1 })
                .lean(),
              ScanLog.countDocuments({
                ...filtroVisibilidade,
                veredito: 'PERIGOSO',
              }),
              ScanLog.countDocuments(filtroVisibilidade),
            ]);

          const niveis = p.niveisSensibilidade || {};
          return {
            id: String(p._id),
            nome: p.nome,
            email: p.email,
            avatar: p.avatar || null,
            restricoes: p.restricoes || [],
            niveisSensibilidade: {
              gluten: niveis.gluten ?? 1,
              lactose: niveis.lactose ?? 1,
              amendoim: niveis.amendoim ?? 1,
            },
            vinculadoEm: p.vinculadoEm || null,
            restricoesAtualizadasEm: p.restricoesAtualizadasEm || null,
            restricoesAtualizadasPor: p.restricoesAtualizadasPor || null,
            ultimoScan: ultimoLog ? formatarItemHistorico(ultimoLog, false) : null,
            contagemRiscos,
            totalScans: totalScansVisiveis,
          };
        })
      );

      return res.json({
        pacientes: lista,
        total: lista.length,
      });
    } catch (err) {
      console.error('Erro em GET /nutri/pacientes:', err);
      return responderErro(res, 500, 'Erro ao listar pacientes vinculados.');
    }
  }
);

app.get(
  '/nutri/pacientes/:id',
  autenticarJWT,
  exigirNutricionista,
  async (req, res) => {
    try {
      const paciente = await obterPacienteVinculado(req, res);
      if (!paciente) return;

      const desde =
        FILTRAR_HISTORICO_DESDE_VINCULO && paciente.vinculadoEm
          ? paciente.vinculadoEm
          : null;
      const stats = await calcularStatsUsuario(paciente._id, desde);
      const pub = paciente.toPublic();

      return res.json({
        ...pub,
        paciente: pub,
        stats,
      });
    } catch (err) {
      console.error('Erro em GET /nutri/pacientes/:id:', err);
      return responderErro(res, 500, 'Erro ao carregar dados do paciente.');
    }
  }
);

app.get(
  '/nutri/pacientes/:id/historico',
  autenticarJWT,
  exigirNutricionista,
  async (req, res) => {
    try {
      const paciente = await obterPacienteVinculado(req, res);
      if (!paciente) return;

      const {
        filtro = 'Todos',
        busca = '',
        curtido,
        limit = '30',
        page = '1',
      } = req.query;

      const query = { userId: paciente._id };
      if (FILTRAR_HISTORICO_DESDE_VINCULO && paciente.vinculadoEm) {
        query.createdAt = { $gte: new Date(paciente.vinculadoEm) };
      }

      const filtroNorm = String(filtro).toLowerCase();
      if (filtroNorm === 'risco' || filtroNorm === 'perigoso') {
        query.veredito = 'PERIGOSO';
      } else if (filtroNorm === 'seguro') {
        query.veredito = 'SEGURO';
      }

      if (String(curtido).toLowerCase() === 'true') {
        query.curtido = true;
      }

      const buscaTexto = String(busca || '');
      const buscaNorm = normalizar(buscaTexto);
      if (buscaNorm) {
        const rx = new RegExp(regexInsensivelAcentos(buscaTexto), 'i');
        query.$or = [
          { nomeProduto: rx },
          { marca: rx },
        ];
      }

      const limiteNum = Math.min(
        Math.max(parseInt(String(limit), 10) || 30, 1),
        100
      );
      const paginaNum = Math.max(parseInt(String(page), 10) || 1, 1);
      const skip = (paginaNum - 1) * limiteNum;

      const [docs, total] = await Promise.all([
        ScanLog.find(query)
          .select('-textoBruto -ingredientesDetalhados')
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limiteNum)
          .lean(),
        ScanLog.countDocuments(query),
      ]);

      const itens = docs.map((d) => {
        const item = formatarItemHistorico(d, false);
        if (item.imagemUrl) {
          item.imagemUrl = `/nutri/pacientes/${paciente._id}/historico/${item.id}/imagem`;
        }
        return item;
      });
      const temMais = skip + itens.length < total;

      return res.json({
        itens,
        total,
        pagina: paginaNum,
        temMais,
      });
    } catch (err) {
      console.error('Erro em GET /nutri/pacientes/:id/historico:', err);
      return responderErro(
        res,
        500,
        'Erro ao carregar histórico do paciente.'
      );
    }
  }
);

app.get(
  '/nutri/pacientes/:id/historico/:logId/imagem',
  autenticarJWT,
  exigirNutricionista,
  async (req, res) => {
    try {
      const paciente = await obterPacienteVinculado(req, res);
      if (!paciente) return;

      const { logId } = req.params;
      if (!mongoose.Types.ObjectId.isValid(logId)) {
        return responderErro(res, 400, 'Identificador inválido');
      }

      const log = await ScanLog.findOne({
        _id: logId,
        userId: paciente._id,
      })
        .select('userId imagemArquivo imagemUri createdAt +imagemThumb')
        .lean();

      if (!log) {
        return responderErro(res, 404, 'Registro não encontrado.');
      }

      if (
        FILTRAR_HISTORICO_DESDE_VINCULO &&
        paciente.vinculadoEm &&
        new Date(log.createdAt) < new Date(paciente.vinculadoEm)
      ) {
        return responderErro(
          res,
          403,
          'Acesso negado: este escaneamento é anterior ao vínculo com o paciente.'
        );
      }

      if (log.imagemThumb?.startsWith('data:image/jpeg;base64,')) {
        const base64 = log.imagemThumb.slice('data:image/jpeg;base64,'.length);
        res.setHeader('Cache-Control', 'private, max-age=86400');
        res.setHeader('Content-Type', 'image/jpeg');
        return res.send(Buffer.from(base64, 'base64'));
      }

      if (log.imagemArquivo) {
        const caminhoAbsoluto = path.resolve(UPLOADS_DIR, log.imagemArquivo);
        const baseUploadsResolvida = path.resolve(UPLOADS_DIR);
        if (
          caminhoAbsoluto.startsWith(baseUploadsResolvida) &&
          fs.existsSync(caminhoAbsoluto)
        ) {
          res.setHeader('Cache-Control', 'private, max-age=86400');
          res.setHeader('Content-Type', 'image/jpeg');
          return res.sendFile(caminhoAbsoluto);
        }
      }

      if (log.imagemUri && log.imagemUri.startsWith('data:image/')) {
        const partes = log.imagemUri.split(',');
        if (partes.length === 2) {
          const buffer = Buffer.from(partes[1], 'base64');
          res.setHeader('Cache-Control', 'private, max-age=86400');
          res.setHeader('Content-Type', 'image/jpeg');
          return res.send(buffer);
        }
      }

      return responderErro(
        res,
        404,
        'Este escaneamento não possui miniatura salva.'
      );
    } catch (err) {
      console.error(
        'Erro em GET /nutri/pacientes/:id/historico/:logId/imagem:',
        err
      );
      return responderErro(res, 500, 'Erro ao carregar imagem do paciente.');
    }
  }
);

app.put(
  '/nutri/pacientes/:id/restricoes',
  autenticarJWT,
  exigirNutricionista,
  async (req, res) => {
    try {
      const paciente = await obterPacienteVinculado(req, res);
      if (!paciente) return;

      const { restricoes, niveisSensibilidade } = req.body || {};
      const validacao = validarRestricoesENiveis(
        restricoes,
        niveisSensibilidade,
        true
      );
      if (validacao.erro) {
        return responderErro(res, 400, validacao.erro);
      }

      paciente.restricoes = validacao.restricoes;
      paciente.niveisSensibilidade = validacao.niveisSensibilidade;
      paciente.restricoesAtualizadasPor = 'NUTRICIONISTA';
      paciente.restricoesAtualizadasEm = new Date();
      await paciente.save();

      const pub = paciente.toPublic();
      return res.json({
        sucesso: true,
        mensagem: 'Restrições do paciente atualizadas pelo nutricionista.',
        ...pub,
        paciente: pub,
      });
    } catch (err) {
      console.error('Erro em PUT /nutri/pacientes/:id/restricoes:', err);
      return responderErro(
        res,
        500,
        'Erro ao atualizar restrições do paciente.'
      );
    }
  }
);

app.delete(
  '/nutri/pacientes/:id/vinculo',
  autenticarJWT,
  exigirNutricionista,
  async (req, res) => {
    try {
      const paciente = await obterPacienteVinculado(req, res);
      if (!paciente) return;

      paciente.nutricionistaId = null;
      paciente.vinculadoEm = null;
      paciente.consentimentoVinculoEm = null;
      await paciente.save();

      return res.json({
        sucesso: true,
        mensagem: 'Paciente desvinculado com sucesso.',
      });
    } catch (err) {
      console.error('Erro em DELETE /nutri/pacientes/:id/vinculo:', err);
      return responderErro(res, 500, 'Erro ao desvincular paciente.');
    }
  }
);

// ============================================================================
// ROTAS DE HISTÓRICO E CURTIDOS DO PACIENTE (JWT)
// ============================================================================

app.get('/users/historico', autenticarJWT, async (req, res) => {
  try {
    const {
      filtro = 'Todos',
      busca = '',
      curtido,
      ordem = 'recentes',
      limit = '30',
      page = '1',
    } = req.query;

    const userIdObj = mongoose.Types.ObjectId.isValid(req.userId)
      ? new mongoose.Types.ObjectId(String(req.userId))
      : req.userId;

    const filtroUserId = mongoose.Types.ObjectId.isValid(req.userId)
      ? { $in: [userIdObj, String(req.userId)] }
      : req.userId;

    const query = { userId: filtroUserId };

    const filtroNorm = String(filtro).toLowerCase();
    if (filtroNorm === 'risco' || filtroNorm === 'perigoso') {
      query.veredito = 'PERIGOSO';
    } else if (filtroNorm === 'seguro') {
      query.veredito = 'SEGURO';
    }

    if (String(curtido).toLowerCase() === 'true') {
      query.curtido = true;
    }

    const buscaTexto = String(busca || '');
    const buscaNorm = normalizar(buscaTexto);
    if (buscaNorm) {
      const rx = new RegExp(regexInsensivelAcentos(buscaTexto), 'i');
      query.$or = [
        { nomeProduto: rx },
        { marca: rx },
      ];
    }

    const limiteNum = Math.min(
      Math.max(parseInt(String(limit), 10) || 30, 1),
      100
    );
    const paginaNum = Math.max(parseInt(String(page), 10) || 1, 1);
    const skip = (paginaNum - 1) * limiteNum;

    const sortSpec =
      String(ordem).toLowerCase() === 'nome' ||
      String(ordem).toLowerCase() === 'az'
        ? { nomeProduto: 1, createdAt: -1 }
        : { createdAt: -1 };

    const [docs, total, totalTodos, totalRisco, totalSeguro] =
      await Promise.all([
        ScanLog.find(query)
          .select('-textoBruto -ingredientesDetalhados')
          .sort(sortSpec)
          .skip(skip)
          .limit(limiteNum)
          .lean(),
        ScanLog.countDocuments(query),
        ScanLog.countDocuments({ userId: filtroUserId }),
        ScanLog.countDocuments({ userId: filtroUserId, veredito: 'PERIGOSO' }),
        ScanLog.countDocuments({ userId: filtroUserId, veredito: 'SEGURO' }),
      ]);

    const itens = docs.map((d) => formatarItemHistorico(d, false));
    const temMais = skip + itens.length < total;

    return res.json({
      itens,
      total,
      pagina: paginaNum,
      temMais,
      contagens: {
        todos: totalTodos,
        risco: totalRisco,
        seguro: totalSeguro,
      },
    });
  } catch (err) {
    console.error('Erro em GET /users/historico:', err);
    return responderErro(
      res,
      500,
      'Erro ao carregar histórico de escaneamentos.'
    );
  }
});

app.get('/users/historico/:id', autenticarJWT, async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return responderErro(res, 400, 'Identificador inválido');
    }

    const log = await ScanLog.findById(id).lean();
    if (!log) {
      return responderErro(res, 404, 'Registro não encontrado.');
    }

    if (String(log.userId) !== String(req.userId)) {
      return responderErro(res, 403, 'Acesso negado a este registro.');
    }

    return res.json(formatarItemHistorico(log, true));
  } catch (err) {
    console.error('Erro em GET /users/historico/:id:', err);
    return responderErro(
      res,
      500,
      'Erro ao carregar detalhes do escaneamento.'
    );
  }
});

app.get('/users/historico/:id/imagem', autenticarJWT, async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return responderErro(res, 400, 'Identificador inválido');
    }

    const log = await ScanLog.findById(id)
      .select('userId imagemArquivo imagemUri +imagemThumb')
      .lean();
    if (!log) {
      return responderErro(res, 404, 'Registro não encontrado.');
    }

    if (String(log.userId) !== String(req.userId)) {
      return responderErro(res, 403, 'Acesso negado a esta imagem.');
    }

    if (log.imagemThumb?.startsWith('data:image/jpeg;base64,')) {
      const base64 = log.imagemThumb.slice('data:image/jpeg;base64,'.length);
      res.setHeader('Cache-Control', 'private, max-age=86400');
      res.setHeader('Content-Type', 'image/jpeg');
      return res.send(Buffer.from(base64, 'base64'));
    }

    if (log.imagemArquivo) {
      const caminhoAbsoluto = path.resolve(UPLOADS_DIR, log.imagemArquivo);
      const baseUploadsResolvida = path.resolve(UPLOADS_DIR);
      if (
        caminhoAbsoluto.startsWith(baseUploadsResolvida) &&
        fs.existsSync(caminhoAbsoluto)
      ) {
        res.setHeader('Cache-Control', 'private, max-age=86400');
        res.setHeader('Content-Type', 'image/jpeg');
        return res.sendFile(caminhoAbsoluto);
      }
    }

    if (log.imagemUri && log.imagemUri.startsWith('data:image/')) {
      const partes = log.imagemUri.split(',');
      if (partes.length === 2) {
        const buffer = Buffer.from(partes[1], 'base64');
        res.setHeader('Cache-Control', 'private, max-age=86400');
        res.setHeader('Content-Type', 'image/jpeg');
        return res.send(buffer);
      }
    }

    return responderErro(
      res,
      404,
      'Este escaneamento não possui miniatura salva.'
    );
  } catch (err) {
    console.error('Erro em GET /users/historico/:id/imagem:', err);
    return responderErro(res, 500, 'Erro ao carregar imagem.');
  }
});

async function handlerAtualizarScanMeta(req, res) {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return responderErro(res, 400, 'Identificador inválido');
    }

    const body = req.body || {};
    const temNome = body.nomeProduto !== undefined;
    const temMarca = body.marca !== undefined;
    const temPeso = body.peso !== undefined;
    const temMarcaPesoLegado = body.marcaPeso !== undefined;

    if (!temNome && !temMarca && !temPeso && !temMarcaPesoLegado) {
      return responderErro(
        res,
        400,
        'Informe ao menos um campo para atualizar (nomeProduto, marca ou peso).'
      );
    }

    const log = await ScanLog.findById(id);
    if (!log) {
      return responderErro(res, 404, 'Registro não encontrado.');
    }
    if (String(log.userId) !== String(req.userId)) {
      return responderErro(res, 403, 'Acesso negado a este registro.');
    }

    if (temNome) {
      const limpo = String(body.nomeProduto ?? '').trim();
      if (!limpo) {
        return responderErro(
          res,
          400,
          'O nome do produto não pode ficar vazio.',
          { nomeProduto: 'O nome do produto não pode ficar vazio.' }
        );
      }
      if (limpo.length > 80) {
        return responderErro(
          res,
          400,
          'O nome do produto deve ter no máximo 80 caracteres.',
          { nomeProduto: 'Máximo de 80 caracteres.' }
        );
      }
      log.nomeProduto = limpo;
      log.nomeAutomatico = false;
      log.nomeBusca = normalizar(limpo);
    }

    if (temMarca) {
      const marcaLimpa = body.marca ? String(body.marca).trim() : '';
      if (marcaLimpa.length > 60) {
        return responderErro(
          res,
          400,
          'A marca deve ter no máximo 60 caracteres.',
          { marca: 'Máximo de 60 caracteres.' }
        );
      }
      log.marca = marcaLimpa;
    }

    if (temPeso) {
      const pesoLimpo = body.peso ? String(body.peso).trim() : '';
      if (pesoLimpo.length > 30) {
        return responderErro(
          res,
          400,
          'O peso deve ter no máximo 30 caracteres.',
          { peso: 'Máximo de 30 caracteres.' }
        );
      }
      log.peso = pesoLimpo;
    }

    // Compatibilidade caso um cliente antigo envie apenas `marcaPeso`
    if (!temMarca && !temPeso && temMarcaPesoLegado) {
      const mpRaw = body.marcaPeso ? String(body.marcaPeso).trim() : '';
      if (mpRaw.includes('•')) {
        const [mParte, ...pResto] = mpRaw.split('•');
        const mLimpa = mParte.trim().slice(0, 60);
        const pLimpa = pResto.join('•').trim().slice(0, 30);
        log.marca = mLimpa;
        log.peso = pLimpa;
      } else {
        if (mpRaw.length > 60) {
          return responderErro(
            res,
            400,
            'A marca deve ter no máximo 60 caracteres.',
            { marca: 'Máximo de 60 caracteres.' }
          );
        }
        log.marca = mpRaw;
        log.peso = '';
      }
    }

    log.marcaPeso = montarMarcaPeso(log.marca, log.peso);

    await log.save();
    const itemFormatado = formatarItemHistorico(log, true);
    return res.json({
      sucesso: true,
      mensagem: 'Informações do produto atualizadas com sucesso!',
      ...itemFormatado,
      item: itemFormatado,
    });
  } catch (err) {
    console.error('Erro ao atualizar metadados do scan:', err);
    return responderErro(
      res,
      500,
      'Erro ao atualizar informações do produto.'
    );
  }
}

app.patch('/users/historico/:id', autenticarJWT, handlerAtualizarScanMeta);
app.patch('/scanner/:id', autenticarJWT, handlerAtualizarScanMeta);

app.patch('/users/historico/:id/curtir', autenticarJWT, async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return responderErro(res, 400, 'Identificador inválido');
    }

    const log = await ScanLog.findById(id);
    if (!log) {
      return responderErro(res, 404, 'Registro não encontrado.');
    }
    if (String(log.userId) !== String(req.userId)) {
      return responderErro(res, 403, 'Acesso negado a este registro.');
    }

    if (typeof req.body?.curtido === 'boolean') {
      log.curtido = req.body.curtido;
    } else {
      log.curtido = !log.curtido;
    }

    await log.save();
    const itemFormatado = formatarItemHistorico(log, true);
    return res.json({
      sucesso: true,
      curtido: log.curtido,
      ...itemFormatado,
      item: itemFormatado,
    });
  } catch (err) {
    console.error('Erro em PATCH /users/historico/:id/curtir:', err);
    return responderErro(res, 500, 'Erro ao atualizar favorito.');
  }
});

// ============================================================================
// ROTAS DE FEEDBACK (Model Feedback — coleção `feedbacks`) E AJUDA
// ============================================================================

app.post('/feedback', autenticarJWT, async (req, res) => {
  try {
    const { mensagem } = req.body || {};

    const msgLimpa = typeof mensagem === 'string' ? mensagem.trim() : '';
    if (!msgLimpa || msgLimpa.length < 3) {
      return responderErro(
        res,
        400,
        'A mensagem deve ter pelo menos 3 caracteres.',
        { mensagem: 'A mensagem deve ter entre 3 e 1000 caracteres.' }
      );
    }
    if (msgLimpa.length > 1000) {
      return responderErro(
        res,
        400,
        'A mensagem deve ter no máximo 1000 caracteres.',
        { mensagem: 'Máximo de 1000 caracteres.' }
      );
    }

    // Limite de 5 feedbacks por hora por usuário
    const umaHoraAtras = new Date(Date.now() - 60 * 60 * 1000);
    const enviadosUltimaHora = await Feedback.countDocuments({
      userId: req.userId,
      createdAt: { $gte: umaHoraAtras },
    });

    if (enviadosUltimaHora >= 5) {
      return responderErro(
        res,
        429,
        'Limite de 5 feedbacks por hora atingido. Tente novamente mais tarde.'
      );
    }

    const novoFeedback = await Feedback.create({
      userId: req.userId,
      mensagem: msgLimpa,
    });

    return res.status(201).json({
      id: String(novoFeedback._id),
      mensagem: 'Feedback enviado com sucesso!',
      item: {
        id: String(novoFeedback._id),
        userId: String(novoFeedback.userId),
        mensagem: novoFeedback.mensagem,
        createdAt: novoFeedback.createdAt,
      },
    });
  } catch (err) {
    console.error('Erro em POST /feedback:', err);
    return responderErro(res, 500, 'Erro ao registrar feedback.');
  }
});

app.get('/feedback', autenticarJWT, async (req, res) => {
  try {
    const lista = await Feedback.find({ userId: req.userId })
      .sort({ createdAt: -1 })
      .limit(30)
      .lean();

    return res.json({
      itens: lista.map((f) => ({
        id: String(f._id),
        mensagem: f.mensagem,
        createdAt: f.createdAt,
      })),
    });
  } catch (err) {
    console.error('Erro em GET /feedback:', err);
    return responderErro(res, 500, 'Erro ao carregar feedbacks enviados.');
  }
});

app.get('/users/ajuda', autenticarJWT, async (req, res) => {
  try {
    const duvidas = await HelpQuestion.find({ userId: req.userId })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    const formatadas = duvidas.map((d) => ({
      id: String(d._id),
      userId: String(d.userId),
      nome: d.nome,
      email: d.email,
      pergunta: d.pergunta,
      resposta: d.resposta || null,
      status: d.status || 'PENDENTE',
      createdAt: d.createdAt,
      updatedAt: d.updatedAt,
    }));

    return res.json({
      sucesso: true,
      duvidas: formatadas,
      perguntas: formatadas,
    });
  } catch (err) {
    console.error('Erro em GET /users/ajuda:', err);
    return responderErro(res, 500, 'Erro ao carregar suas dúvidas.');
  }
});

app.post('/users/ajuda', autenticarJWT, async (req, res) => {
  try {
    const user = await User.findById(req.userId).lean();
    if (!user) {
      return responderErro(res, 404, 'Usuário não encontrado.');
    }

    const { pergunta, mensagem } = req.body || {};
    const perguntaLimpa = String(pergunta || mensagem || '').trim();

    if (!perguntaLimpa || perguntaLimpa.length < 3) {
      return responderErro(
        res,
        400,
        'Por favor, escreva sua dúvida com pelo menos 3 caracteres.',
        { pergunta: 'Mínimo de 3 caracteres.' }
      );
    }

    const novaDuvida = await HelpQuestion.create({
      userId: user._id,
      nome: user.nome || 'Usuário',
      email: user.email || '',
      pergunta: perguntaLimpa,
      resposta: null,
      status: 'PENDENTE',
    });

    const item = {
      id: String(novaDuvida._id),
      userId: String(novaDuvida.userId),
      nome: novaDuvida.nome,
      email: novaDuvida.email,
      pergunta: novaDuvida.pergunta,
      resposta: novaDuvida.resposta,
      status: novaDuvida.status,
      createdAt: novaDuvida.createdAt,
    };

    return res.status(201).json({
      sucesso: true,
      id: item.id,
      mensagem: 'Sua dúvida foi salva com sucesso!',
      duvida: item,
      item,
    });
  } catch (err) {
    console.error('Erro em POST /users/ajuda:', err);
    return responderErro(res, 500, 'Erro ao enviar sua dúvida.');
  }
});

// ============================================================================
// ROTA DO SCANNER OCR (JWT)
// ============================================================================

function logErroUploadScanner(req, rota, err) {
  const imagemBytes = Number(req.file?.size) || 'indisponível';
  console.error(
    `[SCAN] erro rota=${rota} userId=${req.userId || 'desconhecido'} veredito=ERRO imagemBytes=${imagemBytes}: ${err.message}`
  );
}

async function handlerScanner(req, res) {
  const rota = req.route?.path || req.path;
  const userIdLog = String(req.userId || 'desconhecido');
  const imagemBytes = Number(req.file?.size) || 0;
  let vereditoLog = 'PENDENTE';

  if (!req.file) {
    console.warn(
      `[SCAN] rota=${rota} userId=${userIdLog} veredito=ERRO imagemBytes=0 erro=imagem ausente`
    );
    return responderErro(
      res,
      400,
      'Nenhuma imagem foi enviada para análise.'
    );
  }

  const caminhoTemp = req.file.path;

  try {
    const user = await User.findById(req.userId);
    if (!user) {
      console.error(
        `[SCAN] erro rota=${rota} userId=${userIdLog} veredito=ERRO imagemBytes=${imagemBytes}: usuário não encontrado`
      );
      return responderErro(res, 404, 'Usuário não encontrado.');
    }

    const textoExtraido = await extrairTextoDaImagem(caminhoTemp);

    const analise = await analisarTextoRotulo({
      textoBruto: textoExtraido,
      restricoes: user.restricoes,
      niveisSensibilidade: user.niveisSensibilidade,
    });

    vereditoLog = analise.veredito || 'ERRO';
    console.info(
      `[SCAN] rota=${rota} userId=${user._id} veredito=${vereditoLog} imagemBytes=${imagemBytes}`
    );

    if (analise.veredito === 'INCONCLUSIVO') {
      return res.status(200).json({
        veredito: 'INCONCLUSIVO',
        status: 'INCONCLUSIVO',
        textoBruto: analise.textoBruto,
        mensagem:
          'Não consegui ler com segurança. Aproxime a câmera da lista de ingredientes com boa iluminação.',
      });
    }

    const logId = new mongoose.Types.ObjectId();
    let imagemThumb = null;

    try {
      const thumbBuffer = await sharp(caminhoTemp)
        .rotate()
        .resize({ width: 320, withoutEnlargement: true })
        .jpeg({ quality: 60 })
        .toBuffer();
      imagemThumb = `data:image/jpeg;base64,${thumbBuffer.toString('base64')}`;
    } catch (thumbErr) {
      console.warn(
        `[SCAN] rota=${rota} userId=${user._id} falha ao gerar imagemThumb: ${thumbErr.message}`
      );
    }

    const MAPA_ROTULO_CAT = {
      gluten: 'Glúten',
      lactose: 'Lactose',
      amendoim: 'Amendoim',
    };
    const MAPA_NIVEL_LABEL = {
      0: 'Leve',
      1: 'Moderado',
      2: 'Grave',
    };

    const alergicosDetectados = Array.isArray(analise.alergicosDetectados)
      ? analise.alergicosDetectados
      : [];
    const intoleranciasDetectadasLista = alergicosDetectados.map(
      (a) => MAPA_ROTULO_CAT[a.categoria] || a.categoria
    );

    const catReferenciaNivel =
      alergicosDetectados[0]?.categoria ||
      user.restricoes?.[0] ||
      'gluten';
    const valorNivelNumerico =
      user.niveisSensibilidade?.[catReferenciaNivel] ?? 1;
    const nivelSensibilidadeTexto =
      MAPA_NIVEL_LABEL[valorNivelNumerico] || 'Moderado';

    let novoLog;
    try {
      novoLog = await ScanLog.create({
        _id: logId,
        userId: user._id,
        escaneadoPorNome: user.nome || 'Usuário',
        nomeProduto: String(analise.nomeProduto || 'Produto analisado').slice(
          0,
          80
        ),
        nomeAutomatico: true,
        nomeBusca: analise.nomeBusca || '',
        marca: null,
        peso: null,
        marcaPeso: '',
        imagemThumb,
        imagemUri: null,
        imagemArquivo: null,
        imagemDemo: null,
        intoleranciaDetectada: intoleranciasDetectadasLista,
        nivelSensibilidade: nivelSensibilidadeTexto,
        confiancaOcr: analise.confiancaOcr ?? null,
        motorOcr: 'tesseract',
        textoBruto: analise.textoBruto,
        veredito: analise.veredito,
        alergicosDetectados,
        ingredientesDetalhados: analise.ingredientesDetalhados || [],
        curtido: false,
        seed: false,
      });
    } catch (saveErr) {
      console.error(
        `[SCAN] erro ao gravar rota=${rota} userId=${user._id} veredito=${vereditoLog} imagemBytes=${imagemBytes}: ${saveErr.name}: ${saveErr.message}`
      );
      return responderErro(
        res,
        500,
        'Não foi possível gravar o escaneamento no histórico.'
      );
    }

    console.info(
      `[SCAN] ScanLog ${novoLog._id} gravado em ${ScanLog.collection.name}`
    );

    const itemFormatado = formatarItemHistorico(novoLog, true);
    return res.status(200).json({
      ...itemFormatado,
      status: analise.veredito,
      textoExtraido: analise.textoBruto,
      detalhes: analise.alergicosDetectados.map((a) => ({
        categoria: a.categoria,
        tipo: a.tipo,
        encontrados: a.termos,
      })),
    });
  } catch (err) {
    if (err?.code === 'OCR_UNAVAILABLE') {
      console.error(
        `[SCAN] erro rota=${rota} userId=${userIdLog} veredito=${vereditoLog} imagemBytes=${imagemBytes}: OCR indisponível`
      );
      return responderErro(res, 500, 'OCR indisponível no servidor', undefined, {
        detalhe: err.detalhe,
        instrucoesWindows: err.instrucoesWindows,
      });
    }
    console.error(
      `[SCAN] erro rota=${rota} userId=${userIdLog} veredito=${vereditoLog} imagemBytes=${imagemBytes}: ${err.name}: ${err.message}`
    );
    return responderErro(
      res,
      500,
      'Falha ao processar a imagem do rótulo.'
    );
  } finally {
    try {
      if (caminhoTemp && fs.existsSync(caminhoTemp)) {
        await fs.promises.unlink(caminhoTemp);
      }
    } catch {
      // ignora erro de remoção do arquivo temporário do multer
    }
  }
}

app.post(
  '/scanner',
  autenticarJWT,
  (req, res, next) => {
    upload.single('photo')(req, res, (err) => {
      if (err) {
        logErroUploadScanner(req, '/scanner', err);
        if (err.code === 'LIMIT_FILE_SIZE') {
          return responderErro(
            res,
            400,
            'A imagem excede o limite máximo de 12MB.'
          );
        }
        return responderErro(
          res,
          400,
          err.message || 'Erro no envio da imagem.'
        );
      }
      return next();
    });
  },
  handlerScanner
);

app.post(
  '/api/analisar-rotulo',
  autenticarJWT,
  (req, res, next) => {
    upload.single('imagem')(req, res, (err) => {
      if (err) {
        logErroUploadScanner(req, '/api/analisar-rotulo', err);
        return responderErro(
          res,
          400,
          err.message || 'Erro no envio da imagem.'
        );
      }
      return next();
    });
  },
  handlerScanner
);

// ============================================================================
// HANDLER 404 EM JSON E HANDLER GLOBAL DE ERROS DO EXPRESS
// ============================================================================

app.use((req, res) => {
  return responderErro(
    res,
    404,
    `Rota não encontrada: ${req.method} ${req.originalUrl}`
  );
});

app.use((err, _req, res, _next) => {
  if (err?.type === 'entity.parse.failed') {
    return responderErro(res, 400, 'Formato JSON inválido no corpo da requisição.');
  }
  if (err?.name === 'ValidationError' && err?.errors) {
    const campos = {};
    for (const [k, v] of Object.entries(err.errors)) {
      campos[k] = v.message;
    }
    return responderErro(
      res,
      400,
      'Erro de validação nos campos enviados.',
      campos
    );
  }
  console.error('Erro não tratado no Express:', err);
  return responderErro(
    res,
    err?.status || 500,
    err?.message || 'Erro interno no servidor.'
  );
});

// ============================================================================
// SINCRONIZAÇÃO NÃO-DESTRUTIVA DE USUÁRIOS LEGADOS NA INICIALIZAÇÃO
// ============================================================================

async function sincronizarUsuariosLegados() {
  try {
    const dbRotuScanDB = mongoose.connection.db;
    const client = mongoose.connection.getClient();

    const usersAtuais = await User.find();
    for (const u of usersAtuais) {
      let mudou = false;
      const validado = validarRestricoesENiveis(
        Array.isArray(u.restricoes) ? u.restricoes : [],
        u.niveisSensibilidade,
        false
      );
      if (
        !u.niveisSensibilidade ||
        typeof u.niveisSensibilidade.gluten !== 'number' ||
        typeof u.niveisSensibilidade.lactose !== 'number' ||
        typeof u.niveisSensibilidade.amendoim !== 'number'
      ) {
        u.niveisSensibilidade = validado.niveisSensibilidade || {
          gluten: 1,
          lactose: 1,
          amendoim: 1,
        };
        mudou = true;
      }
      if (!u.role) {
        u.role = 'PACIENTE';
        mudou = true;
      }
      if (u.avatar === undefined) {
        u.avatar = null;
        mudou = true;
      }
      if (mudou) {
        await u.save();
      }
    }

    const colecoesFonte = [];
    const colsMain = await dbRotuScanDB
      .listCollections({ name: 'usuarios' })
      .toArray();
    if (colsMain.length > 0) {
      colecoesFonte.push(dbRotuScanDB.collection('usuarios'));
    }

    try {
      const dbLegado = client.db('RotuScan');
      const colsLegado = await dbLegado
        .listCollections({ name: 'usuarios' })
        .toArray();
      if (colsLegado.length > 0) {
        colecoesFonte.push(dbLegado.collection('usuarios'));
      }
    } catch {
      // Ignora se não houver acesso ao banco paralelo
    }

    let migrados = 0;
    for (const col of colecoesFonte) {
      const docs = await col.find({}).toArray();
      for (const doc of docs) {
        const emailLimpo = String(doc.email || '')
          .trim()
          .toLowerCase();
        if (!emailLimpo || !doc.senha) continue;

        const jaExiste = await User.findOne({ email: emailLimpo }).lean();
        if (jaExiste) continue;

        let senhaFinal = String(doc.senha);
        if (!/^\$2[aby]\$/.test(senhaFinal)) {
          const salt = await bcrypt.genSalt(10);
          senhaFinal = await bcrypt.hash(senhaFinal, salt);
        }

        const validado = validarRestricoesENiveis(
          Array.isArray(doc.restricoes) ? doc.restricoes : [],
          doc.niveisSensibilidade,
          false
        );

        await User.collection.insertOne({
          nome: String(doc.nome || 'Usuário')
            .trim()
            .slice(0, 100),
          email: emailLimpo,
          senha: senhaFinal,
          avatar: doc.avatar || null,
          role: 'PACIENTE',
          nutricionistaId: null,
          vinculadoEm: null,
          consentimentoVinculoEm: null,
          restricoes: validado.restricoes || [],
          niveisSensibilidade: validado.niveisSensibilidade || {
            gluten: 1,
            lactose: 1,
            amendoim: 1,
          },
          createdAt: doc.createdAt || doc.dataCriacao || new Date(),
          updatedAt: new Date(),
        });
        migrados += 1;
      }
    }

    if (migrados > 0) {
      console.log(
        `Sincronização inicial: ${migrados} conta(s) legada(s) copiada(s) para RotuScanDB.users.`
      );
    }
  } catch (err) {
    console.warn('Aviso ao sincronizar usuários legados:', err.message);
  }
}

// ============================================================================
// CONEXÃO COM O MONGODB E INICIALIZAÇÃO DO SERVIDOR
// ============================================================================

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI;
const PORT = process.env.PORT || 3000;

if (!MONGO_URI) {
  console.error(
    'ERRO: Variável MONGO_URI / MONGODB_URI não definida no arquivo .env.'
  );
  process.exit(1);
}

mongoose
  .connect(MONGO_URI, { dbName: 'RotuScanDB' })
  .then(async () => {
    console.log('Conectado ao MongoDB Atlas (RotuScanDB) com sucesso.');
    if (process.env.SMOKE_TEST !== 'true') {
      await inicializarDicionarioPadrao();
      await sincronizarUsuariosLegados();
    }

    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Servidor rodando na porta ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Erro ao conectar ao MongoDB:', err.message);
    process.exit(1);
  });

export default app;
