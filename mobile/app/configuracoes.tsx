import React, { useState } from "react";
import {
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather, Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import {
  Geist_400Regular,
  Geist_500Medium,
  Geist_600SemiBold,
  Geist_700Bold,
} from "@expo-google-fonts/geist";
import { useFonts } from "@expo-google-fonts/geist/useFonts";

import AppHeader from "../components/Header/AppHeader";
import TabBar from "../components/TabBar/indexTab";
import ConfirmModal from "../components/ConfirmModal";
import VinculoCard from "../components/VinculoCard";
import api, { extrairMensagemErro } from "../services/api";
import { useAuth } from "../context/AuthContext";
import { useVinculoSync } from "../hooks/useVinculoSync";

export default function ConfiguracoesScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { encerrarSessao } = useAuth();
  const {
    vinculo,
    erroInline: erroVinculo,
    aviso: avisoVinculo,
    limparAviso: limparAvisoVinculo,
    sincronizar,
  } = useVinculoSync();

  const [fontsLoaded] = useFonts({
    Geist_400Regular,
    Geist_500Medium,
    Geist_600SemiBold,
    Geist_700Bold,
  });

  const [modalSairVisivel, setModalSairVisivel] = useState(false);
  const [modalExcluirVisivel, setModalExcluirVisivel] = useState(false);
  const [excluindo, setExcluindo] = useState(false);
  const [erroInline, setErroInline] = useState<string | null>(null);

  const confirmarSaida = async () => {
    setModalSairVisivel(false);
    await encerrarSessao();
    router.replace("/login" as never);
  };

  const confirmarExclusaoConta = async () => {
    if (excluindo) return;
    setExcluindo(true);
    setErroInline(null);
    try {
      await api.delete("/users/me");
      setModalExcluirVisivel(false);
      await encerrarSessao();
      router.replace("/login" as never);
    } catch (err: any) {
      setModalExcluirVisivel(false);
      setErroInline(extrairMensagemErro(err));
    } finally {
      setExcluindo(false);
    }
  };

  if (!fontsLoaded) return null;

  const cardWidth = Math.min(width - 36, 440);

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <StatusBar barStyle="dark-content" />
      <AppHeader />

      <ScrollView
        style={styles.container}
        contentContainerStyle={[styles.scrollContent, { width: cardWidth }]}
        showsVerticalScrollIndicator={false}
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
            <Text style={styles.pageTitle}>Definições</Text>
            <Text style={styles.pageSubtitle}>
              Gerencie sua conta, preferências e segurança alimentar
            </Text>
          </View>
        </View>

        {erroInline || erroVinculo ? (
          <View style={styles.erroBanner}>
            <Ionicons name="alert-circle" size={18} color="#DC2626" />
            <Text style={styles.erroBannerText}>{erroInline || erroVinculo}</Text>
          </View>
        ) : null}
        {avisoVinculo ? (
          <View style={styles.erroBanner}>
            <Ionicons name="notifications" size={18} color="#087443" />
            <Text style={styles.erroBannerText}>{avisoVinculo}</Text>
            <TouchableOpacity onPress={limparAvisoVinculo}>
              <Feather name="x" size={16} color="#087443" />
            </TouchableOpacity>
          </View>
        ) : null}

        {}
        <Text style={styles.sectionTitle}>MEU NUTRICIONISTA</Text>
        <VinculoCard vinculo={vinculo} onRefresh={sincronizar} />

        {}
        <Text style={styles.sectionTitle}>CONTA E PERFIL ALIMENTAR</Text>
        <View style={styles.card}>
          <ConfigItem
            icon="user"
            title="Dados Pessoais"
            subtitle="Alterar nome, e-mail e senha"
            onPress={() => router.push("/dados-pessoais" as never)}
          />
          <View style={styles.divider} />

          <ConfigItem
            icon="sliders"
            title="Minhas Intolerâncias"
            subtitle="Ativar/desativar Glúten, Lactose e Amendoim"
            onPress={() => router.push("/editar-perfil" as never)}
          />
          <View style={styles.divider} />

          <ConfigItem
            icon="bell"
            title="Alertas de Contaminação"
            subtitle="Sensibilidade a avisos de 'Pode conter traços'"
            onPress={() => router.push("/alertas" as never)}
          />
        </View>

        {}
        <Text style={styles.sectionTitle}>ATIVIDADE E SUPORTE</Text>
        <View style={styles.card}>
          <ConfigItem
            icon="clock"
            title="Histórico de Escaneamentos"
            subtitle="Consultar todas as análises realizadas"
            onPress={() => router.push("/historico" as never)}
          />
          <View style={styles.divider} />

          <ConfigItem
            icon="heart"
            title="Itens Curtidos"
            subtitle="Acessar seus produtos favoritos"
            onPress={() => router.push("/itensCurtidos" as never)}
          />
          <View style={styles.divider} />

          <ConfigItem
            icon="help-circle"
            title="Ajuda e Perguntas Frequentes"
            subtitle="Dicas de uso e suporte"
            onPress={() => router.push("/ajuda" as never)}
          />
        </View>

        {}
        <Text style={styles.sectionTitle}>SESSÃO</Text>

        <TouchableOpacity
          style={styles.logoutButton}
          activeOpacity={0.8}
          onPress={() => setModalSairVisivel(true)}
          accessibilityRole="button"
          accessibilityLabel="Sair da conta"
        >
          <Feather name="log-out" size={17} color="#DC2626" />
          <Text style={styles.logoutText}>Sair da conta</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.deleteAccountButton}
          activeOpacity={0.8}
          onPress={() => setModalExcluirVisivel(true)}
          accessibilityRole="button"
          accessibilityLabel="Excluir minha conta permanentemente"
        >
          <Feather name="trash-2" size={16} color="#991B1B" />
          <Text style={styles.deleteAccountText}>
            Excluir minha conta permanentemente
          </Text>
        </TouchableOpacity>

        <Text style={styles.versionText}>
          RotuScan v1.0.0 • Segurança Alimentar Inteligente
        </Text>
      </ScrollView>

      <TabBar abaAtiva="perfil" />

      <ConfirmModal
        visible={modalSairVisivel}
        title="Sair da conta"
        message="Deseja realmente encerrar sua sessão atual no RotuScan?"
        confirmText="Sair"
        cancelText="Cancelar"
        destructive
        onConfirm={confirmarSaida}
        onCancel={() => setModalSairVisivel(false)}
      />

      <ConfirmModal
        visible={modalExcluirVisivel}
        title="Excluir conta permanentemente?"
        message="Esta ação apagará definitivamente sua conta, suas preferências e todo o seu histórico de escaneamentos. Não pode ser desfeita."
        confirmText="Excluir Conta"
        cancelText="Cancelar"
        destructive
        loading={excluindo}
        onConfirm={confirmarExclusaoConta}
        onCancel={() => setModalExcluirVisivel(false)}
      />

    </SafeAreaView>
  );
}

function ConfigItem({
  icon,
  title,
  subtitle,
  onPress,
}: {
  icon: React.ComponentProps<typeof Feather>["name"];
  title: string;
  subtitle: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={styles.itemRow}
      activeOpacity={0.7}
      onPress={onPress}
    >
      <View style={styles.itemIcon}>
        <Feather name={icon} size={18} color="#087443" />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.itemTitle}>{title}</Text>
        <Text style={styles.itemSubtitle}>{subtitle}</Text>
      </View>
      <Feather name="chevron-right" size={18} color="#94A3B8" />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#F5F7FA" },
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
  sectionTitle: {
    fontFamily: "Geist_700Bold",
    fontSize: 11.5,
    letterSpacing: 0.4,
    color: "#607087",
    marginTop: 10,
    marginBottom: 8,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: "#E8EDF0",
    marginBottom: 12,
  },
  itemRow: {
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
  },
  itemIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: "#EAF5EE",
    alignItems: "center",
    justifyContent: "center",
  },
  itemTitle: {
    fontFamily: "Geist_600SemiBold",
    fontSize: 13.5,
    color: "#1E293B",
  },
  itemSubtitle: {
    fontFamily: "Geist_400Regular",
    fontSize: 11.5,
    color: "#64748B",
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: "#F1F5F9",
    marginLeft: 50,
  },
  logoutButton: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#FFF1F1",
    borderWidth: 1,
    borderColor: "#FECACA",
    borderRadius: 14,
    marginTop: 4,
  },
  logoutText: {
    fontFamily: "Geist_700Bold",
    fontSize: 14,
    color: "#DC2626",
  },
  deleteAccountButton: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 12,
  },
  deleteAccountText: {
    fontFamily: "Geist_500Medium",
    fontSize: 12.5,
    color: "#991B1B",
  },
  versionText: {
    fontFamily: "Geist_400Regular",
    fontSize: 11,
    color: "#94A3B8",
    textAlign: "center",
    marginTop: 18,
  },
});
