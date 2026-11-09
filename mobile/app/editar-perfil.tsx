import React, { useState, useCallback, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  StatusBar,
  Image,
  RefreshControl,
  useWindowDimensions,
  BackHandler,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons, Feather } from "@expo/vector-icons";
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
import ConfirmModal from "../components/ConfirmModal";
import { useAuth, NiveisSensibilidade } from "../context/AuthContext";
import {
  CategoriaRestricao,
  useRestricoesDraft,
} from "../hooks/useRestricoesDraft";

const iconImages = {
  gluten: require("../assets/images/iconGluten.png"),
  lactose: require("../assets/images/iconLactose.png"),
  amendoim: require("../assets/images/iconAmendoim.png"),
} as const;

type SnapshotServidor = {
  nome: string;
  email: string;
  restricoes: string[];
  niveisSensibilidade: NiveisSensibilidade;
};

export default function EditarPerfilScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { usuarioAtual, atualizarUsuario } = useAuth();
  const usuarioAtualRef = useRef(usuarioAtual);
  const {
    rascunho,
    inicializar,
    alternar,
    definirNivel,
    marcarSalvo,
    descartar,
    alterado: isDirty,
  } = useRestricoesDraft();

  const [fontsLoaded] = useFonts({
    Geist_400Regular,
    Geist_500Medium,
    Geist_600SemiBold,
    Geist_700Bold,
  });

  const [carregandoInicial, setCarregandoInicial] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [sliderEmArrasto, setSliderEmArrasto] = useState(false);

  const [snapshotServidor, setSnapshotServidor] =
    useState<SnapshotServidor | null>(null);

  const [mensagemSucesso, setMensagemSucesso] = useState<string | null>(null);
  const [mensagemErro, setMensagemErro] = useState<string | null>(null);
  const [modalRestaurarVisivel, setModalRestaurarVisivel] = useState(false);
  const [modalDescartarVisivel, setModalDescartarVisivel] = useState(false);
  const [sairAposDescarte, setSairAposDescarte] = useState(false);
  const repetirAcaoPendente = useRef<(() => void) | null>(null);

  useEffect(() => {
    usuarioAtualRef.current = usuarioAtual;
  }, [usuarioAtual]);

    const carregarDoServidor = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setRefreshing(true);
      setMensagemErro(null);

      try {
        const res = await api.get("/users/perfil");
        const u = res.data?.usuario || res.data;
        const snap: SnapshotServidor = {
          nome: u.nome || "",
          email: u.email || "",
          restricoes: Array.isArray(u.restricoes)
            ? u.restricoes.map((r: string) => r.toLowerCase())
            : [],
          niveisSensibilidade: {
            gluten: (u.niveisSensibilidade?.gluten ?? 1) as 0 | 1 | 2,
            lactose: (u.niveisSensibilidade?.lactose ?? 1) as 0 | 1 | 2,
            amendoim: (u.niveisSensibilidade?.amendoim ?? 1) as 0 | 1 | 2,
          },
        };
        setSnapshotServidor(snap);
        inicializar(snap.restricoes, snap.niveisSensibilidade);

                await atualizarUsuario({
          id: String(u.id || u._id || ""),
          nome: snap.nome,
          email: snap.email,
          avatar: u.avatar || null,
          restricoes: snap.restricoes,
          niveisSensibilidade: snap.niveisSensibilidade,
          restricoesAtualizadasEm: u.restricoesAtualizadasEm || null,
          restricoesAtualizadasPor: u.restricoesAtualizadasPor || null,
        });
      } catch (err: any) {
                const usuarioContexto = usuarioAtualRef.current;
        if (usuarioContexto) {
          const snapContexto: SnapshotServidor = {
            nome: usuarioContexto.nome || "",
            email: usuarioContexto.email || "",
            restricoes: usuarioContexto.restricoes || [],
            niveisSensibilidade: usuarioContexto.niveisSensibilidade || {
              gluten: 1,
              lactose: 1,
              amendoim: 1,
            },
          };
          setSnapshotServidor(snapContexto);
          inicializar(
            snapContexto.restricoes,
            snapContexto.niveisSensibilidade
          );
        }
        setMensagemErro(extrairMensagemErro(err));
      } finally {
        setCarregandoInicial(false);
        setRefreshing(false);
      }
    },
    [atualizarUsuario, inicializar]
  );

  useFocusEffect(
    useCallback(() => {
      carregarDoServidor(false);
    }, [carregarDoServidor])
  );

    useEffect(() => {
    const backAction = () => {
      if (isDirty) {
        setModalDescartarVisivel(true);
        return true;
      }
      return false;
    };

    const backHandler = BackHandler.addEventListener(
      "hardwareBackPress",
      backAction
    );
    return () => backHandler.remove();
  }, [isDirty]);

  useEffect(() => {
    if (!sairAposDescarte || isDirty) return;
    setSairAposDescarte(false);
    router.back();
  }, [isDirty, router, sairAposDescarte]);

  const handleToqueVoltar = () => {
    if (isDirty) {
      setModalDescartarVisivel(true);
    } else {
      router.back();
    }
  };

  const alternarSwitch = (
    categoria: CategoriaRestricao,
    novoEstado: boolean
  ) => {
    setMensagemSucesso(null);
    setMensagemErro(null);
    alternar(categoria, novoEstado);
  };

  const salvarAlteracoes = async () => {
    if (salvando || !isDirty) return;
    setMensagemSucesso(null);
    setMensagemErro(null);

    const restricoesSelecionadas: string[] = [];
    if (rascunho.ativos.gluten) restricoesSelecionadas.push("gluten");
    if (rascunho.ativos.lactose) restricoesSelecionadas.push("lactose");
    if (rascunho.ativos.amendoim) restricoesSelecionadas.push("amendoim");

        if (restricoesSelecionadas.length === 0) {
      setMensagemErro("Mantenha ao menos uma intolerância ativa.");
      return;
    }

    const niveisPayload: NiveisSensibilidade = rascunho.niveis;

    setSalvando(true);
    try {
      const resRestricoes = await api.put("/users/restricoes", {
        restricoes: restricoesSelecionadas,
        niveisSensibilidade: niveisPayload,
      });

      const usuarioAtualizado =
        resRestricoes.data?.usuario || resRestricoes.data;

      const novoSnap: SnapshotServidor = {
        nome: usuarioAtualizado.nome || snapshotServidor?.nome || "",
        email: usuarioAtualizado.email || snapshotServidor?.email || "",
        restricoes: (usuarioAtualizado.restricoes || restricoesSelecionadas).map(
          (r: string) => r.toLowerCase()
        ),
        niveisSensibilidade:
          usuarioAtualizado.niveisSensibilidade || niveisPayload,
      };

      setSnapshotServidor(novoSnap);

            await atualizarUsuario({
        id: String(usuarioAtualizado.id || usuarioAtualizado._id || ""),
        nome: novoSnap.nome,
        email: novoSnap.email,
        avatar: usuarioAtualizado.avatar || null,
        restricoes: novoSnap.restricoes,
        niveisSensibilidade: novoSnap.niveisSensibilidade,
        restricoesAtualizadasEm:
          usuarioAtualizado.restricoesAtualizadasEm || new Date().toISOString(),
        restricoesAtualizadasPor: "PACIENTE",
      });

      marcarSalvo(novoSnap.restricoes, novoSnap.niveisSensibilidade);
      setMensagemSucesso("Alterações salvas com sucesso!");
    } catch (err: any) {
      setMensagemErro(extrairMensagemErro(err));
    } finally {
      setSalvando(false);
    }
  };

  const confirmarDescarte = () => {
    setModalDescartarVisivel(false);
    descartar();
    const repetirAcao = repetirAcaoPendente.current;
    repetirAcaoPendente.current = null;
    if (repetirAcao) {
      repetirAcao();
    } else {
      setSairAposDescarte(true);
    }
  };

  const confirmarRestaurarPadroes = () => {
    setModalRestaurarVisivel(false);
    setMensagemErro(null);
    setMensagemSucesso(null);
    if (snapshotServidor) {
      descartar();
      setMensagemSucesso("Valores restaurados conforme gravados no servidor.");
    }
  };

  if (!fontsLoaded || carregandoInicial) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator size="large" color="#006D37" />
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
        scrollEnabled={!sliderEmArrasto}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => carregarDoServidor(true)}
            colors={["#006D37"]}
            tintColor="#006D37"
          />
        }
      >
        <View style={styles.headerRow}>
          <TouchableOpacity
            onPress={handleToqueVoltar}
            style={styles.backBtn}
            accessibilityRole="button"
            accessibilityLabel="Voltar"
          >
            <Feather name="arrow-left" size={20} color="#087443" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.pageTitle}>Suas Intolerâncias Ativas</Text>
            <Text style={styles.pageSubtitle}>
              Ative ou desative restrições e ajuste o nível de sensibilidade
            </Text>
          </View>
        </View>

        {mensagemErro ? (
          <View style={styles.erroBanner}>
            <Ionicons name="alert-circle" size={18} color="#DC2626" />
            <Text style={styles.erroBannerText}>{mensagemErro}</Text>
          </View>
        ) : null}

        {mensagemSucesso ? (
          <View style={styles.sucessoBanner}>
            <Ionicons name="checkmark-circle" size={18} color="#15803D" />
            <Text style={styles.sucessoBannerText}>{mensagemSucesso}</Text>
          </View>
        ) : null}

        <IntoleranciaEditCard
          image="gluten"
          title="Glúten"
          description="Filtrar produtos que contenham trigo, centeio, cevada ou derivados para sua segurança celíaca."
          ativo={rascunho.ativos.gluten}
          onToggle={(v) => alternarSwitch("gluten", v)}
          nivel={rascunho.niveis.gluten}
          disabled={salvando}
          setNivel={(n) => {
            setMensagemSucesso(null);
            definirNivel("gluten", n);
          }}
          onGestureActiveChange={setSliderEmArrasto}
        />

        <IntoleranciaEditCard
          image="lactose"
          title="Lactose"
          description="Identificar leite, soro de leite e traços de laticínios em alimentos processados e bebidas."
          ativo={rascunho.ativos.lactose}
          onToggle={(v) => alternarSwitch("lactose", v)}
          nivel={rascunho.niveis.lactose}
          disabled={salvando}
          setNivel={(n) => {
            setMensagemSucesso(null);
            definirNivel("lactose", n);
          }}
          onGestureActiveChange={setSliderEmArrasto}
        />

        <IntoleranciaEditCard
          image="amendoim"
          title="Amendoim"
          description="Monitorar amendoim e seus derivados que podem causar reações de hipersensibilidade alimentar."
          ativo={rascunho.ativos.amendoim}
          onToggle={(v) => alternarSwitch("amendoim", v)}
          nivel={rascunho.niveis.amendoim}
          disabled={salvando}
          setNivel={(n) => {
            setMensagemSucesso(null);
            definirNivel("amendoim", n);
          }}
          onGestureActiveChange={setSliderEmArrasto}
        />

        <TouchableOpacity
          style={[
            styles.saveButton,
            (!isDirty || salvando) && styles.saveButtonDisabled,
          ]}
          activeOpacity={0.85}
          onPress={salvarAlteracoes}
          disabled={!isDirty || salvando}
          accessibilityRole="button"
          accessibilityLabel="Salvar alterações de intolerâncias"
          accessibilityState={{ disabled: !isDirty || salvando }}
        >
          {salvando ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <Text style={styles.saveButtonText}>
              {isDirty ? "Salvar Alterações" : "Nenhuma alteração pendente"}
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.restoreButton}
          activeOpacity={0.75}
          onPress={() => setModalRestaurarVisivel(true)}
          disabled={salvando}
        >
          <Text style={styles.restoreButtonText}>Restaurar Padrões</Text>
        </TouchableOpacity>
      </ScrollView>

      <TabBar abaAtiva="perfil" />

      {}
      <ConfirmModal
        visible={modalDescartarVisivel}
        title="Descartar alterações?"
        message="Você possui alterações não salvas. Deseja realmente descartá-las e voltar?"
        confirmText="Descartar"
        cancelText="Continuar editando"
        destructive
        onConfirm={confirmarDescarte}
        onCancel={() => {
          repetirAcaoPendente.current = null;          setModalDescartarVisivel(false);
        }}
      />

      {}
      <ConfirmModal
        visible={modalRestaurarVisivel}
        title="Restaurar padrões?"
        message="Deseja descartar as edições e voltar aos valores gravados no servidor?"
        confirmText="Restaurar"
        cancelText="Cancelar"
        onConfirm={confirmarRestaurarPadroes}
        onCancel={() => setModalRestaurarVisivel(false)}
      />
    </SafeAreaView>
  );
}

type IntoleranciaEditCardProps = {
  image: keyof typeof iconImages;
  title: string;
  description: string;
  ativo: boolean;
  onToggle: (v: boolean) => void;
  nivel: NivelSensibilidade;
  setNivel: (n: NivelSensibilidade) => void;
  onGestureActiveChange: (active: boolean) => void;
  disabled: boolean;
};

function IntoleranciaEditCard({
  image,
  title,
  description,
  ativo,
  onToggle,
  nivel,
  setNivel,
  onGestureActiveChange,
  disabled,
}: IntoleranciaEditCardProps) {
  return (
    <View style={styles.intoleranciaCard}>
      <View style={styles.cardTopRow}>
        <View style={styles.iconBox}>
          <Image source={iconImages[image]} style={styles.iconImage} />
        </View>

        <TouchableOpacity
          activeOpacity={0.8}
          disabled={disabled}
          onPress={() => onToggle(!ativo)}
          style={[styles.switch, ativo && styles.switchActive]}
          accessibilityRole="switch"
          accessibilityState={{ checked: ativo }}
          accessibilityLabel={`Ativar restrição de ${title}`}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <View
            style={[styles.switchCircle, ativo && styles.switchCircleActive]}
          />
        </TouchableOpacity>
      </View>

      <View style={styles.cardInfo}>
        <Text style={styles.cardTitle}>{title}</Text>
        <Text style={styles.cardDescription}>{description}</Text>
      </View>

      <View style={styles.cardDivider} />

      <SensitivitySlider
        nivel={nivel}
        onChangeNivel={setNivel}
        ativo={ativo}
        readOnly={disabled}
        onGestureActiveChange={onGestureActiveChange}
      />
    </View>
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
    fontSize: 19,
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
  intoleranciaCard: {
    width: "100%",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#006D37",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 14,
    marginBottom: 12,
  },
  cardTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 7,
  },
  iconBox: {
    width: 34,
    height: 34,
    borderRadius: 7,
    backgroundColor: "#FFF7E3",
    alignItems: "center",
    justifyContent: "center",
  },
  iconImage: { width: 21, height: 21, resizeMode: "contain" },
  cardInfo: { width: "100%" },
  cardTitle: {
    fontFamily: "Geist_700Bold",
    fontSize: 16,
    color: "#191C1D",
    marginBottom: 4,
  },
  cardDescription: {
    fontFamily: "Geist_400Regular",
    fontSize: 13,
    lineHeight: 18,
    color: "#4B5563",
  },
  switch: {
    width: 40,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#DDE1E4",
    padding: 2,
    justifyContent: "center",
  },
  switchActive: { backgroundColor: "#24C95B" },
  switchCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#FFFFFF",
    alignSelf: "flex-start",
  },
  switchCircleActive: { alignSelf: "flex-end" },
  cardDivider: {
    width: "100%",
    height: 1,
    backgroundColor: "#E5E7EB",
    marginTop: 10,
    marginBottom: 12,
  },
  saveButton: {
    backgroundColor: "#22C55E",
    height: 48,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    elevation: 2,
    marginTop: 4,
  },
  saveButtonDisabled: {
    backgroundColor: "#A3D9B5",
    elevation: 0,
    opacity: 0.75,
  },
  saveButtonText: {
    fontFamily: "Geist_700Bold",
    color: "#FFFFFF",
    fontSize: 15,
  },
  restoreButton: {
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    backgroundColor: "#FFFFFF",
  },
  restoreButtonText: {
    fontFamily: "Geist_600SemiBold",
    color: "#475569",
    fontSize: 14,
  },
});
