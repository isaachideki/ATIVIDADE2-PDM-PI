import {
  Geist_400Regular,
  Geist_500Medium,
  Geist_600SemiBold,
  Geist_700Bold,
} from "@expo-google-fonts/geist";
import { useFonts } from "@expo-google-fonts/geist/useFonts";
import { Feather, Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import React, { useState, useCallback } from "react";
import {
  ActivityIndicator,
  Image,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";

import AppHeader from "../components/Header/AppHeader";
import TabBar from "@/components/TabBar/indexTab";
import ConfirmModal from "../components/ConfirmModal";
import VinculoCard from "../components/VinculoCard";
import api, { extrairMensagemErro } from "../services/api";
import {
  useAuth,
  NiveisSensibilidade,
} from "../context/AuthContext";
import { useVinculoSync } from "../hooks/useVinculoSync";

const COLORS = {
  background: "#F5F7FA",
  white: "#FFFFFF",
  green: "#087443",
  greenBright: "#20C875",
  greenLight: "#EAF5EE",
  text: "#17251D",
  textSecondary: "#7B8790",
  border: "#E8EDF0",
  muted: "#F0F4F7",
  red: "#EF4444",
  redLight: "#FFF1F1",
};

const ROTULOS_NIVEL: Record<0 | 1 | 2, string> = {
  0: "Leve",
  1: "Moderado",
  2: "Grave",
};

type OptionProps = {
  icon: React.ComponentProps<typeof Feather>["name"];
  title: string;
  subtitle?: string;
  onPress: () => void;
};

export default function PerfilScreen() {
  const [fontsLoaded] = useFonts({
    Geist_400Regular,
    Geist_500Medium,
    Geist_600SemiBold,
    Geist_700Bold,
  });

  const { width } = useWindowDimensions();
  const {
    usuarioAtual,
    salvarSessaoUsuario,
    atualizarUsuario,
    atualizarAvatarContexto,
    encerrarSessao,
  } = useAuth();
  const {
    vinculo,
    erroInline: erroVinculo,
    aviso: avisoVinculo,
    limparAviso: limparAvisoVinculo,
    sincronizar: sincronizarVinculo,
  } = useVinculoSync();

  const cardWidth = Math.min(width - 32, 440);

  const [nome, setNome] = useState(usuarioAtual?.nome || "Usuário");
  const [email, setEmail] = useState(usuarioAtual?.email || "");
  const [avatar, setAvatar] = useState<string | null>(
    usuarioAtual?.avatar || null
  );
  const [enviandoAvatar, setEnviandoAvatar] = useState(false);

  const [diasConsecutivos, setDiasConsecutivos] = useState(0);
  const [escaneamentosSegurosMes, setEscaneamentosSegurosMes] = useState(0);
  const [totalScans, setTotalScans] = useState(0);
  const [metaMensal, setMetaMensal] = useState(50);

  const [refreshing, setRefreshing] = useState(false);
  const [erroInline, setErroInline] = useState<string | null>(null);
  const [sucessoInline, setSucessoInline] = useState<string | null>(null);
  const [modalSairVisivel, setModalSairVisivel] = useState(false);
  const categoriasRestricao: {
    categoria: "gluten" | "lactose" | "amendoim";
    nome: string;
  }[] = [
    { categoria: "gluten", nome: "Glúten" },
    { categoria: "lactose", nome: "Lactose" },
    { categoria: "amendoim", nome: "Amendoim" },
  ];
  const resumoIntolerancias = categoriasRestricao
    .filter(({ categoria }) =>
      usuarioAtual?.restricoes?.some(
        (restricao) => restricao.toLowerCase() === categoria
      )
    )
    .map(({ categoria, nome }) => {
      const nivel =
        usuarioAtual?.niveisSensibilidade?.[categoria] ?? 1;
      return `${nome}: ${ROTULOS_NIVEL[nivel]}`;
    })
    .join(" · ");

  const carregarDadosPerfil = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setRefreshing(true);
      setErroInline(null);

      try {
        const [nomeCache, emailCache, avatarCache] = await Promise.all([
          AsyncStorage.getItem("@usuario_nome"),
          AsyncStorage.getItem("@usuario_email"),
          AsyncStorage.getItem("@usuario_avatar"),
        ]);

        if (nomeCache) setNome(nomeCache);
        if (emailCache) setEmail(emailCache);
        if (avatarCache) setAvatar(avatarCache);

        const res = await api.get("/users/perfil");
        const u = res.data?.usuario || res.data;
        const st = res.data?.stats || {};

        const restServidor = Array.isArray(u.restricoes)
          ? u.restricoes.map((r: string) => r.toLowerCase())
          : [];

        const niveisServidor: NiveisSensibilidade = {
          gluten: (u.niveisSensibilidade?.gluten ?? 1) as 0 | 1 | 2,
          lactose: (u.niveisSensibilidade?.lactose ?? 1) as 0 | 1 | 2,
          amendoim: (u.niveisSensibilidade?.amendoim ?? 1) as 0 | 1 | 2,
        };

        const avatarResolucao = u.avatar || avatarCache || null;
        const vinculoServidor = res.data?.vinculo || u.vinculo;

        setNome(u.nome || "Usuário");
        setEmail(u.email || "");
        setAvatar(avatarResolucao);

        setDiasConsecutivos(Number(st.diasConsecutivos || 0));
        setEscaneamentosSegurosMes(Number(st.escaneamentosSegurosMes || 0));
        setTotalScans(Number(st.totalScans || 0));
        setMetaMensal(Number(st.metaMensal || 50));

        await salvarSessaoUsuario(null, {
          id: String(u.id || u._id),
          nome: u.nome || "Usuário",
          email: u.email || "",
          avatar: avatarResolucao,
          restricoes: restServidor,
          niveisSensibilidade: niveisServidor,
          vinculo: vinculoServidor,
          restricoesAtualizadasEm: u.restricoesAtualizadasEm || null,
          restricoesAtualizadasPor: u.restricoesAtualizadasPor || null,
        });
      } catch (error: any) {
        setErroInline(extrairMensagemErro(error));
      } finally {
        setRefreshing(false);
      }
    },
    [salvarSessaoUsuario]
  );

  useFocusEffect(
    useCallback(() => {
      carregarDadosPerfil(false);
    }, [carregarDadosPerfil])
  );

  /**
   * Abre a galeria com expo-image-picker, converte para data:image/jpeg;base64,
   * atualiza estado local + AsyncStorage + AuthContext imediatamente e grava
   * via PUT /users/perfil no MongoDB (RotuScanDB.users).
   */
  const selecionarFotoAvatar = async () => {
    if (enviandoAvatar) return;
    setErroInline(null);
    setSucessoInline(null);

    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        setErroInline(
          "Permissão de acesso à galeria negada. Habilite nas configurações do aparelho."
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.4,
        base64: true,
      });

      if (result.canceled || !result.assets?.length) {
        return;
      }

      const asset = result.assets[0];
      if (!asset.base64) {
        setErroInline("Não foi possível processar a imagem selecionada.");
        return;
      }

      const avatarBase64 = "data:image/jpeg;base64," + asset.base64;

      // Atualiza imediatamente na UI e no AsyncStorage
      setAvatar(avatarBase64);
      await atualizarAvatarContexto(avatarBase64);

      setEnviandoAvatar(true);
      await api.put("/users/perfil", { avatar: avatarBase64 });

      setSucessoInline("Foto de perfil salva com sucesso!");
      setTimeout(() => setSucessoInline(null), 3500);
    } catch (err: any) {
      setErroInline(extrairMensagemErro(err));
    } finally {
      setEnviandoAvatar(false);
    }
  };

  function abrirRota(path: string) {
    router.push(path as never);
  }

  async function confirmarSaida() {
    setModalSairVisivel(false);
    await encerrarSessao();
    router.replace("/login" as never);
  }

  if (!fontsLoaded) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={COLORS.green} />
      </View>
    );
  }

  const porcentagemMeta = Math.min(
    100,
    Math.round((escaneamentosSegurosMes / Math.max(1, metaMensal)) * 100)
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <StatusBar barStyle="dark-content" />

      <View style={styles.headerContainer}>
        <AppHeader />
      </View>

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { width: cardWidth }]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => carregarDadosPerfil(true)}
            colors={[COLORS.green]}
            tintColor={COLORS.green}
          />
        }
      >
        {erroInline || erroVinculo ? (
          <View style={styles.erroBanner}>
            <Ionicons name="alert-circle" size={16} color="#DC2626" />
            <Text style={styles.erroBannerText}>{erroInline || erroVinculo}</Text>
          </View>
        ) : null}

        {sucessoInline ? (
          <View style={styles.sucessoBanner}>
            <Ionicons name="checkmark-circle" size={16} color="#15803D" />
            <Text style={styles.sucessoBannerText}>{sucessoInline}</Text>
          </View>
        ) : null}

        {avisoVinculo ? (
          <View style={styles.sucessoBanner}>
            <Ionicons name="notifications" size={16} color="#15803D" />
            <Text style={styles.sucessoBannerText}>{avisoVinculo}</Text>
            <TouchableOpacity onPress={limparAvisoVinculo}>
              <Feather name="x" size={16} color="#15803D" />
            </TouchableOpacity>
          </View>
        ) : null}

        {/* Cartão Principal do Usuário */}
        <View style={styles.profileCard}>
          <View style={styles.profileTop}>
            <TouchableOpacity
              style={styles.avatarContainer}
              onPress={selecionarFotoAvatar}
              activeOpacity={0.85}
              disabled={enviandoAvatar}
              accessibilityRole="button"
              accessibilityLabel="Alterar foto de perfil"
            >
              <Image
                source={
                  avatar
                    ? { uri: avatar }
                    : require("../assets/images/user.png")
                }
                style={styles.avatarImage}
                resizeMode="cover"
              />

              {enviandoAvatar ? (
                <View style={styles.avatarLoadingOverlay}>
                  <ActivityIndicator size="small" color="#FFFFFF" />
                </View>
              ) : null}

              <View style={styles.editAvatar}>
                <Feather name="edit-2" size={11} color={COLORS.white} />
              </View>
            </TouchableOpacity>

            <View style={styles.memberBadge}>
              <View style={styles.memberDot} />
              <Text style={styles.memberText}>MEMBRO ATIVO</Text>
            </View>
          </View>

          <Text style={styles.userName}>Olá, {nome}</Text>
          <Text style={styles.userEmail}>{email}</Text>

          <View style={styles.profileDivider} />

          <View style={styles.profileFooter}>
            <Feather name="shield" size={13} color={COLORS.green} />
            <Text style={styles.profileDate}>
              Sua saúde em primeiro lugar
            </Text>
          </View>
        </View>

        {/* Progresso de Saúde */}
        <View style={styles.healthCard}>
          <View style={styles.healthHeader}>
            <Text style={styles.healthTitle}>PROGRESSO DE SAÚDE</Text>
            <Text style={styles.healthDays}>
              {diasConsecutivos} {diasConsecutivos === 1 ? "Dia" : "Dias"}
            </Text>
          </View>

          <View style={styles.progressBackground}>
            <View
              style={[
                styles.progressFill,
                { width: `${porcentagemMeta}%` },
              ]}
            />
          </View>

          {escaneamentosSegurosMes > 0 ? (
            <Text style={styles.healthDescription}>
              Você realizou{" "}
              <Text style={styles.healthBold}>
                {escaneamentosSegurosMes} escaneamentos seguros
              </Text>{" "}
              este mês. Continue assim!
            </Text>
          ) : (
            <Text style={styles.healthDescription}>
              Você ainda não realizou escaneamentos seguros este mês. Faça seu
              primeiro scan para acompanhar sua meta!
            </Text>
          )}
        </View>

        {/* Meu Nutricionista */}
        <View style={styles.optionsSection}>
          <Text style={styles.sectionTitle}>MEU NUTRICIONISTA</Text>

          <VinculoCard
            vinculo={vinculo}
            onRefresh={async () => {
              await sincronizarVinculo();
              await carregarDadosPerfil(true);
            }}
          />
        </View>

        {/* Opções da Conta */}
        <View style={styles.optionsSection}>
          <Text style={styles.sectionTitle}>OPÇÕES DA CONTA</Text>

          <View style={styles.optionsCard}>
            <Option
              icon="shield"
              title="Minhas intolerâncias"
              subtitle={
                resumoIntolerancias ||
                "Nenhuma intolerância ativa"
              }
              onPress={() => abrirRota("/editar-perfil")}
            />

            <View style={styles.optionDivider} />

            <Option
              icon="user"
              title="Dados pessoais e metas"
              subtitle="Editar nome, e-mail e senha"
              onPress={() => abrirRota("/dados-pessoais")}
            />

            <View style={styles.optionDivider} />

            <Option
              icon="bell"
              title="Alertas de contaminação"
              subtitle="Configurar intolerâncias e sensibilidade"
              onPress={() => abrirRota("/alertas")}
            />

            <View style={styles.optionDivider} />

            <Option
              icon="help-circle"
              title="Ajuda e perguntas frequentes"
              subtitle="Dúvidas sobre leitura de rótulos e suporte"
              onPress={() => abrirRota("/ajuda")}
            />

            <View style={styles.optionDivider} />

            <Option
              icon="settings"
              title="Configurações"
              subtitle="Preferências do aplicativo e conta"
              onPress={() => abrirRota("/configuracoes")}
            />
          </View>
        </View>

        {/* Sair da conta */}
        <TouchableOpacity
          style={styles.logoutButton}
          activeOpacity={0.75}
          onPress={() => setModalSairVisivel(true)}
        >
          <Feather name="log-out" size={16} color={COLORS.red} />
          <Text style={styles.logoutText}>Sair da conta</Text>
        </TouchableOpacity>

        <View style={styles.bottomSpace} />
      </ScrollView>

      <View style={styles.tabBarContainer}>
        <TabBar abaAtiva="perfil" />
      </View>

      <ConfirmModal
        visible={modalSairVisivel}
        title="Sair da conta"
        message="Deseja realmente sair da sua conta?"
        confirmText="Sair"
        cancelText="Cancelar"
        destructive
        onConfirm={confirmarSaida}
        onCancel={() => setModalSairVisivel(false)}
      />

    </SafeAreaView>
  );
}

function Option({ icon, title, subtitle, onPress }: OptionProps) {
  return (
    <TouchableOpacity
      style={styles.optionRow}
      activeOpacity={0.7}
      onPress={onPress}
    >
      <View style={styles.optionIcon}>
        <Feather name={icon} size={18} color="#718092" />
      </View>

      <View style={styles.optionContent}>
        <Text style={styles.optionTitle}>{title}</Text>

        {subtitle ? (
          <Text style={styles.optionSubtitle}>{subtitle}</Text>
        ) : null}
      </View>

      <Feather name="chevron-right" size={18} color="#91A3BA" />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.background,
  },
  headerContainer: {
    width: "100%",
    alignSelf: "center",
  },
  scrollView: {
    flex: 1,
    width: "100%",
  },
  scrollContent: {
    paddingTop: 12,
    paddingBottom: 16,
    alignSelf: "center",
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
    marginBottom: 10,
  },
  erroBannerText: {
    flex: 1,
    fontFamily: "Geist_500Medium",
    fontSize: 12,
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
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
  },
  sucessoBannerText: {
    flex: 1,
    fontFamily: "Geist_600SemiBold",
    fontSize: 12,
    color: "#15803D",
  },
  profileCard: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 16,
    alignItems: "center",
    shadowColor: "#223344",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 5,
    elevation: 2,
  },
  profileTop: {
    width: "100%",
    minHeight: 76,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  avatarContainer: {
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  avatarImage: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#CFF8E3",
  },
  avatarLoadingOverlay: {
    ...StyleSheet.absoluteFill,
    borderRadius: 36,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
  },
  editAvatar: {
    position: "absolute",
    right: -2,
    bottom: -2,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: COLORS.greenBright,
    borderWidth: 2,
    borderColor: COLORS.white,
    alignItems: "center",
    justifyContent: "center",
  },
  memberBadge: {
    position: "absolute",
    top: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#E7FFF4",
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  memberDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#12B981",
    marginRight: 5,
  },
  memberText: {
    fontFamily: "Geist_600SemiBold",
    fontSize: 9,
    color: "#079568",
  },
  userName: {
    fontFamily: "Geist_700Bold",
    fontSize: 20,
    color: "#101828",
    marginTop: 8,
  },
  userEmail: {
    fontFamily: "Geist_400Regular",
    fontSize: 13,
    color: "#64748B",
    marginTop: 4,
  },
  profileDivider: {
    width: "100%",
    height: 1,
    backgroundColor: "#F0F3F5",
    marginTop: 16,
    marginBottom: 12,
  },
  profileFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  },
  profileDate: {
    fontFamily: "Geist_400Regular",
    fontSize: 12,
    color: "#64748B",
  },
  healthCard: {
    marginTop: 18,
    backgroundColor: "#EAF4EE",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: "#E0ECE4",
  },
  healthHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  healthTitle: {
    fontFamily: "Geist_700Bold",
    fontSize: 10.5,
    color: COLORS.green,
    letterSpacing: 0.4,
  },
  healthDays: {
    fontFamily: "Geist_700Bold",
    fontSize: 14,
    color: COLORS.green,
  },
  progressBackground: {
    width: "100%",
    height: 6,
    borderRadius: 999,
    backgroundColor: "#DBE6E0",
    overflow: "hidden",
    marginBottom: 10,
  },
  progressFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: "#178C4A",
  },
  healthDescription: {
    fontFamily: "Geist_400Regular",
    fontSize: 11.5,
    lineHeight: 16,
    color: "#556476",
  },
  healthBold: {
    fontFamily: "Geist_700Bold",
    color: "#1F2937",
  },
  optionsSection: {
    marginTop: 22,
  },
  sectionTitle: {
    fontFamily: "Geist_600SemiBold",
    fontSize: 12,
    letterSpacing: 0.3,
    color: "#607087",
  },
  optionsCard: {
    marginTop: 10,
    backgroundColor: COLORS.white,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: "hidden",
  },
  optionRow: {
    minHeight: 56,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  optionIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: COLORS.muted,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  optionContent: {
    flex: 1,
  },
  optionTitle: {
    fontFamily: "Geist_600SemiBold",
    fontSize: 13.5,
    color: "#1F2933",
  },
  optionSubtitle: {
    fontFamily: "Geist_400Regular",
    fontSize: 11.5,
    color: "#94A3B8",
    marginTop: 2,
  },
  optionDivider: {
    height: 1,
    backgroundColor: "#EEF2F5",
    marginLeft: 60,
  },
  logoutButton: {
    marginTop: 16,
    minHeight: 46,
    borderRadius: 14,
    backgroundColor: COLORS.redLight,
    borderWidth: 1,
    borderColor: "#FED7D7",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  logoutText: {
    fontFamily: "Geist_600SemiBold",
    fontSize: 13,
    color: COLORS.red,
  },
  bottomSpace: {
    height: 22,
  },
  tabBarContainer: {
    width: "100%",
    alignSelf: "center",
  },
  nutriCard: {
    marginTop: 10,
    backgroundColor: COLORS.white,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  nutriRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  nutriIconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: COLORS.greenLight,
    alignItems: "center",
    justifyContent: "center",
  },
  nutriName: {
    fontFamily: "Geist_700Bold",
    fontSize: 13.5,
    color: "#1F2933",
  },
  nutriSub: {
    fontFamily: "Geist_400Regular",
    fontSize: 11.5,
    color: "#64748B",
    marginTop: 2,
  },
  linkBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: COLORS.green,
  },
  linkBtnText: {
    fontFamily: "Geist_600SemiBold",
    fontSize: 11.5,
    color: COLORS.white,
  },
  unlinkBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: COLORS.redLight,
    borderWidth: 1,
    borderColor: "#FECACA",
  },
  unlinkBtnText: {
    fontFamily: "Geist_600SemiBold",
    fontSize: 11.5,
    color: COLORS.red,
  },
});
