import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import api, { limparSessaoLocal } from "../services/api";
import { VINCULO_VAZIO } from "../services/vinculo";
import type { NutricionistaVinculado, Vinculo } from "../services/vinculo";

export type { NutricionistaVinculado, Vinculo } from "../services/vinculo";

export type NiveisSensibilidade = {
  gluten: 0 | 1 | 2;
  lactose: 0 | 1 | 2;
  amendoim: 0 | 1 | 2;
};

export type UsuarioPublico = {
  id: string;
  nome: string;
  email: string;
  avatar?: string | null;
  role?: "PACIENTE" | "NUTRICIONISTA";
  restricoes: string[];
  niveisSensibilidade: NiveisSensibilidade;
  vinculo?: Vinculo;
  restricoesAtualizadasEm?: string | null;
  restricoesAtualizadasPor?: "PACIENTE" | "NUTRICIONISTA" | null;
};

export type RascunhoCadastro = {
  nome: string;
  email: string;
  senha: string;
  repetirSenha: string;
  crnNutricionista?: string;
  nutricionistaPreview?: NutricionistaVinculado | null;
};

type AuthContextType = {
  usuarioAtual: UsuarioPublico | null;
  rascunhoCadastro: RascunhoCadastro;
  setRascunhoCadastro: React.Dispatch<React.SetStateAction<RascunhoCadastro>>;
  limparRascunhoCadastro: () => void;
  salvarSessaoUsuario: (
    token: string | null,
    usuario: UsuarioPublico
  ) => Promise<void>;
  atualizarUsuario: (parcial: Partial<UsuarioPublico>) => Promise<void>;
  atualizarAvatarContexto: (avatarBase64: string) => Promise<void>;
  encerrarSessao: () => Promise<void>;
};

const RASCUNHO_VAZIO: RascunhoCadastro = {
  nome: "",
  email: "",
  senha: "",
  repetirSenha: "",
  crnNutricionista: undefined,
  nutricionistaPreview: null,
};

const AuthContext = createContext<AuthContextType>({
  usuarioAtual: null,
  rascunhoCadastro: RASCUNHO_VAZIO,
  setRascunhoCadastro: () => {},
  limparRascunhoCadastro: () => {},
  salvarSessaoUsuario: async () => {},
  atualizarUsuario: async () => {},
  atualizarAvatarContexto: async () => {},
  encerrarSessao: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [usuarioAtual, setUsuarioAtual] = useState<UsuarioPublico | null>(null);
  const [rascunhoCadastro, setRascunhoCadastro] =
    useState<RascunhoCadastro>(RASCUNHO_VAZIO);

  useEffect(() => {
    let ativo = true;
    AsyncStorage.multiGet([
      "@usuario_id",
      "@usuario_nome",
      "@usuario_email",
      "@usuario_avatar",
      "@usuario_restricoes",
      "@usuario_niveis",
      "@usuario_vinculo",
      "@rotuscan_token",
      "@restricao_gluten",
      "@restricao_lactose",
      "@restricao_amendoim",
    ])
      .then(async (entries) => {
        if (!ativo) return;
        const map = Object.fromEntries(entries);
        const id = map["@usuario_id"];
        if (!id) return;

        let restricoes: string[] = [];
        if (map["@usuario_restricoes"]) {
          try {
            restricoes = JSON.parse(map["@usuario_restricoes"]!);
          } catch {
            console.warn("Não foi possível restaurar as restrições locais.");
          }
        } else {
          if (map["@restricao_gluten"] === "true") restricoes.push("gluten");
          if (map["@restricao_lactose"] === "true") restricoes.push("lactose");
          if (map["@restricao_amendoim"] === "true") restricoes.push("amendoim");
          if (restricoes.length > 0) {
            await AsyncStorage.setItem(
              "@usuario_restricoes",
              JSON.stringify(restricoes)
            );
          }
        }

        await AsyncStorage.multiRemove([
          "@restricao_gluten",
          "@restricao_lactose",
          "@restricao_amendoim",
          "@usuario_liberar_tracos",
        ]).catch((error: unknown) => {
          console.warn("Não foi possível remover as preferências legadas.", error);
        });

        let niveis: NiveisSensibilidade = {
          gluten: 1,
          lactose: 1,
          amendoim: 1,
        };
        try {
          if (map["@usuario_niveis"]) {
            niveis = JSON.parse(map["@usuario_niveis"]!);
          }
        } catch {
          console.warn("Não foi possível restaurar os níveis locais.");
        }

        let vinculo = VINCULO_VAZIO;
        try {
          if (map["@usuario_vinculo"]) {
            vinculo = JSON.parse(map["@usuario_vinculo"]!) as Vinculo;
          }
        } catch {
          console.warn("Não foi possível restaurar o vínculo salvo localmente.");
        }

        setUsuarioAtual({
          id,
          nome: map["@usuario_nome"] || "Usuário",
          email: map["@usuario_email"] || "",
          avatar: map["@usuario_avatar"] || null,
          restricoes,
          niveisSensibilidade: niveis,
          vinculo,
        });

        if (map["@rotuscan_token"]) {
          try {
            const response = await api.get("/users/perfil");
            if (!ativo) return;
            const perfil = response.data?.usuario || response.data;
            const niveisServidor = perfil.niveisSensibilidade || niveis;
            const vinculoServidor =
              response.data?.vinculo || perfil.vinculo || VINCULO_VAZIO;
            const sessaoAtualizada: UsuarioPublico = {
              id: String(perfil.id || perfil._id || id),
              nome: perfil.nome || map["@usuario_nome"] || "Usuário",
              email: perfil.email || map["@usuario_email"] || "",
              avatar: perfil.avatar || map["@usuario_avatar"] || null,
              role: perfil.role || "PACIENTE",
              restricoes: Array.isArray(perfil.restricoes)
                ? perfil.restricoes
                : restricoes,
              niveisSensibilidade: niveisServidor,
              vinculo: vinculoServidor,
              restricoesAtualizadasEm: perfil.restricoesAtualizadasEm || null,
              restricoesAtualizadasPor: perfil.restricoesAtualizadasPor || null,
            };
            await AsyncStorage.multiSet([
              ["@usuario_id", sessaoAtualizada.id],
              ["@usuario_nome", sessaoAtualizada.nome],
              ["@usuario_email", sessaoAtualizada.email],
              [
                "@usuario_restricoes",
                JSON.stringify(sessaoAtualizada.restricoes),
              ],
              [
                "@usuario_niveis",
                JSON.stringify(sessaoAtualizada.niveisSensibilidade),
              ],
              ["@usuario_vinculo", JSON.stringify(vinculoServidor)],
            ]);
            setUsuarioAtual(sessaoAtualizada);
          } catch {
            console.warn("Não foi possível atualizar o perfil salvo no servidor.");
          }
        }
      })
      .catch(() => {
        console.warn("Não foi possível restaurar a sessão local.");
      });

    return () => {
      ativo = false;
    };
  }, []);

  const limparRascunhoCadastro = useCallback(() => {
    setRascunhoCadastro(RASCUNHO_VAZIO);
  }, []);

  const salvarSessaoUsuario = useCallback(
    async (token: string | null, usuario: UsuarioPublico) => {
      const avatarExistente = await AsyncStorage.getItem("@usuario_avatar");
      const avatarFinal =
        usuario.avatar && String(usuario.avatar).trim()
          ? String(usuario.avatar)
          : avatarExistente || null;

      const restricoesArray = Array.isArray(usuario.restricoes)
        ? usuario.restricoes
        : [];
      const niveisObj = usuario.niveisSensibilidade || {
        gluten: 1,
        lactose: 1,
        amendoim: 1,
      };

      const pares: [string, string][] = [
        ["@usuario_id", String(usuario.id)],
        ["@usuario_nome", String(usuario.nome || "")],
        ["@usuario_email", String(usuario.email || "")],
        ["@usuario_restricoes", JSON.stringify(restricoesArray)],
        ["@usuario_niveis", JSON.stringify(niveisObj)],
        ["@usuario_vinculo", JSON.stringify(usuario.vinculo || VINCULO_VAZIO)],
      ];

      if (token) {
        pares.push(["@rotuscan_token", token]);
      }
      if (avatarFinal) {
        pares.push(["@usuario_avatar", avatarFinal]);
      }

      await AsyncStorage.multiSet(pares);

            await AsyncStorage.multiRemove([
        "@restricao_gluten",
        "@restricao_lactose",
        "@restricao_amendoim",
        "@usuario_liberar_tracos",
      ]).catch((error: unknown) => {
        console.warn("Não foi possível remover as preferências legadas.", error);
      });

      setUsuarioAtual((prev) => ({
        ...prev,
        ...usuario,
        restricoes: restricoesArray,
        niveisSensibilidade: niveisObj,
        avatar: avatarFinal,
      }));
    },
    []
  );

  
  const atualizarUsuario = useCallback(
    async (parcial: Partial<UsuarioPublico>) => {
      const pares: [string, string][] = [];
      if (parcial.nome !== undefined) {
        pares.push(["@usuario_nome", String(parcial.nome || "")]);
      }
      if (parcial.email !== undefined) {
        pares.push(["@usuario_email", String(parcial.email || "")]);
      }
      if (parcial.avatar !== undefined && parcial.avatar !== null) {
        pares.push(["@usuario_avatar", String(parcial.avatar)]);
      }
      if (parcial.restricoes !== undefined) {
        pares.push([
          "@usuario_restricoes",
          JSON.stringify(parcial.restricoes || []),
        ]);
      }
      if (parcial.niveisSensibilidade !== undefined) {
        pares.push([
          "@usuario_niveis",
          JSON.stringify(parcial.niveisSensibilidade),
        ]);
      }
      if (parcial.vinculo !== undefined) {
        pares.push(["@usuario_vinculo", JSON.stringify(parcial.vinculo)]);
      }

      if (pares.length > 0) {
        await AsyncStorage.multiSet(pares);
      }

      setUsuarioAtual((prev) => {
        if (!prev) {
          if (!parcial.id && !parcial.email) return null;
          return {
            id: parcial.id || "",
            nome: parcial.nome || "Usuário",
            email: parcial.email || "",
            avatar: parcial.avatar || null,
            role: parcial.role || "PACIENTE",
            restricoes: parcial.restricoes || [],
            niveisSensibilidade: parcial.niveisSensibilidade || {
              gluten: 1,
              lactose: 1,
              amendoim: 1,
            },
            vinculo: parcial.vinculo || VINCULO_VAZIO,
            restricoesAtualizadasEm: parcial.restricoesAtualizadasEm || null,
            restricoesAtualizadasPor: parcial.restricoesAtualizadasPor || null,
          };
        }

        const novasRestricoes =
          parcial.restricoes !== undefined
            ? parcial.restricoes
            : prev.restricoes;
        const novosNiveis =
          parcial.niveisSensibilidade !== undefined
            ? { ...prev.niveisSensibilidade, ...parcial.niveisSensibilidade }
            : prev.niveisSensibilidade;

        return {
          ...prev,
          ...parcial,
          restricoes: novasRestricoes,
          niveisSensibilidade: novosNiveis,
        };
      });

      await AsyncStorage.multiRemove([
        "@restricao_gluten",
        "@restricao_lactose",
        "@restricao_amendoim",
        "@usuario_liberar_tracos",
      ]).catch((error: unknown) => {
        console.warn("Não foi possível remover as preferências legadas.", error);
      });
    },
    []
  );

  const atualizarAvatarContexto = useCallback(async (avatarBase64: string) => {
    await AsyncStorage.setItem("@usuario_avatar", avatarBase64);
    setUsuarioAtual((prev) =>
      prev
        ? { ...prev, avatar: avatarBase64 }
        : {
            id: "",
            nome: "Usuário",
            email: "",
            avatar: avatarBase64,
            restricoes: [],
            niveisSensibilidade: { gluten: 1, lactose: 1, amendoim: 1 },
          }
    );
  }, []);

  const encerrarSessao = useCallback(async () => {
    limparRascunhoCadastro();
    setUsuarioAtual(null);
    await limparSessaoLocal();
  }, [limparRascunhoCadastro]);

  return (
    <AuthContext.Provider
      value={{
        usuarioAtual,
        rascunhoCadastro,
        setRascunhoCadastro,
        limparRascunhoCadastro,
        salvarSessaoUsuario,
        atualizarUsuario,
        atualizarAvatarContexto,
        encerrarSessao,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
