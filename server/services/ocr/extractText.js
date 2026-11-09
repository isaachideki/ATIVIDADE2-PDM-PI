
import { execFile } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';
import { temMarcadorIngredientes } from '../../utils/texto.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SERVER_ROOT = path.join(__dirname, '..', '..');
const DEBUG_DIR = path.join(SERVER_ROOT, 'uploads', 'debug');

export const CONFIG_OCR_PADRAO = Object.freeze({
  larguraAlvo: 2000,
  psmPrincipal: 6,
      limiarConfiancaExtra: 70,
  passadasExtras: [
    { variante: 'V2', psm: 6 },
    { variante: 'V3', psm: 11 },
  ],
  usarPassadasExtras: true,
});


export function resolverBinarioTesseract() {
  if (process.env.TESSERACT_PATH && fs.existsSync(process.env.TESSERACT_PATH)) {
    return process.env.TESSERACT_PATH;
  }
  if (process.platform === 'win32') {
    const padraoWin = path.join('C:\\', 'Program Files', 'Tesseract-OCR', 'tesseract.exe');
    if (fs.existsSync(padraoWin)) return padraoWin;
  }
  return 'tesseract';
}


export function resolverTessdataDir() {
  const candidatos = [process.env.TESSDATA_DIR, path.join(SERVER_ROOT, 'tessdata')].filter(Boolean);
  for (const dir of candidatos) {
    if (fs.existsSync(path.join(dir, 'por.traineddata'))) return dir;
  }
  return null;
}


export function diagnosticarModeloPor() {
  const dirs = [
    resolverTessdataDir(),
    process.env.TESSDATA_PREFIX,
    path.join('C:\\', 'Program Files', 'Tesseract-OCR', 'tessdata'),
    '/usr/share/tesseract-ocr/5/tessdata',
    '/usr/share/tesseract-ocr/4.00/tessdata',
  ].filter(Boolean);
  for (const dir of dirs) {
    const arq = path.join(dir, 'por.traineddata');
    if (fs.existsSync(arq)) {
      const tamanhoMb = fs.statSync(arq).size / (1024 * 1024);
      return {
        arquivo: arq,
        tamanhoMb: Number(tamanhoMb.toFixed(1)),
        tipo: tamanhoMb < 6 ? 'fast' : 'best/standard',
      };
    }
  }
  return { arquivo: null, tamanhoMb: 0, tipo: 'nao-encontrado' };
}

function erroOcrIndisponivel(err) {
  const erroOcr = new Error(
    'OCR indisponível no servidor. Verifique a instalação do Tesseract OCR com pacote de idioma português (por).'
  );
  erroOcr.code = 'OCR_UNAVAILABLE';
  erroOcr.detalhe = err?.message || String(err);
  erroOcr.instrucoesWindows =
    'Instale o Tesseract OCR (https://github.com/UB-Mannheim/tesseract/wiki) em "C:\\Program Files\\Tesseract-OCR" marcando o idioma "Portuguese (por)" durante a instalação.';
  return erroOcr;
}


export function executarTesseractTsv(caminhoImagem, { psm = 6, lang = 'por', oem = 1 } = {}) {
  const args = [caminhoImagem, 'stdout', '-l', lang, '--oem', String(oem), '--psm', String(psm)];
  const tessdata = resolverTessdataDir();
  if (tessdata) args.push('--tessdata-dir', tessdata);
  args.push('tsv');

  return new Promise((resolve, reject) => {
    execFile(
      resolverBinarioTesseract(),
      args,
      { maxBuffer: 32 * 1024 * 1024, timeout: 25000, windowsHide: true },
      (error, stdout) => {
        if (error) return reject(erroOcrIndisponivel(error));
        return resolve(String(stdout || ''));
      }
    );
  });
}


export function parseTsv(tsv) {
  const linhasMap = new Map();
  const ordem = [];
  const confs = [];

  for (const linha of String(tsv).split(/\r?\n/).slice(1)) {
    if (!linha) continue;
    const c = linha.split('\t');
    if (c.length < 12 || c[0] !== '5') continue;
    const texto = c.slice(11).join('\t').trim();
    if (!texto) continue;
    const conf = Number.parseFloat(c[10]);
    const chave = `${c[2]}-${c[3]}-${c[4]}`;
    if (!linhasMap.has(chave)) {
      linhasMap.set(chave, { palavras: [] });
      ordem.push(chave);
    }
    linhasMap.get(chave).palavras.push({ texto, conf: Number.isFinite(conf) ? conf : null });
    if (Number.isFinite(conf) && conf >= 0 && /[\p{L}\p{N}]/u.test(texto)) confs.push(conf);
  }

  const linhas = ordem.map((k) => linhasMap.get(k));
  const textoBruto = linhas.map((l) => l.palavras.map((p) => p.texto).join(' ')).join('\n');
  const confianca = confs.length ? confs.reduce((a, b) => a + b, 0) / confs.length : null;
  return { linhas, textoBruto, confianca };
}

// ---------------------------------------------------------------------------
// Pré-processamento (sharp)
// ---------------------------------------------------------------------------

/** Valida a região { x, y, w, h } em frações 0..1 da foto. Devolve null se inválida. */
export function validarRegiao(regiao) {
  let r = regiao;
  if (typeof r === 'string') {
    try {
      r = JSON.parse(r);
    } catch {
      return null;
    }
  }
  if (!r || typeof r !== 'object') return null;
  const vals = ['x', 'y', 'w', 'h'].map((k) => Number(r[k]));
  if (vals.some((v) => !Number.isFinite(v))) return null;
  let [x, y, w, h] = vals;
  x = Math.min(Math.max(x, 0), 1);
  y = Math.min(Math.max(y, 0), 1);
  w = Math.min(Math.max(w, 0), 1 - x);
  h = Math.min(Math.max(h, 0), 1 - y);
  if (w < 0.05 || h < 0.05) return null;
  return { x, y, w, h };
}

/**
 * .rotate() (EXIF) -> extract(regiao) -> resize para ~2000 px (lanczos3).
 * Usa buffer raw entre as etapas para não recomprimir a foto.
 */
async function prepararBase(caminhoImagem, regiao, larguraAlvo) {
  const { data, info } = await sharp(caminhoImagem)
    .rotate()
    .raw()
    .toBuffer({ resolveWithObject: true });

  let img = sharp(data, { raw: { width: info.width, height: info.height, channels: info.channels } });
  let regiaoAplicada = null;
  const r = validarRegiao(regiao);
  if (r) {
    regiaoAplicada = {
      left: Math.floor(r.x * info.width),
      top: Math.floor(r.y * info.height),
      width: Math.max(1, Math.min(Math.round(r.w * info.width), info.width - Math.floor(r.x * info.width))),
      height: Math.max(1, Math.min(Math.round(r.h * info.height), info.height - Math.floor(r.y * info.height))),
    };
    img = img.extract(regiaoAplicada);
  }

  const base = await img
    .resize({ width: larguraAlvo, kernel: sharp.kernel.lanczos3 })
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { base, regiaoAplicada };
}

function sharpDaBase(base) {
  return sharp(base.data, {
    raw: { width: base.info.width, height: base.info.height, channels: base.info.channels },
  });
}

/** V1: cinza + CLAHE + nitidez | V2: V1 negativo (texto claro em fundo escuro) | V3: cinza + mediana 3 + normalize */
const VARIANTES = {
  V1: (base) => sharpDaBase(base).grayscale().clahe({ width: 64, height: 64, maxSlope: 3 }).sharpen(),
  V2: (base) =>
    sharpDaBase(base).grayscale().clahe({ width: 64, height: 64, maxSlope: 3 }).sharpen().negate({ alpha: false }),
  V3: (base) => sharpDaBase(base).grayscale().median(3).normalize(),
};

async function gravarVariante(base, nome, prefixoTemp) {
  const caminho = `${prefixoTemp}_${nome}.png`;
  await VARIANTES[nome](base).png({ compressionLevel: 1 }).toFile(caminho);
  return caminho;
}

function debugAtivo() {
  return process.env.OCR_DEBUG === '1' && process.env.NODE_ENV !== 'production';
}

async function salvarDebug(arquivosVariantes, passadas, extra) {
  try {
    const pasta = path.join(DEBUG_DIR, `${Date.now()}`);
    await fs.promises.mkdir(pasta, { recursive: true });
    for (const [nome, arq] of Object.entries(arquivosVariantes)) {
      if (arq && fs.existsSync(arq)) await fs.promises.copyFile(arq, path.join(pasta, `${nome}.png`));
    }
    for (const p of passadas) {
      await fs.promises.writeFile(
        path.join(pasta, `passada_${p.variante}_psm${p.psm}.txt`),
        `confianca=${p.confianca}\n\n${p.textoBruto}`,
        'utf8'
      );
    }
    await fs.promises.writeFile(path.join(pasta, 'resumo.json'), JSON.stringify(extra, null, 2), 'utf8');
    console.log(` [OCR_DEBUG] variantes e textos gravados em ${pasta}`);
  } catch (err) {
    console.warn(' [OCR_DEBUG] falha ao gravar debug:', err.message);
  }
}

function contarLetrasTexto(t) {
  const m = String(t || '').match(/\p{L}/gu);
  return m ? m.length : 0;
}

// ---------------------------------------------------------------------------
// API pública do motor
// ---------------------------------------------------------------------------

/**
 * Pipeline novo: V1 + psm 6; passadas extras (V2 psm 6, V3 psm 11) em paralelo só quando
 * a confiança fica abaixo do limiar ou o marcador de ingredientes não aparece.
 */
export async function extrairTexto(caminhoImagem, { regiao = null, config = {} } = {}) {
  const cfg = { ...CONFIG_OCR_PADRAO, ...config };
  const t0 = Date.now();
  const prefixoTemp = `${caminhoImagem}_ocr_${Date.now()}`;
  const arquivos = {};
  const temposMs = {};

  try {
    let base;
    let regiaoAplicada;
    try {
      ({ base, regiaoAplicada } = await prepararBase(caminhoImagem, regiao, cfg.larguraAlvo));
    } catch (err) {
      const e = new Error('Não foi possível abrir a imagem enviada.');
      e.code = 'IMAGEM_INVALIDA';
      e.detalhe = err.message;
      throw e;
    }
    temposMs.preparo = Date.now() - t0;

    const tVar = Date.now();
    arquivos.V1 = await gravarVariante(base, 'V1', prefixoTemp);
    temposMs.variantes = Date.now() - tVar;

    const tOcr1 = Date.now();
    const tsv1 = await executarTesseractTsv(arquivos.V1, { psm: cfg.psmPrincipal });
    const p1 = { variante: 'V1', psm: cfg.psmPrincipal, ...parseTsv(tsv1), ms: Date.now() - tOcr1 };
    temposMs.ocrPrincipal = p1.ms;
    const passadas = [p1];

    const precisaExtras =
      cfg.usarPassadasExtras &&
      cfg.passadasExtras.length > 0 &&
      ((p1.confianca ?? 0) < cfg.limiarConfiancaExtra || !temMarcadorIngredientes(p1.textoBruto));

    if (precisaExtras) {
      const tEx = Date.now();
      const extras = await Promise.all(
        cfg.passadasExtras.map(async ({ variante, psm }) => {
          const ti = Date.now();
          if (!arquivos[variante]) arquivos[variante] = await gravarVariante(base, variante, prefixoTemp);
          const tsv = await executarTesseractTsv(arquivos[variante], { psm });
          return { variante, psm, ...parseTsv(tsv), ms: Date.now() - ti };
        })
      );
      passadas.push(...extras);
      temposMs.ocrExtras = Date.now() - tEx;
    } else {
      temposMs.ocrExtras = 0;
    }

    // Passada de exibição: maior confiança entre as que leram pelo menos 60% das letras da mais longa
    const maxLetras = Math.max(...passadas.map((p) => contarLetrasTexto(p.textoBruto)));
    const candidatas = passadas.filter((p) => contarLetrasTexto(p.textoBruto) >= 0.6 * maxLetras);
    const exibicao = candidatas.sort((a, b) => (b.confianca ?? 0) - (a.confianca ?? 0))[0] || p1;

    temposMs.total = Date.now() - t0;

    const resultado = {
      motor: 'tesseract',
      textoBruto: p1.textoBruto,
      textoBusca: passadas.map((p) => p.textoBruto).join('\n.\n'),
      linhasExibicao: exibicao.linhas,
      varianteExibicao: exibicao.variante,
      confianca: exibicao.confianca == null ? null : Math.round(exibicao.confianca),
      passadas: passadas.map((p) => ({
        variante: p.variante,
        psm: p.psm,
        confianca: p.confianca == null ? null : Math.round(p.confianca),
        caracteres: p.textoBruto.length,
        ms: p.ms,
      })),
      temposMs,
      regiaoAplicada,
    };

    if (debugAtivo()) {
      await salvarDebug(arquivos, passadas, {
        regiaoRecebida: regiao,
        regiaoAplicada,
        temposMs,
        passadas: resultado.passadas,
        varianteExibicao: resultado.varianteExibicao,
      });
    }

    return resultado;
  } finally {
    for (const arq of Object.values(arquivos)) {
      try {
        if (arq && fs.existsSync(arq)) await fs.promises.unlink(arq);
      } catch {
        // ignora erro de limpeza de temporário
      }
    }
  }
}

/**
 * Pipeline ANTIGO (Entrega 1), mantido apenas para o benchmark comparar:
 * resize 1200 px + grayscale + normalize + psm 3, sem região e sem passadas extras.
 */
export async function extrairTextoBaseline(caminhoImagem) {
  const t0 = Date.now();
  const temp = `${caminhoImagem}_baseline_${Date.now()}.png`;
  try {
    await sharp(caminhoImagem)
      .rotate()
      .resize({ width: 1200, withoutEnlargement: true })
      .grayscale()
      .normalize()
      .toFile(temp);
    const tsv = await executarTesseractTsv(temp, { psm: 3 });
    const p = parseTsv(tsv);
    return {
      motor: 'tesseract',
      textoBruto: p.textoBruto,
      textoBusca: p.textoBruto,
      linhasExibicao: p.linhas,
      confianca: p.confianca == null ? null : Math.round(p.confianca),
      passadas: [{ variante: 'BASE', psm: 3, confianca: p.confianca, caracteres: p.textoBruto.length }],
      temposMs: { total: Date.now() - t0 },
      regiaoAplicada: null,
    };
  } finally {
    try {
      if (fs.existsSync(temp)) await fs.promises.unlink(temp);
    } catch {
      // ignora
    }
  }
}

