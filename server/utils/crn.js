function escaparRegExp(valor) {
  return valor.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function parseCrn(texto) {
  if (typeof texto !== 'string') return null;
  const match = texto.match(
    /^\s*CRN\s*[-/]?\s*(\d{1,2})[\s/-]+(\d+(?:\.\d+)*)\s*$/i
  );
  if (!match) return null;

  const regiao = Number(match[1]);
  const numero = match[2].replace(/\./g, '');
  if (regiao < 1 || regiao > 11 || numero.length < 3 || numero.length > 6) {
    return null;
  }

  return { regiao, numero };
}

export function normalizarCrn(texto) {
  const parsed = parseCrn(texto);
  return parsed ? `CRN-${parsed.regiao} ${parsed.numero}` : null;
}

export function regexCrn(texto) {
  const parsed = parseCrn(texto);
  if (!parsed) {
    throw new TypeError('CRN inválido. Ex.: CRN-3 12345');
  }

  const numeroComPontosOpcionais = [...parsed.numero]
    .map(escaparRegExp)
    .join('\\.?');
  const regiao = escaparRegExp(String(parsed.regiao));
  return new RegExp(
    `^\\s*CRN\\s*[-/]?\\s*${regiao}[\\s/-]+${numeroComPontosOpcionais}\\s*$`,
    'i'
  );
}
