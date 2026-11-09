import AsyncStorage from "@react-native-async-storage/async-storage";
import api from "./api";
import { nomeProfissional } from "./vinculo";
import type { Vinculo } from "./vinculo";
import {
  ROTULO_CATEGORIA,
  formatarResumoAlergicos,
  obterDicaDoDia,
} from "../utils/datas";

/**
 * Central de notificações do RotuScan.
 *
 * O backend não possui uma coleção de notificações. O feed é montado no app a
 * partir de eventos reais devolvidos pela API:
 *   - RISCO       -> GET /users/historico?filtro=Risco (scans PERIGOSO)
 *   - RESTRICOES  -> GET /users/perfil (restricoesAtualizadasPor/Em)
 *   - VINCULO     -> GET /users/perfil (vinculo: PENDENTE/APROVADO/RECUSADO)
 *   - DICA        -> dica do dia (utils/datas.ts)
 *
 * Apenas o estado "lida/dispensada" é salvo localmente (AsyncStorage), por usuário.
 */

export type TipoNotificacao = "RISCO" | "RESTRICOES" | "VINCULO" | "DICA";

export type RotaNotificacao = {
  pathname: string;
  params?: Record<string, string>;
};

export type Notificacao = {
  id: string;
  tipo: TipoNotificacao;
  titulo: string;
  descricao: string;
  data: string;
  rota: RotaNotificacao | null;
};

export type EstadoNotificacoes = {
  lidas: string[];
  ocultas: string[];
};

type AlergicoApi = {
  categoria: string;
  tipo: "CONTEM" | "TRACOS";
  termos?: string[];
};

type ItemHistoricoRisco = {
  id?: string;
  _id?: string;
  nomeProduto?: string;
  alergicosDetectados?: unknown;
  createdAt?: string;
};

const LIMITE_RISCOS = 30;
const LIMITE_IDS_SALVOS = 500;

export function estadoVazio(): EstadoNotificacoes {
  return { lidas: [], ocultas: [] };
}

function chaveEstado(usuarioId: string): string {
  return `@notificacoes_estado:${usuarioId}`;
}

function dataValida(valor: unknown): string | null {
  if (typeof valor !== "string" && !(valor instanceof Date)) return null;
  const dt = new Date(valor);
  return Number.isNaN(dt.getTime()) ? null : dt.toISOString();
}

function inicioDeHojeISO(): string {
  const agora = new Date();
  return new Date(
    agora.getFullYear(),
    agora.getMonth(),
    agora.getDate()
  ).toISOString();
}

function chaveDia(iso: string): string {
  const dt = new Date(iso);
  const mes = String(dt.getMonth() + 1).padStart(2, "0");
  const dia = String(dt.getDate()).padStart(2, "0");
  return `${dt.getFullYear()}-${mes}-${dia}`;
}

function notificacoesDeRisco(itens: ItemHistoricoRisco[]): Notificacao[] {
  const lista: Notificacao[] = [];

  itens.forEach((item) => {
    const id = String(item.id || item._id || "");
    const data = dataValida(item.createdAt);
    if (!id || !data) return;

    const alergicos = (
      Array.isArray(item.alergicosDetectados) ? item.alergicosDetectados : []
    ).filter(
      (a): a is AlergicoApi => Boolean(a) && typeof a === "object"
    );

    lista.push({
      id: `scan:${id}`,
      tipo: "RISCO",
      titulo: `Alerta: ${item.nomeProduto || "Produto analisado"}`,
      descricao: formatarResumoAlergicos("PERIGOSO", alergicos),
      data,
      rota: { pathname: "/resultado", params: { id } },
    });
  });

  return lista;
}

function notificacaoDeRestricoes(
  usuario: any
): Notificacao | null {
  if (usuario?.restricoesAtualizadasPor !== "NUTRICIONISTA") return null;
  const data = dataValida(usuario?.restricoesAtualizadasEm);
  if (!data) return null;

  const restricoes: string[] = Array.isArray(usuario?.restricoes)
    ? usuario.restricoes
    : [];
  const lista = restricoes
    .map((r) => ROTULO_CATEGORIA[String(r).toLowerCase()] || String(r))
    .join(", ");

  return {
    id: `restricoes:${data}`,
    tipo: "RESTRICOES",
    titulo: "Seu nutricionista atualizou suas restrições",
    descricao: lista
      ? `Restrições ativas agora: ${lista}.`
      : "Nenhuma restrição ativa no momento.",
    data,
    rota: { pathname: "/editar-perfil" },
  };
}

function notificacaoDeVinculo(vinculo?: Vinculo | null): Notificacao | null {
  if (!vinculo || vinculo.estado === "NENHUM") return null;

  const data = dataValida(vinculo.atualizadoEm) || dataValida(vinculo.vinculadoEm);
  if (!data) return null;

  const nome = vinculo.nutricionista
    ? nomeProfissional(vinculo.nutricionista)
    : "O nutricionista";

  if (vinculo.estado === "APROVADO") {
    return {
      id: `vinculo:APROVADO:${data}`,
      tipo: "VINCULO",
      titulo: "Vínculo aprovado",
      descricao: `${nome} agora acompanha suas restrições alimentares.`,
      data,
      rota: { pathname: "/perfil" },
    };
  }

  if (vinculo.estado === "PENDENTE") {
    return {
      id: `vinculo:PENDENTE:${data}`,
      tipo: "VINCULO",
      titulo: "Solicitação de vínculo em análise",
      descricao: `Aguardando ${nome} responder à sua solicitação.`,
      data,
      rota: { pathname: "/vincular-nutricionista" },
    };
  }

  return {
    id: `vinculo:RECUSADO:${data}`,
    tipo: "VINCULO",
    titulo: "Solicitação de vínculo recusada",
    descricao: `${nome} não aceitou o vínculo. Você pode enviar uma nova solicitação.`,
    data,
    rota: { pathname: "/vincular-nutricionista" },
  };
}

function notificacaoDica(): Notificacao {
  const data = inicioDeHojeISO();
  return {
    id: `dica:${chaveDia(data)}`,
    tipo: "DICA",
    titulo: "Dica do dia",
    descricao: obterDicaDoDia(),
    data,
    rota: null,
  };
}

/**
 * Consulta a API e monta a lista de notificações, da mais recente para a mais antiga.
 * Se uma das duas consultas falhar, usa a outra; se ambas falharem, lança o erro.
 */
export async function buscarNotificacoes(): Promise<Notificacao[]> {
  const [resPerfil, resRiscos] = await Promise.allSettled([
    api.get("/users/perfil"),
    api.get(`/users/historico?filtro=Risco&limit=${LIMITE_RISCOS}`),
  ]);

  if (resPerfil.status === "rejected" && resRiscos.status === "rejected") {
    throw resPerfil.reason;
  }

  const lista: Notificacao[] = [notificacaoDica()];

  if (resPerfil.status === "fulfilled") {
    const dados = resPerfil.value.data;
    const usuario = dados?.usuario || dados;
    const vinculo: Vinculo | undefined = dados?.vinculo || usuario?.vinculo;

    const restricoes = notificacaoDeRestricoes(usuario);
    if (restricoes) lista.push(restricoes);

    const vinc = notificacaoDeVinculo(vinculo);
    if (vinc) lista.push(vinc);
  }

  if (resRiscos.status === "fulfilled") {
    const itens = resRiscos.value.data?.itens;
    if (Array.isArray(itens)) {
      lista.push(...notificacoesDeRisco(itens));
    }
  }

  return lista.sort(
    (a, b) => new Date(b.data).getTime() - new Date(a.data).getTime()
  );
}

export async function carregarEstado(
  usuarioId: string
): Promise<EstadoNotificacoes> {
  try {
    const bruto = await AsyncStorage.getItem(chaveEstado(usuarioId));
    if (!bruto) return estadoVazio();
    const parsed = JSON.parse(bruto);
    const somenteTexto = (v: unknown): string[] =>
      Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
    return {
      lidas: somenteTexto(parsed?.lidas),
      ocultas: somenteTexto(parsed?.ocultas),
    };
  } catch {
    return estadoVazio();
  }
}

export async function salvarEstado(
  usuarioId: string,
  estado: EstadoNotificacoes
): Promise<void> {
  try {
    await AsyncStorage.setItem(
      chaveEstado(usuarioId),
      JSON.stringify({
        lidas: estado.lidas.slice(-LIMITE_IDS_SALVOS),
        ocultas: estado.ocultas.slice(-LIMITE_IDS_SALVOS),
      })
    );
  } catch {
    // Falha ao persistir não deve quebrar a tela; o estado segue em memória.
  }
}
