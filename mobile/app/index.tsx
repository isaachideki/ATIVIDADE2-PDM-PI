import React, { useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  ActivityIndicator,
  Animated,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as SplashScreen from "expo-splash-screen";
import { useFonts } from "@expo-google-fonts/geist/useFonts";
import { Geist_400Regular } from "@expo-google-fonts/geist/400Regular";
import { Geist_500Medium } from "@expo-google-fonts/geist/500Medium";
import { Geist_600SemiBold } from "@expo-google-fonts/geist/600SemiBold";
import { Geist_700Bold } from "@expo-google-fonts/geist/700Bold";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";

import api from "../services/api";
import { useAuth } from "../context/AuthContext";

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function IndexSplashScreen() {
  const router = useRouter();
  const { salvarSessaoUsuario } = useAuth();

  const [fontsLoaded] = useFonts({
    Geist_400Regular,
    Geist_500Medium,
    Geist_600SemiBold,
    Geist_700Bold,
  });

  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 380,
      useNativeDriver: true,
    }).start();
  }, [fadeAnim]);

  useEffect(() => {
    if (!fontsLoaded) return;

    let cancelado = false;

    const inicializarSessao = async () => {
      try {
        await SplashScreen.hideAsync();
      } catch {
              }

      const inicio = Date.now();
      let destino: "/home" | "/login" = "/login";

      try {
        const token = await AsyncStorage.getItem("@rotuscan_token");

        if (token) {
          try {
            const res = await api.get("/users/perfil");
            const u = res.data?.usuario || res.data;
            if (u?.role === "NUTRICIONISTA") {
              await AsyncStorage.multiRemove([
                "@rotuscan_token",
                "@usuario_id",
                "@usuario_nome",
                "@usuario_email",
                "@usuario_avatar",
                "@usuario_restricoes",
                "@usuario_niveis",
              ]);
              destino = "/login";
            } else if (u && (u.id || u._id)) {
              await salvarSessaoUsuario(token, {
                id: String(u.id || u._id),
                nome: u.nome || "Usuário",
                email: u.email || "",
                avatar: u.avatar || null,
                role: u.role || "PACIENTE",
                restricoes: Array.isArray(u.restricoes) ? u.restricoes : [],
                niveisSensibilidade: u.niveisSensibilidade || {
                  gluten: 1,
                  lactose: 1,
                  amendoim: 1,
                },
                restricoesAtualizadasEm: u.restricoesAtualizadasEm || null,
                restricoesAtualizadasPor: u.restricoesAtualizadasPor || null,
              });
              destino = "/home";
            }
          } catch (err: any) {
            if (err?.response?.status === 401 || err?.response?.status === 404) {
              await AsyncStorage.multiRemove([
                "@rotuscan_token",
                "@usuario_id",
                "@usuario_nome",
                "@usuario_email",
                "@usuario_avatar",
                "@usuario_restricoes",
                "@usuario_niveis",
              ]);
              destino = "/login";
            } else {
                            const usuarioId = await AsyncStorage.getItem("@usuario_id");
              destino = usuarioId ? "/home" : "/login";
            }
          }
        }
      } catch {
        destino = "/login";
      }

      const decorrido = Date.now() - inicio;
      const restante = Math.max(0, 800 - decorrido);

      setTimeout(() => {
        if (!cancelado) {
          router.replace(destino as never);
        }
      }, restante);
    };

    inicializarSessao();

    return () => {
      cancelado = true;
    };
  }, [fontsLoaded, router, salvarSessaoUsuario]);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />

      <Animated.View style={[styles.centerContent, { opacity: fadeAnim }]}>
        <View style={styles.logoRow}>
          <Text style={styles.logoRotu}>Rotu</Text>
          <Text style={styles.logoScan}>Scan</Text>
        </View>

        <Text style={styles.subtitle}>
          Segurança alimentar na palma da mão
        </Text>

        <ActivityIndicator
          size="large"
          color="#006D37"
          style={styles.loader}
        />
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAF9",
    alignItems: "center",
    justifyContent: "center",
  },
  centerContent: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
  },
  logoRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  logoRotu: {
    fontFamily: "Geist_700Bold",
    fontSize: 52,
    color: "#006D37",
    letterSpacing: -1.5,
  },
  logoScan: {
    fontFamily: "Geist_700Bold",
    fontSize: 52,
    color: "#F59E0B",
    letterSpacing: -1.5,
  },
  subtitle: {
    fontFamily: "Geist_500Medium",
    fontSize: 14,
    color: "#52635A",
    marginTop: 8,
    textAlign: "center",
  },
  loader: {
    marginTop: 24,
  },
});
