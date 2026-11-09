import api from "./api";

export type EstadoVinculo = "NENHUM" | "PENDENTE" | "APROVADO" | "RECUSADO";

export type NutricionistaVinculado = {
  id?: string;
  nome: string;
  crn: string | null;
  tratamento: string | null;
};

export type Vinculo = {
  estado: EstadoVinculo;
  nutricionista: NutricionistaVinculado | null;
  solicitacaoId: string | null;
  vinculadoEm: string | null;
  atualizadoEm: string | null;
};

export type NutricionistaEncontrado = NutricionistaVinculado & {
  id: string;
};

export const VINCULO_VAZIO: Vinculo = {
  estado: "NENHUM",
  nutricionista: null,
  solicitacaoId: null,
  vinculadoEm: null,
  atualizadoEm: null,
};

export function nomeProfissional(
  nutricionista: Pick<NutricionistaVinculado, "nome" | "tratamento">
): string {
  return `${nutricionista.tratamento ?? "Nutricionista"} ${nutricionista.nome}`;
}

export async function consultarNutricionistaPorCrn(
  crn: string
): Promise<NutricionistaEncontrado> {
  const response = await api.get<{ nutricionista: NutricionistaEncontrado }>(
    `/api/vinculacoes/nutricionista/${encodeURIComponent(crn)}`
  );
  return response.data.nutricionista;
}

export async function solicitarVinculo(crn: string): Promise<Vinculo> {
  const response = await api.post<{ vinculo: Vinculo }>(
    "/api/vinculacoes/solicitar",
    { crn }
  );
  return response.data.vinculo;
}

export async function buscarVinculo(): Promise<Vinculo> {
  const response = await api.get<{ vinculo: Vinculo }>(
    "/api/vinculacoes/minha-solicitacao"
  );
  return response.data.vinculo;
}

export async function cancelarSolicitacao(): Promise<Vinculo> {
  const response = await api.delete<{ vinculo: Vinculo }>(
    "/api/vinculacoes/minha-solicitacao"
  );
  return response.data.vinculo;
}

export async function desvincular(): Promise<Vinculo> {
  const response = await api.delete<{ vinculo: Vinculo }>("/users/vinculo");
  return response.data.vinculo;
}
