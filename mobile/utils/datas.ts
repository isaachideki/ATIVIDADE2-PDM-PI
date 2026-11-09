const MESES_ABREV_PT = [
  "Jan",
  "Fev",
  "Mar",
  "Abr",
  "Mai",
  "Jun",
  "Jul",
  "Ago",
  "Set",
  "Out",
  "Nov",
  "Dez",
];

function chaveDiaLocal(d: Date): string {
  const ano = d.getFullYear();
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
}

/**
 * Formata uma data no fuso do aparelho como:
 * "Hoje", "Ontem" ou "06 de Set, 2026"
 */
export function formatarGrupoData(dataInput?: string | Date | null): string {
  if (!dataInput) return "Hoje";
  const dt = typeof dataInput === "string" ? new Date(dataInput) : dataInput;
  if (!dt || Number.isNaN(dt.getTime())) return "Hoje";

  const agora = new Date();
  const ontem = new Date(
    agora.getFullYear(),
    agora.getMonth(),
    agora.getDate() - 1
  );

  const chaveAlvo = chaveDiaLocal(dt);
  const chaveAgora = chaveDiaLocal(agora);
  const chaveOntem = chaveDiaLocal(ontem);

  if (chaveAlvo === chaveAgora || dt.getTime() > agora.getTime()) {
    return "Hoje";
  }
  if (chaveAlvo === chaveOntem) {
    return "Ontem";
  }

  const dia = String(dt.getDate()).padStart(2, "0");
  const mes = MESES_ABREV_PT[dt.getMonth()] || "Jan";
  const ano = dt.getFullYear();
  return `${dia} de ${mes}, ${ano}`;
}

/**
 * Formata o horário no fuso do aparelho como "HH:mm"
 */
export function formatarHorario(dataInput?: string | Date | null): string {
  if (!dataInput) return "--:--";
  const dt = typeof dataInput === "string" ? new Date(dataInput) : dataInput;
  if (Number.isNaN(dt.getTime())) return "--:--";

  const horas = String(dt.getHours()).padStart(2, "0");
  const minutos = String(dt.getMinutes()).padStart(2, "0");
  return `${horas}:${minutos}`;
}

export const DICAS_DO_DIA = [
  "Substitua o leite por bebidas vegetais de amêndoas, coco ou aveia sem glúten para uma digestão mais leve.",
  "Atenção ao malte de cevada e ao extrato de malte em achocolatados e cereais: ambos contêm glúten.",
  "Soro de leite (whey), caseína e lactoalbumina são derivados lácteos e devem ser evitados por quem tem restrição severa.",
  "Produtos com o aviso 'Pode conter traços' compartilham maquinário na fábrica; confira sempre seu nível de sensibilidade.",
  "Farinha de arroz, fécula de batata, polvilho e quinoa real são excelentes alternativas naturalmente sem glúten.",
  "Manteiga de cacau e ácido láctico não possuem lactose em sua composição, apesar do nome parecido.",
];

export function obterDicaDoDia(dataRef: Date = new Date()): string {
  const inicioAno = new Date(dataRef.getFullYear(), 0, 0);
  const diff = dataRef.getTime() - inicioAno.getTime();
  const diaDoAno = Math.floor(diff / (1000 * 60 * 60 * 24));
  return DICAS_DO_DIA[Math.abs(diaDoAno) % DICAS_DO_DIA.length];
}

export const ROTULO_CATEGORIA: Record<string, string> = {
  gluten: "Glúten",
  lactose: "Lactose",
  amendoim: "Amendoim",
};

export function formatarResumoAlergicos(
  veredito: "SEGURO" | "PERIGOSO",
  alergicosDetectados?: {
    categoria: string;
    tipo: "CONTEM" | "TRACOS";
    termos?: string[];
  }[]
): string {
  if (veredito === "SEGURO") {
    return "Seguro";
  }

  if (!Array.isArray(alergicosDetectados) || alergicosDetectados.length === 0) {
    return "Restrição encontrada";
  }

  const contem = alergicosDetectados
    .filter((a) => a.tipo === "CONTEM")
    .map((a) => ROTULO_CATEGORIA[a.categoria] || a.categoria);

  const tracos = alergicosDetectados
    .filter((a) => a.tipo === "TRACOS")
    .map((a) => ROTULO_CATEGORIA[a.categoria] || a.categoria);

  if (contem.length > 0) {
    return `Contém ${contem.join(" e ")}`;
  }
  if (tracos.length > 0) {
    return `Pode conter traços de ${tracos.join(" e ")}`;
  }
  return "Restrição encontrada";
}


/**
 * Texto curto de tempo decorrido para listas de notificações:
 * "agora", "há 5 min", "há 3 h", "Ontem, 14:30" ou "06 de Set, 2026 · 14:30".
 */
export function formatarTempoRelativo(
  dataInput?: string | Date | null
): string {
  if (!dataInput) return "";
  const dt = typeof dataInput === "string" ? new Date(dataInput) : dataInput;
  if (!dt || Number.isNaN(dt.getTime())) return "";

  const minutos = Math.floor((Date.now() - dt.getTime()) / 60000);
  if (minutos < 1) return "agora";
  if (minutos < 60) return `há ${minutos} min`;

  const grupo = formatarGrupoData(dt);
  if (grupo === "Hoje") return `há ${Math.floor(minutos / 60)} h`;
  if (grupo === "Ontem") return `Ontem, ${formatarHorario(dt)}`;
  return `${grupo} · ${formatarHorario(dt)}`;
}

export type SecaoNotificacao = "Hoje" | "Esta semana" | "Anteriores";

/**
 * Classifica uma data em seção da central de notificações,
 * comparando dias de calendário no fuso do aparelho.
 */
export function secaoDaData(
  dataInput?: string | Date | null
): SecaoNotificacao {
  if (!dataInput) return "Anteriores";
  const dt = typeof dataInput === "string" ? new Date(dataInput) : dataInput;
  if (!dt || Number.isNaN(dt.getTime())) return "Anteriores";

  const agora = new Date();
  const inicioHoje = new Date(
    agora.getFullYear(),
    agora.getMonth(),
    agora.getDate()
  );
  const inicioData = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate());
  const dias = Math.round(
    (inicioHoje.getTime() - inicioData.getTime()) / 86400000
  );

  if (dias <= 0) return "Hoje";
  if (dias < 7) return "Esta semana";
  return "Anteriores";
}
