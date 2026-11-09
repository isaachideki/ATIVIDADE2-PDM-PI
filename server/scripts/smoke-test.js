import 'dotenv/config';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import User from '../models/User.js';
import Nutricionista from '../models/Nutricionista.js';
import SolicitacaoVinculo from '../models/SolicitacaoVinculo.js';
import { JWT_SECRET } from '../middleware/auth.js';
import { normalizarCrn, parseCrn, regexCrn } from '../utils/crn.js';

const PORTA_SMOKE = process.env.SMOKE_PORT || '3099';
const BASE_URL = `http://127.0.0.1:${PORTA_SMOKE}`;
const resultados = [];

function registrarResultado(etapa, passou, detalhe = '') {
  resultados.push({ etapa, status: passou ? 'PASS' : 'FAIL', detalhe });
  console.log(`[${passou ? 'PASS' : 'FAIL'}] ${etapa}${detalhe ? ` — ${detalhe}` : ''}`);
  if (!passou) process.exitCode = 1;
}

async function aguardarServidorPronto(processoServidor, timeoutMs = 20000) {
  await new Promise((resolve, reject) => {
    let resolvido = false;
    const cleanup = () => {
      clearTimeout(timer);
      processoServidor.stdout.off('data', onStdout);
      processoServidor.off('exit', onExit);
    };
    const onStdout = (chunk) => {
      if (chunk.toString().includes('Servidor rodando na porta')) {
        resolvido = true;
        cleanup();
        resolve();
      }
    };
    const onExit = () => {
      if (!resolvido) {
        cleanup();
        reject(new Error('O servidor encerrou antes de ficar disponível.'));
      }
    };
    const timer = setTimeout(() => {
      if (!resolvido) {
        cleanup();
        reject(new Error('Tempo esgotado aguardando o servidor.'));
      }
    }, timeoutMs);

    processoServidor.stdout.on('data', onStdout);
    processoServidor.on('exit', onExit);
  });
}

async function requisitar(path, { method = 'GET', token, body } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const data = await response.json().catch(() => ({}));
  return { status: response.status, data };
}

async function executarSmokeTest() {
  let servidorProc;
  const pacientesTeste = new Set();
  const emailsTeste = new Set();
  let nutricionistaTesteId = null;
  let mongoConectado = false;

  try {
    servidorProc = spawn(process.execPath, ['server.js'], {
      cwd: fileURLToPath(new URL('..', import.meta.url)),
      env: {
        ...process.env,
        PORT: String(PORTA_SMOKE),
        SMOKE_TEST: 'true',
        VINCULO_RATE_LIMIT_MAX: '10',
        AUTH_RATE_LIMIT_MAX: '100',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    await aguardarServidorPronto(servidorProc);
    await mongoose.connect(process.env.MONGO_URI || process.env.MONGODB_URI, {
      dbName: 'RotuScanDB',
    });
    mongoConectado = true;
    await SolicitacaoVinculo.init();
    registrarResultado('Inicialização do servidor de testes', true);

    const sufixo = `${Date.now()}_${Math.floor(Math.random() * 100000)}`;
    const senhaTeste = 'Teste@123';
    const emailNutri = `smoke_nutri_${sufixo}@rotuscan.test`;
    const numeroCrn = String(100000 + (Date.now() % 900000));
    let crnTeste = `CRN-3 ${numeroCrn}`;
    while (await Nutricionista.exists({ crn: regexCrn(crnTeste) })) {
      crnTeste = `CRN-3 ${Math.floor(100000 + Math.random() * 900000)}`;
    }

    const hashTeste = await bcrypt.hash(senhaTeste, 10);
    const nutriInserido = await Nutricionista.collection.insertOne({
      nome: 'Nutricionista de Teste Smoke',
      email: emailNutri,
      senha: hashTeste,
      crn: crnTeste,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    nutricionistaTesteId = nutriInserido.insertedId;

    const formatosCrn = [
      crnTeste,
      `crn3 ${numeroCrn}`,
      `CRN-3/${numeroCrn.slice(0, 2)}.${numeroCrn.slice(2)}`,
    ];
    const consultasCrn = await Promise.all(
      formatosCrn.map((crn) =>
        requisitar(`/api/vinculacoes/nutricionista/${encodeURIComponent(crn)}`)
      )
    );
    const consultaPublica = consultasCrn[0].data?.nutricionista;
    registrarResultado(
      'Consulta pública e variações normalizadas do CRN',
      consultasCrn.every(
        (result) =>
          result.status === 200 &&
          result.data?.nutricionista?.id === String(nutricionistaTesteId)
      ) &&
        consultaPublica?.nome === 'Nutricionista de Teste Smoke' &&
        consultaPublica?.crn === crnTeste &&
        !('email' in consultaPublica) &&
        !('senha' in consultaPublica),
      `HTTP ${consultasCrn.map((result) => result.status).join('/')}`
    );

    const emailCadastroCrn = `smoke_cadastro_${sufixo}@rotuscan.test`;
    emailsTeste.add(emailCadastroCrn);
    const cadastroComCrn = await requisitar('/auth/register', {
      method: 'POST',
      body: {
        nome: 'Paciente de Teste CRN',
        email: emailCadastroCrn,
        senha: senhaTeste,
        role: 'NUTRICIONISTA',
        codigoNutricionista: 'IGNORADO',
        crnNutricionista: crnTeste,
        restricoes: ['gluten'],
        niveisSensibilidade: { gluten: 1, lactose: 1, amendoim: 1 },
      },
    });
    const cadastroPacienteId = cadastroComCrn.data?.usuario?.id;
    if (cadastroPacienteId) pacientesTeste.add(cadastroPacienteId);
    const pacienteCriado = cadastroPacienteId
      ? await User.findById(cadastroPacienteId)
          .select('_id role nutricionistaId vinculadoEm consentimentoVinculoEm')
          .lean()
      : null;
    const solicitacaoCadastro = pacienteCriado
      ? await SolicitacaoVinculo.findOne({
          pacienteId: pacienteCriado._id,
          status: 'PENDENTE',
        })
          .select('_id nutricionistaId')
          .lean()
      : null;
    registrarResultado(
      'Cadastro com CRN cria paciente e solicitação PENDENTE sem vínculo ativo',
      cadastroComCrn.status === 201 &&
        cadastroComCrn.data?.usuario?.role === 'PACIENTE' &&
        cadastroComCrn.data?.vinculo?.estado === 'PENDENTE' &&
        pacienteCriado?.role === 'PACIENTE' &&
        !pacienteCriado.nutricionistaId &&
        !pacienteCriado.vinculadoEm &&
        Boolean(pacienteCriado.consentimentoVinculoEm) &&
        String(solicitacaoCadastro?.nutricionistaId) ===
          String(nutricionistaTesteId),
      `HTTP ${cadastroComCrn.status}`
    );

    let crnInexistente = `CRN-11 ${String(900000 + (Date.now() % 99999)).slice(0, 6)}`;
    while (await Nutricionista.exists({ crn: regexCrn(crnInexistente) })) {
      crnInexistente = `CRN-11 ${Math.floor(100000 + Math.random() * 900000)}`;
    }
    const emailCadastroInvalido = `smoke_invalido_${sufixo}@rotuscan.test`;
    emailsTeste.add(emailCadastroInvalido);
    const countAntes = await User.countDocuments({
      email: emailCadastroInvalido,
    });
    const cadastroCrnInexistente = await requisitar('/auth/register', {
      method: 'POST',
      body: {
        nome: 'Cadastro que não deve existir',
        email: emailCadastroInvalido,
        senha: senhaTeste,
        crnNutricionista: crnInexistente,
        restricoes: ['gluten'],
      },
    });
    const countDepois = await User.countDocuments({
      email: emailCadastroInvalido,
    });
    registrarResultado(
      'Cadastro com CRN inexistente responde 400 sem criar conta',
      cadastroCrnInexistente.status === 400 &&
        cadastroCrnInexistente.data?.mensagem ===
          'CRN de nutricionista inválido' &&
        countAntes === countDepois,
      `HTTP ${cadastroCrnInexistente.status}; contas ${countAntes}->${countDepois}`
    );

    const emailPaciente2 = `smoke_paciente2_${sufixo}@rotuscan.test`;
    emailsTeste.add(emailPaciente2);
    const cadastroPaciente2 = await requisitar('/auth/register', {
      method: 'POST',
      body: {
        nome: 'Paciente de Teste Login',
        email: emailPaciente2,
        senha: senhaTeste,
        restricoes: ['gluten'],
      },
    });
    const idPaciente2 = cadastroPaciente2.data?.usuario?.id;
    if (idPaciente2) pacientesTeste.add(idPaciente2);
    const loginPaciente2 = await requisitar('/auth/login', {
      method: 'POST',
      body: { email: emailPaciente2, senha: senhaTeste },
    });
    const tokenPaciente2 = loginPaciente2.data?.token;
    const solicitacaoInicial = await requisitar(
      '/api/vinculacoes/solicitar',
      { method: 'POST', token: tokenPaciente2, body: { crn: crnTeste } }
    );
    const repetidaPendente = await requisitar(
      '/api/vinculacoes/solicitar',
      { method: 'POST', token: tokenPaciente2, body: { crn: crnTeste } }
    );
    registrarResultado(
      'Paciente autenticado solicita vínculo; segunda pendente retorna 409',
      cadastroPaciente2.status === 201 &&
        loginPaciente2.status === 200 &&
        solicitacaoInicial.status === 201 &&
        solicitacaoInicial.data?.vinculo?.estado === 'PENDENTE' &&
        repetidaPendente.status === 409,
      `login=${loginPaciente2.status}; solicitação=${solicitacaoInicial.status}; repetida=${repetidaPendente.status}`
    );

    const cancelar = await requisitar(
      '/api/vinculacoes/minha-solicitacao',
      { method: 'DELETE', token: tokenPaciente2 }
    );
    const solicitacaoCancelada = await SolicitacaoVinculo.findById(
      cancelar.data?.vinculo?.solicitacaoId
    )
      .select('status encerradaPor encerradaEm')
      .lean();
    const solicitarNovamente = await requisitar(
      '/api/vinculacoes/solicitar',
      { method: 'POST', token: tokenPaciente2, body: { crn: crnTeste } }
    );
    registrarResultado(
      'Cancelar mantém solicitação como RECUSADO e permite solicitar novamente',
      cancelar.status === 200 &&
        cancelar.data?.vinculo?.estado === 'RECUSADO' &&
        solicitacaoCancelada?.status === 'RECUSADO' &&
        solicitacaoCancelada?.encerradaPor === 'PACIENTE' &&
        Boolean(solicitacaoCancelada?.encerradaEm) &&
        solicitarNovamente.status === 201 &&
        solicitarNovamente.data?.vinculo?.estado === 'PENDENTE',
      `cancelar=${cancelar.status}; nova=${solicitarNovamente.status}`
    );

    const paciente2Id = new mongoose.Types.ObjectId(idPaciente2);
    const vinculadoEm = new Date();
    const aprovacaoUser = await User.collection.updateOne(
      { _id: paciente2Id },
      { $set: { nutricionistaId: nutricionistaTesteId, vinculadoEm } }
    );
    const aprovacaoSolicitacao = await SolicitacaoVinculo.collection.updateOne(
      {
        _id: new mongoose.Types.ObjectId(
          solicitarNovamente.data?.vinculo?.solicitacaoId
        ),
        status: 'PENDENTE',
      },
      { $set: { status: 'APROVADO', updatedAt: new Date() } }
    );
    const vinculoAprovado = await requisitar(
      '/api/vinculacoes/minha-solicitacao',
      { token: tokenPaciente2 }
    );
    const perfilAprovado = await requisitar('/users/perfil', {
      token: tokenPaciente2,
    });
    registrarResultado(
      'Aprovação simulada apenas no banco aparece em solicitação e perfil',
      aprovacaoUser.modifiedCount === 1 &&
        aprovacaoSolicitacao.modifiedCount === 1 &&
        vinculoAprovado.data?.vinculo?.estado === 'APROVADO' &&
        vinculoAprovado.data?.vinculo?.nutricionista?.nome ===
          'Nutricionista de Teste Smoke' &&
        perfilAprovado.data?.vinculo?.estado === 'APROVADO' &&
        perfilAprovado.data?.usuario?.vinculo?.estado === 'APROVADO',
      `user=${aprovacaoUser.modifiedCount}; solicitação=${aprovacaoSolicitacao.modifiedCount}; perfil=${perfilAprovado.status}`
    );

    const tentarOutroVinculo = await requisitar(
      '/api/vinculacoes/solicitar',
      {
        method: 'POST',
        token: tokenPaciente2,
        body: { crn: crnTeste },
      }
    );
    const desvincular = await requisitar('/users/vinculo', {
      method: 'DELETE',
      token: tokenPaciente2,
    });
    const pacienteDesvinculado = await User.findById(paciente2Id)
      .select('_id nutricionistaId vinculadoEm')
      .lean();
    const solicitacaoAprovadaPreservada = await SolicitacaoVinculo.findById(
      solicitarNovamente.data?.vinculo?.solicitacaoId
    )
      .select('status encerradaPor encerradaEm')
      .lean();
    const estadoAposDesvincular = await requisitar(
      '/api/vinculacoes/minha-solicitacao',
      { token: tokenPaciente2 }
    );
    registrarResultado(
      'Vínculo ativo bloqueia outro; desvincular limpa campos e preserva histórico',
      tentarOutroVinculo.status === 409 &&
        desvincular.status === 200 &&
        !pacienteDesvinculado?.nutricionistaId &&
        !pacienteDesvinculado?.vinculadoEm &&
        solicitacaoAprovadaPreservada?.status === 'APROVADO' &&
        solicitacaoAprovadaPreservada?.encerradaPor === 'PACIENTE' &&
        Boolean(solicitacaoAprovadaPreservada?.encerradaEm) &&
        estadoAposDesvincular.data?.vinculo?.estado !== 'APROVADO',
      `outro=${tentarOutroVinculo.status}; desvincular=${desvincular.status}; estado=${estadoAposDesvincular.data?.vinculo?.estado}`
    );

    const emailPaciente3 = `smoke_paciente3_${sufixo}@rotuscan.test`;
    emailsTeste.add(emailPaciente3);
    const cadastroPaciente3 = await requisitar('/auth/register', {
      method: 'POST',
      body: {
        nome: 'Paciente de Teste Recusa',
        email: emailPaciente3,
        senha: senhaTeste,
        restricoes: ['lactose'],
      },
    });
    const idPaciente3 = cadastroPaciente3.data?.usuario?.id;
    if (idPaciente3) pacientesTeste.add(idPaciente3);
    const tokenPaciente3 = cadastroPaciente3.data?.token;
    const referenciaLegada = await User.updateOne(
      { _id: new mongoose.Types.ObjectId(idPaciente3) },
      {
        $set: {
          nutricionistaId: new mongoose.Types.ObjectId(),
          vinculadoEm: new Date(),
        },
      }
    );
    const solicitacaoRecusada = await requisitar(
      '/api/vinculacoes/solicitar',
      { method: 'POST', token: tokenPaciente3, body: { crn: crnTeste } }
    );
    const pacienteComSolicitacaoLegada = await User.findById(idPaciente3)
      .select('nutricionistaId vinculadoEm consentimentoVinculoEm')
      .lean();
    registrarResultado(
      'Solicitar por CRN recupera referência legada sem nutricionista correspondente',
      referenciaLegada.modifiedCount === 1 &&
        solicitacaoRecusada.status === 201 &&
        solicitacaoRecusada.data?.vinculo?.estado === 'PENDENTE' &&
        !pacienteComSolicitacaoLegada?.nutricionistaId &&
        !pacienteComSolicitacaoLegada?.vinculadoEm &&
        Boolean(pacienteComSolicitacaoLegada?.consentimentoVinculoEm),
      `referência=${referenciaLegada.modifiedCount}; solicitação=${solicitacaoRecusada.status}`
    );
    await SolicitacaoVinculo.collection.updateOne(
      { _id: new mongoose.Types.ObjectId(solicitacaoRecusada.data?.vinculo?.solicitacaoId) },
      {
        $set: {
          status: 'RECUSADO',
          encerradaEm: new Date(),
          encerradaPor: 'NUTRICIONISTA',
          updatedAt: new Date(),
        },
      }
    );
    const estadoRecusado = await requisitar(
      '/api/vinculacoes/minha-solicitacao',
      { token: tokenPaciente3 }
    );
    const novoPedidoAposRecusa = await requisitar(
      '/api/vinculacoes/solicitar',
      { method: 'POST', token: tokenPaciente3, body: { crn: crnTeste } }
    );
    const formatosInvalidos = [
      'CRN-312345',
      'CRN-12 12345',
      'texto-sem-crn',
    ];
    const crnInvalidos = await Promise.all(
      formatosInvalidos.map((crn) =>
        requisitar(`/api/vinculacoes/nutricionista/${encodeURIComponent(crn)}`)
      )
    );
    const buscaInexistente = await requisitar(
      `/api/vinculacoes/nutricionista/${encodeURIComponent(crnInexistente)}`
    );
    registrarResultado(
      'Recusa é exibida e permite nova solicitação; formatos inválidos e CRN ausente são tratados',
      estadoRecusado.data?.vinculo?.estado === 'RECUSADO' &&
        novoPedidoAposRecusa.status === 201 &&
        formatosInvalidos.every((_, index) => crnInvalidos[index].status === 400) &&
        buscaInexistente.status === 404 &&
        buscaInexistente.data?.mensagem === 'Nutricionista não encontrado' &&
        parseCrn('CRN-3 12345')?.numero === '12345' &&
        normalizarCrn('crn3 12345') === 'CRN-3 12345' &&
        !parseCrn('CRN-312345'),
      `recusa=${estadoRecusado.data?.vinculo?.estado}; inválidos=${crnInvalidos.map((r) => r.status).join('/')}; inexistente=${buscaInexistente.status}`
    );

    const tokenAusente = await requisitar(
      '/api/vinculacoes/minha-solicitacao'
    );
    const tokenInvalido = await requisitar(
      '/api/vinculacoes/minha-solicitacao',
      { token: 'token-invalido' }
    );
    const tokenExpirado = jwt.sign(
      {
        id: idPaciente3,
        email: emailPaciente3,
        role: 'PACIENTE',
      },
      JWT_SECRET,
      { expiresIn: '-1s' }
    );
    const expirado = await requisitar(
      '/api/vinculacoes/minha-solicitacao',
      { token: tokenExpirado }
    );
    registrarResultado(
      'Token ausente, inválido e expirado retornam 401',
      tokenAusente.status === 401 &&
        tokenInvalido.status === 401 &&
        expirado.status === 401,
      `HTTP ${tokenAusente.status}/${tokenInvalido.status}/${expirado.status}`
    );

    const loginNutriSenhaIncorreta = await requisitar('/auth/login', {
      method: 'POST',
      body: { email: emailNutri, senha: 'senha-incorreta' },
    });
    const loginNutri = await requisitar('/auth/login', {
      method: 'POST',
      body: { email: emailNutri, senha: senhaTeste },
    });
    registrarResultado(
      'Login de nutricionista retorna 403 somente com a senha correta',
      loginNutriSenhaIncorreta.status === 401 && loginNutri.status === 403,
      `senha incorreta=${loginNutriSenhaIncorreta.status}; correta=${loginNutri.status}`
    );

    const solicitacoesRateLimit = [];
    for (let i = 0; i < 6; i++) {
      solicitacoesRateLimit.push(
        await requisitar('/api/vinculacoes/solicitar', {
          method: 'POST',
          token: tokenPaciente2,
          body: { crn: crnTeste },
        })
      );
    }
    registrarResultado(
      'Solicitações limitadas a cinco por hora por paciente',
      solicitacoesRateLimit[0]?.status === 201 &&
        solicitacoesRateLimit.slice(1).every((result) => result.status === 429),
      `HTTP ${solicitacoesRateLimit.map((result) => result.status).join('/')}`
    );

    const consultasRateLimit = [];
    for (let i = 0; i < 6; i++) {
      consultasRateLimit.push(
        await requisitar(
          `/api/vinculacoes/nutricionista/${encodeURIComponent(crnTeste)}`
        )
      );
    }
    registrarResultado(
      'Consulta pública limitada a dez requisições por 15 minutos por IP',
      consultasRateLimit.some((result) => result.status === 429),
      `HTTP ${consultasRateLimit.map((result) => result.status).join('/')}`
    );
  } catch {
    registrarResultado('Execução do smoke test', false, 'Falha inesperada; consulte os logs locais do servidor.');
  } finally {
    if (mongoConectado) {
      for (const email of emailsTeste) {
        const user = await User.findOne({ email }).select('_id').lean();
        if (user) pacientesTeste.add(String(user._id));
      }
      for (const id of pacientesTeste) {
        const pacienteId = new mongoose.Types.ObjectId(id);
        const solicitacoes = await SolicitacaoVinculo.find({ pacienteId })
          .select('_id')
          .lean();
        for (const solicitacao of solicitacoes) {
          await SolicitacaoVinculo.deleteOne({ _id: solicitacao._id });
        }
        await User.deleteOne({ _id: pacienteId });
      }
      if (nutricionistaTesteId) {
        await Nutricionista.deleteOne({ _id: nutricionistaTesteId });
      }
      await mongoose.disconnect();
    }
    if (servidorProc && !servidorProc.killed) servidorProc.kill();
  }

  console.log('\nRESUMO DO SMOKE TEST DE VÍNCULO POR CRN');
  console.table(resultados);
  const falhas = resultados.filter((resultado) => resultado.status === 'FAIL');
  if (falhas.length > 0) process.exitCode = 1;
  else console.log(`Smoke concluído: ${resultados.length} verificações aprovadas.`);
}

executarSmokeTest();
