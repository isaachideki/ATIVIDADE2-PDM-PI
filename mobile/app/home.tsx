import React, { useState, useCallback } from "react";
import {
  Geist_400Regular,
  Geist_500Medium,
  Geist_600SemiBold,
  Geist_700Bold,
} from "@expo-google-fonts/geist";
import { useFonts } from "@expo-google-fonts/geist/useFonts";
import {
  Feather,
  Ionicons,
  MaterialCommunityIcons,
} from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import {
  Image,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";

import TabBar from "../components/TabBar/indexTab";
import AppHeader from "../components/Header/AppHeader";
import ScanThumb from "../components/ScanThumb";
import VinculoCard from "../components/VinculoCard";
import api, { extrairMensagemErro } from "../services/api";
import { useAuth } from "../context/AuthContext";
import { useVinculoSync } from "../hooks/useVinculoSync";
import { formatarResumoAlergicos, obterDicaDoDia } from "../utils/datas";

type ItemHistoricoAPI = {
  id: string;
  nomeProduto: string;
  nomeAutomatico?: boolean;
  marcaPeso?: string | null;
  veredito: "SEGURO" | "PERIGOSO";
  alergicosDetectados?: (
    | string
    | {
        categoria: string;
        tipo: "CONTEM" | "TRACOS";
        termos?: string[];
      }
  )[];
  curtido: boolean;
  imagemUri?: string | null;
  imagemUrl?: string | null;
  imagemDemo?: string | null;
  createdAt?: string;
};

const ROTULOS_NIVEL: Record<0 | 1 | 2, string> = {
  0: "Leve",
  1: "Moderado",
  2: "Grave",
};

export default function HomeScreen() {
  const [fontsLoaded] = useFonts({
    Geist_400Regular,
    Geist_500Medium,
    Geist_600SemiBold,
    Geist_700Bold,
  });

  const { usuarioAtual, atualizarUsuario } = useAuth();
  const {
    vinculo,
    erroInline: erroVinculo,
    aviso: avisoVinculo,
    limparAviso: limparAvisoVinculo,
    sincronizar: sincronizarVinculo,
  } = useVinculoSync();

  const nomeUsuario = usuarioAtual?.nome
    ? usuarioAtual.nome.trim().split(" ")[0]
    : "Usuário";
  const restricoesAtivas = Array.isArray(usuarioAtual?.restricoes)
    ? usuarioAtual.restricoes.map((r) => r.toLowerCase())
    : [];
  const niveisSensibilidade = usuarioAtual?.niveisSensibilidade;

  const [diasConsecutivos, setDiasConsecutivos] = useState(0);
  const [escaneamentosSegurosMes, setEscaneamentosSegurosMes] = useState(0);
  const [metaMensal, setMetaMensal] = useState(50);

  const [itensCurtidos, setItensCurtidos] = useState<ItemHistoricoAPI[]>([]);
  const [recemEscaneados, setRecemEscaneados] = useState<ItemHistoricoAPI[]>(
    []
  );

  const [refreshing, setRefreshing] = useState(false);
  const [erroInline, setErroInline] = useState<string | null>(null);
  const [avisoRestricoesNutri, setAvisoRestricoesNutri] = useState(false);

  const dicaDoDia = obterDicaDoDia();

  const carregarTudo = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setRefreshing(true);
      setErroInline(null);

      try {
        const restricoesVistasEmSalvo = await AsyncStorage.getItem(
          "@restricoes_vistas_em"
        );

        const [resPerfil, resCurtidos, resRecentes] = await Promise.all([
          api.get("/users/perfil"),
          api.get("/users/historico?curtido=true&limit=10"),
          api.get("/users/historico?limit=5"),
        ]);

        const u = resPerfil.data?.usuario || resPerfil.data;
        const st = resPerfil.data?.stats || {};
        const vinculoServidor = resPerfil.data?.vinculo || u?.vinculo;

                const atualizadasPor = u?.restricoesAtualizadasPor;
        const atualizadasEm = u?.restricoesAtualizadasEm;
        if (atualizadasPor === "NUTRICIONISTA" && atualizadasEm) {
          const tsServidor = new Date(atualizadasEm).getTime();
          const tsVisto = restricoesVistasEmSalvo
            ? new Date(restricoesVistasEmSalvo).getTime()
            : 0;
          if (!Number.isNaN(tsServidor) && tsServidor > tsVisto) {
            setAvisoRestricoesNutri(true);
            await AsyncStorage.setItem(
              "@restricoes_vistas_em",
              String(atualizadasEm)
            );
          }
        }

        setDiasConsecutivos(Number(st.diasConsecutivos || 0));
        setEscaneamentosSegurosMes(Number(st.escaneamentosSegurosMes || 0));
        setMetaMensal(Number(st.metaMensal || 50));

        setItensCurtidos(
          Array.isArray(resCurtidos.data?.itens) ? resCurtidos.data.itens : []
        );
        setRecemEscaneados(
          Array.isArray(resRecentes.data?.itens) ? resRecentes.data.itens : []
        );

        if (u?.id || u?._id) {
          await atualizarUsuario({
            id: String(u.id || u._id),
            nome: u.nome || "",
            email: u.email || "",
            avatar: u.avatar || null,
            restricoes: Array.isArray(u.restricoes)
              ? u.restricoes.map((r: string) => r.toLowerCase())
              : [],
            niveisSensibilidade: u.niveisSensibilidade || {
              gluten: 1,
              lactose: 1,
              amendoim: 1,
            },
            vinculo: vinculoServidor,
            restricoesAtualizadasEm: u.restricoesAtualizadasEm || null,
            restricoesAtualizadasPor: u.restricoesAtualizadasPor || null,
          });
        }
      } catch (error: any) {
        setErroInline(extrairMensagemErro(error));
      } finally {
        setRefreshing(false);
      }
    },
    [atualizarUsuario]
  );

  useFocusEffect(
    useCallback(() => {
      carregarTudo(false);
    }, [carregarTudo])
  );

  const abrirResultado = (id: string) => {
    router.push({
      pathname: "/resultado" as any,
      params: { id },
    });
  };

  const extrairCategoriaPrincipal = (
    alergicos?: ItemHistoricoAPI["alergicosDetectados"]
  ): string | null => {
    if (!Array.isArray(alergicos) || alergicos.length === 0) return null;
    const primeiro = alergicos[0];
    if (typeof primeiro === "string") return primeiro.toLowerCase();
    return primeiro?.categoria || null;
  };

  if (!fontsLoaded) {
    return null;
  }

  const porcentagemMeta = Math.min(
    100,
    Math.round((escaneamentosSegurosMes / Math.max(1, metaMensal)) * 100)
  );

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <StatusBar barStyle="dark-content" />

      <AppHeader />

      {}
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => carregarTudo(true)}
            colors={["#006D37"]}
            tintColor="#006D37"
          />
        }
      >
        {erroInline || erroVinculo ? (
          <View style={styles.erroBanner}>
            <Ionicons name="alert-circle" size={16} color="#DC2626" />
            <Text style={styles.erroBannerText}>{erroInline || erroVinculo}</Text>
          </View>
        ) : null}

        {}
        <Text style={styles.greeting}>Olá {nomeUsuario}!</Text>

        {avisoVinculo ? (
          <View style={styles.nutriUpdateBanner}>
            <Ionicons name="notifications" size={18} color="#006D37" />
            <Text style={styles.nutriUpdateText}>{avisoVinculo}</Text>
            <TouchableOpacity onPress={limparAvisoVinculo}>
              <Feather name="x" size={16} color="#047857" />
            </TouchableOpacity>
          </View>
        ) : null}

        {}
        {avisoRestricoesNutri ? (
          <View style={styles.nutriUpdateBanner}>
            <Ionicons name="notifications" size={18} color="#006D37" />
            <Text style={styles.nutriUpdateText}>
              Seu nutricionista atualizou suas restrições
            </Text>
            <TouchableOpacity
              onPress={() => setAvisoRestricoesNutri(false)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Feather name="x" size={16} color="#047857" />
            </TouchableOpacity>
          </View>
        ) : null}

        {}
        <VinculoCard
          vinculo={vinculo}
          onRefresh={async () => {
            await sincronizarVinculo();
            await carregarTudo(true);
          }}
        />

        {/* INTOLERÂNCIAS */}
        <Text style={styles.sectionLabel}>Suas intolerâncias</Text>

        <View style={styles.intoleranciasRow}>
          {restricoesAtivas.includes("gluten") && (
            <TouchableOpacity
              activeOpacity={0.8}
              style={styles.intolerancia}
              onPress={() => router.push("/editar-perfil" as never)}
            >
              <Image
                style={styles.iconIntoleranciaGluten}
                source={require("../assets/images/iconGluInt.png")}
              />
              <Text style={styles.intoleranciaText}>
                Glúten · {ROTULOS_NIVEL[niveisSensibilidade?.gluten ?? 1]}
              </Text>
            </TouchableOpacity>
          )}

          {restricoesAtivas.includes("lactose") && (
            <TouchableOpacity
              activeOpacity={0.8}
              style={styles.intolerancia}
              onPress={() => router.push("/editar-perfil" as never)}
            >
              <Image
                style={styles.iconIntolerancia}
                source={require("../assets/images/iconLacInt.png")}
              />
              <Text style={styles.intoleranciaText}>
                Lactose · {ROTULOS_NIVEL[niveisSensibilidade?.lactose ?? 1]}
              </Text>
            </TouchableOpacity>
          )}

          {restricoesAtivas.includes("amendoim") && (
            <TouchableOpacity
              activeOpacity={0.8}
              style={styles.intolerancia}
              onPress={() => router.push("/editar-perfil" as never)}
            >
              <Image
                style={styles.iconIntoleranciaGluten}
                source={require("../assets/images/iconAmendoim.png")}
              />
              <Text style={styles.intoleranciaText}>
                Amendoim · {ROTULOS_NIVEL[niveisSensibilidade?.amendoim ?? 1]}
              </Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            activeOpacity={0.8}
            style={styles.addChipButton}
            onPress={() => router.push("/editar-perfil" as never)}
            accessibilityLabel="Configurar intolerâncias e sensibilidade"
            accessibilityRole="button"
          >
            <Feather name="plus" size={17} color="#006D37" />
          </TouchableOpacity>
        </View>

        {/* PROGRESSO DE SAÚDE */}
        <View style={styles.progressCard}>
          <View style={styles.progressHeader}>
            <Text style={styles.progressTitle}>PROGRESSO DE SAÚDE</Text>
            <View style={styles.progressDiasBadge}>
              <Text style={styles.progressDias}>
                {diasConsecutivos} {diasConsecutivos === 1 ? "Dia" : "Dias"}
              </Text>
            </View>
          </View>

          <View style={styles.progressBarBackground}>
            <View
              style={[
                styles.progressBarFill,
                { width: `${porcentagemMeta}%` },
              ]}
            />
          </View>

          {escaneamentosSegurosMes > 0 ? (
            <Text style={styles.progressDescription}>
              Você realizou{" "}
              <Text style={styles.boldText}>
                {escaneamentosSegurosMes} escaneamentos seguros
              </Text>{" "}
              este mês. Continue assim!
            </Text>
          ) : (
            <Text style={styles.progressDescription}>
              Você ainda não realizou escaneamentos seguros este mês.{" "}
              <Text style={styles.boldText}>
                Escaneie seu primeiro rótulo agora!
              </Text>
            </Text>
          )}
        </View>

        {/* BOTÃO ESCANEAR PRODUTO */}
        <View style={styles.scanCardBorder}>
          <TouchableOpacity
            activeOpacity={0.9}
            style={styles.scanCardInner}
            onPress={() => router.push("/scanner" as never)}
          >
            <View style={styles.scanIconBox}>
              <MaterialCommunityIcons
                name="barcode-scan"
                size={23}
                color="#FFFFFF"
              />
            </View>

            <View style={styles.scanTextBox}>
              <Text style={styles.scanTitle}>Escanear Produto</Text>
              <Text style={styles.scanSubtitle}>
                Análise de ingredientes{"\n"}instantânea
              </Text>
            </View>

            <View style={styles.scanChevronCircle}>
              <Feather name="chevron-right" size={19} color="#006D37" />
            </View>
          </TouchableOpacity>
        </View>

        {/* ITENS CURTIDOS */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionHeaderTitle}>Itens Curtidos</Text>

          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => router.push("/itensCurtidos" as never)}
            accessibilityLabel="Ver todos os itens curtidos"
          >
            <Feather name="chevron-right" size={18} color="#191C1D" />
          </TouchableOpacity>
        </View>

        {itensCurtidos.length > 0 ? (
          <ScrollView
            horizontal
            style={styles.curtidosScroll}
            contentContainerStyle={styles.curtidosRow}
            showsHorizontalScrollIndicator={false}
            nestedScrollEnabled
            directionalLockEnabled
            bounces={false}
            alwaysBounceHorizontal={false}
          >
            {itensCurtidos.map((item) => {
              const isSeguro = item.veredito === "SEGURO";
              const catPrincipal = extrairCategoriaPrincipal(
                item.alergicosDetectados
              );

              return (
                <TouchableOpacity
                  key={item.id}
                  style={styles.curtidoCard}
                  activeOpacity={0.82}
                  onPress={() => abrirResultado(item.id)}
                >
                  <View style={styles.curtidoImageBox}>
                    <ScanThumb
                      imagemUri={item.imagemUri}
                      imagemUrl={item.imagemUrl}
                      imagemDemo={item.imagemDemo}
                      categoriaPrincipal={catPrincipal}
                      style={styles.curtidoImage}
                      iconSize={24}
                    />

                    <View style={styles.heartIcon}>
                      <Ionicons name="heart" size={12} color="#DC2626" />
                    </View>
                  </View>

                  <Text style={styles.curtidoNome} numberOfLines={2}>
                    {item.nomeProduto}
                  </Text>

                  <Text
                    style={[
                      styles.statusSimpleText,
                      {
                        color: isSeguro ? "#15803D" : "#DC2626",
                      },
                    ]}
                  >
                    {isSeguro ? "Seguro" : "Risco"}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        ) : (
          <View style={styles.emptyBox}>
            <Ionicons name="heart-outline" size={22} color="#64748B" />
            <Text style={styles.emptyBoxText}>
              Seus produtos favoritados aparecerão aqui.
            </Text>
          </View>
        )}

        {/* RECÉM ESCANEADOS */}
        <View style={[styles.sectionHeaderRow, { marginTop: 18 }]}>
          <Text style={styles.sectionHeaderTitle}>Recém Escaneados</Text>

          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => router.push("/historico" as never)}
          >
            <Text style={styles.historicoLink}>Histórico</Text>
          </TouchableOpacity>
        </View>

        {recemEscaneados.length > 0 ? (
          recemEscaneados.map((item) => {
            const isSeguro = item.veredito === "SEGURO";
            const alergicosObjetos = Array.isArray(item.alergicosDetectados)
              ? item.alergicosDetectados.map((a) =>
                  typeof a === "string"
                    ? { categoria: a, tipo: "CONTEM" as const }
                    : a
                )
              : [];
            const detalheTexto = formatarResumoAlergicos(
              item.veredito,
              alergicosObjetos
            );
            const catPrincipal = extrairCategoriaPrincipal(
              item.alergicosDetectados
            );

            return (
              <TouchableOpacity
                key={item.id}
                style={styles.escaneadoRow}
                activeOpacity={0.82}
                onPress={() => abrirResultado(item.id)}
              >
                <ScanThumb
                  imagemUri={item.imagemUri}
                  imagemUrl={item.imagemUrl}
                  imagemDemo={item.imagemDemo}
                  categoriaPrincipal={catPrincipal}
                  style={styles.escaneadoImagePlaceholder}
                  iconSize={20}
                />

                <View style={styles.escaneadoInfo}>
                  <Text style={styles.escaneadoNome} numberOfLines={1}>
                    {item.nomeProduto}
                  </Text>

                  <View style={styles.escaneadoDetalheRow}>
                    {isSeguro ? (
                      <Ionicons
                        name="checkmark-circle"
                        size={13}
                        color="#16A34A"
                        style={{ marginRight: 4 }}
                      />
                    ) : (
                      <Ionicons
                        name="warning"
                        size={13}
                        color="#DC2626"
                        style={{ marginRight: 4 }}
                      />
                    )}

                    <Text
                      style={[
                        styles.escaneadoDetalhe,
                        {
                          color: isSeguro ? "#16A34A" : "#DC2626",
                        },
                      ]}
                      numberOfLines={1}
                    >
                      {detalheTexto}
                    </Text>
                  </View>
                </View>

                <StatusBadge seguro={isSeguro} />
              </TouchableOpacity>
            );
          })
        ) : (
          <View style={styles.emptyBox}>
            <MaterialCommunityIcons
              name="barcode-scan"
              size={22}
              color="#64748B"
            />
            <Text style={styles.emptyBoxText}>
              Nenhum produto escaneado ainda. Toque em &quot;Escanear Produto&quot;
              acima para começar!
            </Text>
          </View>
        )}

        {/* DICA DO DIA */}
        <View style={styles.tipCard}>
          <View style={styles.tipIconBox}>
            <Ionicons name="bulb-outline" size={21} color="#B45309" />
          </View>
          <View style={styles.tipContent}>
            <Text style={styles.tipTitle}>DICA DO DIA</Text>
            <Text style={styles.tipText}>{dicaDoDia}</Text>
          </View>
        </View>
      </ScrollView>

      {/* BARRA DE NAVEGAÇÃO INFERIOR */}
      <TabBar abaAtiva="inicio" />
    </SafeAreaView>
  );
}

function StatusBadge({ seguro }: { seguro: boolean }) {
  return (
    <View
      style={[
        styles.statusBadge,
        seguro ? styles.statusBadgeSeguro : styles.statusBadgeRisco,
      ]}
    >
      <Text
        style={[
          styles.statusBadgeText,
          seguro ? styles.statusBadgeTextSeguro : styles.statusBadgeTextRisco,
        ]}
      >
        {seguro ? "Seguro" : "Risco"}
      </Text>
    </View>
  );
}

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F2F6F4",
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 30,
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
    fontFamily: "Geist_500Medium",
    fontSize: 12,
    color: "#DC2626",
  },
  greeting: {
    fontFamily: "Geist_700Bold",
    fontSize: 23,
    color: "#0F172A",
    marginBottom: 14,
  },
  sectionLabel: {
    fontFamily: "Geist_600SemiBold",
    fontSize: 13,
    color: "#64748B",
    marginBottom: 10,
  },
  intoleranciasRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    marginBottom: 20,
  },
  intolerancia: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#DCE7E0",
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 14,
    marginRight: 10,
    marginBottom: 6,
    gap: 6,
    elevation: 1,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
  },
  iconIntolerancia: {
    width: 7,
    height: 13,
  },
  iconIntoleranciaGluten: {
    width: 16,
    height: 16,
  },
  intoleranciaText: {
    fontFamily: "Geist_600SemiBold",
    fontSize: 13,
    color: "#1F2937",
  },
  addChipButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#ECFDF5",
    borderWidth: 1.5,
    borderColor: "#16A34A",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
    elevation: 2,
    shadowColor: "#006D37",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  // PROGRESSO DE SAÚDE
  progressCard: {
    width: "100%",
    backgroundColor: "#ECFDF5",
    borderWidth: 1,
    borderColor: "#A7F3D0",
    borderRadius: 20,
    padding: 16,
    marginBottom: 18,
    elevation: 2,
    shadowColor: "#006D37",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
  },
  progressHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  progressTitle: {
    fontFamily: "Geist_700Bold",
    fontSize: 11.5,
    letterSpacing: 0.5,
    color: "#006D37",
  },
  progressDiasBadge: {
    backgroundColor: "#006D37",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  progressDias: {
    fontFamily: "Geist_700Bold",
    fontSize: 12.5,
    color: "#FFFFFF",
  },
  progressBarBackground: {
    width: "100%",
    height: 7,
    borderRadius: 4,
    backgroundColor: "#D1FAE5",
    marginBottom: 12,
    overflow: "hidden",
  },
  progressBarFill: {
    height: 7,
    borderRadius: 4,
    backgroundColor: "#006D37",
  },
  progressDescription: {
    fontFamily: "Geist_400Regular",
    fontSize: 12.5,
    lineHeight: 18,
    color: "#334155",
  },
  boldText: {
    fontFamily: "Geist_700Bold",
    color: "#064E3B",
  },
  // ESCANEAR PRODUTO
  scanCardBorder: {
    width: "100%",
    borderRadius: 24,
    padding: 2.5,
    backgroundColor: "#22C55E",
    marginBottom: 24,
    elevation: 4,
    shadowColor: "#006D37",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.16,
    shadowRadius: 10,
  },
  scanCardInner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 21.5,
    paddingVertical: 15,
    paddingHorizontal: 16,
  },
  scanIconBox: {
    width: 46,
    height: 46,
    borderRadius: 13,
    backgroundColor: "#006D37",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  scanTextBox: {
    flex: 1,
  },
  scanTitle: {
    fontFamily: "Geist_700Bold",
    fontSize: 15.5,
    color: "#0F172A",
    marginBottom: 2,
  },
  scanSubtitle: {
    fontFamily: "Geist_400Regular",
    fontSize: 11.5,
    color: "#64748B",
    lineHeight: 15,
  },
  scanChevronCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#ECFDF5",
    alignItems: "center",
    justifyContent: "center",
  },
  // SEÇÕES
  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  sectionHeaderTitle: {
    fontFamily: "Geist_700Bold",
    fontSize: 16,
    color: "#0F172A",
  },
  historicoLink: {
    fontFamily: "Geist_700Bold",
    fontSize: 12.5,
    color: "#006D37",
  },
  // ITENS CURTIDOS
  curtidosScroll: {
    width: "100%",
    flexGrow: 0,
    flexShrink: 0,
  },
  curtidosRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingRight: 12,
    paddingBottom: 6,
  },
  curtidoCard: {
    width: 98,
    flexShrink: 0,
    marginRight: 10,
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 7,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    elevation: 2,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  curtidoImageBox: {
    width: "100%",
    height: 82,
    borderRadius: 10,
    backgroundColor: "#F8FAFC",
    marginBottom: 6,
    position: "relative",
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  curtidoImage: {
    width: "100%",
    height: "100%",
  },
  heartIcon: {
    position: "absolute",
    top: 4,
    right: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.95)",
    alignItems: "center",
    justifyContent: "center",
  },
  curtidoNome: {
    fontFamily: "Geist_600SemiBold",
    fontSize: 10.5,
    lineHeight: 13.5,
    color: "#0F172A",
  },
  statusSimpleText: {
    fontFamily: "Geist_600SemiBold",
    fontSize: 9.5,
    marginTop: 2,
  },
  emptyBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginBottom: 6,
  },
  emptyBoxText: {
    flex: 1,
    fontFamily: "Geist_400Regular",
    fontSize: 12,
    lineHeight: 17,
    color: "#64748B",
  },
  // RECÉM ESCANEADOS
  escaneadoRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 11,
    marginBottom: 10,
    elevation: 2,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  escaneadoImagePlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: "#F8FAFC",
    marginRight: 12,
  },
  escaneadoInfo: {
    flex: 1,
    marginRight: 8,
  },
  escaneadoNome: {
    fontFamily: "Geist_700Bold",
    fontSize: 13.5,
    color: "#0F172A",
  },
  escaneadoDetalheRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 3,
  },
  escaneadoDetalhe: {
    fontFamily: "Geist_600SemiBold",
    fontSize: 11,
    lineHeight: 14,
  },
  statusBadge: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
  },
  statusBadgeSeguro: {
    backgroundColor: "#DCFCE7",
  },
  statusBadgeRisco: {
    backgroundColor: "#FEE2E2",
  },
  statusBadgeText: {
    fontFamily: "Geist_700Bold",
    fontSize: 10,
  },
  statusBadgeTextSeguro: {
    color: "#15803D",
  },
  statusBadgeTextRisco: {
    color: "#DC2626",
  },
  // DICA DO DIA
  tipCard: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
    backgroundColor: "#FFFBEB",
    borderWidth: 1,
    borderColor: "#FDE68A",
    borderRadius: 18,
    padding: 15,
    marginTop: 10,
    elevation: 1,
    shadowColor: "#B45309",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  tipIconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#FEF3C7",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  tipContent: {
    flex: 1,
  },
  tipTitle: {
    fontFamily: "Geist_700Bold",
    fontSize: 10.5,
    letterSpacing: 0.5,
    color: "#B45309",
    marginBottom: 3,
  },
  tipText: {
    fontFamily: "Geist_400Regular",
    fontSize: 12,
    lineHeight: 17,
    color: "#78350F",
  },
  nutriUpdateBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#DCFCE7",
    borderWidth: 1,
    borderColor: "#86EFAC",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 11,
    marginBottom: 12,
  },
  nutriUpdateText: {
    flex: 1,
    fontFamily: "Geist_700Bold",
    fontSize: 12.5,
    color: "#065F46",
  },
  acompanhamentoCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#A7F3D0",
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 14,
    elevation: 2,
    shadowColor: "#006D37",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 5,
  },
  acompanhamentoIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#ECFDF5",
    alignItems: "center",
    justifyContent: "center",
  },
  acompanhamentoLabel: {
    fontFamily: "Geist_700Bold",
    fontSize: 9.5,
    letterSpacing: 0.5,
    color: "#006D37",
    marginBottom: 2,
  },
  acompanhamentoText: {
    fontFamily: "Geist_400Regular",
    fontSize: 12.5,
    color: "#334155",
    lineHeight: 17,
  },
  acompanhamentoBold: {
    fontFamily: "Geist_700Bold",
    color: "#0F172A",
  },
  conviteNutriCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 14,
    paddingLeft: 12,
    paddingRight: 8,
    paddingVertical: 10,
    marginBottom: 14,
  },
  conviteNutriTouch: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  conviteNutriIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "#ECFDF5",
    alignItems: "center",
    justifyContent: "center",
  },
  conviteNutriTitle: {
    fontFamily: "Geist_600SemiBold",
    fontSize: 12.5,
    color: "#0F172A",
  },
  conviteNutriSub: {
    fontFamily: "Geist_400Regular",
    fontSize: 11,
    color: "#64748B",
    marginTop: 1,
  },
  conviteNutriDismiss: {
    padding: 6,
    marginLeft: 4,
  },
});
