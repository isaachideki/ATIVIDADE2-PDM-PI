import React, { useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import {
  Geist_400Regular,
  Geist_500Medium,
  Geist_600SemiBold,
  Geist_700Bold,
} from "@expo-google-fonts/geist";
import { useFonts } from "@expo-google-fonts/geist/useFonts";
import { Feather, Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { extrairMensagemErro } from "../services/api";
import { useAuth } from "../context/AuthContext";
import ConfirmModal from "../components/ConfirmModal";
import {
  consultarNutricionistaPorCrn,
  nomeProfissional,
  solicitarVinculo,
} from "../services/vinculo";
import type { NutricionistaVinculado } from "../services/vinculo";

const { width } = Dimensions.get("window");

function crnValido(valor: string): boolean {
  const match = valor.match(
    /^\s*CRN\s*[-/]?\s*(\d{1,2})[\s/-]+(\d+(?:\.\d+)*)\s*$/i
  );
  if (!match) return false;
  const regiao = Number(match[1]);
  const numero = match[2].replace(/\./g, "");
  return regiao >= 1 && regiao <= 11 && numero.length >= 3 && numero.length <= 6;
}

export default function VincularNutricionistaScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ modo?: string }>();
  const {
    usuarioAtual,
    rascunhoCadastro,
    setRascunhoCadastro,
    limparRascunhoCadastro,
    salvarSessaoUsuario,
  } = useAuth();

  const modoCadastro =
    params.modo === "cadastro" || (!usuarioAtual?.id && Boolean(rascunhoCadastro.email));

  const [fontsLoaded] = useFonts({
    Geist_400Regular,
    Geist_500Medium,
    Geist_600SemiBold,
    Geist_700Bold,
  });

  const [crnInput, setCrnInput] = useState(
    rascunhoCadastro.crnNutricionista || ""
  );
  const [verificando, setVerificando] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [erroInline, setErroInline] = useState<string | null>(null);
  const [sucessoInline, setSucessoInline] = useState<string | null>(null);

  const [nutriEncontrado, setNutriEncontrado] =
    useState<NutricionistaVinculado | null>(
      rascunhoCadastro.nutricionistaPreview || null
    );
  const [modalCancelarVisivel, setModalCancelarVisivel] = useState(false);

  const handleAlterarCrn = (txt: string) => {
    if (erroInline) setErroInline(null);
    if (sucessoInline) setSucessoInline(null);
    if (nutriEncontrado) setNutriEncontrado(null);
    setCrnInput(txt.toUpperCase());
  };

  const verificarCrn = async () => {
    if (!crnValido(crnInput)) {
      setErroInline("CRN inválido. Ex.: CRN-3 12345");
      return;
    }
    if (verificando) return;

    setVerificando(true);
    setErroInline(null);
    setSucessoInline(null);

    try {
      setNutriEncontrado(await consultarNutricionistaPorCrn(crnInput.trim()));
    } catch (err: any) {
      setNutriEncontrado(null);
      setErroInline(extrairMensagemErro(err));
    } finally {
      setVerificando(false);
    }
  };

  const confirmarVinculo = async () => {
    if (!nutriEncontrado || confirmando) return;

    if (modoCadastro) {
      setRascunhoCadastro((prev) => ({
        ...prev,
        crnNutricionista: nutriEncontrado.crn || crnInput.trim(),
        nutricionistaPreview: nutriEncontrado,
      }));
      router.push("/selectIntolerancia" as never);
      return;
    }

    // Modo Perfil (usuário já autenticado)
    setConfirmando(true);
    setErroInline(null);
    try {
      const vinculo = await solicitarVinculo(crnInput.trim());

      await AsyncStorage.removeItem("@vinculo_convite_dispensado");

      if (usuarioAtual) {
        await salvarSessaoUsuario(null, {
          ...usuarioAtual,
          vinculo,
        });
      }

      setSucessoInline(
        "Solicitação enviada. Aguarde a aprovação do nutricionista."
      );
      setTimeout(() => {
        router.back();
      }, 900);
    } catch (err: any) {
      setErroInline(extrairMensagemErro(err));
    } finally {
      setConfirmando(false);
    }
  };

  const handleNaoEhEssaPessoa = () => {
    setNutriEncontrado(null);
    setCrnInput("");
    setErroInline(null);
    if (modoCadastro) {
      setRascunhoCadastro((prev) => ({
        ...prev,
        crnNutricionista: undefined,
        nutricionistaPreview: null,
      }));
    }
  };

  const handleNaoTenhoCrn = () => {
    if (modoCadastro) {
      setRascunhoCadastro((prev) => ({
        ...prev,
        crnNutricionista: undefined,
        nutricionistaPreview: null,
      }));
      router.push("/selectIntolerancia" as never);
    } else {
      router.back();
    }
  };

  const handleToqueBotaoX = () => {
    if (modoCadastro) {
      setModalCancelarVisivel(true);
    } else {
      router.back();
    }
  };

  const confirmarCancelamentoCadastro = () => {
    setModalCancelarVisivel(false);
    limparRascunhoCadastro();
    router.replace("/login" as never);
  };

  if (!fontsLoaded) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator size="large" color="#006D37" />
      </View>
    );
  }

  const cardWidth = Math.min(width - 40, 420);
  const nomeFormatadoNutri = nutriEncontrado
    ? nomeProfissional(nutriEncontrado)
    : "";

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />

      <TouchableOpacity
        style={[
          styles.closeButtonFixed,
          { top: Math.max(insets.top + 8, 14) },
        ]}
        activeOpacity={0.75}
        onPress={handleToqueBotaoX}
        accessibilityRole="button"
        accessibilityLabel={modoCadastro ? "Cancelar cadastro" : "Fechar"}
      >
        <Feather name="x" size={22} color="#374151" />
      </TouchableOpacity>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.logoContainer}>
          <Text style={styles.logoRotu}>Rotu</Text>
          <Text style={styles.logoScan}>Scan</Text>
        </View>

        <View style={[styles.mainCard, { width: cardWidth }]}>
          <View style={styles.iconCircle}>
            <Ionicons name="medical-outline" size={26} color="#006D37" />
          </View>

          <Text style={styles.title}>
            Você acompanha com um nutricionista?
          </Text>
          <Text style={styles.subtitle}>
            Informe o CRN do profissional para consultar os dados e confirmar
            sua solicitação de vínculo.
          </Text>

          {erroInline ? (
            <View style={styles.erroBanner}>
              <Ionicons name="alert-circle" size={16} color="#DC2626" />
              <Text style={styles.erroBannerText}>{erroInline}</Text>
            </View>
          ) : null}

          {sucessoInline ? (
            <View style={styles.sucessoBanner}>
              <Ionicons name="checkmark-circle" size={16} color="#15803D" />
              <Text style={styles.sucessoBannerText}>{sucessoInline}</Text>
            </View>
          ) : null}

          <Text style={styles.inputLabel}>CRN do nutricionista</Text>
          <View style={styles.inputRow}>
            <TextInput
              value={crnInput}
              onChangeText={handleAlterarCrn}
              placeholder="Ex.: CRN-3 12345"
              placeholderTextColor="#94A3B8"
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={28}
              style={styles.codeInput}
            />
            <TouchableOpacity
              style={[
                styles.verifyButton,
                (verificando || crnInput.trim().length === 0) &&
                  styles.verifyButtonDisabled,
              ]}
              activeOpacity={0.85}
              onPress={verificarCrn}
              disabled={verificando}
            >
              {verificando ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.verifyButtonText}>Buscar</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* CARD DE CONFIRMAÇÃO DO NUTRICIONISTA */}
          {nutriEncontrado ? (
            <View style={styles.confirmCard}>
              <View style={styles.confirmHeader}>
                <View style={styles.confirmAvatar}>
                  <Ionicons name="person" size={20} color="#006D37" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.confirmName}>{nomeFormatadoNutri}</Text>
                  <Text style={styles.confirmCrn}>{nutriEncontrado.crn}</Text>
                </View>
                <View style={styles.verifiedBadge}>
                  <Ionicons name="checkmark-circle" size={14} color="#15803D" />
                  <Text style={styles.verifiedBadgeText}>Verificado</Text>
                </View>
              </View>

              <Text style={styles.consentText}>
                Ao solicitar, você autoriza que este profissional veja suas
                restrições e o histórico dos seus escaneamentos SE ele aprovar
                o vínculo. Até a aprovação, nada é compartilhado. Você pode
                desvincular quando quiser.
              </Text>

              <TouchableOpacity
                style={[
                  styles.confirmPrimaryBtn,
                  confirmando && { opacity: 0.7 },
                ]}
                activeOpacity={0.85}
                onPress={confirmarVinculo}
                disabled={confirmando}
              >
                {confirmando ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.confirmPrimaryText}>
                    {modoCadastro ? "Continuar" : "Solicitar vínculo"}
                  </Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.notThisPersonBtn}
                activeOpacity={0.75}
                onPress={handleNaoEhEssaPessoa}
                disabled={confirmando}
              >
                <Text style={styles.notThisPersonText}>Não é essa pessoa</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          <TouchableOpacity
            style={styles.skipButton}
            activeOpacity={0.8}
            onPress={handleNaoTenhoCrn}
          >
            <Text style={styles.skipButtonText}>Não tenho CRN</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.backLink}
            activeOpacity={0.75}
            onPress={() => router.back()}
          >
            <Feather name="arrow-left" size={15} color="#006D37" />
            <Text style={styles.backLinkText}>Voltar</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <ConfirmModal
        visible={modalCancelarVisivel}
        title="Cancelar cadastro?"
        message="Deseja cancelar o cadastro? Os dados preenchidos serão descartados."
        confirmText="Descartar"
        cancelText="Continuar"
        destructive
        onConfirm={confirmarCancelamentoCadastro}
        onCancel={() => setModalCancelarVisivel(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F2F6F4",
  },
  loadingScreen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F2F6F4",
  },
  closeButtonFixed: {
    position: "absolute",
    right: 18,
    zIndex: 20,
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    alignItems: "center",
    justifyContent: "center",
    elevation: 2,
  },
  scrollContent: {
    alignItems: "center",
    paddingTop: 22,
    paddingBottom: 36,
  },
  logoContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  logoRotu: {
    fontFamily: "Geist_700Bold",
    fontSize: 34,
    color: "#006D37",
    letterSpacing: -1.1,
  },
  logoScan: {
    fontFamily: "Geist_700Bold",
    fontSize: 34,
    color: "#F59E0B",
    letterSpacing: -0.6,
  },
  mainCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    paddingHorizontal: 20,
    paddingVertical: 24,
    alignItems: "center",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },
  iconCircle: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: "#ECFDF5",
    borderWidth: 1,
    borderColor: "#A7F3D0",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  title: {
    fontFamily: "Geist_700Bold",
    fontSize: 19,
    color: "#0F172A",
    textAlign: "center",
    marginBottom: 8,
  },
  subtitle: {
    fontFamily: "Geist_400Regular",
    fontSize: 13,
    lineHeight: 19,
    color: "#475569",
    textAlign: "center",
    marginBottom: 18,
  },
  erroBanner: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FECACA",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 14,
  },
  erroBannerText: {
    flex: 1,
    fontFamily: "Geist_500Medium",
    fontSize: 12,
    color: "#DC2626",
  },
  sucessoBanner: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#DCFCE7",
    borderWidth: 1,
    borderColor: "#BBF7D0",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 14,
  },
  sucessoBannerText: {
    flex: 1,
    fontFamily: "Geist_600SemiBold",
    fontSize: 12,
    color: "#15803D",
  },
  inputLabel: {
    alignSelf: "flex-start",
    fontFamily: "Geist_600SemiBold",
    fontSize: 12.5,
    color: "#334155",
    marginBottom: 6,
  },
  inputRow: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 16,
  },
  codeInput: {
    flex: 1,
    height: 48,
    borderWidth: 1.5,
    borderColor: "#CBD5E1",
    borderRadius: 12,
    backgroundColor: "#F8FAFC",
    paddingHorizontal: 14,
    fontFamily: "Geist_700Bold",
    fontSize: 16,
    letterSpacing: 1.5,
    color: "#0F172A",
    textAlign: "center",
  },
  verifyButton: {
    height: 48,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: "#006D37",
    alignItems: "center",
    justifyContent: "center",
  },
  verifyButtonDisabled: {
    backgroundColor: "#64748B",
    opacity: 0.75,
  },
  verifyButtonText: {
    fontFamily: "Geist_600SemiBold",
    fontSize: 13,
    color: "#FFFFFF",
  },
  confirmCard: {
    width: "100%",
    backgroundColor: "#ECFDF5",
    borderWidth: 1.5,
    borderColor: "#6EE7B7",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  confirmHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 12,
  },
  confirmAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#D1FAE5",
    alignItems: "center",
    justifyContent: "center",
  },
  confirmName: {
    fontFamily: "Geist_700Bold",
    fontSize: 15.5,
    color: "#064E3B",
  },
  confirmCrn: {
    fontFamily: "Geist_600SemiBold",
    fontSize: 12.5,
    color: "#047857",
    marginTop: 2,
  },
  verifiedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  verifiedBadgeText: {
    fontFamily: "Geist_700Bold",
    fontSize: 10.5,
    color: "#15803D",
  },
  consentText: {
    fontFamily: "Geist_400Regular",
    fontSize: 12.5,
    lineHeight: 18,
    color: "#1E293B",
    backgroundColor: "#FFFFFF",
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#A7F3D0",
    marginBottom: 14,
  },
  confirmPrimaryBtn: {
    width: "100%",
    height: 46,
    borderRadius: 12,
    backgroundColor: "#22C55E",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  confirmPrimaryText: {
    fontFamily: "Geist_700Bold",
    fontSize: 14,
    color: "#FFFFFF",
  },
  notThisPersonBtn: {
    width: "100%",
    height: 38,
    alignItems: "center",
    justifyContent: "center",
  },
  notThisPersonText: {
    fontFamily: "Geist_600SemiBold",
    fontSize: 12.5,
    color: "#B91C1C",
  },
  skipButton: {
    width: "100%",
    height: 46,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    backgroundColor: "#F8FAFC",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  skipButtonText: {
    fontFamily: "Geist_600SemiBold",
    fontSize: 13.5,
    color: "#475569",
  },
  backLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 16,
    paddingVertical: 6,
  },
  backLinkText: {
    fontFamily: "Geist_600SemiBold",
    fontSize: 13,
    color: "#006D37",
  },
});
