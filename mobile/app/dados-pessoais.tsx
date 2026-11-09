import React, { useState, useCallback } from "react";
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
import { useAuth } from "../context/AuthContext";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export default function DadosPessoaisScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { salvarSessaoUsuario } = useAuth();

  const [fontsLoaded] = useFonts({
    Geist_400Regular,
    Geist_500Medium,
    Geist_600SemiBold,
    Geist_700Bold,
  });

  const [carregando, setCarregando] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [salvando, setSalvando] = useState(false);

  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senhaAtual, setSenhaAtual] = useState("");
  const [novaSenha, setNovaSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");
  const [senhaVisivel, setSenhaVisivel] = useState(false);

    const [erroNome, setErroNome] = useState<string | null>(null);
  const [erroEmail, setErroEmail] = useState<string | null>(null);
  const [erroSenhaAtual, setErroSenhaAtual] = useState<string | null>(null);
  const [erroNovaSenha, setErroNovaSenha] = useState<string | null>(null);
  const [erroConfirmarSenha, setErroConfirmarSenha] = useState<string | null>(
    null
  );

  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const [sucessoGeral, setSucessoGeral] = useState<string | null>(null);

  const carregarDados = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setRefreshing(true);
      setErroGeral(null);

      try {
        const [nomeCache, emailCache] = await Promise.all([
          AsyncStorage.getItem("@usuario_nome"),
          AsyncStorage.getItem("@usuario_email"),
        ]);
        if (nomeCache) setNome(nomeCache);
        if (emailCache) setEmail(emailCache);

        const res = await api.get("/users/perfil");
        const u = res.data?.usuario || res.data;
        if (u?.nome) setNome(u.nome);
        if (u?.email) setEmail(u.email);

        if (u?.id || u?._id) {
          await salvarSessaoUsuario(null, {
            id: String(u.id || u._id),
            nome: u.nome || "",
            email: u.email || "",
            avatar: u.avatar || null,
            restricoes: u.restricoes || [],
            niveisSensibilidade: u.niveisSensibilidade || {
              gluten: 1,
              lactose: 1,
              amendoim: 1,
            },
          });
        }
      } catch (err: any) {
        setErroGeral(extrairMensagemErro(err));
      } finally {
        setCarregando(false);
        setRefreshing(false);
      }
    },
    [salvarSessaoUsuario]
  );

  useFocusEffect(
    useCallback(() => {
      carregarDados(false);
    }, [carregarDados])
  );

  const validarESalvar = async () => {
    if (salvando) return;
    setErroNome(null);
    setErroEmail(null);
    setErroSenhaAtual(null);
    setErroNovaSenha(null);
    setErroConfirmarSenha(null);
    setErroGeral(null);
    setSucessoGeral(null);

    let valido = true;

    if (!nome.trim()) {
      setErroNome("Preencha seu nome completo.");
      valido = false;
    }

    if (!email.trim()) {
      setErroEmail("Preencha seu endereço de e-mail.");
      valido = false;
    } else if (!EMAIL_REGEX.test(email.trim())) {
      setErroEmail("E-mail inválido. Use o formato seunome@email.com.");
      valido = false;
    }

    if (novaSenha.trim() || confirmarSenha.trim() || senhaAtual.trim()) {
      if (!senhaAtual.trim()) {
        setErroSenhaAtual("Informe sua senha atual para alterar a senha.");
        valido = false;
      }
      if (novaSenha.trim().length < 6) {
        setErroNovaSenha("A nova senha deve ter pelo menos 6 caracteres.");
        valido = false;
      }
      if (novaSenha !== confirmarSenha) {
        setErroConfirmarSenha("A confirmação de senha não coincide.");
        valido = false;
      }
    }

    if (!valido) return;

    setSalvando(true);
    try {
      const payload: any = {
        nome: nome.trim(),
        email: email.trim().toLowerCase(),
      };

      if (novaSenha.trim()) {
        payload.senhaAtual = senhaAtual;
        payload.novaSenha = novaSenha.trim();
      }

      const res = await api.put("/users/perfil", payload);
      const u = res.data?.usuario || res.data;

      await salvarSessaoUsuario(null, {
        id: String(u.id || u._id || ""),
        nome: u.nome || nome.trim(),
        email: u.email || email.trim().toLowerCase(),
        avatar: u.avatar || null,
        restricoes: u.restricoes || [],
        niveisSensibilidade: u.niveisSensibilidade || {
          gluten: 1,
          lactose: 1,
          amendoim: 1,
        },
      });

      setSenhaAtual("");
      setNovaSenha("");
      setConfirmarSenha("");
      setSucessoGeral("Dados pessoais atualizados com sucesso!");
    } catch (err: any) {
      setErroGeral(extrairMensagemErro(err));
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
            onRefresh={() => carregarDados(true)}
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
            <Text style={styles.pageTitle}>Dados Pessoais</Text>
            <Text style={styles.pageSubtitle}>
              Atualize seu nome, e-mail e senha de acesso
            </Text>
          </View>
        </View>

        {erroGeral ? (
          <View style={styles.erroBanner}>
            <Ionicons name="alert-circle" size={18} color="#DC2626" />
            <Text style={styles.erroBannerText}>{erroGeral}</Text>
          </View>
        ) : null}

        {sucessoGeral ? (
          <View style={styles.sucessoBanner}>
            <Ionicons name="checkmark-circle" size={18} color="#15803D" />
            <Text style={styles.sucessoBannerText}>{sucessoGeral}</Text>
          </View>
        ) : null}

        <View style={styles.card}>
          {}
          <Text style={styles.label}>Nome Completo</Text>
          <View
            style={[
              styles.inputContainer,
              erroNome ? styles.inputContainerError : null,
            ]}
          >
            <Ionicons
              name="person-outline"
              size={18}
              color={erroNome ? "#EF4444" : "#64748B"}
              style={styles.inputIcon}
            />
            <TextInput
              style={styles.input}
              value={nome}
              onChangeText={(txt) => {
                setNome(txt);
                if (erroNome) setErroNome(null);
                if (sucessoGeral) setSucessoGeral(null);
              }}
              placeholder="Digite seu nome completo"
              placeholderTextColor="#94A3B8"
            />
          </View>
          {erroNome ? <Text style={styles.fieldError}>{erroNome}</Text> : null}

          {}
          <Text style={styles.label}>E-mail</Text>
          <View
            style={[
              styles.inputContainer,
              erroEmail ? styles.inputContainerError : null,
            ]}
          >
            <Ionicons
              name="mail-outline"
              size={18}
              color={erroEmail ? "#EF4444" : "#64748B"}
              style={styles.inputIcon}
            />
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={(txt) => {
                setEmail(txt);
                if (erroEmail) setErroEmail(null);
                if (sucessoGeral) setSucessoGeral(null);
              }}
              keyboardType="email-address"
              placeholder="seunome@email.com"
              placeholderTextColor="#94A3B8"
              autoCapitalize="none"
            />
          </View>
          {erroEmail ? (
            <Text style={styles.fieldError}>{erroEmail}</Text>
          ) : null}

          <View style={styles.divider} />

          <Text style={styles.sectionSubHeader}>ALTERAR SENHA (OPCIONAL)</Text>

          {}
          <Text style={styles.label}>Senha Atual</Text>
          <View
            style={[
              styles.inputContainer,
              erroSenhaAtual ? styles.inputContainerError : null,
            ]}
          >
            <Ionicons
              name="key-outline"
              size={18}
              color={erroSenhaAtual ? "#EF4444" : "#64748B"}
              style={styles.inputIcon}
            />
            <TextInput
              style={styles.input}
              value={senhaAtual}
              onChangeText={(txt) => {
                setSenhaAtual(txt);
                if (erroSenhaAtual) setErroSenhaAtual(null);
              }}
              secureTextEntry={!senhaVisivel}
              placeholder="Digite sua senha atual"
              placeholderTextColor="#94A3B8"
              autoCapitalize="none"
            />
          </View>
          {erroSenhaAtual ? (
            <Text style={styles.fieldError}>{erroSenhaAtual}</Text>
          ) : null}

          {}
          <Text style={styles.label}>Nova Senha</Text>
          <View
            style={[
              styles.inputContainer,
              erroNovaSenha ? styles.inputContainerError : null,
            ]}
          >
            <Ionicons
              name="lock-closed-outline"
              size={18}
              color={erroNovaSenha ? "#EF4444" : "#64748B"}
              style={styles.inputIcon}
            />
            <TextInput
              style={styles.input}
              value={novaSenha}
              onChangeText={(txt) => {
                setNovaSenha(txt);
                if (erroNovaSenha) setErroNovaSenha(null);
              }}
              secureTextEntry={!senhaVisivel}
              placeholder="Mínimo de 6 caracteres"
              placeholderTextColor="#94A3B8"
              autoCapitalize="none"
            />
            <TouchableOpacity
              onPress={() => setSenhaVisivel(!senhaVisivel)}
              style={{ padding: 5 }}
            >
              <Ionicons
                name={senhaVisivel ? "eye-off-outline" : "eye-outline"}
                size={20}
                color="#94A3B8"
              />
            </TouchableOpacity>
          </View>
          {erroNovaSenha ? (
            <Text style={styles.fieldError}>{erroNovaSenha}</Text>
          ) : null}

          {}
          <Text style={styles.label}>Confirmar Nova Senha</Text>
          <View
            style={[
              styles.inputContainer,
              erroConfirmarSenha ? styles.inputContainerError : null,
            ]}
          >
            <Ionicons
              name="lock-closed-outline"
              size={18}
              color={erroConfirmarSenha ? "#EF4444" : "#64748B"}
              style={styles.inputIcon}
            />
            <TextInput
              style={styles.input}
              value={confirmarSenha}
              onChangeText={(txt) => {
                setConfirmarSenha(txt);
                if (erroConfirmarSenha) setErroConfirmarSenha(null);
              }}
              secureTextEntry={!senhaVisivel}
              placeholder="Repita a nova senha"
              placeholderTextColor="#94A3B8"
              autoCapitalize="none"
            />
          </View>
          {erroConfirmarSenha ? (
            <Text style={styles.fieldError}>{erroConfirmarSenha}</Text>
          ) : null}

          <Text style={styles.hintText}>
            Deixe os campos de senha em branco caso não queira alterá-la.
          </Text>

          <TouchableOpacity
            style={[styles.saveButton, salvando && { opacity: 0.7 }]}
            activeOpacity={0.85}
            onPress={validarESalvar}
            disabled={salvando}
          >
            {salvando ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.saveButtonText}>Salvar Dados Pessoais</Text>
            )}
          </TouchableOpacity>
        </View>
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
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 20,
    borderWidth: 1,
    borderColor: "#E8EDF0",
  },
  sectionSubHeader: {
    fontFamily: "Geist_700Bold",
    fontSize: 11,
    letterSpacing: 0.4,
    color: "#607087",
    marginBottom: 6,
  },
  label: {
    fontFamily: "Geist_600SemiBold",
    fontSize: 13,
    color: "#334155",
    marginBottom: 6,
    marginTop: 10,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    paddingHorizontal: 14,
  },
  inputContainerError: {
    borderColor: "#EF4444",
    backgroundColor: "#FEF2F2",
  },
  inputIcon: { marginRight: 10 },
  input: {
    flex: 1,
    paddingVertical: 13,
    fontFamily: "Geist_400Regular",
    fontSize: 14,
    color: "#1E293B",
  },
  fieldError: {
    fontFamily: "Geist_500Medium",
    fontSize: 11.5,
    color: "#EF4444",
    marginTop: 4,
    marginLeft: 4,
  },
  divider: { height: 1, backgroundColor: "#E2E8F0", marginVertical: 16 },
  hintText: {
    fontFamily: "Geist_400Regular",
    fontSize: 11.5,
    color: "#64748B",
    marginTop: 8,
    marginBottom: 16,
  },
  saveButton: {
    backgroundColor: "#087443",
    height: 48,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    elevation: 2,
  },
  saveButtonText: {
    fontFamily: "Geist_700Bold",
    color: "#FFFFFF",
    fontSize: 15,
  },
});

