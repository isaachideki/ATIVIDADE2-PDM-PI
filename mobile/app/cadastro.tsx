import React, { useState, useRef } from "react";
import {
  Dimensions,
  ImageBackground,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Animated,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  Geist_400Regular,
  Geist_500Medium,
  Geist_600SemiBold,
  Geist_700Bold,
} from "@expo-google-fonts/geist";
import { useFonts } from "@expo-google-fonts/geist/useFonts";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useAuth } from "../context/AuthContext";

const { width } = Dimensions.get("window");
const backgroundImage = require("../assets/images/Fundo.png");

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export default function CadastroScreen() {
  const router = useRouter();
  const { rascunhoCadastro, setRascunhoCadastro } = useAuth();

  const [fontsLoaded] = useFonts({
    Geist_400Regular,
    Geist_500Medium,
    Geist_600SemiBold,
    Geist_700Bold,
  });

  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [mostrarRepetirSenha, setMostrarRepetirSenha] = useState(false);

  const [erroNome, setErroNome] = useState<string | null>(null);
  const [erroEmail, setErroEmail] = useState<string | null>(null);
  const [erroSenha, setErroSenha] = useState<string | null>(null);
  const [erroRepetirSenha, setErroRepetirSenha] = useState<string | null>(null);

  const shakeAnim = useRef(new Animated.Value(0)).current;

  const dispararShake = () => {
    Animated.sequence([
      Animated.timing(shakeAnim, {
        toValue: 9,
        duration: 55,
        useNativeDriver: true,
      }),
      Animated.timing(shakeAnim, {
        toValue: -9,
        duration: 55,
        useNativeDriver: true,
      }),
      Animated.timing(shakeAnim, {
        toValue: 6,
        duration: 55,
        useNativeDriver: true,
      }),
      Animated.timing(shakeAnim, {
        toValue: 0,
        duration: 55,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const atualizarCampo = (
    campo: keyof typeof rascunhoCadastro,
    valor: string
  ) => {
    if (campo === "nome" && erroNome) setErroNome(null);
    if (campo === "email" && erroEmail) setErroEmail(null);
    if (campo === "senha" && erroSenha) setErroSenha(null);
    if (campo === "repetirSenha" && erroRepetirSenha) setErroRepetirSenha(null);
    setRascunhoCadastro((prev) => ({ ...prev, [campo]: valor }));
  };

  const handleProximo = () => {
    setErroNome(null);
    setErroEmail(null);
    setErroSenha(null);
    setErroRepetirSenha(null);

    const nomeLimpo = rascunhoCadastro.nome.trim();
    const emailLimpo = rascunhoCadastro.email.trim().toLowerCase();
    const { senha, repetirSenha } = rascunhoCadastro;

    let invalido = false;

    if (!nomeLimpo) {
      setErroNome("Preencha seu nome completo");
      invalido = true;
    }

    if (!emailLimpo) {
      setErroEmail("Preencha seu e-mail");
      invalido = true;
    } else if (!EMAIL_REGEX.test(emailLimpo)) {
      setErroEmail("E-mail inválido");
      invalido = true;
    }

    if (!senha) {
      setErroSenha("Preencha sua senha");
      invalido = true;
    } else if (senha.length < 6) {
      setErroSenha("A senha deve ter pelo menos 6 caracteres");
      invalido = true;
    }

    if (!repetirSenha) {
      setErroRepetirSenha("Repita sua senha");
      invalido = true;
    } else if (senha && senha !== repetirSenha) {
      setErroRepetirSenha("As senhas não coincidem");
      invalido = true;
    }

    if (invalido) {
      dispararShake();
      return;
    }

        setRascunhoCadastro((prev) => ({
      ...prev,
      nome: nomeLimpo,
      email: emailLimpo,
      senha,
      repetirSenha,
    }));

    router.push("/vincular-nutricionista?modo=cadastro" as never);
  };

  if (!fontsLoaded) {
    return null;
  }

  return (
    <ImageBackground
      source={backgroundImage}
      resizeMode="cover"
      style={styles.background}
    >
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" />

        <View style={styles.logoContainer}>
          <Text style={styles.logoRotu}>Rotu</Text>
          <Text style={styles.logoScan}>Scan</Text>
        </View>

        <Animated.View
          style={[
            styles.loginCard,
            { transform: [{ translateX: shakeAnim }] },
          ]}
        >
          {}
          <Text style={styles.label}>Usuário (Nome completo)</Text>
          <View
            style={[
              styles.inputContainer,
              erroNome ? styles.inputContainerError : null,
            ]}
          >
            <Ionicons
              name="person-outline"
              size={16}
              color={erroNome ? "#EF4444" : "#737D8D"}
              style={styles.inputIcon}
            />
            <TextInput
              value={rascunhoCadastro.nome}
              onChangeText={(txt) => atualizarCampo("nome", txt)}
              placeholder="Digite seu nome"
              placeholderTextColor="#9EA5B1"
              autoCapitalize="words"
              autoCorrect={false}
              style={styles.input}
            />
          </View>
          {erroNome ? (
            <View style={styles.fieldErrorRow}>
              <Ionicons name="alert-circle" size={13} color="#EF4444" />
              <Text style={styles.fieldErrorText}>{erroNome}</Text>
            </View>
          ) : null}

          {}
          <Text style={[styles.label, styles.fieldLabelSpacing]}>E-mail</Text>
          <View
            style={[
              styles.inputContainer,
              erroEmail ? styles.inputContainerError : null,
            ]}
          >
            <Ionicons
              name="mail-outline"
              size={16}
              color={erroEmail ? "#EF4444" : "#737D8D"}
              style={styles.inputIcon}
            />
            <TextInput
              value={rascunhoCadastro.email}
              onChangeText={(txt) => atualizarCampo("email", txt)}
              placeholder="seunome@email.com"
              placeholderTextColor="#9EA5B1"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              style={styles.input}
            />
          </View>
          {erroEmail ? (
            <View style={styles.fieldErrorRow}>
              <Ionicons name="alert-circle" size={13} color="#EF4444" />
              <Text style={styles.fieldErrorText}>{erroEmail}</Text>
            </View>
          ) : null}

          {}
          <Text style={[styles.label, styles.fieldLabelSpacing]}>Senha</Text>
          <View
            style={[
              styles.inputContainer,
              erroSenha ? styles.inputContainerError : null,
            ]}
          >
            <Ionicons
              name="lock-closed-outline"
              size={16}
              color={erroSenha ? "#EF4444" : "#737D8D"}
              style={styles.inputIcon}
            />
            <TextInput
              value={rascunhoCadastro.senha}
              onChangeText={(txt) => atualizarCampo("senha", txt)}
              placeholder="Crie uma senha (mín. 6 caracteres)"
              placeholderTextColor="#9EA5B1"
              secureTextEntry={!mostrarSenha}
              autoCapitalize="none"
              autoCorrect={false}
              style={styles.input}
            />
            <TouchableOpacity
              onPress={() => setMostrarSenha(!mostrarSenha)}
              style={styles.eyeButton}
              activeOpacity={0.7}
            >
              <Ionicons
                name={mostrarSenha ? "eye-off-outline" : "eye-outline"}
                size={18}
                color="#9AA3B2"
              />
            </TouchableOpacity>
          </View>
          {erroSenha ? (
            <View style={styles.fieldErrorRow}>
              <Ionicons name="alert-circle" size={13} color="#EF4444" />
              <Text style={styles.fieldErrorText}>{erroSenha}</Text>
            </View>
          ) : null}

          {}
          <Text style={[styles.label, styles.fieldLabelSpacing]}>
            Repita a senha
          </Text>
          <View
            style={[
              styles.inputContainer,
              erroRepetirSenha ? styles.inputContainerError : null,
            ]}
          >
            <Ionicons
              name="lock-closed-outline"
              size={16}
              color={erroRepetirSenha ? "#EF4444" : "#737D8D"}
              style={styles.inputIcon}
            />
            <TextInput
              value={rascunhoCadastro.repetirSenha}
              onChangeText={(txt) => atualizarCampo("repetirSenha", txt)}
              placeholder="Repita a senha"
              placeholderTextColor="#9EA5B1"
              secureTextEntry={!mostrarRepetirSenha}
              autoCapitalize="none"
              autoCorrect={false}
              style={styles.input}
            />
            <TouchableOpacity
              onPress={() => setMostrarRepetirSenha(!mostrarRepetirSenha)}
              style={styles.eyeButton}
              activeOpacity={0.7}
            >
              <Ionicons
                name={mostrarRepetirSenha ? "eye-off-outline" : "eye-outline"}
                size={18}
                color="#9AA3B2"
              />
            </TouchableOpacity>
          </View>
          {erroRepetirSenha ? (
            <View style={styles.fieldErrorRow}>
              <Ionicons name="alert-circle" size={13} color="#EF4444" />
              <Text style={styles.fieldErrorText}>{erroRepetirSenha}</Text>
            </View>
          ) : null}

          <TouchableOpacity
            style={styles.loginButton}
            activeOpacity={0.85}
            onPress={handleProximo}
          >
            <Text style={styles.loginButtonText}>Próximo</Text>
            <Ionicons
              name="arrow-forward"
              size={16}
              color="#FFFFFF"
              style={styles.arrow}
            />
          </TouchableOpacity>

          <View style={styles.registerContainer}>
            <Text style={styles.registerText}>Já tem conta? </Text>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => router.replace("/login" as never)}
            >
              <Text style={styles.registerLink}>Login</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </SafeAreaView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  background: {
    flex: 1,
    width: "100%",
    height: "100%",
  },
  container: {
    flex: 1,
    backgroundColor: "transparent",
    alignItems: "center",
  },
  logoContainer: {
    marginTop: 72,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  logoRotu: {
    fontFamily: "Geist_700Bold",
    fontSize: 44,
    color: "#006B3A",
  },
  logoScan: {
    fontFamily: "Geist_700Bold",
    fontSize: 44,
    color: "#F8A018",
  },
  loginCard: {
    marginTop: 14,
    width: width * 0.9,
    maxWidth: 420,
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 22,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 15,
    elevation: 5,
  },
  label: {
    fontFamily: "Geist_600SemiBold",
    fontSize: 12,
    color: "#374151",
    marginBottom: 6,
  },
  fieldLabelSpacing: {
    marginTop: 12,
  },
  inputContainer: {
    width: "100%",
    height: 46,
    borderWidth: 1,
    borderColor: "#E3E6EA",
    borderRadius: 23,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    backgroundColor: "#FFFFFF",
  },
  inputContainerError: {
    borderColor: "#EF4444",
    backgroundColor: "#FEF2F2",
  },
  fieldErrorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 4,
    paddingHorizontal: 6,
  },
  fieldErrorText: {
    fontFamily: "Geist_500Medium",
    fontSize: 11.5,
    color: "#EF4444",
  },
  inputIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    height: "100%",
    fontFamily: "Geist_400Regular",
    fontSize: 13,
    color: "#374151",
  },
  eyeButton: {
    padding: 4,
  },
  loginButton: {
    width: "100%",
    height: 48,
    borderRadius: 24,
    backgroundColor: "#24C95B",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    marginTop: 18,
    marginBottom: 18,
  },
  loginButtonText: {
    fontFamily: "Geist_600SemiBold",
    fontSize: 15,
    color: "#FFFFFF",
  },
  arrow: {
    marginLeft: 6,
  },
  registerContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  registerText: {
    fontFamily: "Geist_400Regular",
    fontSize: 13,
    color: "#9CA3AF",
  },
  registerLink: {
    fontFamily: "Geist_700Bold",
    fontSize: 13,
    color: "#008B5E",
  },
});
