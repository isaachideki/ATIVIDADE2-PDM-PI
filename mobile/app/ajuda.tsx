import React, { useState, useCallback } from "react";
import {
  ActivityIndicator,
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
import { useRouter, useFocusEffect } from "expo-router";
import {
  Geist_400Regular,
  Geist_500Medium,
  Geist_600SemiBold,
  Geist_700Bold,
} from "@expo-google-fonts/geist";
import { useFonts } from "@expo-google-fonts/geist/useFonts";

import AppHeader from "../components/Header/AppHeader";
import TabBar from "../components/TabBar/indexTab";
import api, { extrairMensagemErro } from "../services/api";
import { formatarGrupoData, formatarHorario } from "../utils/datas";

type FeedbackEnviado = {
  id: string;
  mensagem: string;
  createdAt?: string;
};

const PERGUNTAS_FREQUENTES = [
  {
    pergunta: "Como tirar uma boa foto do rótulo?",
    resposta:
      "Aproxime a câmera da lista de ingredientes em um local bem iluminado, evitando reflexos de luz sobre a embalagem plástica ou metálica.",
  },
  {
    pergunta: "O que significa a barra de Nível de Sensibilidade?",
    resposta:
      "No nível Leve, o RotuScan ignora avisos de 'Pode conter traços' para aquele alérgeno. Nos níveis Moderado e Grave, qualquer risco de contaminação cruzada gera alerta vermelho.",
  },
  {
    pergunta: "O que acontece quando o resultado dá Inconclusivo?",
    resposta:
      "Por segurança alimentar, se a foto estiver borrada ou com menos de 40 caracteres legíveis, o RotuScan nunca dirá que o produto é seguro. Ele exibirá um alerta âmbar pedindo uma nova foto.",
  },
  {
    pergunta: "Posso renomear um produto escaneado?",
    resposta:
      "Sim! Na tela de Resultado Detalhado, basta tocar sobre o nome automático do produto para digitar o nome comercial, a marca e o peso.",
  },
];

export default function AjudaScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();

  const [fontsLoaded] = useFonts({
    Geist_400Regular,
    Geist_500Medium,
    Geist_600SemiBold,
    Geist_700Bold,
  });

  const [mensagemFeedback, setMensagemFeedback] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [toastSucesso, setToastSucesso] = useState<string | null>(null);
  const [erroEnvio, setErroEnvio] = useState<string | null>(null);
  const [feedbacksEnviados, setFeedbacksEnviados] = useState<FeedbackEnviado[]>(
    []
  );
  const [carregandoLista, setCarregandoLista] = useState(false);

  const carregarFeedbacks = useCallback(async () => {
    setCarregandoLista(true);
    try {
      const res = await api.get("/feedback");
      const lista = Array.isArray(res.data?.itens) ? res.data.itens : [];
      setFeedbacksEnviados(lista);
    } catch {
          } finally {
      setCarregandoLista(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      carregarFeedbacks();
    }, [carregarFeedbacks])
  );

  const enviarFeedback = async () => {
    if (enviando) return;
    const texto = mensagemFeedback.trim();

    if (texto.length < 3) {
      setErroEnvio("Digite sua mensagem com pelo menos 3 caracteres.");
      return;
    }
    if (texto.length > 1000) {
      setErroEnvio("A mensagem deve ter no máximo 1000 caracteres.");
      return;
    }

    setEnviando(true);
    setErroEnvio(null);
    setToastSucesso(null);

    try {
      const res = await api.post("/feedback", {
        mensagem: texto,
      });

      const novoItem: FeedbackEnviado = res.data?.item || {
        id: String(res.data?.id || Date.now()),
        mensagem: texto,
        createdAt: new Date().toISOString(),
      };

      setFeedbacksEnviados((prev) => [novoItem, ...prev]);
      setMensagemFeedback("");
      setToastSucesso(
        res.data?.mensagem || "Feedback enviado com sucesso! Obrigado pela contribuição."
      );
      setTimeout(() => setToastSucesso(null), 4000);
    } catch (err: any) {
      setErroEnvio(extrairMensagemErro(err));
    } finally {
      setEnviando(false);
    }
  };

  if (!fontsLoaded) return null;

  const cardWidth = Math.min(width - 36, 440);

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <StatusBar barStyle="dark-content" />
      <AppHeader />

      {toastSucesso ? (
        <View style={styles.toastBanner}>
          <Ionicons name="checkmark-circle" size={18} color="#FFFFFF" />
          <Text style={styles.toastText}>{toastSucesso}</Text>
        </View>
      ) : null}

      <ScrollView
        style={styles.container}
        contentContainerStyle={[styles.scrollContent, { width: cardWidth }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
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
            <Text style={styles.pageTitle}>Ajuda e Feedback</Text>
            <Text style={styles.pageSubtitle}>
              Envie sugestões, relate problemas ou consulte o FAQ
            </Text>
          </View>
        </View>

        {}
        <View style={styles.boxCard}>
          <Text style={styles.boxLabel}>Enviar Feedback</Text>

          <TextInput
            value={mensagemFeedback}
            onChangeText={(t) => {
              setMensagemFeedback(t);
              if (erroEnvio) setErroEnvio(null);
            }}
            placeholder="Descreva sua mensagem, sugestão ou dúvida (3 a 1000 caracteres)..."
            placeholderTextColor="#94A3B8"
            multiline
            numberOfLines={4}
            maxLength={1000}
            style={styles.textArea}
          />

          <View style={styles.counterRow}>
            <Text
              style={[
                styles.counterText,
                mensagemFeedback.length > 950 && { color: "#D97706" },
              ]}
            >
              {mensagemFeedback.length}/1000 caracteres
            </Text>
          </View>

          {erroEnvio ? (
            <View style={styles.erroRow}>
              <Ionicons name="alert-circle" size={16} color="#DC2626" />
              <Text style={styles.erroText}>{erroEnvio}</Text>
            </View>
          ) : null}

          <TouchableOpacity
            style={[styles.sendBtn, enviando && { opacity: 0.7 }]}
            activeOpacity={0.85}
            onPress={enviarFeedback}
            disabled={enviando}
          >
            {enviando ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.sendBtnText}>Enviar Feedback</Text>
            )}
          </TouchableOpacity>
        </View>

        {}
        {carregandoLista && feedbacksEnviados.length === 0 ? (
          <View style={{ paddingVertical: 12, alignItems: "center" }}>
            <ActivityIndicator size="small" color="#087443" />
          </View>
        ) : null}

        {feedbacksEnviados.length > 0 ? (
          <View style={styles.sentQuestionsSection}>
            <Text style={styles.sectionHeader}>SEUS FEEDBACKS ENVIADOS</Text>
            {feedbacksEnviados.map((item) => {
              const dataFormatada = item.createdAt
                ? `${formatarGrupoData(item.createdAt)} às ${formatarHorario(item.createdAt)}`
                : "";

              return (
                <View key={item.id} style={styles.sentCard}>
                  {dataFormatada ? (
                    <View style={styles.sentTopRow}>
                      <Text style={styles.sentDateText}>{dataFormatada}</Text>
                    </View>
                  ) : null}
                  <Text style={styles.sentQuestionText}>{item.mensagem}</Text>
                </View>
              );
            })}
          </View>
        ) : null}

        <Text style={styles.sectionHeader}>PERGUNTAS FREQUENTES (FAQ)</Text>

        {PERGUNTAS_FREQUENTES.map((item, idx) => (
          <View key={idx} style={styles.faqCard}>
            <View style={styles.faqHeader}>
              <Ionicons
                name="help-circle-outline"
                size={18}
                color="#006D37"
              />
              <Text style={styles.faqQuestion}>{item.pergunta}</Text>
            </View>
            <Text style={styles.faqAnswer}>{item.resposta}</Text>
          </View>
        ))}
      </ScrollView>

      <TabBar abaAtiva="perfil" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#F5F7FA" },
  container: { flex: 1, backgroundColor: "#F5F7FA" },
  toastBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#006D37",
    marginHorizontal: 18,
    marginTop: 8,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 12,
    elevation: 4,
  },
  toastText: {
    flex: 1,
    fontFamily: "Geist_600SemiBold",
    fontSize: 12.5,
    color: "#FFFFFF",
  },
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
  boxCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E8EDF0",
    marginBottom: 20,
  },
  boxLabel: {
    fontFamily: "Geist_700Bold",
    fontSize: 14,
    color: "#1E293B",
    marginBottom: 14,
  },
  textArea: {
    minHeight: 96,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 12,
    backgroundColor: "#F8FAFC",
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontFamily: "Geist_400Regular",
    fontSize: 13,
    color: "#1E293B",
    textAlignVertical: "top",
  },
  counterRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 4,
  },
  counterText: {
    fontFamily: "Geist_500Medium",
    fontSize: 11,
    color: "#64748B",
  },
  erroRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 8,
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FECACA",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  erroText: {
    flex: 1,
    fontFamily: "Geist_500Medium",
    fontSize: 12,
    color: "#DC2626",
  },
  sendBtn: {
    backgroundColor: "#087443",
    height: 44,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
  },
  sendBtnText: {
    fontFamily: "Geist_600SemiBold",
    fontSize: 13.5,
    color: "#FFFFFF",
  },
  sentQuestionsSection: {
    marginBottom: 14,
  },
  sentCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginBottom: 10,
  },
  sentTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-start",
    marginBottom: 6,
  },
  sentDateText: {
    fontFamily: "Geist_500Medium",
    fontSize: 11.5,
    color: "#64748B",
  },
  sentQuestionText: {
    fontFamily: "Geist_500Medium",
    fontSize: 13,
    color: "#1E293B",
    lineHeight: 18,
  },
  sectionHeader: {
    fontFamily: "Geist_700Bold",
    fontSize: 12,
    letterSpacing: 0.4,
    color: "#607087",
    marginBottom: 10,
  },
  faqCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E8EDF0",
    marginBottom: 10,
  },
  faqHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 6,
  },
  faqQuestion: {
    flex: 1,
    fontFamily: "Geist_700Bold",
    fontSize: 13.5,
    color: "#1E293B",
  },
  faqAnswer: {
    fontFamily: "Geist_400Regular",
    fontSize: 12.5,
    lineHeight: 18,
    color: "#475569",
  },
});
