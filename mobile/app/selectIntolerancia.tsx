import React, { useState, useEffect } from "react";
import {
  Geist_400Regular,
  Geist_500Medium,
  Geist_600SemiBold,
  Geist_700Bold,
} from "@expo-google-fonts/geist";
import { useFonts } from "@expo-google-fonts/geist/useFonts";
import { router } from "expo-router";
import {
  Dimensions,
  Image,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ActivityIndicator,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Feather, Ionicons } from "@expo/vector-icons";

import api, { extrairMensagemErro } from "../services/api";
import { useAuth } from "../context/AuthContext";
import SensitivitySlider, {
  NivelSensibilidade,
} from "../components/SensitivitySlider";
import ConfirmModal from "../components/ConfirmModal";
import {
  CategoriaRestricao,
  useRestricoesDraft,
} from "../hooks/useRestricoesDraft";

const { width } = Dimensions.get("window");

const iconImages = {
  gluten: require("../assets/images/iconGluten.png"),
  lactose: require("../assets/images/iconLactose.png"),
  amendoim: require("../assets/images/iconAmendoim.png"),
} as const;

export default function IntoleranciasScreen() {
  const insets = useSafeAreaInsets();
  const {
    rascunhoCadastro,
    limparRascunhoCadastro,
    salvarSessaoUsuario,
  } = useAuth();

  const [fontsLoaded] = useFonts({
    Geist_400Regular,
    Geist_500Medium,
    Geist_600SemiBold,
    Geist_700Bold,
  });

  const [verificandoAcesso, setVerificandoAcesso] = useState(true);
  const [sliderEmArrasto, setSliderEmArrasto] = useState(false);
  const { rascunho, alternar, definirNivel } = useRestricoesDraft();

  const [loading, setLoading] = useState(false);
  const [erroInline, setErroInline] = useState<string | null>(null);
  const [modalCancelarVisivel, setModalCancelarVisivel] = useState(false);

  useEffect(() => {
    let ativo = true;
    const checarFluxo = async () => {
      const token = await AsyncStorage.getItem("@rotuscan_token");
      const userId = await AsyncStorage.getItem("@usuario_id");

      if (!ativo) return;

      if (token && userId && !rascunhoCadastro.email) {
        router.replace("/editar-perfil" as never);
        return;
      }

      if (!rascunhoCadastro.email || !rascunhoCadastro.senha) {
        router.replace("/cadastro" as never);
        return;
      }

      setVerificandoAcesso(false);
    };
    checarFluxo();
    return () => {
      ativo = false;
    };
  }, [rascunhoCadastro.email, rascunhoCadastro.senha]);

  const alternarSwitch = (
    categoria: CategoriaRestricao,
    novoEstado: boolean
  ) => {
    if (erroInline) setErroInline(null);
    alternar(categoria, novoEstado);
  };

  const handleToqueBotaoX = () => {
    const temDadosPreenchidos = Boolean(
      rascunhoCadastro.nome ||
        rascunhoCadastro.email ||
        rascunhoCadastro.senha ||
        rascunho.ativos.gluten ||
        rascunho.ativos.lactose ||
        rascunho.ativos.amendoim
    );

    if (temDadosPreenchidos) {
      setModalCancelarVisivel(true);
    } else {
      limparRascunhoCadastro();
      router.replace("/login" as never);
    }
  };

  const confirmarCancelamento = () => {
    setModalCancelarVisivel(false);
    limparRascunhoCadastro();
    router.replace("/login" as never);
  };

  const concluirCadastro = async () => {
    if (loading) return;
    setErroInline(null);

    const restricoesSelecionadas: string[] = [];
    if (rascunho.ativos.gluten) restricoesSelecionadas.push("gluten");
    if (rascunho.ativos.lactose) restricoesSelecionadas.push("lactose");
    if (rascunho.ativos.amendoim) restricoesSelecionadas.push("amendoim");

    if (restricoesSelecionadas.length === 0) {
      setErroInline("Mantenha ao menos uma intolerância ativa.");
      return;
    }

    setLoading(true);
    try {
      const response = await api.post("/auth/register", {
        nome: rascunhoCadastro.nome.trim(),
        email: rascunhoCadastro.email.trim().toLowerCase(),
        senha: rascunhoCadastro.senha,
        restricoes: restricoesSelecionadas,
        niveisSensibilidade: rascunho.niveis,
        ...(rascunhoCadastro.crnNutricionista
          ? { crnNutricionista: rascunhoCadastro.crnNutricionista }
          : {}),
      });

      const { token, usuario } = response.data;
      await salvarSessaoUsuario(token, usuario);
      limparRascunhoCadastro();

      router.replace("/home" as never);
    } catch (error: any) {
      setErroInline(extrairMensagemErro(error));
    } finally {
      setLoading(false);
    }
  };

  if (!fontsLoaded || verificandoAcesso) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator size="large" color="#006D37" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />

      <TouchableOpacity
        style={[
          styles.closeButtonFixed,
          { top: Math.max(insets.top + 8, 14) },
        ]}
        activeOpacity={0.75}
        onPress={handleToqueBotaoX}
        accessibilityRole="button"
        accessibilityLabel="Cancelar cadastro"
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Feather name="x" size={22} color="#374151" />
      </TouchableOpacity>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        scrollEnabled={!sliderEmArrasto}
      >
        <View style={styles.logoContainer}>
          <Text style={styles.logoRotu}>Rotu</Text>
          <Text style={styles.logoScan}>Scan</Text>
        </View>

        <View style={styles.titleBox}>
          <Text style={styles.title}>Selecione a sua intolerância</Text>
        </View>

        {erroInline ? (
          <View style={styles.erroBanner}>
            <Ionicons name="alert-circle" size={16} color="#DC2626" />
            <Text style={styles.erroBannerText}>{erroInline}</Text>
          </View>
        ) : null}

        <IntoleranciaCard
          image="gluten"
          iconBackground="#FFF7E3"
          title="Glúten"
          description="Filtrar produtos que contenham trigo, centeio, cevada ou derivados para sua segurança celíaca."
          ativo={rascunho.ativos.gluten}
          onToggle={(v) => alternarSwitch("gluten", v)}
          nivel={rascunho.niveis.gluten}
          disabled={loading}
          setNivel={(n) => {
            if (erroInline) setErroInline(null);
            definirNivel("gluten", n);
          }}
          onGestureActiveChange={setSliderEmArrasto}
        />

        <IntoleranciaCard
          image="lactose"
          iconBackground="#FFF7E3"
          title="Lactose"
          description="Identificar leite, soro de leite e traços de laticínios em alimentos processados e bebidas."
          ativo={rascunho.ativos.lactose}
          onToggle={(v) => alternarSwitch("lactose", v)}
          nivel={rascunho.niveis.lactose}
          disabled={loading}
          setNivel={(n) => {
            if (erroInline) setErroInline(null);
            definirNivel("lactose", n);
          }}
          onGestureActiveChange={setSliderEmArrasto}
        />

        <IntoleranciaCard
          image="amendoim"
          iconBackground="#FFF7E3"
          title="Amendoim"
          description="Monitorar amendoim e seus derivados que podem causar reações de hipersensibilidade alimentar."
          ativo={rascunho.ativos.amendoim}
          onToggle={(v) => alternarSwitch("amendoim", v)}
          nivel={rascunho.niveis.amendoim}
          disabled={loading}
          setNivel={(n) => {
            if (erroInline) setErroInline(null);
            definirNivel("amendoim", n);
          }}
          onGestureActiveChange={setSliderEmArrasto}
        />

        <TouchableOpacity
          style={[styles.finishButton, loading && { opacity: 0.7 }]}
          activeOpacity={0.85}
          onPress={concluirCadastro}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={styles.finishButtonText}>Concluir Cadastro</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => router.back()}
          disabled={loading}
          style={styles.voltarTouch}
        >
          <Text style={styles.btnVoltar}>Voltar</Text>
        </TouchableOpacity>
      </ScrollView>

      <ConfirmModal
        visible={modalCancelarVisivel}
        title="Cancelar cadastro?"
        message="Cancelar cadastro? Os dados preenchidos serão descartados."
        confirmText="Descartar"
        cancelText="Continuar"
        destructive
        onConfirm={confirmarCancelamento}
        onCancel={() => setModalCancelarVisivel(false)}
      />
    </SafeAreaView>
  );
}

type IntoleranciaCardProps = {
  image: keyof typeof iconImages;
  iconBackground: string;
  title: string;
  description: string;
  ativo: boolean;
  onToggle: (value: boolean) => void;
  nivel: NivelSensibilidade;
  setNivel: (value: NivelSensibilidade) => void;
  onGestureActiveChange: (active: boolean) => void;
  disabled: boolean;
};

function IntoleranciaCard({
  image,
  iconBackground,
  title,
  description,
  ativo,
  onToggle,
  nivel,
  setNivel,
  onGestureActiveChange,
  disabled,
}: IntoleranciaCardProps) {
  return (
    <View style={styles.card}>
      <View style={styles.cardTopRow}>
        <View style={[styles.iconBox, { backgroundColor: iconBackground }]}>
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

      <View style={styles.divider} />

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
  container: { flex: 1, backgroundColor: "#F8F9FA" },
  loadingScreen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F8F9FA",
  },
  closeButtonFixed: {
    position: "absolute",
    right: 18,
    zIndex: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },
  scrollContent: {
    alignItems: "center",
    paddingTop: 16,
    paddingBottom: 30,
  },
  logoContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  logoRotu: {
    fontFamily: "Geist_700Bold",
    fontSize: 34,
    color: "#006D37",
    letterSpacing: -1.2,
  },
  logoScan: {
    fontFamily: "Geist_700Bold",
    fontSize: 34,
    color: "#F59E0B",
    letterSpacing: -0.6,
  },
  titleBox: {
    width: Math.min(width - 64, 420),
    height: 44,
    borderWidth: 1,
    borderColor: "#006D37",
    borderRadius: 9,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 9,
    backgroundColor: "#FFFFFF",
  },
  title: {
    fontFamily: "Geist_600SemiBold",
    fontSize: 17.5,
    color: "#000000",
  },
  erroBanner: {
    width: Math.min(width - 64, 420),
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FECACA",
    borderRadius: 9,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
  },
  erroBannerText: {
    flex: 1,
    fontFamily: "Geist_500Medium",
    fontSize: 12,
    color: "#DC2626",
  },
  card: {
    width: Math.min(width - 64, 420),
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#006D37",
    borderRadius: 9,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 14,
    marginBottom: 10,
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
    alignItems: "center",
    justifyContent: "center",
  },
  iconImage: { width: 21, height: 21, resizeMode: "contain" },
  cardInfo: { width: "100%" },
  cardTitle: {
    fontFamily: "Geist_700Bold",
    fontSize: 17,
    color: "#191C1D",
    marginBottom: 5,
  },
  cardDescription: {
    fontFamily: "Geist_400Regular",
    fontSize: 13.5,
    lineHeight: 19,
    color: "#191c1d9a",
    width: "100%",
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
  divider: {
    width: "100%",
    height: 1,
    backgroundColor: "#E5E7EB",
    marginTop: 10,
    marginBottom: 12,
  },
  finishButton: {
    width: Math.min(width - 64, 420),
    height: 46,
    backgroundColor: "#22C55E",
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
    elevation: 2,
  },
  finishButtonText: {
    fontFamily: "Geist_600SemiBold",
    fontSize: 14,
    color: "#FFFFFF",
  },
  voltarTouch: {
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  btnVoltar: {
    fontFamily: "Geist_600SemiBold",
    fontSize: 12.5,
    color: "#22C55E",
  },
});
