import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import tesseract from 'node-tesseract-ocr';
import AllergenDictionary from '../models/AllergenDictionary.js';
import { ROTULOS_CATEGORIA, DICIONARIO_PADRAO } from '../seeds/dicionarioPadrao.js';
import {
  normalizar,
  normalizarMantendoIndices,
  escaparRegex,
  juntarLista,
  capitalizar,
} from '../utils/texto.js';

const EXCECOES_SEGUROS = [
  'leite de coco',
  'leite de amendoas',
  'leite de amendoa',
  'leite de soja',
  'leite de aveia',
  'leite de arroz',
  'leite de castanha',
  'leite vegetal',
  'manteiga de cacau',
  'acido lactico',
  'lactato de sodio',
  'lactato de calcio',
  'trigo sarraceno',
  'farinha de trigo sarraceno',
];

function resolverBinarioTesseract() {
  if (process.env.TESSERACT_PATH && fs.existsSync(process.env.TESSERACT_PATH)) {
    return `"${process.env.TESSERACT_PATH}"`;
  }
  if (process.platform === 'win32') {
    const padraoWin = 'C:\\Program Files\\Tesseract-OCR\\tesseract.exe';
    if (fs.existsSync(padraoWin)) {
      return `"${padraoWin}"`;
    }
  }
  return undefined;
}


export async function extrairTextoDaImagem(caminhoImagemOriginal) {
  const tempPreprocessed = `${caminhoImagemOriginal}_prep_${Date.now()}.png`;
  try {
    await sharp(caminhoImagemOriginal)
      .rotate()
      .resize({ width: 1200, withoutEnlargement: true })
      .grayscale()
      .normalize()
      .toFile(tempPreprocessed);

    const config = {
      lang: 'por',
      oem: 1,
      psm: 3,
    };
    const binary = resolverBinarioTesseract();
    if (binary) {
      config.binary = binary;
    }

    const texto = await tesseract.recognize(tempPreprocessed, config);
    return (texto || '').trim();
  } catch (err) {
    const erroOcr = new Error(
      'OCR indisponível no servidor. Verifique a instalação do Tesseract OCR com pacote de idioma português (por).'
    );
    erroOcr.code = 'OCR_UNAVAILABLE';
    erroOcr.detalhe = err?.message || String(err);
    erroOcr.instrucoesWindows =
      'Instale o Tesseract OCR (https://github.com/UB-Mannheim/tesseract/wiki) em "C:\\Program Files\\Tesseract-OCR" marcando o idioma "Portuguese (por)" durante a instalação.';
    throw erroOcr;
  } finally {
    try {
      if (fs.existsSync(tempPreprocessed)) {
        await fs.promises.unlink(tempPreprocessed);
      }
    } catch {
      // ignora erro de limpeza do temporário
    }
  }
}

/**
 * Verifica se o texto extraído tem conteúdo suficiente de um rótulo/lista de ingredientes.
 */
export function textoPareceRotuloValido(textoBruto) {
  if (!textoBruto || typeof textoBruto !== 'string') return false;
  const textoLimpo = textoBruto.replace(/[\s\r\n]+/g, ' ').trim();
  // Textos com menos de 40 caracteres úteis são inconclusivos
  const apenasLetras = textoLimpo.replace(/[^a-zA-ZÀ-ÿ]/g, '');
  if (textoLimpo.length < 40 || apenasLetras.length < 25) {
    return false;
  }
  return true;
}

/**
 * Separa o texto bruto em:
 * - textoPrincipal: lista de ingredientes e avisos diretos ("CONTÉM ...")
 * - textoTracos: trechos iniciados por "pode conter..." até o ponto final
 */
export function separarSecaoTracos(textoOriginal) {
  const regexPodeConter =
    /(?:al[eé]rgicos\s*:\s*)?pode\s+conter(?:\s+tra[cç]os\s+de)?\s+([^.\n;]+)[.\n;]?/gi;

  const trechosTracos = [];
  let textoPrincipal = textoOriginal;

  let match;
  while ((match = regexPodeConter.exec(textoOriginal)) !== null) {
    trechosTracos.push(match[0]);
  }

  if (trechosTracos.length > 0) {
    textoPrincipal = textoOriginal.replace(regexPodeConter, ' . ');
  }

  return {
    textoPrincipal,
    textoTracos: trechosTracos.join(' . '),
  };
}

/**
 * Remove exceções seguras (ex: "leite de coco", "manteiga de cacau", "trigo sarraceno")
 * antes de aplicar a busca por palavras-chave para evitar falsos positivos.
 */
function mascararExcecoesSeguras(textoNorm) {
  let mascarado = textoNorm;
  for (const excecao of EXCECOES_SEGUROS) {
    const excNorm = normalizar(excecao);
    const rx = new RegExp(`\\b${escaparRegex(excNorm)}\\b`, 'gi');
    mascarado = mascarado.replace(rx, (m) => '_'.repeat(m.length));
  }
  return mascarado;
}

/**
 * Verifica se o trecho antes do match contém uma expressão de negação que invalida a detecção
 * (ex: "não contém glúten", "sem lactose", "zero lactose", "livre de glúten e lactose").
 */
function possuiNegacaoAntes(textoNorm, indiceMatch) {
  const inicioJanela = Math.max(0, indiceMatch - 45);
  const prefixo = textoNorm.slice(inicioJanela, indiceMatch);

  // Caso direto colado ao termo (lookbehind equivalente + variações com artigos/conjunções)
  const regexNegacaoDireta =
    /(?:nao\s+contem|sem|zero|0%|isento\s+de|livre\s+de|nem)\s+(?:adic(?:ao|oes)\s+de\s+)?(?:tra[cç]os\s+de\s+)?(?:[a-z]+\s+(?:e|ou|nem)\s+)?$/i;

  if (regexNegacaoDireta.test(prefixo)) {
    return true;
  }
  return false;
}

/**
 * Busca os termos de uma categoria em um texto, aplicando lookbehind negativo e máscara de exceções.
 */
function detectarTermosNoTexto(textoOriginal, sinonimosOrdenados) {
  if (!textoOriginal || !textoOriginal.trim()) return [];

  const normalizado = normalizarMantendoIndices(
    String(textoOriginal).normalize('NFC').replace(/\s+/g, ' ')
  );
  const textoMascarado = mascararExcecoesSeguras(normalizado);

  const encontrados = new Set();
  // Intervalos já casados por termos mais longos para não duplicar "trigo" dentro de "farinha de trigo"
  const intervalosConsumidos = [];

  for (const termoOriginal of sinonimosOrdenados) {
    const termoNorm = normalizar(termoOriginal);
    if (!termoNorm) continue;

    const padrao =
      `(?<!nao\\s+contem\\s+)(?<!sem\\s+)(?<!zero\\s+)(?<!0%\\s+)(?<!nem\\s+)(?<!isento\\s+de\\s+)(?<!livre\\s+de\\s+)\\b${escaparRegex(termoNorm)}\\b`;
    const regex = new RegExp(padrao, 'gi');

    let match;
    while ((match = regex.exec(textoMascarado)) !== null) {
      const inicio = match.index;
      const fim = inicio + match[0].length;

      if (possuiNegacaoAntes(textoMascarado, inicio)) {
        continue;
      }

      const jaCoberto = intervalosConsumidos.some(
        ([i, f]) => inicio >= i && fim <= f
      );
      if (!jaCoberto) {
        intervalosConsumidos.push([inicio, fim]);
        encontrados.add(termoOriginal);
      }
    }
  }

  return Array.from(encontrados);
}

/**
 * Extrai a lista de ingredientes individuais a partir do texto bruto e classifica cada um.
 */
export function extrairIngredientesDetalhados(
  textoBruto,
  restricoesAtivas,
  mapaSinonimosPorCategoria
) {
  if (!textoBruto) return [];

  // Procura seção após "ingredientes:" ou "ingredientes" até um ponto final ou alerta alérgico
  let trechoIngredientes = '';
  const matchIng = textoBruto.match(
    /ingredientes\s*[:\-]?\s*([\s\S]*?)(?:\.\s*(?:al[eé]rgicos|pode\s+conter|cont[eé]m|n[aã]o\s+cont[eé]m|$)|\n\s*(?:al[eé]rgicos|pode\s+conter|cont[eé]m|n[aã]o\s+cont[eé]m)|$)/i
  );

  if (matchIng && matchIng[1] && matchIng[1].trim().length >= 3) {
    trechoIngredientes = matchIng[1].trim();
  } else {
    // Se não houver a palavra "Ingredientes:", usa a primeira sentença antes de "ALÉRGICOS" / "PODE CONTER" / "CONTÉM"
    trechoIngredientes = textoBruto
      .split(/\b(?:al[eé]rgicos|pode\s+conter|n[aã]o\s+cont[eé]m\s+gl[uú]ten|cont[eé]m\s+gl[uú]ten|cont[eé]m\s+lactose)\b/i)[0]
      .trim();
  }

  // Remove ponto final solto no fim
  trechoIngredientes = trechoIngredientes.replace(/\.\s*$/, '').trim();
  if (!trechoIngredientes) return [];

  // Divide por vírgula, ponto-e-vírgula ou ponto (respeitando parênteses)
  const partes = [];
  let atual = '';
  let nivelParenteses = 0;

  for (let i = 0; i < trechoIngredientes.length; i++) {
    const ch = trechoIngredientes[i];
    if (ch === '(' || ch === '[') nivelParenteses++;
    else if ((ch === ')' || ch === ']') && nivelParenteses > 0) nivelParenteses--;

    if (
      nivelParenteses === 0 &&
      (ch === ',' || ch === ';' || (ch === '.' && i < trechoIngredientes.length - 1))
    ) {
      partes.push(atual.trim());
      atual = '';
    } else {
      atual += ch;
    }
  }
  if (atual.trim()) partes.push(atual.trim());

  // Separa também o último item caso tenha " e " fora de parênteses (ex: "sal e corante")
  const itensLimpos = [];
  for (const bruta of partes) {
    const limpa = bruta
      .replace(/^[\s•\-*:\d.)]+/, '')
      .replace(/[\s.]+$/, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (limpa.length < 2) continue;
    // Ignora frases de negação que caíram na lista
    if (/^(?:nao contem|sem |zero |isento de |alergicos)/i.test(normalizar(limpa))) {
      continue;
    }
    itensLimpos.push(capitalizar(limpa));
  }

  const detalhados = [];
  for (const item of itensLimpos) {
    let risco = false;
    const fontes = [];

    for (const cat of restricoesAtivas) {
      const sinonimos = mapaSinonimosPorCategoria[cat] || [];
      const achados = detectarTermosNoTexto(item, sinonimos);
      if (achados.length > 0) {
        risco = true;
        fontes.push(`Fonte de ${ROTULOS_CATEGORIA[cat] || capitalizar(cat)}`);
      }
    }

    detalhados.push({
      nome: item,
      risco,
      fonte: risco ? fontes.join(' / ') : null,
    });
  }

  // Ordena itens de risco no topo (mantendo a ordem relativa)
  const comRisco = detalhados.filter((d) => d.risco);
  const semRisco = detalhados.filter((d) => !d.risco);
  return [...comRisco, ...semRisco];
}

/**
 * Carrega o dicionário de alérgenos do MongoDB (com fallback para DICIONARIO_PADRAO),
 * ordenando sinônimos do mais longo para o mais curto.
 */
export async function carregarMapaDicionario() {
  const docs = await AllergenDictionary.find().lean();
  const mapa = {};

  for (const cat of ['gluten', 'lactose', 'amendoim']) {
    const doc = docs.find((d) => d.categoria === cat);
    const lista =
      doc && Array.isArray(doc.sinonimos) && doc.sinonimos.length > 0
        ? doc.sinonimos
        : DICIONARIO_PADRAO[cat] || [];
    mapa[cat] = [...lista].sort((a, b) => b.length - a.length);
  }

  return mapa;
}

/**
 * Analisa o texto bruto contra as restrições e níveis de sensibilidade do usuário.
 */
export async function analisarTextoRotulo({
  textoBruto,
  restricoes = [],
  niveisSensibilidade = { gluten: 1, lactose: 1, amendoim: 1 },
}) {
  if (!textoPareceRotuloValido(textoBruto)) {
    return {
      veredito: 'INCONCLUSIVO',
      textoBruto: textoBruto || '',
    };
  }

  const restricoesAtivas = Array.isArray(restricoes)
    ? restricoes.filter((r) => ['gluten', 'lactose', 'amendoim'].includes(r))
    : [];

  const mapaSinonimos = await carregarMapaDicionario();
  const { textoPrincipal, textoTracos } = separarSecaoTracos(textoBruto);

  const alergicosDetectados = [];

  for (const categoria of restricoesAtivas) {
    const sinonimos = mapaSinonimos[categoria] || [];
    const nivel =
      typeof niveisSensibilidade?.[categoria] === 'number'
        ? niveisSensibilidade[categoria]
        : 1;

    const termosContem = detectarTermosNoTexto(textoPrincipal, sinonimos);
    if (termosContem.length > 0) {
      alergicosDetectados.push({
        categoria,
        tipo: 'CONTEM',
        termo: termosContem[0] || '',
        trecho: termosContem.join(', '),
        aproximado: false,
        termos: termosContem,
      });
      continue;
    }

    // Seção "pode conter": nível 0 (Leve) ignora traços; níveis 1 (Moderado) e 2 (Grave) alertam como TRACOS
    if (nivel >= 1 && textoTracos) {
      const termosTracos = detectarTermosNoTexto(textoTracos, sinonimos);
      if (termosTracos.length > 0) {
        alergicosDetectados.push({
          categoria,
          tipo: 'TRACOS',
          termo: termosTracos[0] || '',
          trecho: termosTracos.join(', '),
          aproximado: false,
          termos: termosTracos,
        });
      }
    }
  }

  const veredito = alergicosDetectados.length > 0 ? 'PERIGOSO' : 'SEGURO';

  let ingredientesDetalhados = extrairIngredientesDetalhados(
    textoBruto,
    restricoesAtivas,
    mapaSinonimos
  );

  // Se o alerta veio apenas de "CONTÉM GLÚTEN" / "PODE CONTER LEITE" fora da lista ou se nenhum item individual casou,
  // garante que os termos detectados apareçam no topo de ingredientesDetalhados
  if (veredito === 'PERIGOSO' && !ingredientesDetalhados.some((i) => i.risco)) {
    const extrasRisco = [];
    for (const det of alergicosDetectados) {
      const rotuloCat = ROTULOS_CATEGORIA[det.categoria] || capitalizar(det.categoria);
      for (const termo of det.termos) {
        extrasRisco.push({
          nome:
            det.tipo === 'TRACOS'
              ? `${capitalizar(termo)} (traços)`
              : capitalizar(termo),
          risco: true,
          fonte:
            det.tipo === 'TRACOS'
              ? `Traços de ${rotuloCat}`
              : `Fonte de ${rotuloCat}`,
        });
      }
    }
    ingredientesDetalhados = [...extrasRisco, ...ingredientesDetalhados];
  }

  // Cálculo do nomeProduto automático
  let nomeProduto = 'Produto analisado';
  if (veredito === 'PERIGOSO') {
    const nomesContem = alergicosDetectados
      .filter((a) => a.tipo === 'CONTEM')
      .map((a) => ROTULOS_CATEGORIA[a.categoria] || capitalizar(a.categoria));
    const nomesTracos = alergicosDetectados
      .filter((a) => a.tipo === 'TRACOS')
      .map((a) => ROTULOS_CATEGORIA[a.categoria] || capitalizar(a.categoria));

    if (nomesContem.length > 0) {
      nomeProduto = `Produto com ${juntarLista(nomesContem)}`;
    } else if (nomesTracos.length > 0) {
      nomeProduto = `Produto com traços de ${juntarLista(nomesTracos)}`;
    }
  } else {
    const nomesRestricoes = restricoesAtivas.map(
      (cat) => ROTULOS_CATEGORIA[cat] || capitalizar(cat)
    );
    if (nomesRestricoes.length > 0) {
      nomeProduto = `Produto sem ${juntarLista(nomesRestricoes)}`;
    } else {
      nomeProduto = 'Produto sem restrições detectadas';
    }
  }

  return {
    veredito,
    nomeProduto,
    nomeAutomatico: true,
    nomeBusca: normalizar(nomeProduto),
    textoBruto: textoBruto.trim(),
    alergicosDetectados,
    ingredientesDetalhados,
  };
}
