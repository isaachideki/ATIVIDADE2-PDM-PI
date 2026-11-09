import React, { useState, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  Dimensions,
  ImageBackground,
  ActivityIndicator,
  Animated,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFonts } from "@expo-google-fonts/geist/useFonts";
import { Geist_400Regular } from "@expo-google-fonts/geist/400Regular";
import { Geist_500Medium } from "@expo-google-fonts/geist/500Medium";
import { Geist_600SemiBold } from "@expo-google-fonts/geist/600SemiBold";
import { Geist_700Bold } from "@expo-google-fonts/geist/700Bold";
import { useRouter } from "expo-router";

import api, { extrairMensagemErro } from "../services/api";
import { useAuth } from "../context/AuthContext";

const { width } = Dimensions.get("window");
const backgroundImage = require("../assets/images/Fundo.png");
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export default function LoginScreen() {
  const router = useRouter();
  const { salvarSessaoUsuario } = useAuth();

  const [fontsLoaded] = useFonts({
    Geist_400Regular,
    Geist_500Medium,
    Geist_600SemiBold,
    Geist_700Bold,
  });

  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [loading, setLoading] = useState(false);

  const [erroEmail, setErroEmail] = useState<string | null>(null);
  const [erroSenha, setErroSenha] = useState<string | null>(null);
  const [erroServidor, setErroServidor] = useState<string | null>(null);

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

  const handleLogin = async () => {
    if (loading) return;
    setErroEmail(null);
    setErroSenha(null);
    setErroServidor(null);

    const emailLimpo = email.trim().toLowerCase();
    let invalido = false;

    if (!emailLimpo) {
      setErroEmail("Preencha seu e-mail");
      invalido = true;
    } else if (!EMAIL_REGEX.test(emailLimpo)) {
      setErroEmail("E-mail inválido");
      invalido = true;
    }

    if (!senha.trim()) {
      setErroSenha("Preencha sua senha");
      invalido = true;
    }

    if (invalido) {
      dispararShake();
      return;
    }

    setLoading(true);
    try {
      const response = await api.post("/auth/login", {
        email: emailLimpo,
        senha,
      });
      const { token, usuario, role } = response.data;
      const roleFinal = role || usuario?.role;

      if (roleFinal === "NUTRICIONISTA") {
        setErroServidor("Esta conta é de nutricionista. Use o painel web.");
        dispararShake();
        return;
      }

      await salvarSessaoUsuario(token, usuario);
      router.replace("/home" as never);
    } catch (error: any) {
      const msg = extrairMensagemErro(error);
      setErroServidor(msg);
      dispararShake();
    } finally {
      setLoading(false);
    }
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

        {}
        <View style={styles.logoContainer}>
          <Text style={styles.logoRotu}>Rotu</Text>
          <Text style={styles.logoScan}>Scan</Text>
        </View>

        {}
        <Animated.View
          style={[
            styles.loginCard,
            { transform: [{ translateX: shakeAnim }] },
          ]}
        >
          {erroServidor ? (
            <View style={styles.erroBanner}>
              <Ionicons name="alert-circle" size={16} color="#DC2626" />
              <Text style={styles.erroBannerText}>{erroServidor}</Text>
            </View>
          ) : null}

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
              color={erroEmail ? "#EF4444" : "#556070"}
              style={styles.inputIcon}
            />
            <TextInput
              value={email}
              onChangeText={(txt) => {
                setEmail(txt);
                if (erroEmail) setErroEmail(null);
                if (erroServidor) setErroServidor(null);
              }}
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
          <Text style={[styles.label, styles.passwordLabel]}>Senha</Text>
          <View
            style={[
              styles.inputContainer,
              erroSenha ? styles.inputContainerError : null,
            ]}
          >
            <Ionicons
              name="lock-closed-outline"
              size={18}
              color={erroSenha ? "#EF4444" : "#556070"}
              style={styles.inputIcon}
            />
            <TextInput
              value={senha}
              onChangeText={(txt) => {
                setSenha(txt);
                if (erroSenha) setErroSenha(null);
                if (erroServidor) setErroServidor(null);
              }}
              placeholder="Sua senha"
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
                color="#8A94A6"
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
          <TouchableOpacity
            style={styles.forgotContainer}
            activeOpacity={0.7}
            onPress={() => router.push("/ajuda" as never)}
          >
            <Text style={styles.forgotText}>Esqueceu a senha?</Text>
          </TouchableOpacity>

          {}
          <TouchableOpacity
            style={styles.loginButton}
            activeOpacity={0.85}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.loginButtonText}>Entrar</Text>
            )}
          </TouchableOpacity>

          {}
          <View style={styles.registerContainer}>
            <Text style={styles.registerText}>Não tem conta? </Text>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => router.push("/cadastro" )}
            >
              <Text style={styles.registerLink}>Cadastre-se</Text>
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
    marginTop: 105,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  logoRotu: {
    fontFamily: "Geist_700Bold",
    fontSize: 50,
    color: "#006B3A",
    letterSpacing: -1.5,
  },
  logoScan: {
    fontFamily: "Geist_700Bold",
    fontSize: 50,
    color: "#F59E0B",
    letterSpacing: -1.5,
  },
  loginCard: {
    marginTop: 12,
    width: width * 0.88,
    maxWidth: 420,
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    paddingHorizontal: 22,
    paddingTop: 26,
    paddingBottom: 26,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.05,
    shadowRadius: 20,
    elevation: 4,
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
    marginBottom: 14,
  },
  erroBannerText: {
    flex: 1,
    fontFamily: "Geist_500Medium",
    fontSize: 12.5,
    color: "#DC2626",
  },
  label: {
    fontFamily: "Geist_700Bold",
    fontSize: 13,
    color: "#374151",
    marginBottom: 8,
  },
  passwordLabel: {
    marginTop: 16,
  },
  inputContainer: {
    width: "100%",
    height: 52,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 26,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
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
    marginTop: 5,
    paddingHorizontal: 8,
  },
  fieldErrorText: {
    fontFamily: "Geist_500Medium",
    fontSize: 11.5,
    color: "#EF4444",
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    height: "100%",
    fontFamily: "Geist_400Regular",
    fontSize: 14,
    color: "#1F2937",
  },
  eyeButton: {
    padding: 4,
  },
  forgotContainer: {
    alignItems: "flex-end",
    marginTop: 12,
    marginBottom: 20,
  },
  forgotText: {
    fontFamily: "Geist_700Bold",
    fontSize: 13,
    color: "#008B5E",
  },
  loginButton: {
    width: "100%",
    height: 52,
    borderRadius: 26,
    backgroundColor: "#22C55E",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
  },
  loginButtonText: {
    fontFamily: "Geist_600SemiBold",
    fontSize: 16,
    color: "#FFFFFF",
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
