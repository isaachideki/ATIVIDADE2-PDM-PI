import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Feather, Ionicons } from "@expo/vector-icons";

import type { TipoNotificacao } from "../services/notificacoes";
import { formatarTempoRelativo } from "../utils/datas";

type IconeIonicons = React.ComponentProps<typeof Ionicons>["name"];

type VisualTipo = {
  icone: IconeIonicons;
  cor: string;
  fundo: string;
  rotulo: string;
};

const VISUAL_POR_TIPO: Record<TipoNotificacao, VisualTipo> = {
  RISCO: {
    icone: "warning",
    cor: "#BF2922",
    fundo: "#FDECEA",
    rotulo: "Alerta",
  },
  RESTRICOES: {
    icone: "options",
    cor: "#B45309",
    fundo: "#FEF3C7",
    rotulo: "Restrições",
  },
  VINCULO: {
    icone: "people",
    cor: "#006D37",
    fundo: "#EAF5EE",
    rotulo: "Vínculo",
  },
  DICA: {
    icone: "bulb",
    cor: "#2563EB",
    fundo: "#EFF6FF",
    rotulo: "Dica",
  },
};

type NotificacaoItemProps = {
  tipo: TipoNotificacao;
  titulo: string;
  descricao: string;
  data: string;
  lida: boolean;
  onPress: () => void;
  onDispensar: () => void;
};

export default function NotificacaoItem({
  tipo,
  titulo,
  descricao,
  data,
  lida,
  onPress,
  onDispensar,
}: NotificacaoItemProps) {
  const visual = VISUAL_POR_TIPO[tipo];

  return (
    <TouchableOpacity
      activeOpacity={0.75}
      onPress={onPress}
      style={[styles.card, !lida && styles.cardNaoLida]}
      accessibilityRole="button"
      accessibilityLabel={`${visual.rotulo}: ${titulo}. ${lida ? "Lida" : "Não lida"}`}
    >
      <View style={[styles.iconeBox, { backgroundColor: visual.fundo }]}>
        <Ionicons name={visual.icone} size={20} color={visual.cor} />
      </View>

      <View style={styles.corpo}>
        <View style={styles.linhaTitulo}>
          <Text
            style={[styles.titulo, !lida && styles.tituloNaoLida]}
            numberOfLines={2}
          >
            {titulo}
          </Text>
          {!lida ? <View style={styles.pontoNaoLida} /> : null}
        </View>

        <Text style={styles.descricao} numberOfLines={3}>
          {descricao}
        </Text>

        <View style={styles.rodape}>
          <Text style={[styles.rotulo, { color: visual.cor }]}>
            {visual.rotulo}
          </Text>
          <Text style={styles.tempo}>{formatarTempoRelativo(data)}</Text>
        </View>
      </View>

      <TouchableOpacity
        onPress={onDispensar}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        style={styles.botaoDispensar}
        accessibilityRole="button"
        accessibilityLabel="Dispensar notificação"
      >
        <Feather name="x" size={16} color="#94A3B8" />
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5ECE7",
    borderRadius: 16,
    padding: 12,
    marginBottom: 10,
  },
  cardNaoLida: {
    backgroundColor: "#F3FAF6",
    borderColor: "#BFE8D1",
  },
  iconeBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  corpo: {
    flex: 1,
  },
  linhaTitulo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  titulo: {
    flexShrink: 1,
    fontFamily: "Geist_500Medium",
    fontSize: 14,
    color: "#37433B",
  },
  tituloNaoLida: {
    fontFamily: "Geist_700Bold",
    color: "#202623",
  },
  pontoNaoLida: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#00783F",
  },
  descricao: {
    marginTop: 3,
    fontFamily: "Geist_400Regular",
    fontSize: 12.5,
    lineHeight: 18,
    color: "#59675E",
  },
  rodape: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 8,
  },
  rotulo: {
    fontFamily: "Geist_600SemiBold",
    fontSize: 11,
  },
  tempo: {
    fontFamily: "Geist_400Regular",
    fontSize: 11,
    color: "#78847D",
  },
  botaoDispensar: {
    padding: 2,
  },
});
