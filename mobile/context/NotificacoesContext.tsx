import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AppState } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { useAuth } from "./AuthContext";
import { extrairMensagemErro } from "../services/api";
import {
  buscarNotificacoes,
  carregarEstado,
  estadoVazio,
  salvarEstado,
} from "../services/notificacoes";
import type {
  EstadoNotificacoes,
  Notificacao,
} from "../services/notificacoes";

export type NotificacaoComEstado = Notificacao & { lida: boolean };

type NotificacoesContextType = {
  notificacoes: NotificacaoComEstado[];
  naoLidas: number;
  carregando: boolean;
  atualizando: boolean;
  erro: string | null;
  recarregar: (opcoes?: { forcar?: boolean }) => Promise<void>;
  marcarComoLida: (id: string) => void;
  marcarTodasComoLidas: () => void;
  dispensar: (id: string) => void;
};

/**
 * Os dados ficam "etiquetados" com o id do usuário a que pertencem. Se a conta
 * mudar (logout/login), os dados antigos são ignorados automaticamente.
 */
type DadosDoUsuario = {
  usuarioId: string | null;
  brutas: Notificacao[];
  estado: EstadoNotificacoes;
};

type ErroDoUsuario = {
  usuarioId: string | null;
  mensagem: string | null;
};

const INTERVALO_MINIMO_MS = 30_000;

const DADOS_VAZIOS: DadosDoUsuario = {
  usuarioId: null,
  brutas: [],
  estado: estadoVazio(),
};

const NotificacoesContext = createContext<NotificacoesContextType>({
  notificacoes: [],
  naoLidas: 0,
  carregando: false,
  atualizando: false,
  erro: null,
  recarregar: async () => {},
  marcarComoLida: () => {},
  marcarTodasComoLidas: () => {},
  dispensar: () => {},
});

export function NotificacoesProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { usuarioAtual } = useAuth();
  const usuarioId = usuarioAtual?.id ?? null;
  const habilitado = Boolean(usuarioId) && usuarioAtual?.role !== "NUTRICIONISTA";

  const [dados, setDados] = useState<DadosDoUsuario>(DADOS_VAZIOS);
  const [concluidoPara, setConcluidoPara] = useState<string | null>(null);
  const [atualizando, setAtualizando] = useState(false);
  const [erroEstado, setErroEstado] = useState<ErroDoUsuario>({
    usuarioId: null,
    mensagem: null,
  });

  const estadoRef = useRef<EstadoNotificacoes>(estadoVazio());
  const ultimaBusca = useRef(0);
  const emAndamento = useRef(false);
  const requisicaoAtual = useRef(0);

  const recarregar = useCallback(
    async (opcoes?: { forcar?: boolean }) => {
      if (!usuarioId || !habilitado) return;

      if (!opcoes?.forcar) {
        if (emAndamento.current) return;
        if (Date.now() - ultimaBusca.current < INTERVALO_MINIMO_MS) return;
      }

      // Evita chamar a API antes do token existir (o interceptor trataria 401 como sessão expirada).
      const token = await AsyncStorage.getItem("@rotuscan_token");
      if (!token) {
        setConcluidoPara(usuarioId);
        return;
      }

      const minhaRequisicao = ++requisicaoAtual.current;
      emAndamento.current = true;
      setAtualizando(true);

      try {
        const [lista, estadoSalvo] = await Promise.all([
          buscarNotificacoes(),
          carregarEstado(usuarioId),
        ]);
        if (minhaRequisicao !== requisicaoAtual.current) return;

        estadoRef.current = estadoSalvo;
        setDados({ usuarioId, brutas: lista, estado: estadoSalvo });
        setErroEstado({ usuarioId, mensagem: null });
        ultimaBusca.current = Date.now();
      } catch (e: any) {
        if (minhaRequisicao === requisicaoAtual.current) {
          setErroEstado({ usuarioId, mensagem: extrairMensagemErro(e) });
        }
      } finally {
        if (minhaRequisicao === requisicaoAtual.current) {
          emAndamento.current = false;
          setAtualizando(false);
          setConcluidoPara(usuarioId);
        }
      }
    },
    [usuarioId, habilitado]
  );

  // Login/troca de conta: invalida buscas antigas e carrega o feed do usuário atual.
  useEffect(() => {
    requisicaoAtual.current += 1;
    emAndamento.current = false;
    ultimaBusca.current = 0;
    estadoRef.current = estadoVazio();
    const agendado = setTimeout(() => {
      void recarregar({ forcar: true });
    }, 0);
    return () => clearTimeout(agendado);
  }, [recarregar]);

  // Ao voltar para o app (background -> ativo), atualiza respeitando o intervalo mínimo.
  useEffect(() => {
    const sub = AppState.addEventListener("change", (status) => {
      if (status === "active") void recarregar();
    });
    return () => sub.remove();
  }, [recarregar]);

  const dadosAtuais =
    habilitado && dados.usuarioId === usuarioId ? dados : DADOS_VAZIOS;
  const carregando = habilitado && concluidoPara !== usuarioId;
  const erro =
    habilitado && erroEstado.usuarioId === usuarioId
      ? erroEstado.mensagem
      : null;

  const aplicarEstado = useCallback(
    (alterar: (atual: EstadoNotificacoes) => EstadoNotificacoes) => {
      if (!usuarioId) return;
      const proximo = alterar(estadoRef.current);
      if (proximo === estadoRef.current) return;
      estadoRef.current = proximo;
      setDados((anterior) =>
        anterior.usuarioId === usuarioId
          ? { ...anterior, estado: proximo }
          : anterior
      );
      void salvarEstado(usuarioId, proximo);
    },
    [usuarioId]
  );

  const notificacoes = useMemo<NotificacaoComEstado[]>(() => {
    const lidas = new Set(dadosAtuais.estado.lidas);
    const ocultas = new Set(dadosAtuais.estado.ocultas);
    return dadosAtuais.brutas
      .filter((n) => !ocultas.has(n.id))
      .map((n) => ({ ...n, lida: lidas.has(n.id) }));
  }, [dadosAtuais]);

  const naoLidas = useMemo(
    () => notificacoes.filter((n) => !n.lida).length,
    [notificacoes]
  );

  const marcarComoLida = useCallback(
    (id: string) => {
      aplicarEstado((atual) =>
        atual.lidas.includes(id)
          ? atual
          : { ...atual, lidas: [...atual.lidas, id] }
      );
    },
    [aplicarEstado]
  );

  const marcarTodasComoLidas = useCallback(() => {
    aplicarEstado((atual) => {
      const jaLidas = new Set(atual.lidas);
      const novas = notificacoes
        .map((n) => n.id)
        .filter((id) => !jaLidas.has(id));
      return novas.length === 0
        ? atual
        : { ...atual, lidas: [...atual.lidas, ...novas] };
    });
  }, [aplicarEstado, notificacoes]);

  const dispensar = useCallback(
    (id: string) => {
      aplicarEstado((atual) => ({
        lidas: atual.lidas.includes(id) ? atual.lidas : [...atual.lidas, id],
        ocultas: atual.ocultas.includes(id)
          ? atual.ocultas
          : [...atual.ocultas, id],
      }));
    },
    [aplicarEstado]
  );

  const valor = useMemo<NotificacoesContextType>(
    () => ({
      notificacoes,
      naoLidas,
      carregando,
      atualizando,
      erro,
      recarregar,
      marcarComoLida,
      marcarTodasComoLidas,
      dispensar,
    }),
    [
      notificacoes,
      naoLidas,
      carregando,
      atualizando,
      erro,
      recarregar,
      marcarComoLida,
      marcarTodasComoLidas,
      dispensar,
    ]
  );

  return (
    <NotificacoesContext.Provider value={valor}>
      {children}
    </NotificacoesContext.Provider>
  );
}

export function useNotificacoes() {
  return useContext(NotificacoesContext);
}
