


export function normalizar(texto) {
  return String(texto ?? '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}


export function normalizarMantendoIndices(original) {
  let saida = '';
  for (let i = 0; i < original.length; i += 1) {
    const ch = original[i];
    const mapeado = ch.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
    saida += mapeado.length === 1 ? mapeado : mapeado[0] || ' ';
  }
  return saida;
}


export function escaparRegex(texto) {
  return String(texto).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const CLASSES_ACENTOS = {
  a: 'aàáâãäåāăą',
  c: 'cçćĉċč',
  d: 'dďđ',
  e: 'eèéêëēĕėęě',
  g: 'gĝğġģ',
  h: 'hĥħ',
  i: 'iìíîïĩīĭįı',
  j: 'jĵ',
  k: 'kķ',
  l: 'lĺļľł',
  n: 'nñńņň',
  o: 'oòóôõöøōő',
  r: 'rŕŗř',
  s: 'sśŝşš',
  t: 'tţť',
  u: 'uùúûüũūŭůűų',
  w: 'wŵ',
  y: 'yýÿŷ',
  z: 'zźżž',
};

export function regexInsensivelAcentos(texto) {
  return [...normalizar(texto)]
    .map((caractere) => {
      const classe = CLASSES_ACENTOS[caractere];
      return classe ? `[${classe}]` : escaparRegex(caractere);
    })
    .join('');
}

/** Junta uma lista em português: ["A"] -> "A"; ["A","B"] -> "A e B"; ["A","B","C"] -> "A, B e C". */
export function juntarLista(itens) {
  const lista = itens.filter(Boolean);
  if (lista.length <= 1) return lista[0] || '';
  return `${lista.slice(0, -1).join(', ')} e ${lista[lista.length - 1]}`;
}

/** Primeira letra maiúscula. */
export function capitalizar(texto) {
  const t = String(texto || '').trim();
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : t;
}

/**
 * "Chave OCR": aplica, caractere a caractere (preservando o comprimento), as confusões
 * típicas do Tesseract sobre um texto JÁ normalizado (minúsculo, sem acento):
 *   i, 1, | -> l     0 -> o     5 -> s
 * É aplicada aos DOIS lados da comparação (texto lido e termo do dicionário), então
 * "Ieite" e "leite" viram ambos "lelte"; "TRIG0" e "trigo" viram ambos "trlgo".
 */
const MAPA_CONFUSOES_OCR = { i: 'l', 1: 'l', '|': 'l', 0: 'o', 5: 's' };
export function chaveOcr(textoNormalizado) {
  let saida = '';
  const s = String(textoNormalizado ?? '');
  for (let i = 0; i < s.length; i += 1) {
    const ch = s[i];
    saida += MAPA_CONFUSOES_OCR[ch] ?? ch;
  }
  return saida;
}

/** Normaliza (sem acento, minúsculo) e aplica a chave OCR. Não preserva índices. */
export function chaveTermo(texto) {
  return chaveOcr(normalizar(texto));
}

/**
 * Distância de Damerau-Levenshtein (variante "optimal string alignment": inserção,
 * remoção, substituição e transposição de vizinhos). Para cedo quando passa de `maximo`.
 */
export function distanciaDamerau(a, b, maximo = Infinity) {
  const s = String(a);
  const t = String(b);
  if (s === t) return 0;
  if (Math.abs(s.length - t.length) > maximo) return maximo + 1;
  const n = s.length;
  const m = t.length;
  if (n === 0) return m;
  if (m === 0) return n;

  let anterior2 = new Array(m + 1).fill(0);
  let anterior = Array.from({ length: m + 1 }, (_, j) => j);
  let atual = new Array(m + 1).fill(0);

  for (let i = 1; i <= n; i += 1) {
    atual[0] = i;
    let menorDaLinha = atual[0];
    for (let j = 1; j <= m; j += 1) {
      const custo = s[i - 1] === t[j - 1] ? 0 : 1;
      let v = Math.min(anterior[j] + 1, atual[j - 1] + 1, anterior[j - 1] + custo);
      if (i > 1 && j > 1 && s[i - 1] === t[j - 2] && s[i - 2] === t[j - 1]) {
        v = Math.min(v, anterior2[j - 2] + 1);
      }
      atual[j] = v;
      if (v < menorDaLinha) menorDaLinha = v;
    }
    if (menorDaLinha > maximo) return maximo + 1;
    [anterior2, anterior, atual] = [anterior, atual, anterior2];
  }
  return anterior[m];
}

/** Quantidade de letras (a-z, com ou sem acento) em um texto. */
export function contarLetras(texto) {
  const m = String(texto ?? '').match(/\p{L}/gu);
  return m ? m.length : 0;
}

/**
 * Prepara um texto para busca preservando índices:
 *   original -> NFC + espaços colapsados ("orig")
 *   plano    -> minúsculo sem acento, mesmo comprimento
 *   chave    -> plano + confusões de OCR, mesmo comprimento
 */
export function prepararTextoBusca(texto) {
  const orig = String(texto ?? '').normalize('NFC').replace(/\s+/g, ' ');
  const plano = normalizarMantendoIndices(orig);
  return { orig, plano, chave: chaveOcr(plano) };
}

const CHAVE_INGREDIENTES = chaveTermo('ingredientes'); // "lngredlentes"

/**
 * Localiza o marcador da lista de ingredientes de forma tolerante ("ingredientes",
 * "ingred.", "ingr", "1NGREDIENTES", "lngredientes", "ingredlentes" com até 2 erros).
 * Recebe a CHAVE OCR (ver prepararTextoBusca) e devolve { inicio, fim } ou null.
 */
export function localizarMarcadorIngredientes(chave) {
  const exato = /\b(lngredlentes?|lngred|lngr)\b\.?\s*[:;\-–]?/.exec(chave);
  if (exato) return { inicio: exato.index, fim: exato.index + exato[0].length };

  const rx = /[a-z]{9,14}/g;
  let m;
  while ((m = rx.exec(chave)) !== null) {
    if (distanciaDamerau(m[0], CHAVE_INGREDIENTES, 2) <= 2) {
      const resto = /^\.?\s*[:;\-–]?/.exec(chave.slice(m.index + m[0].length));
      return { inicio: m.index, fim: m.index + m[0].length + (resto ? resto[0].length : 0) };
    }
  }
  return null;
}

export function temMarcadorIngredientes(texto) {
  return localizarMarcadorIngredientes(prepararTextoBusca(texto).chave) !== null;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export function emailValido(email) {
  return EMAIL_REGEX.test(String(email || '').trim());
}
