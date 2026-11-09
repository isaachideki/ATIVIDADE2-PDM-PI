import { useCallback, useMemo, useRef, useState } from "react";
import type { NiveisSensibilidade } from "../context/AuthContext";
import type { NivelSensibilidade } from "../components/SensitivitySlider";

export type CategoriaRestricao = "gluten" | "lactose" | "amendoim";

export type RestricoesDraft = {
  ativos: Record<CategoriaRestricao, boolean>;
  niveis: NiveisSensibilidade;
};

const NIVEIS_PADRAO: NiveisSensibilidade = {
  gluten: 1,
  lactose: 1,
  amendoim: 1,
};

const RASCUNHO_PADRAO: RestricoesDraft = {
  ativos: {
    gluten: false,
    lactose: false,
    amendoim: false,
  },
  niveis: NIVEIS_PADRAO,
};

function normalizarNivel(value: unknown): NivelSensibilidade {
  return value === 0 || value === 2 ? value : 1;
}

function criarDraft(
  restricoes: string[],
  niveis?: Partial<NiveisSensibilidade> | null
): RestricoesDraft {
  const ativas = new Set(restricoes.map((restricao) => restricao.toLowerCase()));
  return {
    ativos: {
      gluten: ativas.has("gluten"),
      lactose: ativas.has("lactose"),
      amendoim: ativas.has("amendoim"),
    },
    niveis: {
      gluten: normalizarNivel(niveis?.gluten),
      lactose: normalizarNivel(niveis?.lactose),
      amendoim: normalizarNivel(niveis?.amendoim),
    },
  };
}

export function useRestricoesDraft() {
  const [rascunho, setRascunho] = useState<RestricoesDraft>(RASCUNHO_PADRAO);
  const [base, setBase] = useState<RestricoesDraft>(RASCUNHO_PADRAO);
  const inicializado = useRef(false);

  const inicializar = useCallback(
    (restricoes: string[], niveis?: Partial<NiveisSensibilidade> | null) => {
      if (inicializado.current) return;
      const inicial = criarDraft(restricoes, niveis);
      inicializado.current = true;
      setRascunho(inicial);
      setBase(inicial);
    },
    []
  );

  const alternar = useCallback(
    (categoria: CategoriaRestricao, ativo: boolean) => {
      setRascunho((anterior) => ({
        ...anterior,
        ativos: { ...anterior.ativos, [categoria]: ativo },
        niveis: {
          ...anterior.niveis,
          [categoria]:
            ativo && anterior.niveis[categoria] === 1
              ? 1
              : anterior.niveis[categoria],
        },
      }));
    },
    []
  );

  const definirNivel = useCallback(
    (categoria: CategoriaRestricao, nivel: NivelSensibilidade) => {
      setRascunho((anterior) => ({
        ...anterior,
        niveis: { ...anterior.niveis, [categoria]: nivel },
      }));
    },
    []
  );

  const marcarSalvo = useCallback(
    (restricoes: string[], niveis: Partial<NiveisSensibilidade>) => {
      const salvo = criarDraft(restricoes, niveis);
      inicializado.current = true;
      setRascunho(salvo);
      setBase(salvo);
    },
    []
  );

  const descartar = useCallback(() => setRascunho(base), [base]);

  const alterado = useMemo(
    () =>
      JSON.stringify(rascunho.ativos) !== JSON.stringify(base.ativos) ||
      JSON.stringify(rascunho.niveis) !== JSON.stringify(base.niveis),
    [base, rascunho]
  );

  return {
    rascunho,
    inicializar,
    alternar,
    definirNivel,
    marcarSalvo,
    descartar,
    alterado,
  };
}
