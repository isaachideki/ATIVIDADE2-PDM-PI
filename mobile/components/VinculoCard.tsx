import React, { useEffect, useState } from "react";
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import { Feather } from "@expo/vector-icons";

import ConfirmModal from "./ConfirmModal";
import { extrairMensagemErro } from "../services/api";
import {
  cancelarSolicitacao,
  desvincular,
  nomeProfissional,
  solicitarVinculo,
  Vinculo,
} from "../services/vinculo";

type Props = {
  vinculo: Vinculo;
  onRefresh: () => Promise<unknown>;
  showInvitation?: boolean;
};

function formatarData(valor: string | null): string {
  if (!valor) return "data indisponível";
  const data = new Date(valor);
  return Number.isNaN(data.getTime())
    ? "data indisponível"
    : data.toLocaleDateString("pt-BR");
}

export default function VinculoCard({
  vinculo,
  onRefresh,
  showInvitation = true,
}: Props) {
  const [modal, setModal] = useState<"cancelar" | "desvincular" | null>(null);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [conviteDispensado, setConviteDispensado] = useState(false);
  const nutricionista = vinculo.nutricionista;

  useEffect(() => {
    AsyncStorage.getItem("@vinculo_convite_dispensado")
      .then((valor) => setConviteDispensado(valor === "true"))
      .catch(() => {
        setErro("Não foi possível carregar as preferências do convite.");
      });
  }, []);

  const abrirTelaCrn = () => {
    router.push("/vincular-nutricionista?modo=perfil" as never);
  };

  const dispensarConvite = async () => {
    setConviteDispensado(true);
    try {
      await AsyncStorage.setItem("@vinculo_convite_dispensado", "true");
    } catch {
      setConviteDispensado(false);
      setErro("Não foi possível salvar a preferência do convite.");
    }
  };

  const executarAcao = async () => {
    if (loading) return;
    setLoading(true);
    setErro(null);
    try {
      if (modal === "cancelar") await cancelarSolicitacao();
      if (modal === "desvincular") await desvincular();
      setModal(null);
      await onRefresh();
    } catch (error: unknown) {
      setErro(extrairMensagemErro(error));
    } finally {
      setLoading(false);
    }
  };

  const solicitarNovamente = async () => {
    if (!nutricionista?.crn || loading) return;
    setLoading(true);
    setErro(null);
    try {
      await solicitarVinculo(nutricionista.crn);
      await onRefresh();
    } catch (error: unknown) {
      setErro(extrairMensagemErro(error));
    } finally {
      setLoading(false);
    }
  };

  let conteudo: React.ReactNode = null;
  if (vinculo.estado === "PENDENTE") {
    conteudo = (
      <>
        <Text style={styles.titulo}>
          Aguardando aprovação de{" "}
          {nutricionista ? nomeProfissional(nutricionista) : "Nutricionista"}
        </Text>
        <TouchableOpacity
          style={styles.acao}
          onPress={() => setModal("cancelar")}
          disabled={loading}
        >
          <Text style={styles.acaoTexto}>Cancelar solicitação</Text>
        </TouchableOpacity>
      </>
    );
  } else if (vinculo.estado === "APROVADO" && nutricionista) {
    conteudo = (
      <>
        <Text style={styles.titulo}>
          Você está vinculado(a) a {nomeProfissional(nutricionista)} ·{" "}
          {nutricionista.crn || "CRN indisponível"} desde{" "}
          {formatarData(vinculo.vinculadoEm)}
        </Text>
        <TouchableOpacity
          style={styles.acao}
          onPress={() => setModal("desvincular")}
          disabled={loading}
        >
          <Text style={styles.acaoTexto}>Desvincular</Text>
        </TouchableOpacity>
      </>
    );
  } else if (vinculo.estado === "RECUSADO" && nutricionista) {
    conteudo = (
      <>
        <Text style={styles.titulo}>
          {nomeProfissional(nutricionista)} recusou sua solicitação
        </Text>
        <View style={styles.acoesLinha}>
          <TouchableOpacity
            style={styles.acao}
            onPress={solicitarNovamente}
            disabled={loading}
          >
            <Text style={styles.acaoTexto}>Solicitar novamente</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.acaoSecundaria} onPress={abrirTelaCrn}>
            <Text style={styles.acaoTextoSecundario}>Informar outro CRN</Text>
          </TouchableOpacity>
        </View>
      </>
    );
  } else if (showInvitation && !conviteDispensado) {
    conteudo = (
      <View style={styles.conviteLinha}>
        <TouchableOpacity style={styles.convite} onPress={abrirTelaCrn}>
          <Text style={styles.titulo}>
            Acompanha com um nutricionista? Informe o CRN
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={dispensarConvite}
          accessibilityRole="button"
          accessibilityLabel="Dispensar convite"
        >
          <Feather name="x" size={18} color="#64748B" />
        </TouchableOpacity>
      </View>
    );
  }

  if (!conteudo && !erro) return null;

  const modalCancelar = modal === "cancelar";
  return (
    <View
      style={[
        styles.card,
        vinculo.estado === "PENDENTE" && styles.cardPendente,
        vinculo.estado === "APROVADO" && styles.cardAprovado,
        vinculo.estado === "RECUSADO" && styles.cardRecusado,
      ]}
    >
      {conteudo}
      {erro ? <Text style={styles.erro}>{erro}</Text> : null}
      <ConfirmModal
        visible={modal !== null}
        title={modalCancelar ? "Cancelar solicitação?" : "Desvincular nutricionista?"}
        message={
          modalCancelar
            ? "A solicitação será cancelada. Você poderá solicitar novamente depois."
            : "O profissional deixará de ter acesso às suas informações vinculadas."
        }
        confirmText={modalCancelar ? "Cancelar solicitação" : "Desvincular"}
        cancelText="Voltar"
        destructive
        loading={loading}
        onConfirm={executarAcao}
        onCancel={() => setModal(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 14,
    borderRadius: 14,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    gap: 10,
  },
  cardPendente: { backgroundColor: "#FFFBEB", borderColor: "#FCD34D" },
  cardAprovado: { backgroundColor: "#ECFDF5", borderColor: "#86EFAC" },
  cardRecusado: { backgroundColor: "#FEF2F2", borderColor: "#FCA5A5" },
  titulo: {
    color: "#1F2937",
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "600",
  },
  acao: {
    alignSelf: "flex-start",
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: "#E2E8F0",
  },
  acaoTexto: { color: "#334155", fontWeight: "600", fontSize: 13 },
  acoesLinha: { gap: 8, flexWrap: "wrap" },
  acaoSecundaria: {
    alignSelf: "flex-start",
    paddingVertical: 5,
    paddingHorizontal: 10,
  },
  acaoTextoSecundario: { color: "#006D37", fontWeight: "600", fontSize: 13 },
  conviteLinha: { flexDirection: "row", alignItems: "center", gap: 8 },
  convite: { flex: 1 },
  erro: { color: "#B91C1C", fontSize: 13 },
});
