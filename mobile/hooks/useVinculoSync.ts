import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import { useFocusEffect } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { NiveisSensibilidade, useAuth } from "../context/AuthContext";
import api, { extrairMensagemErro } from "../services/api";
import {
  nomeProfissional,
  Vinculo,
  VINCULO_VAZIO,
} from "../services/vinculo";

type PerfilUsuario = {
  id?: string;
  _id?: string;
  nome?: string;
  email?: string;
  avatar?: string | null;
  role?: "PACIENTE" | "NUTRICIONISTA";
  restricoes?: string[];
  niveisSensibilidade?: NiveisSensibilidade;
  restricoesAtualizadasEm?: string | null;
  restricoesAtualizadasPor?: "PACIENTE" | "NUTRICIONISTA" | null;
  vinculo?: Vinculo;
};

type PerfilResponse = PerfilUsuario & {
  usuario?: PerfilUsuario;
};

export function useVinculoSync() {
  const { usuarioAtual, atualizarUsuario } = useAuth();
  const usuarioAtualRef = useRef(usuarioAtual);
  const vinculo = usuarioAtual?.vinculo || VINCULO_VAZIO;
  const [erroInline, setErroInline] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [telaVisivel, setTelaVisivel] = useState(false);
  const telaVisivelRef = useRef(false);

  useEffect(() => {
    usuarioAtualRef.current = usuarioAtual;
  }, [usuarioAtual]);

  const sincronizar = useCallback(async () => {
    try {
      const response = await api.get<PerfilResponse>("/users/perfil");
      const perfil: PerfilUsuario = response.data.usuario || response.data;
      const vinculoAtual =
        response.data.vinculo || perfil.vinculo || VINCULO_VAZIO;
      const usuarioSalvo = usuarioAtualRef.current;
      const restricoes = Array.isArray(perfil.restricoes)
        ? perfil.restricoes
        : usuarioSalvo?.restricoes || [];
      const niveis =
        perfil.niveisSensibilidade || usuarioSalvo?.niveisSensibilidade;

      await atualizarUsuario({
        id: String(perfil.id || perfil._id || usuarioSalvo?.id || ""),
        nome: perfil.nome || usuarioSalvo?.nome || "Usuário",
        email: perfil.email || usuarioSalvo?.email || "",
        avatar: perfil.avatar ?? usuarioSalvo?.avatar ?? null,
        role: perfil.role || usuarioSalvo?.role || "PACIENTE",
        restricoes,
        ...(niveis ? { niveisSensibilidade: niveis } : {}),
        vinculo: vinculoAtual,
        restricoesAtualizadasEm: perfil.restricoesAtualizadasEm || null,
        restricoesAtualizadasPor: perfil.restricoesAtualizadasPor || null,
      });

      const estadoVisto = `${vinculoAtual.estado}:${vinculoAtual.solicitacaoId || ""}`;
      const estadoSalvo = await AsyncStorage.getItem("@vinculo_status_visto");
      if (
        ["APROVADO", "RECUSADO"].includes(vinculoAtual.estado) &&
        estadoSalvo !== estadoVisto
      ) {
        const profissional = vinculoAtual.nutricionista
          ? nomeProfissional(vinculoAtual.nutricionista)
          : "Seu nutricionista";
        setAviso(
          vinculoAtual.estado === "APROVADO"
            ? `Seu vínculo com ${profissional} foi aprovado.`
            : `${profissional} recusou sua solicitação.`
        );
        await AsyncStorage.setItem("@vinculo_status_visto", estadoVisto);
      }

      setErroInline(null);
      return vinculoAtual;
    } catch (error: unknown) {
      setErroInline(extrairMensagemErro(error));
      return null;
    }
  }, [atualizarUsuario]);

  useFocusEffect(
    useCallback(() => {
      telaVisivelRef.current = true;
      setTelaVisivel(true);
      void sincronizar();
      return () => {
        telaVisivelRef.current = false;
        setTelaVisivel(false);
      };
    }, [sincronizar])
  );

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active" && telaVisivelRef.current) {
        void sincronizar();
      }
    });
    return () => subscription.remove();
  }, [sincronizar]);

  useEffect(() => {
    if (!telaVisivel || vinculo.estado !== "PENDENTE") return;
    const interval = setInterval(() => {
      void sincronizar();
    }, 30000);
    return () => clearInterval(interval);
  }, [sincronizar, telaVisivel, vinculo.estado]);

  return {
    vinculo,
    erroInline,
    aviso,
    limparAviso: () => setAviso(null),
    sincronizar,
    setErroInline,
  };
}
