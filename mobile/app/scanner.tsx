import React, { useState, useCallback } from "react";
import {
  ActivityIndicator,
  Image,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { Ionicons, Feather } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";

import DrawerMenu from "@/components/Drawer/DrawerMenu";
import TabBar from "@/components/TabBar/indexTab";
import { enviarFotoScanner, extrairMensagemErro } from "../services/api";
import { useAuth } from "../context/AuthContext";

export default function ScannerScreen() {
  const { width } = useWindowDimensions();
  const [permission, requestPermission] = useCameraPermissions();
  const { usuarioAtual } = useAuth();

  const [flashAtivo, setFlashAtivo] = useState(false);
  const [menuAberto, setMenuAberto] = useState(false);
  const [cameraRef, setCameraRef] = useState<CameraView | null>(null);
  const [loading, setLoading] = useState(false);
  const [erroInline, setErroInline] = useState<string | null>(null);
  const [avatarUsuario, setAvatarUsuario] = useState<string | null>(
    usuarioAtual?.avatar || null
  );

  useFocusEffect(
    useCallback(() => {
      if (usuarioAtual?.avatar) {
        setAvatarUsuario(usuarioAtual.avatar);
      } else {
        AsyncStorage.getItem("@usuario_avatar").then((av) => {
          setAvatarUsuario(av || null);
        });
      }
    }, [usuarioAtual?.avatar])
  );

  const tamanhoMoldura = Math.min(width * 0.68, 250);
  const tamanhoBotao = Math.min(width * 0.115, 48);

  const navegar = (rota: string) => {
    setMenuAberto(false);
    router.push(rota as never);
  };

  const capturarEAnalisarRotulo = async () => {
    if (!cameraRef || loading) return;
    setLoading(true);
    setErroInline(null);

    try {
      const photo = await cameraRef.takePictureAsync({
        quality: 0.7,
        base64: false,
      });

      if (!photo?.uri) {
        setErroInline("Não foi possível capturar a foto. Tente novamente.");
        setLoading(false);
        return;
      }

            const data = await enviarFotoScanner(photo.uri);

      if (data.veredito === "INCONCLUSIVO" || data.status === "INCONCLUSIVO") {
        router.push({
          pathname: "/resultado" as any,
          params: {
            veredito: "INCONCLUSIVO",
            localUri: photo.uri,
            textoBruto: data.textoBruto || "",
          },
        });
        return;
      }

      const idScan = data.id || data._id;
      if (idScan) {
        router.push({
          pathname: "/resultado" as any,
          params: {
            id: String(idScan),
            localUri: photo.uri,
          },
        });
      } else {
        setErroInline("Não foi possível obter o resultado da leitura.");
      }
    } catch (error: any) {
      setErroInline(extrairMensagemErro(error));
    } finally {
      setLoading(false);
    }
  };

  if (!permission) {
    return (
      <View style={styles.permissionContainer}>
        <ActivityIndicator size="large" color="#24C95B" />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.permissionContainer}>
        <Ionicons name="camera-outline" size={65} color="#24C95B" />

        <Text style={styles.permissionTitle}>Acesso à câmera</Text>

        <Text style={styles.permissionText}>
          Precisamos acessar sua câmera para fotografar e analisar a lista de
          ingredientes dos rótulos.
        </Text>

        <TouchableOpacity
          style={styles.permissionButton}
          onPress={requestPermission}
        >
          <Text style={styles.permissionButtonText}>Permitir acesso</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {}
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        enableTorch={flashAtivo}
        ref={(ref) => setCameraRef(ref)}
      />

      {}
      <View style={styles.overlay} pointerEvents="box-none">
        <SafeAreaView style={styles.safeArea} edges={["top"]}>
          {}
          <View style={styles.header}>
            <TouchableOpacity
              style={styles.headerButton}
              onPress={() => setMenuAberto(true)}
              activeOpacity={0.7}
              accessibilityLabel="Abrir menu"
            >
              <Feather name="menu" size={22} color="#FFFFFF" />
            </TouchableOpacity>

            <Text style={styles.headerTitle}>RotuScan</Text>

            <TouchableOpacity
              style={styles.profileButton}
              onPress={() => navegar("/perfil")}
              activeOpacity={0.8}
              accessibilityLabel="Ir para o perfil"
            >
              {avatarUsuario ? (
                <Image
                  source={{ uri: avatarUsuario }}
                  style={styles.profileAvatarImage}
                />
              ) : (
                <Ionicons name="person-circle" size={38} color="#FFFFFF" />
              )}
            </TouchableOpacity>
          </View>

          {erroInline ? (
            <View style={styles.erroBanner}>
              <Ionicons name="alert-circle" size={18} color="#FEF2F2" />
              <Text style={styles.erroBannerText}>{erroInline}</Text>
              <TouchableOpacity onPress={() => setErroInline(null)}>
                <Feather name="x" size={16} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          ) : null}

          {}
          <View style={styles.sideControls}>
            <TouchableOpacity
              style={[
                styles.controlButton,
                {
                  width: tamanhoBotao,
                  height: tamanhoBotao,
                  backgroundColor: flashAtivo
                    ? "#24C95B"
                    : "rgba(120, 75, 48, 0.65)",
                },
              ]}
              onPress={() => setFlashAtivo(!flashAtivo)}
              activeOpacity={0.7}
              accessibilityLabel="Alternar flash"
            >
              <Ionicons
                name={flashAtivo ? "flash" : "flash-outline"}
                size={22}
                color="#FFFFFF"
              />
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.controlButton,
                {
                  width: tamanhoBotao,
                  height: tamanhoBotao,
                },
              ]}
              onPress={() => navegar("/historico")}
              activeOpacity={0.7}
              accessibilityLabel="Ver histórico"
            >
              <Ionicons name="time-outline" size={22} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          {}
          <View style={styles.scannerArea}>
            <View
              style={[
                styles.scannerFrame,
                {
                  width: tamanhoMoldura,
                  height: tamanhoMoldura * 0.83,
                },
              ]}
            >
              <View style={[styles.corner, styles.topLeft]} />
              <View style={[styles.corner, styles.topRight]} />
              <View style={[styles.corner, styles.bottomLeft]} />
              <View style={[styles.corner, styles.bottomRight]} />
            </View>
            <Text style={styles.frameHint}>
              Enquadre a lista de ingredientes do rótulo
            </Text>
          </View>

          {}
          <View style={styles.bottomContainer}>
            <TouchableOpacity
              style={[
                styles.scanningIndicator,
                loading && { backgroundColor: "rgba(0, 109, 55, 0.92)" },
              ]}
              activeOpacity={0.8}
              onPress={capturarEAnalisarRotulo}
              disabled={loading}
              accessibilityRole="button"
              accessibilityLabel="Fotografar e analisar rótulo"
            >
              <View style={styles.scanningIcon}>
                <Ionicons
                  name="scan-outline"
                  size={19}
                  color={loading ? "#FFFFFF" : "#24C95B"}
                />
              </View>

              <Text style={styles.scanningText}>
                {loading
                  ? "Buscando restrições..."
                  : "Toque para escanear rótulo"}
              </Text>

              {loading && (
                <ActivityIndicator
                  size="small"
                  color="#FFFFFF"
                  style={styles.loadingIcon}
                />
              )}
            </TouchableOpacity>
          </View>
        </SafeAreaView>

        <TabBar abaAtiva="escanear" />
      </View>

      <DrawerMenu
        visible={menuAberto}
        onClose={() => setMenuAberto(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000000",
  },
  permissionContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 35,
    backgroundColor: "#FFFFFF",
  },
  permissionTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#006B3A",
    marginTop: 20,
  },
  permissionText: {
    fontSize: 14,
    color: "#6B7280",
    textAlign: "center",
    lineHeight: 22,
    marginTop: 10,
  },
  permissionButton: {
    backgroundColor: "#24C95B",
    paddingHorizontal: 30,
    paddingVertical: 14,
    borderRadius: 25,
    marginTop: 25,
  },
  permissionButtonText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 15,
  },
  overlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(0, 0, 0, 0.12)",
  },
  safeArea: {
    flex: 1,
  },
  header: {
    height: 53,
    paddingHorizontal: 15,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerButton: {
    width: 38,
    height: 38,
    borderRadius: 22,
    backgroundColor: "rgba(0, 0, 0, 0.35)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    position: "absolute",
    left: 55,
    right: 55,
    textAlign: "center",
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
    textShadowColor: "rgba(0,0,0,0.5)",
    textShadowRadius: 5,
  },
  profileButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(0, 0, 0, 0.35)",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    borderWidth: 1.5,
    borderColor: "rgba(255, 255, 255, 0.7)",
  },
  profileAvatarImage: {
    width: 38,
    height: 38,
    borderRadius: 19,
  },
  erroBanner: {
    marginHorizontal: 16,
    marginTop: 8,
    backgroundColor: "rgba(220, 38, 38, 0.92)",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  erroBannerText: {
    flex: 1,
    color: "#FFFFFF",
    fontSize: 12.5,
    fontWeight: "600",
  },
  sideControls: {
    position: "absolute",
    right: 12,
    top: "12%",
    gap: 13,
    alignItems: "center",
  },
  controlButton: {
    borderRadius: 50,
    backgroundColor: "rgba(120, 75, 48, 0.65)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.35)",
    alignItems: "center",
    justifyContent: "center",
  },
  scannerArea: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  scannerFrame: {
    position: "relative",
  },
  frameHint: {
    marginTop: 14,
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "600",
    backgroundColor: "rgba(0,0,0,0.45)",
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 12,
    overflow: "hidden",
  },
  corner: {
    position: "absolute",
    width: "25%",
    height: "25%",
    borderColor: "#22C55E",
  },
  topLeft: {
    top: 0,
    left: 0,
    borderTopWidth: 3.5,
    borderLeftWidth: 3.5,
    borderTopLeftRadius: 8,
  },
  topRight: {
    top: 0,
    right: 0,
    borderTopWidth: 3.5,
    borderRightWidth: 3.5,
    borderTopRightRadius: 8,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 3.5,
    borderLeftWidth: 3.5,
    borderBottomLeftRadius: 8,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 3.5,
    borderRightWidth: 3.5,
    borderBottomRightRadius: 8,
  },
  bottomContainer: {
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 110,
  },
  scanningIndicator: {
    minHeight: 46,
    minWidth: 225,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 30,
    backgroundColor: "rgba(35, 35, 35, 0.90)",
    gap: 9,
  },
  scanningIcon: {
    alignItems: "center",
    justifyContent: "center",
  },
  scanningText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "600",
  },
  loadingIcon: {
    marginLeft: 2,
  },
});
