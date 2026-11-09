import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  NativeScrollEvent,
  NativeSyntheticEvent,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather, Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";

import TabBar from "../components/TabBar/indexTab";
import AppHeader from "../components/Header/AppHeader";
import ScanThumb from "../components/ScanThumb";
import api, { extrairMensagemErro } from "../services/api";
import { formatarGrupoData, formatarHorario } from "../utils/datas";

type StatusProduto = "Seguro" | "Risco";
type Filtro = "Todos" | StatusProduto;

type ItemHistorico = {
  id: string;
  nomeProduto: string;
  veredito: "SEGURO" | "PERIGOSO";
  alergicosDetectados?: {
    categoria: string;
    tipo: "CONTEM" | "TRACOS";
    termos?: string[];
  }[];
  curtido: boolean;
  imagemUri?: string | null;
  imagemUrl: string | null;
  imagemDemo: string | null;
  createdAt: string;
};

const LIMITE_PAGINA = 20;

export default function Historico() {
  const [busca, setBusca] = useState("");
  const [buscaDebounced, setBuscaDebounced] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("Todos");

  const [itens, setItens] = useState<ItemHistorico[]>([]);
  const [pagina, setPagina] = useState(1);
  const [temMais, setTemMais] = useState(false);

  const [carregando, setCarregando] = useState(true);
  const [carregandoMais, setCarregandoMais] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [erroInline, setErroInline] = useState<string | null>(null);

    useEffect(() => {
    const timer = setTimeout(() => {
      setBuscaDebounced(busca.trim());
    }, 400);
    return () => clearTimeout(timer);
  }, [busca]);

  const buscarHistorico = useCallback(
    async (paginaAlvo: number, substituir: boolean, isRefresh = false) => {
      if (isRefresh) {
        setRefreshing(true);
      } else if (substituir) {
        setCarregando(true);
      } else {
        setCarregandoMais(true);
      }

      setErroInline(null);

      try {
        const res = await api.get("/users/historico", {
          params: {
            filtro,
            busca: buscaDebounced,
            page: paginaAlvo,
            limit: LIMITE_PAGINA,
          },
        });

        const novosItens: ItemHistorico[] = Array.isArray(res.data?.itens)
          ? res.data.itens
          : [];

        setItens((atuais) =>
          substituir ? novosItens : [...atuais, ...novosItens]
        );
        setPagina(paginaAlvo);
        setTemMais(Boolean(res.data?.temMais));
      } catch (err: any) {
        setErroInline(extrairMensagemErro(err));
      } finally {
        setCarregando(false);
        setCarregandoMais(false);
        setRefreshing(false);
      }
    },
    [filtro, buscaDebounced]
  );

    useFocusEffect(
    useCallback(() => {
      buscarHistorico(1, true, false);
    }, [buscarHistorico])
  );

  const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (carregando || carregandoMais || !temMais) return;
    const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent;
    const distanciaDoFim =
      contentSize.height - (layoutMeasurement.height + contentOffset.y);

    if (distanciaDoFim < 160) {
      buscarHistorico(pagina + 1, false, false);
    }
  };

    const grupos = useMemo(() => {
    const resultado: {
      titulo: string;
      itens: ItemHistorico[];
    }[] = [];

    itens.forEach((item) => {
      const tituloData = formatarGrupoData(item.createdAt);
      let grupo = resultado.find((g) => g.titulo === tituloData);

      if (!grupo) {
        grupo = {
          titulo: tituloData,
          itens: [],
        };
        resultado.push(grupo);
      }

      grupo.itens.push(item);
    });

    return resultado;
  }, [itens]);

  const abrirDetalhe = (id: string) => {
    router.push({
      pathname: "/resultado" as any,
      params: { id },
    });
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <StatusBar barStyle="dark-content" />

      <AppHeader />

      {}
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.conteudo}
        onScroll={handleScroll}
        scrollEventThrottle={200}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => buscarHistorico(1, true, true)}
            colors={["#00783F"]}
            tintColor="#00783F"
          />
        }
      >
        <Text style={styles.titleHistorico}>Histórico</Text>
        <Text style={styles.subtitle}>Seus últimos escaneamentos</Text>

        {erroInline ? (
          <View style={styles.erroBanner}>
            <Ionicons name="alert-circle" size={16} color="#DC2626" />
            <Text style={styles.erroBannerText}>{erroInline}</Text>
          </View>
        ) : null}

        {}
        <View style={styles.search}>
          <Feather name="search" size={18} color="#728078" />

          <TextInput
            value={busca}
            onChangeText={setBusca}
            placeholder="Buscar produto escaneado..."
            placeholderTextColor="#78847D"
            style={styles.input}
            returnKeyType="search"
          />

          {busca.length > 0 && (
            <TouchableOpacity
              onPress={() => setBusca("")}
              accessibilityLabel="Limpar pesquisa"
            >
              <Ionicons name="close-circle" size={18} color="#78847D" />
            </TouchableOpacity>
          )}
        </View>

        {}
        <View style={styles.filtros}>
          {(["Todos", "Risco", "Seguro"] as Filtro[]).map((opcao) => {
            const ativo = filtro === opcao;

            return (
              <TouchableOpacity
                key={opcao}
                activeOpacity={0.7}
                onPress={() => setFiltro(opcao)}
                style={[styles.filtro, ativo && styles.filtroAtivo]}
              >
                {opcao !== "Todos" && (
                  <View
                    style={[
                      styles.bolinhaFiltro,
                      {
                        backgroundColor:
                          opcao === "Risco" ? "#BF2922" : "#00783F",
                      },
                    ]}
                  />
                )}

                <Text
                  style={[
                    styles.textoFiltro,
                    ativo && styles.textoFiltroAtivo,
                  ]}
                >
                  {opcao}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {}
        {carregando && itens.length === 0 ? (
          <View style={styles.loadingArea}>
            <ActivityIndicator size="large" color="#00783F" />
          </View>
        ) : grupos.length > 0 ? (
          <>
            {grupos.map((grupo) => (
              <View key={grupo.titulo} style={styles.grupo}>
                <Text style={styles.dataGrupo}>{grupo.titulo}</Text>

                {grupo.itens.map((item, indice) => {
                  const seguro = String(item.veredito).toUpperCase() === "SEGURO";
                  const cor = seguro ? "#00783F" : "#BF2922";
                  const primeiro = indice === 0;
                  const ultimo = indice === grupo.itens.length - 1;
                  const primeiroAlergico = item.alergicosDetectados?.[0];
                  const catPrincipal =
                    typeof primeiroAlergico === "string"
                      ? primeiroAlergico
                      : primeiroAlergico?.categoria || null;
                  const itemId = item.id || (item as any)._id;

                  return (
                    <View key={itemId} style={styles.itemTimeline}>
                      {}
                      <View style={styles.trilho}>
                        {grupo.itens.length > 1 && (
                          <View
                            style={[
                              styles.linha,
                              { backgroundColor: cor },
                              primeiro
                                ? styles.linhaPrimeiro
                                : ultimo
                                ? styles.linhaUltimo
                                : styles.linhaIntermediario,
                            ]}
                          />
                        )}

                        <View
                          style={[styles.marcador, { backgroundColor: cor }]}
                        />
                      </View>

                      {}
                      <TouchableOpacity
                        style={styles.card}
                        activeOpacity={0.8}
                        onPress={() => abrirDetalhe(item.id)}
                      >
                        <ScanThumb
                          imagemUri={item.imagemUri}
                          imagemUrl={item.imagemUrl}
                          imagemDemo={item.imagemDemo}
                          categoriaPrincipal={catPrincipal}
                          style={styles.imagem}
                          resizeMode="cover"
                          iconSize={22}
                        />

                        <View style={styles.informacoes}>
                          <Text style={styles.nome} numberOfLines={2}>
                            {item.nomeProduto}
                          </Text>

                          <View style={styles.status}>
                            <View
                              style={[
                                styles.bolinhaStatus,
                                { backgroundColor: cor },
                              ]}
                            />

                            <Text
                              style={[styles.textoStatus, { color: cor }]}
                            >
                              {seguro ? "Seguro" : "Risco"}
                            </Text>
                          </View>

                          <Text style={styles.horario}>
                            {formatarHorario(item.createdAt)}
                          </Text>
                        </View>

                        <Feather
                          name="chevron-right"
                          size={18}
                          color="#94A3B8"
                        />
                      </TouchableOpacity>
                    </View>
                  );
                })}
              </View>
            ))}

            {carregandoMais && (
              <View style={styles.paginacaoLoader}>
                <ActivityIndicator size="small" color="#00783F" />
              </View>
            )}
          </>
        ) : (
          <View style={styles.vazio}>
            <Ionicons name="time-outline" size={44} color="#A0B0A6" />

            <Text style={styles.vazioTitulo}>
              Nenhum escaneamento encontrado
            </Text>

            <Text style={styles.vazioTexto}>
              {busca.trim() || filtro !== "Todos"
                ? "Tente buscar outro nome ou altere o filtro selecionado."
                : "Você ainda não escaneou nenhum rótulo. Comece agora!"}
            </Text>

            <TouchableOpacity
              style={styles.btnEscanearVazio}
              activeOpacity={0.85}
              onPress={() => router.push("/scanner" as never)}
            >
              <MaterialCommunityIcons
                name="barcode-scan"
                size={18}
                color="#FFFFFF"
                style={{ marginRight: 6 }}
              />
              <Text style={styles.btnEscanearVazioText}>Escanear</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      <TabBar abaAtiva="historico" />
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
    paddingBottom: 30,
  },
  titleHistorico: {
    fontSize: 25,
    fontWeight: "800",
    color: "#202623",
    letterSpacing: -0.7,
  },
  subtitle: {
    fontSize: 11,
    color: "#68756D",
    fontWeight: "600",
    marginBottom: 9,
  },
  erroBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FECACA",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
  },
  erroBannerText: {
    flex: 1,
    fontSize: 12,
    color: "#DC2626",
  },
  search: {
    minHeight: 42,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: "#CAD8CE",
    backgroundColor: "#F1F4F2",
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  input: {
    flex: 1,
    fontSize: 12,
    color: "#263B30",
    paddingVertical: 8,
  },
  filtros: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    marginTop: 16,
    marginBottom: 21,
  },
  filtro: {
    minHeight: 30,
    paddingHorizontal: 11,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#DCE4DE",
    backgroundColor: "#FAFBFA",
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  filtroAtivo: {
    backgroundColor: "#BFE8D1",
    borderColor: "#00783F",
  },
  bolinhaFiltro: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  textoFiltro: {
    fontSize: 11,
    color: "#59675E",
  },
  textoFiltroAtivo: {
    color: "#005C30",
    fontWeight: "700",
  },
  loadingArea: {
    paddingVertical: 60,
    alignItems: "center",
    justifyContent: "center",
  },
  grupo: {
    marginBottom: 12,
  },
  dataGrupo: {
    fontSize: 12,
    fontWeight: "800",
    color: "#00783F",
    marginLeft: 11,
    marginBottom: 8,
  },
  itemTimeline: {
    flexDirection: "row",
    minHeight: 76,
    marginBottom: 8,
  },
  trilho: {
    width: 32,
    alignItems: "center",
    position: "relative",
  },
  linha: {
    position: "absolute",
    left: 15,
    width: 2,
    opacity: 0.65,
    zIndex: 1,
  },
  linhaPrimeiro: {
    top: 32,
    bottom: -8,
  },
  linhaIntermediario: {
    top: 0,
    bottom: -8,
  },
  linhaUltimo: {
    top: 0,
    height: 38,
  },
  marcador: {
    position: "absolute",
    top: 32,
    left: 10,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: "#FFFFFF",
    zIndex: 2,
  },
  card: {
    flex: 1,
    minHeight: 76,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#CBD9CE",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 10,
    paddingVertical: 7,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  imagem: {
    width: 50,
    height: 58,
    borderRadius: 8,
  },
  informacoes: {
    flex: 1,
    justifyContent: "center",
  },
  nome: {
    fontSize: 12,
    fontWeight: "800",
    color: "#242925",
  },
  status: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 3,
  },
  bolinhaStatus: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  textoStatus: {
    fontSize: 10,
    fontWeight: "700",
  },
  horario: {
    fontSize: 9,
    color: "#68756D",
    marginTop: 4,
  },
  paginacaoLoader: {
    paddingVertical: 14,
    alignItems: "center",
  },
  vazio: {
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 45,
  },
  vazioTitulo: {
    color: "#294638",
    fontSize: 14,
    fontWeight: "700",
    marginTop: 12,
    textAlign: "center",
  },
  vazioTexto: {
    color: "#78847C",
    fontSize: 12,
    textAlign: "center",
    marginTop: 5,
    marginBottom: 18,
  },
  btnEscanearVazio: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#00783F",
    paddingHorizontal: 20,
    paddingVertical: 11,
    borderRadius: 22,
  },
  btnEscanearVazioText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },
});
