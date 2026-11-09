import React, { useState, useCallback } from "react";
import {
  ActivityIndicator,
  Image,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Feather, Ionicons } from "@expo/vector-icons";
import { useRouter, useFocusEffect } from "expo-router";
import {
  Geist_400Regular,
  Geist_500Medium,
  Geist_600SemiBold,
  Geist_700Bold,
} from "@expo-google-fonts/geist";
import { useFonts } from "@expo-google-fonts/geist/useFonts";

import api, { extrairMensagemErro } from "../services/api";
import AppHeader from "../components/Header/AppHeader";
import TabBar from "../components/TabBar/indexTab";
import SensitivitySlider, {
  NivelSensibilidade,
} from "../components/SensitivitySlider";
import { useAuth, NiveisSensibilidade } from "../context/AuthContext";

const CATEGORIAS: {
  id: "gluten" | "lactose" | "amendoim";
  titulo: string;
  descricao: string;
  icone: any;
}[] = [
  {
    id: "gluten",
    titulo: "Glúten",
    descricao:
      "Filtrar produtos que contenham trigo, centeio, cevada ou derivados para sua segurança celíaca.",
    icone: require("../assets/images/iconGluten.png"),
  },
  {
    id: "lactose",
    titulo: "Lactose",
    descricao:
      "Identificar leite, soro de leite e traços de laticínios em alimentos processados e bebidas.",
    icone: require("../assets/images/iconLactose.png"),
  },
  {
    id: "amendoim",
    titulo: "Amendoim",
    descricao:
      "Monitorar amendoim e seus derivados que podem causar reações de hipersensibilidade alimentar.",
    icone: require("../assets/images/iconAmendoim.png"),
  },
];

export default function AlertasContaminacaoScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { usuarioAtual, atualizarUsuario } = useAuth();

  const [fontsLoaded] = useFonts({
    Geist_400Regular,
    Geist_500Medium,
    Geist_600SemiBold,
    Geist_700Bold,
  });

  const [carregando, setCarregando] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [salvando, setSalvando] = useState(false);

  const [ativos, setAtivos] = useState<{
    gluten: boolean;
    lactose: boolean;
    amendoim: boolean;
  }>({
    gluten: false,
    lactose: false,
    amendoim: false,
  });

  const [niveis, setNiveis] = useState<NiveisSensibilidade>({
    gluten: 1,
    lactose: 1,
    amendoim: 1,
  });

  const [erroInline, setErroInline] = useState<string | null>(null);
  const [sucessoInline, setSucessoInline] = useState<string | null>(null);

  const carregarAlertas = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    setErroInline(null);

    try {
      const res = await api.get("/users/perfil");
      const u = res.data?.usuario || res.data;
      const restServidor: string[] = Array.isArray(u.restricoes)
        ? u.restricoes.map((r: string) => r.toLowerCase())
        : [];

      const niveisServidor: NiveisSensibilidade = {
        gluten: (u.niveisSensibilidade?.gluten ?? 1) as 0 | 1 | 2,
        lactose: (u.niveisSensibilidade?.lactose ?? 1) as 0 | 1 | 2,
        amendoim: (u.niveisSensibilidade?.amendoim ?? 1) as 0 | 1 | 2,
      };

      setAtivos({
        gluten: restServidor.includes("gluten"),
        lactose: restServidor.includes("lactose"),
        amendoim: restServidor.includes("amendoim"),
      });
      setNiveis(niveisServidor);

      await atualizarUsuario({
        id: String(u.id || u._id || usuarioAtual?.id || ""),
        nome: u.nome || usuarioAtual?.nome || "",
        email: u.email || usuarioAtual?.email || "",
        avatar: u.avatar || usuarioAtual?.avatar || null,
        restricoes: restServidor,
        niveisSensibilidade: niveisServidor,
        restricoesAtualizadasEm: u.restricoesAtualizadasEm || null,
        restricoesAtualizadasPor: u.restricoesAtualizadasPor || null,
      });
    } catch (err: any) {
      const [restLocal, niveisLocal] = await Promise.all([
        AsyncStorage.getItem("@usuario_restricoes"),
        AsyncStorage.getItem("@usuario_niveis"),
      ]);
      if (restLocal) {
        try {
          const parsed: string[] = JSON.parse(restLocal);
          const lower = parsed.map((r) => r.toLowerCase());
          setAtivos({
            gluten: lower.includes("gluten"),
            lactose: lower.includes("lactose"),
            amendoim: lower.includes("amendoim"),
          });
        } catch {}
      }
      if (niveisLocal) {
        try {
          setNiveis(JSON.parse(niveisLocal));
        } catch {}
      }
      setErroInline(extrairMensagemErro(err));
    } finally {
      setCarregando(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      carregarAlertas(false);
    }, [carregarAlertas])
  );

  const alternarCategoria = (cat: "gluten" | "lactose" | "amendoim") => {
    setSucessoInline(null);
    setErroInline(null);
    setAtivos((prev) => ({
      ...prev,
      [cat]: !prev[cat],
    }));
  };

  const atualizarNivel = (
    cat: "gluten" | "lactose" | "amendoim",
    novoNivel: NivelSensibilidade
  ) => {
    setSucessoInline(null);
    setErroInline(null);
    setAtivos((prev) => ({ ...prev, [cat]: true }));
    setNiveis((prev) => ({ ...prev, [cat]: novoNivel }));
  };

  const salvarConfiguracaoAlertas = async () => {
    if (salvando) return;
    setErroInline(null);
    setSucessoInline(null);

    const restricoesSelecionadas: string[] = [];
    if (ativos.gluten) restricoesSelecionadas.push("gluten");
    if (ativos.lactose) restricoesSelecionadas.push("lactose");
    if (ativos.amendoim) restricoesSelecionadas.push("amendoim");

    if (restricoesSelecionadas.length === 0) {
      setErroInline("Selecione ao menos uma intolerância ativa.");
      return;
    }

    setSalvando(true);
    try {
      const res = await api.put("/users/restricoes", {
        restricoes: restricoesSelecionadas,
        niveisSensibilidade: niveis,
      });
      const u = res.data?.usuario || res.data;

      await atualizarUsuario({
        id: String(u.id || u._id || usuarioAtual?.id || ""),
        nome: u.nome || usuarioAtual?.nome || "",
        email: u.email || usuarioAtual?.email || "",
        avatar: u.avatar || usuarioAtual?.avatar || null,
        restricoes: u.restricoes || restricoesSelecionadas,
        niveisSensibilidade: u.niveisSensibilidade || niveis,
        restricoesAtualizadasEm:
          u.restricoesAtualizadasEm || new Date().toISOString(),
        restricoesAtualizadasPor: "PACIENTE",
      });

      setSucessoInline(
        "Intolerâncias e alertas de contaminação salvos com sucesso!"
      );
    } catch (err: any) {
      setErroInline(extrairMensagemErro(err));
    } finally {
      setSalvando(false);
    }
  };

  if (!fontsLoaded || carregando) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator size="large" color="#087443" />
      </View>
    );
  }

  const cardWidth = Math.min(width - 36, 440);

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <StatusBar barStyle="dark-content" />
      <AppHeader />

      <ScrollView
        style={styles.container}
        contentContainerStyle={[styles.scrollContent, { width: cardWidth }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => carregarAlertas(true)}
            colors={["#087443"]}
            tintColor="#087443"
          />
        }
      >
        <View style={styles.headerRow}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backBtn}
            accessibilityRole="button"
            accessibilityLabel="Voltar"
          >
            <Feather name="arrow-left" size={20} color="#087443" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.pageTitle}>Alertas de Contaminação</Text>
            <Text style={styles.pageSubtitle}>
              Ative suas intolerâncias e ajuste a reação a &quot;Pode conter...&quot;
            </Text>
          </View>
        </View>

        {erroInline ? (
          <View style={styles.erroBanner}>
            <Ionicons name="alert-circle" size={18} color="#DC2626" />
            <Text style={styles.erroBannerText}>{erroInline}</Text>
          </View>
        ) : null}

        {sucessoInline ? (
          <View style={styles.sucessoBanner}>
            <Ionicons name="checkmark-circle" size={18} color="#15803D" />
            <Text style={styles.sucessoBannerText}>{sucessoInline}</Text>
          </View>
        ) : null}

        <View style={styles.infoBanner}>
          <Ionicons
            name="shield-checkmark-outline"
            size={22}
            color="#006D37"
          />
          <View style={{ flex: 1 }}>
            <Text style={styles.infoTitle}>
              Como funcionam os alertas de traços?
            </Text>
            <Text style={styles.infoDesc}>
              Nos níveis <Text style={styles.bold}>Moderado</Text> e{" "}
              <Text style={styles.bold}>Grave</Text>, qualquer menção a{" "}
              <Text style={styles.bold}>&quot;Pode conter...&quot;</Text> dispara um
              alerta vermelho de risco. No nível{" "}
              <Text style={styles.bold}>Leve</Text>, apenas ingredientes diretos
              são barrados.
            </Text>
          </View>
        </View>

        {CATEGORIAS.map((cat) => {
          const estaAtivo = ativos[cat.id];
          const nivelAtual = (niveis[cat.id] ?? 1) as NivelSensibilidade;
          const alertaTracosAtivo = estaAtivo && nivelAtual >= 1;

          return (
            <View
              key={cat.id}
              style={[styles.card, !estaAtivo && styles.cardInactive]}
            >
              <View style={styles.cardTop}>
                <View style={styles.iconBox}>
                  <Image source={cat.icone} style={styles.iconImage} />
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>{cat.titulo}</Text>
                  <Text
                    style={[
                      styles.statusTag,
                      !estaAtivo
                        ? styles.statusTagDisabled
                        : alertaTracosAtivo
                        ? styles.statusTagStrict
                        : styles.statusTagRelaxed,
                    ]}
                  >
                    {!estaAtivo
                      ? "Restrição desativada para o seu perfil"
                      : alertaTracosAtivo
                      ? "Alerta de traços ATIVO ('Pode conter' = Risco)"
                      : "Alerta de traços IGNORADO (Apenas 'Contém')"}
                  </Text>
                </View>

                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => alternarCategoria(cat.id)}
                  style={[styles.switch, estaAtivo && styles.switchActive]}
                  accessibilityRole="switch"
                  accessibilityState={{ checked: estaAtivo }}
                  accessibilityLabel={`Ativar restrição de ${cat.titulo}`}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <View
                    style={[
                      styles.switchCircle,
                      estaAtivo && styles.switchCircleActive,
                    ]}
                  />
                </TouchableOpacity>
              </View>

              <Text style={styles.cardDesc}>{cat.descricao}</Text>

              <View style={styles.divider} />

              <SensitivitySlider
                nivel={nivelAtual}
                onChangeNivel={(novo) => atualizarNivel(cat.id, novo)}
                onRequestActivate={() =>
                  setAtivos((prev) => ({ ...prev, [cat.id]: true }))
                }
                ativo={estaAtivo}
              />
            </View>
          );
        })}

        <TouchableOpacity
          style={[styles.saveButton, salvando && { opacity: 0.7 }]}
          activeOpacity={0.85}
          onPress={salvarConfiguracaoAlertas}
          disabled={salvando}
        >
          {salvando ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.saveButtonText}>
              Salvar Preferências de Alerta
            </Text>
          )}
        </TouchableOpacity>
      </ScrollView>

      <TabBar abaAtiva="perfil" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#F5F7FA" },
  loadingScreen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F5F7FA",
  },
  container: { flex: 1, backgroundColor: "#F5F7FA" },
  scrollContent: {
    alignSelf: "center",
    paddingTop: 16,
    paddingBottom: 34,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
    gap: 12,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#EAF5EE",
    alignItems: "center",
    justifyContent: "center",
  },
  pageTitle: {
    fontFamily: "Geist_700Bold",
    fontSize: 20,
    color: "#101828",
  },
  pageSubtitle: {
    fontFamily: "Geist_400Regular",
    fontSize: 12,
    color: "#64748B",
    marginTop: 2,
  },
  erroBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FECACA",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    marginBottom: 14,
  },
  erroBannerText: {
    flex: 1,
    fontFamily: "Geist_500Medium",
    fontSize: 12.5,
    color: "#DC2626",
  },
  sucessoBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#DCFCE7",
    borderWidth: 1,
    borderColor: "#BBF7D0",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    marginBottom: 14,
  },
  sucessoBannerText: {
    flex: 1,
    fontFamily: "Geist_600SemiBold",
    fontSize: 12.5,
    color: "#15803D",
  },
  infoBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    backgroundColor: "#EAF4EE",
    borderWidth: 1,
    borderColor: "#D1E7DA",
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
  },
  infoTitle: {
    fontFamily: "Geist_700Bold",
    fontSize: 13.5,
    color: "#006D37",
    marginBottom: 4,
  },
  infoDesc: {
    fontFamily: "Geist_400Regular",
    fontSize: 12,
    lineHeight: 18,
    color: "#334155",
  },
  bold: {
    fontFamily: "Geist_700Bold",
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#006D37",
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
  },
  cardInactive: {
    borderColor: "#CBD5E1",
  },
  cardTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  iconBox: {
    width: 38,
    height: 38,
    borderRadius: 9,
    backgroundColor: "#FFF7E3",
    alignItems: "center",
    justifyContent: "center",
  },
  iconImage: {
    width: 22,
    height: 22,
    resizeMode: "contain",
  },
  cardTitle: {
    fontFamily: "Geist_700Bold",
    fontSize: 16,
    color: "#111827",
  },
  statusTag: {
    fontFamily: "Geist_600SemiBold",
    fontSize: 11,
    marginTop: 2,
  },
  statusTagStrict: {
    color: "#006D37",
  },
  statusTagRelaxed: {
    color: "#B45309",
  },
  statusTagDisabled: {
    color: "#94A3B8",
  },
  cardDesc: {
    fontFamily: "Geist_400Regular",
    fontSize: 12.5,
    lineHeight: 18,
    color: "#4B5563",
    marginTop: 8,
  },
  switch: {
    width: 40,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#DDE1E4",
    padding: 2,
    justifyContent: "center",
  },
  switchActive: {
    backgroundColor: "#24C95B",
  },
  switchCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#FFFFFF",
    alignSelf: "flex-start",
  },
  switchCircleActive: {
    alignSelf: "flex-end",
  },
  divider: {
    height: 1,
    backgroundColor: "#E5E7EB",
    marginVertical: 12,
  },
  saveButton: {
    backgroundColor: "#087443",
    height: 48,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 6,
  },
  saveButtonText: {
    fontFamily: "Geist_700Bold",
    fontSize: 15,
    color: "#FFFFFF",
  },
});
