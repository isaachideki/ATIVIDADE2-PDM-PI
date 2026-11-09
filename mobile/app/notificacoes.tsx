import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  SectionList,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather, Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";

import AppHeader from "../components/Header/AppHeader";
import NotificacaoItem from "../components/NotificacaoItem";
import { useNotificacoes } from "../context/NotificacoesContext";
import type { NotificacaoComEstado } from "../context/NotificacoesContext";
import { secaoDaData } from "../utils/datas";
import type { SecaoNotificacao } from "../utils/datas";

type Filtro = "Todas" | "Não lidas";

type Secao = {
  title: SecaoNotificacao;
  data: NotificacaoComEstado[];
};

const ORDEM_SECOES: SecaoNotificacao[] = [
  "Hoje",
  "Esta semana",
  "Anteriores",
];

export default function NotificacoesScreen() {
  const {
    notificacoes,
    naoLidas,
    carregando,
    erro,
    recarregar,
    marcarComoLida,
    marcarTodasComoLidas,
    dispensar,
  } = useNotificacoes();

  const [filtro, setFiltro] = useState<Filtro>("Todas");
  const [puxando, setPuxando] = useState(false);

  // Ao abrir a tela, atualiza o feed (o contexto limita a frequência das chamadas).
  useFocusEffect(
    useCallback(() => {
      void recarregar();
    }, [recarregar])
  );

  const visiveis = useMemo(
    () =>
      filtro === "Não lidas"
        ? notificacoes.filter((n) => !n.lida)
        : notificacoes,
    [filtro, notificacoes]
  );

  const secoes = useMemo<Secao[]>(
    () =>
      ORDEM_SECOES.map((titulo) => ({
        title: titulo,
        data: visiveis.filter((n) => secaoDaData(n.data) === titulo),
      })).filter((secao) => secao.data.length > 0),
    [visiveis]
  );

  const aoPuxarParaAtualizar = useCallback(async () => {
    setPuxando(true);
    await recarregar({ forcar: true });
    setPuxando(false);
  }, [recarregar]);

  const abrirNotificacao = (notificacao: NotificacaoComEstado) => {
    marcarComoLida(notificacao.id);
    if (notificacao.rota) {
      router.push({
        pathname: notificacao.rota.pathname as any,
        params: notificacao.rota.params,
      });
    }
  };

  const voltar = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/home" as never);
    }
  };

  const cabecalho = (
    <View>
      <View style={styles.linhaTitulo}>
        <TouchableOpacity
          onPress={voltar}
          style={styles.botaoVoltar}
          accessibilityRole="button"
          accessibilityLabel="Voltar"
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Feather name="chevron-left" size={22} color="#202623" />
        </TouchableOpacity>
        <View style={styles.blocoTitulo}>
          <Text style={styles.titulo}>Notificações</Text>
          <Text style={styles.subtitulo}>
            {naoLidas === 0
              ? "Tudo em dia"
              : naoLidas === 1
              ? "1 notificação não lida"
              : `${naoLidas} notificações não lidas`}
          </Text>
        </View>
      </View>

      {erro ? (
        <View style={styles.erroBanner}>
          <Ionicons name="alert-circle" size={16} color="#DC2626" />
          <Text style={styles.erroTexto}>{erro}</Text>
          <TouchableOpacity
            onPress={() => void recarregar({ forcar: true })}
            accessibilityRole="button"
          >
            <Text style={styles.erroAcao}>Tentar novamente</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      <View style={styles.linhaFiltros}>
        <View style={styles.filtros}>
          {(["Todas", "Não lidas"] as Filtro[]).map((opcao) => {
            const ativo = filtro === opcao;
            return (
              <TouchableOpacity
                key={opcao}
                activeOpacity={0.7}
                onPress={() => setFiltro(opcao)}
                style={[styles.filtro, ativo && styles.filtroAtivo]}
              >
                <Text
                  style={[styles.textoFiltro, ativo && styles.textoFiltroAtivo]}
                >
                  {opcao}
                  {opcao === "Não lidas" && naoLidas > 0 ? ` (${naoLidas})` : ""}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <TouchableOpacity
          onPress={marcarTodasComoLidas}
          disabled={naoLidas === 0}
          activeOpacity={0.7}
          accessibilityRole="button"
        >
          <Text
            style={[
              styles.acaoMarcarTodas,
              naoLidas === 0 && styles.acaoMarcarTodasDesativada,
            ]}
          >
            Marcar todas como lidas
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const vazio = carregando ? (
    <View style={styles.estadoVazio}>
      <ActivityIndicator size="large" color="#00783F" />
      <Text style={styles.estadoVazioTexto}>Carregando notificações...</Text>
    </View>
  ) : erro ? undefined : (
    <View style={styles.estadoVazio}>
      <Ionicons name="notifications-off-outline" size={44} color="#A7B5AC" />
      <Text style={styles.estadoVazioTitulo}>
        {filtro === "Não lidas"
          ? "Nenhuma notificação não lida"
          : "Nenhuma notificação por enquanto"}
      </Text>
      <Text style={styles.estadoVazioTexto}>
        Alertas de risco, mudanças de restrições e novidades do vínculo
        aparecem aqui.
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <StatusBar barStyle="dark-content" />

      <AppHeader />

      <SectionList<NotificacaoComEstado, Secao>
        sections={secoes}
        keyExtractor={(item) => item.id}
        stickySectionHeadersEnabled={false}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.conteudo}
        ListHeaderComponent={cabecalho}
        ListEmptyComponent={vazio}
        renderSectionHeader={({ section }) => (
          <Text style={styles.secao}>{section.title}</Text>
        )}
        renderItem={({ item }) => (
          <NotificacaoItem
            tipo={item.tipo}
            titulo={item.titulo}
            descricao={item.descricao}
            data={item.data}
            lida={item.lida}
            onPress={() => abrirNotificacao(item)}
            onDispensar={() => dispensar(item.id)}
          />
        )}
        refreshControl={
          <RefreshControl
            refreshing={puxando}
            onRefresh={aoPuxarParaAtualizar}
            colors={["#00783F"]}
            tintColor="#00783F"
          />
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F7F9F8",
  },
  conteudo: {
    paddingHorizontal: 17,
    paddingTop: 22,
    paddingBottom: 40,
  },
  linhaTitulo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  botaoVoltar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: -6,
  },
  blocoTitulo: {
    flex: 1,
  },
  titulo: {
    fontFamily: "Geist_700Bold",
    fontSize: 25,
    color: "#202623",
    letterSpacing: -0.7,
  },
  subtitulo: {
    fontFamily: "Geist_500Medium",
    fontSize: 12,
    color: "#68756D",
  },
  erroBanner: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FECACA",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
  },
  erroTexto: {
    flex: 1,
    fontFamily: "Geist_400Regular",
    fontSize: 12,
    color: "#DC2626",
  },
  erroAcao: {
    fontFamily: "Geist_700Bold",
    fontSize: 12,
    color: "#B91C1C",
  },
  linhaFiltros: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  filtros: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  filtro: {
    minHeight: 30,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#DCE4DE",
    backgroundColor: "#FAFBFA",
    alignItems: "center",
    justifyContent: "center",
  },
  filtroAtivo: {
    backgroundColor: "#BFE8D1",
    borderColor: "#00783F",
  },
  textoFiltro: {
    fontFamily: "Geist_500Medium",
    fontSize: 11,
    color: "#59675E",
  },
  textoFiltroAtivo: {
    fontFamily: "Geist_700Bold",
    color: "#005C30",
  },
  acaoMarcarTodas: {
    fontFamily: "Geist_600SemiBold",
    fontSize: 11,
    color: "#00783F",
  },
  acaoMarcarTodasDesativada: {
    color: "#A7B5AC",
  },
  secao: {
    fontFamily: "Geist_700Bold",
    fontSize: 13,
    color: "#37433B",
    marginTop: 14,
    marginBottom: 8,
  },
  estadoVazio: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 56,
    paddingHorizontal: 24,
    gap: 10,
  },
  estadoVazioTitulo: {
    fontFamily: "Geist_700Bold",
    fontSize: 15,
    color: "#37433B",
    textAlign: "center",
  },
  estadoVazioTexto: {
    fontFamily: "Geist_400Regular",
    fontSize: 12.5,
    lineHeight: 18,
    color: "#68756D",
    textAlign: "center",
  },
});
