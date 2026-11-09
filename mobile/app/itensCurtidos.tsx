import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather, Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";

import TabBar from "../components/TabBar/indexTab";
import AppHeader from "@/components/Header/AppHeader";
import ScanThumb from "../components/ScanThumb";
import api, { extrairMensagemErro } from "../services/api";

type StatusProduto = "Seguro" | "Risco";
type Filtro = "Todos" | StatusProduto;

type ProdutoCurtido = {
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
};

export default function ItensCurtidos() {
  const [produtos, setProdutos] = useState<ProdutoCurtido[]>([]);
  const [totalServidor, setTotalServidor] = useState(0);

  const [busca, setBusca] = useState("");
  const [buscaDebounced, setBuscaDebounced] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("Todos");

  const [carregando, setCarregando] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [erroInline, setErroInline] = useState<string | null>(null);

  const { width } = useWindowDimensions();
  const espacamento = 12;
  const paddingHorizontal = 17;
  const larguraCard = (width - paddingHorizontal * 2 - espacamento) / 2;

  useEffect(() => {
    const timer = setTimeout(() => {
      setBuscaDebounced(busca.trim());
    }, 400);
    return () => clearTimeout(timer);
  }, [busca]);

  const carregarCurtidos = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setCarregando(true);
      }
      setErroInline(null);

      try {
        const res = await api.get("/users/historico", {
          params: {
            curtido: "true",
            filtro,
            busca: buscaDebounced,
            limit: 60,
            page: 1,
          },
        });

        const lista: ProdutoCurtido[] = Array.isArray(res.data?.itens)
          ? res.data.itens
          : [];
        setProdutos(lista);
        setTotalServidor(
          typeof res.data?.total === "number" ? res.data.total : lista.length
        );
      } catch (err: any) {
        setErroInline(extrairMensagemErro(err));
      } finally {
        setCarregando(false);
        setRefreshing(false);
      }
    },
    [filtro, buscaDebounced]
  );

    useFocusEffect(
    useCallback(() => {
      carregarCurtidos(false);
    }, [carregarCurtidos])
  );

  
  const descurtirOtimista = async (produtoAlvo: ProdutoCurtido) => {
    setErroInline(null);
    const snapshotProdutos = [...produtos];
    const snapshotTotal = totalServidor;

    setProdutos((atuais) => atuais.filter((p) => p.id !== produtoAlvo.id));
    setTotalServidor((t) => Math.max(0, t - 1));

    try {
      await api.patch(`/users/historico/${produtoAlvo.id}/curtir`, {
        curtido: false,
      });
    } catch (err: any) {
      // Rollback em caso de erro
      setProdutos(snapshotProdutos);
      setTotalServidor(snapshotTotal);
      setErroInline(extrairMensagemErro(err));
    }
  };

  const abrirResultado = (id: string) => {
    router.push({
      pathname: "/resultado" as any,
      params: { id },
    });
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <StatusBar barStyle="dark-content" />
      <AppHeader />

      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.conteudo}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => carregarCurtidos(true)}
            colors={["#00783F"]}
            tintColor="#00783F"
          />
        }
      >
        {/* Título e contador vindo de `total` */}
        <View style={styles.tituloLinha}>
          <View style={styles.tituloGrupo}>
            <Text style={styles.titulo}>Itens Curtidos</Text>
            <Text style={styles.subtitulo}>Produtos que você salvou</Text>
          </View>

          <View style={styles.contador}>
            <Ionicons name="heart" size={15} color="#F52222" />
            <Text style={styles.contadorTexto}>
              {totalServidor} {totalServidor === 1 ? "item" : "itens"}
            </Text>
          </View>
        </View>

        {erroInline ? (
          <View style={styles.erroBanner}>
            <Ionicons name="alert-circle" size={16} color="#DC2626" />
            <Text style={styles.erroBannerText}>{erroInline}</Text>
          </View>
        ) : null}

        {/* Pesquisa */}
        <View style={styles.pesquisa}>
          <Feather name="search" size={18} color="#728078" />

          <TextInput
            value={busca}
            onChangeText={setBusca}
            placeholder="Buscar nos seus itens curtidos..."
            placeholderTextColor="#89948E"
            style={styles.input}
            returnKeyType="search"
          />

          {busca.length > 0 && (
            <TouchableOpacity
              onPress={() => setBusca("")}
              accessibilityLabel="Limpar pesquisa"
            >
              <Ionicons name="close-circle" size={18} color="#89948E" />
            </TouchableOpacity>
          )}
        </View>

        {/* Filtros */}
        <View style={styles.filtros}>
          {(["Todos", "Risco", "Seguro"] as Filtro[]).map((opcao) => (
            <TouchableOpacity
              key={opcao}
              activeOpacity={0.7}
              onPress={() => setFiltro(opcao)}
              style={[styles.filtro, filtro === opcao && styles.filtroAtivo]}
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
                  filtro === opcao && styles.textoFiltroAtivo,
                ]}
              >
                {opcao}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Grade de 2 colunas de produtos curtidos */}
        {carregando && produtos.length === 0 ? (
          <View style={styles.loadingArea}>
            <ActivityIndicator size="large" color="#00783F" />
          </View>
        ) : produtos.length > 0 ? (
          <View style={styles.grade}>
            {produtos.map((produto) => {
              const ehSeguro = String(produto.veredito).toUpperCase() === "SEGURO";
              const cor = ehSeguro ? "#00783F" : "#BF2922";
              const primeiroAlergico = produto.alergicosDetectados?.[0];
              const catPrincipal =
                typeof primeiroAlergico === "string"
                  ? primeiroAlergico
                  : primeiroAlergico?.categoria || null;
              const prodId = produto.id || (produto as any)._id;

              return (
                <TouchableOpacity
                  key={prodId}
                  style={[styles.card, { width: larguraCard }]}
                  activeOpacity={0.85}
                  onPress={() => abrirResultado(prodId)}
                >
                  <TouchableOpacity
                    style={styles.botaoCoracao}
                    onPress={() => descurtirOtimista(produto)}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    accessibilityLabel={`Desfavoritar ${produto.nomeProduto}`}
                  >
                    <Ionicons name="heart" size={19} color="#F52222" />
                  </TouchableOpacity>

                  <View style={styles.imagemContainer}>
                    <ScanThumb
                      imagemUri={produto.imagemUri}
                      imagemUrl={produto.imagemUrl}
                      imagemDemo={produto.imagemDemo}
                      categoriaPrincipal={catPrincipal}
                      style={styles.imagemProduto}
                      resizeMode="contain"
                      iconSize={32}
                    />
                  </View>

                  <Text style={styles.nomeProduto} numberOfLines={2}>
                    {produto.nomeProduto}
                  </Text>

                  <View style={styles.status}>
                    <View
                      style={[
                        styles.bolinhaStatus,
                        { backgroundColor: cor },
                      ]}
                    />
                    <Text style={[styles.textoStatus, { color: cor }]}>
                      {ehSeguro ? "Seguro" : "Risco"}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        ) : (
          <View style={styles.vazio}>
            <Ionicons name="heart-outline" size={45} color="#A0B0A6" />

            <Text style={styles.vazioTitulo}>
              Nenhum item curtido encontrado
            </Text>

            <Text style={styles.vazioTexto}>
              Favorite um produto na tela de resultado ou tente outra pesquisa.
            </Text>
          </View>
        )}
      </ScrollView>

      <TabBar abaAtiva="itensCurtidos" />
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
    paddingTop: 20,
    paddingBottom: 24,
  },
  tituloLinha: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 6,
    marginBottom: 16,
  },
  tituloGrupo: {
    flex: 1,
  },
  titulo: {
    fontSize: 22,
    fontWeight: "800",
    color: "#202623",
    letterSpacing: -0.7,
  },
  subtitulo: {
    fontSize: 11,
    color: "#68756D",
    marginTop: 2,
  },
  contador: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 7,
    borderRadius: 18,
    backgroundColor: "#EAF3EE",
    borderWidth: 1,
    borderColor: "#D5E4DA",
  },
  contadorTexto: {
    fontSize: 10,
    fontWeight: "700",
    color: "#294638",
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
    marginBottom: 12,
  },
  erroBannerText: {
    flex: 1,
    fontSize: 12,
    color: "#DC2626",
  },
  pesquisa: {
    height: 42,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#CDDAD1",
    backgroundColor: "#F2F5F3",
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  input: {
    flex: 1,
    fontSize: 11,
    color: "#263B30",
    paddingVertical: 0,
  },
  filtros: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 15,
    marginBottom: 18,
  },
  filtro: {
    minHeight: 30,
    paddingHorizontal: 10,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#D9E2DC",
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
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
    fontSize: 10,
    color: "#59665E",
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
  grade: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 13,
  },
  card: {
    minHeight: 166,
    backgroundColor: "#FFFFFF",
    borderRadius: 13,
    padding: 9,
    borderWidth: 1,
    borderColor: "#E5EAE6",
    elevation: 2,
    shadowColor: "#25382D",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },
  botaoCoracao: {
    position: "absolute",
    zIndex: 2,
    top: 6,
    right: 6,
    width: 30,
    height: 30,
    alignItems: "center",
    justifyContent: "center",
  },
  imagemContainer: {
    height: 94,
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 7,
  },
  imagemProduto: {
    width: "88%",
    height: "100%",
    borderRadius: 8,
  },
  nomeProduto: {
    minHeight: 16,
    fontSize: 11,
    fontWeight: "700",
    color: "#252B27",
    marginTop: 2,
  },
  status: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 5,
  },
  bolinhaStatus: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  textoStatus: {
    fontSize: 9,
    fontWeight: "600",
  },
  vazio: {
    alignItems: "center",
    paddingVertical: 48,
    paddingHorizontal: 15,
  },
  vazioTitulo: {
    fontSize: 14,
    fontWeight: "700",
    color: "#294638",
    marginTop: 12,
    textAlign: "center",
  },
  vazioTexto: {
    fontSize: 12,
    color: "#78847C",
    textAlign: "center",
    marginTop: 5,
  },
});
