import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  RefreshControl,
  ScrollView,
  Share,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, router } from "expo-router";
import {
  Feather,
  Ionicons,
  MaterialCommunityIcons,
} from "@expo/vector-icons";
import {
  Geist_400Regular,
  Geist_500Medium,
  Geist_600SemiBold,
  Geist_700Bold,
} from "@expo-google-fonts/geist";
import { useFonts } from "@expo-google-fonts/geist/useFonts";
import AsyncStorage from "@react-native-async-storage/async-storage";

import api, { extrairMensagemErro } from "../services/api";
import ScanThumb from "../components/ScanThumb";
import { ROTULO_CATEGORIA, formatarResumoAlergicos } from "../utils/datas";

type AlergicoDetectado = {
  categoria: "gluten" | "lactose" | "amendoim";
  tipo: "CONTEM" | "TRACOS";
  termos: string[];
};

type IngredienteDetalhado = {
  nome: string;
  risco: boolean;
  fonte: string | null;
};

type DetalheScan = {
  id: string;
  nomeProduto: string;
  nomeAutomatico: boolean;
  marca?: string;
  peso?: string;
  marcaPeso: string | null;
  veredito: "SEGURO" | "PERIGOSO" | "INCONCLUSIVO";
  alergicosDetectados: AlergicoDetectado[];
  intoleranciaDetectada?: string[];
  nivelSensibilidade?: string;
  ingredientesDetalhados: IngredienteDetalhado[];
  textoBruto: string;
  curtido: boolean;
  imagemUri?: string | null;
  imagemUrl: string | null;
  imagemDemo: string | null;
  createdAt?: string;
};

export default function ResultadoDetalhadoScreen() {
  const params = useLocalSearchParams<{
    id?: string;
    localUri?: string;
    veredito?: string;
    textoBruto?: string;
  }>();

  const [fontsLoaded] = useFonts({
    Geist_400Regular,
    Geist_500Medium,
    Geist_600SemiBold,
    Geist_700Bold,
  });

  const [carregando, setCarregando] = useState(Boolean(params.id));
  const [refreshing, setRefreshing] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [avatarUsuario, setAvatarUsuario] = useState<string | null>(null);

  const [detalhe, setDetalhe] = useState<DetalheScan | null>(() => {
    if (params.veredito === "INCONCLUSIVO") {
      return {
        id: "",
        nomeProduto: "Leitura inconclusiva",
        nomeAutomatico: true,
        marcaPeso: null,
        veredito: "INCONCLUSIVO",
        alergicosDetectados: [],
        ingredientesDetalhados: [],
        textoBruto: params.textoBruto || "",
        curtido: false,
        imagemUrl: null,
        imagemDemo: null,
      };
    }
    return null;
  });

    const [editandoMeta, setEditandoMeta] = useState(false);
  const [nomeInput, setNomeInput] = useState("");
  const [marcaInput, setMarcaInput] = useState("");
  const [pesoInput, setPesoInput] = useState("");
  const [salvandoMeta, setSalvandoMeta] = useState(false);
  const [sucessoMeta, setSucessoMeta] = useState<string | null>(null);
  const [togglingCurtir, setTogglingCurtir] = useState(false);
  const [mostrarTextoBruto, setMostrarTextoBruto] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem("@usuario_avatar").then((av) => {
      if (av) setAvatarUsuario(av);
    });
  }, []);

  const carregarDetalhe = useCallback(
    async (isRefresh = false) => {
      if (!params.id) {
        setCarregando(false);
        return;
      }
      if (isRefresh) setRefreshing(true);
      setErro(null);

      try {
        const res = await api.get(`/users/historico/${params.id}`);
        const d: DetalheScan = res.data;
        setDetalhe(d);
        setNomeInput(d.nomeProduto || "");
        setMarcaInput(d.marca || "");
        setPesoInput(d.peso || "");
      } catch (err: any) {
        setErro(extrairMensagemErro(err));
      } finally {
        setCarregando(false);
        setRefreshing(false);
      }
    },
    [params.id]
  );

  useEffect(() => {
    if (params.id) {
      carregarDetalhe(false);
    }
  }, [params.id, carregarDetalhe]);

  const salvarNomeEMarca = async () => {
    if (!detalhe?.id || salvandoMeta) return;
    const limpo = nomeInput.trim();
    const marcaLimpa = marcaInput.trim();
    const pesoLimpo = pesoInput.trim();

    if (!limpo) {
      setErro("O nome do produto não pode ficar vazio.");
      return;
    }
    if (limpo.length > 80) {
      setErro("O nome do produto deve ter no máximo 80 caracteres.");
      return;
    }
    if (marcaLimpa.length > 60) {
      setErro("A marca deve ter no máximo 60 caracteres.");
      return;
    }
    if (pesoLimpo.length > 30) {
      setErro("O peso deve ter no máximo 30 caracteres.");
      return;
    }

    const estadoAnterior = { ...detalhe };
    const marcaPesoOtimista =
      marcaLimpa && pesoLimpo
        ? `${marcaLimpa} • ${pesoLimpo}`
        : marcaLimpa || pesoLimpo || "";

    // Atualização otimista imediata
    setDetalhe((prev) =>
      prev
        ? {
            ...prev,
            nomeProduto: limpo,
            nomeAutomatico: false,
            marca: marcaLimpa,
            peso: pesoLimpo,
            marcaPeso: marcaPesoOtimista || null,
          }
        : prev
    );
    setEditandoMeta(false);
    setSalvandoMeta(true);
    setErro(null);
    setSucessoMeta(null);

    try {
      const res = await api.patch(`/users/historico/${detalhe.id}`, {
        nomeProduto: limpo,
        marca: marcaLimpa,
        peso: pesoLimpo,
      });
      const atualizado = res.data?.item || res.data;
      setDetalhe((prev) =>
        prev
          ? {
              ...prev,
              nomeProduto: atualizado.nomeProduto || limpo,
              nomeAutomatico: false,
              marca: atualizado.marca ?? marcaLimpa,
              peso: atualizado.peso ?? pesoLimpo,
              marcaPeso:
                atualizado.marcaPeso ?? (marcaPesoOtimista || null),
            }
          : prev
      );
      setSucessoMeta("Nome, marca e peso salvos com sucesso!");
      setTimeout(() => setSucessoMeta(null), 3500);
    } catch (err: any) {
      // Rollback em caso de erro
      setDetalhe(estadoAnterior);
      setEditandoMeta(true);
      setErro(extrairMensagemErro(err));
    } finally {
      setSalvandoMeta(false);
    }
  };

  const alternarFavorito = async () => {
    if (!detalhe?.id || togglingCurtir) return;
    const estadoAnterior = detalhe.curtido;
    const novoEstado = !estadoAnterior;

    setDetalhe((prev) => (prev ? { ...prev, curtido: novoEstado } : prev));
    setTogglingCurtir(true);

    try {
      const res = await api.patch(`/users/historico/${detalhe.id}/curtir`, {
        curtido: novoEstado,
      });
      const confirmado =
        typeof res.data?.curtido === "boolean" ? res.data.curtido : novoEstado;
      setDetalhe((prev) => (prev ? { ...prev, curtido: confirmado } : prev));
    } catch (err: any) {
      // Rollback em caso de erro
      setDetalhe((prev) =>
        prev ? { ...prev, curtido: estadoAnterior } : prev
      );
      setErro(extrairMensagemErro(err));
    } finally {
      setTogglingCurtir(false);
    }
  };

  const compartilharResultado = async () => {
    if (!detalhe) return;
    const resumo =
      detalhe.veredito === "INCONCLUSIVO"
        ? "Leitura inconclusiva"
        : formatarResumoAlergicos(
            detalhe.veredito,
            detalhe.alergicosDetectados
          );

    const textoShare =
      detalhe.veredito === "SEGURO"
        ? `RotuScan — ${detalhe.nomeProduto}: Produto SEGURO para o meu perfil alimentar (nenhum ingrediente restrito encontrado na lista lida).`
        : detalhe.veredito === "PERIGOSO"
        ? `RotuScan — ⚠️ ATENÇÃO em ${detalhe.nomeProduto}: ${resumo}. Este produto não é seguro para o meu perfil.`
        : `RotuScan — Não foi possível ler o rótulo com segurança.`;

    try {
      await Share.share({
        message: textoShare,
      });
    } catch {
      // ignora cancelamento do share
    }
  };

  if (!fontsLoaded || carregando) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator size="large" color="#006D37" />
      </View>
    );
  }

  const veredito = detalhe?.veredito || "INCONCLUSIVO";
  const ehPerigoso = veredito === "PERIGOSO";
  const ehSeguro = veredito === "SEGURO";
  const ehInconclusivo = veredito === "INCONCLUSIVO";
  const catPrincipal = detalhe?.alergicosDetectados?.[0]?.categoria || null;

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <StatusBar barStyle="dark-content" />

      {/* CABEÇALHO DO RESULTADO */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Voltar"
        >
          <Feather name="arrow-left" size={22} color="#006D37" />
        </TouchableOpacity>

        <View style={styles.logoRow}>
          <Text style={styles.logoRotu}>Rotu</Text>
          <Text style={styles.logoScan}>Scan</Text>
        </View>

        <View style={styles.headerRight}>
          {detalhe?.id ? (
            <TouchableOpacity
              style={styles.heartButton}
              onPress={alternarFavorito}
              activeOpacity={0.75}
              accessibilityRole="button"
              accessibilityLabel={
                detalhe.curtido
                  ? "Remover dos favoritos"
                  : "Salvar nos favoritos"
              }
            >
              <Ionicons
                name={detalhe.curtido ? "heart" : "heart-outline"}
                size={22}
                color={detalhe.curtido ? "#DC2626" : "#64748B"}
              />
            </TouchableOpacity>
          ) : null}

          <TouchableOpacity
            onPress={() => router.push("/perfil" as never)}
            activeOpacity={0.8}
          >
            <Image
              source={
                avatarUsuario
                  ? { uri: avatarUsuario }
                  : require("../assets/images/user.png")
              }
              style={styles.headerAvatar}
            />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          params.id ? (
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => carregarDetalhe(true)}
              colors={["#006D37"]}
              tintColor="#006D37"
            />
          ) : undefined
        }
      >
        {erro ? (
          <View style={styles.erroBanner}>
            <Ionicons name="alert-circle" size={16} color="#DC2626" />
            <Text style={styles.erroBannerText}>{erro}</Text>
          </View>
        ) : null}

        {sucessoMeta ? (
          <View style={styles.sucessoBanner}>
            <Ionicons name="checkmark-circle" size={16} color="#15803D" />
            <Text style={styles.sucessoBannerText}>{sucessoMeta}</Text>
          </View>
        ) : null}

        {/* CARD DO PRODUTO (FOTO + NOME + MARCA/PESO) */}
        <View style={styles.productCard}>
          <ScanThumb
            localUri={params.localUri || null}
            imagemUri={detalhe?.imagemUri}
            imagemUrl={detalhe?.imagemUrl}
            imagemDemo={detalhe?.imagemDemo}
            categoriaPrincipal={catPrincipal}
            style={styles.productImage}
            resizeMode="contain"
            iconSize={48}
          />

          {!ehInconclusivo && editandoMeta ? (
            <View style={styles.editMetaBox}>
              <Text style={styles.editMetaLabel}>
                Nome do produto ({nomeInput.length}/80)
              </Text>
              <TextInput
                value={nomeInput}
                onChangeText={setNomeInput}
                placeholder="Ex: Biscoito Integral"
                placeholderTextColor="#9CA3AF"
                maxLength={80}
                style={styles.editMetaInput}
                autoFocus
              />

              <Text style={styles.editMetaLabel}>
                Marca (opcional • {marcaInput.length}/60)
              </Text>
              <TextInput
                value={marcaInput}
                onChangeText={setMarcaInput}
                placeholder="Ex: ElmaChips"
                placeholderTextColor="#9CA3AF"
                maxLength={60}
                style={styles.editMetaInput}
              />

              <Text style={styles.editMetaLabel}>
                Peso / Volume (opcional • {pesoInput.length}/30)
              </Text>
              <TextInput
                value={pesoInput}
                onChangeText={setPesoInput}
                placeholder="Ex: 100g"
                placeholderTextColor="#9CA3AF"
                maxLength={30}
                style={styles.editMetaInput}
              />

              <View style={styles.editMetaActions}>
                <TouchableOpacity
                  style={styles.cancelMetaBtn}
                  onPress={() => {
                    setEditandoMeta(false);
                    setNomeInput(detalhe?.nomeProduto || "");
                    setMarcaInput(detalhe?.marca || "");
                    setPesoInput(detalhe?.peso || "");
                  }}
                  disabled={salvandoMeta}
                >
                  <Text style={styles.cancelMetaText}>Cancelar</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.saveMetaBtn}
                  onPress={salvarNomeEMarca}
                  disabled={salvandoMeta}
                >
                  {salvandoMeta ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.saveMetaText}>Salvar</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <TouchableOpacity
              activeOpacity={ehInconclusivo ? 1 : 0.75}
              disabled={ehInconclusivo}
              onPress={() => setEditandoMeta(true)}
              style={styles.productTitleTouch}
            >
              <View style={styles.productNameRow}>
                <Text style={styles.productName}>
                  {detalhe?.nomeProduto || "Produto analisado"}
                </Text>
                {!ehInconclusivo && (
                  <Feather
                    name="edit-2"
                    size={14}
                    color="#6B7280"
                    style={{ marginLeft: 6 }}
                  />
                )}
              </View>

              {!ehInconclusivo && detalhe?.nomeAutomatico ? (
                <Text style={styles.touchToRenameHint}>
                  Toque para nomear
                </Text>
              ) : null}

              {!ehInconclusivo ? (
                <Text style={styles.productBrand}>
                  {detalhe?.marcaPeso || "Toque para adicionar marca e peso"}
                </Text>
              ) : null}
            </TouchableOpacity>
          )}
        </View>

        {/* BANNER DE VEREDITO: PERIGOSO (VERMELHO) */}
        {ehPerigoso && (
          <>
            <View style={styles.verdictCardDanger}>
              <View style={styles.verdictIconCircleDanger}>
                <Ionicons name="alert-circle" size={26} color="#FFFFFF" />
              </View>

              <View style={styles.verdictTextCol}>
                <Text style={styles.verdictTitle}>
                  ATENÇÃO:{"\n"}RESTRIÇÃO{"\n"}ENCONTRADA
                </Text>
                <Text style={styles.verdictSubtitle}>
                  Este produto não é seguro para o seu perfil.
                </Text>
              </View>

              <Ionicons
                name="warning"
                size={84}
                color="rgba(255,255,255,0.12)"
                style={styles.watermarkIcon}
              />
            </View>

            {/* ALERTAS POR CATEGORIA DETECTADA */}
            {detalhe?.alergicosDetectados?.map((alerg) => {
              const nomeCat =
                ROTULO_CATEGORIA[alerg.categoria] || alerg.categoria;
              const frase =
                alerg.tipo === "TRACOS"
                  ? `Pode conter traços de ${nomeCat}`
                  : `Contém ${nomeCat}`;

              return (
                <View
                  key={`${alerg.categoria}-${alerg.tipo}`}
                  style={styles.detectedAlertBox}
                >
                  <Ionicons
                    name="close-circle"
                    size={22}
                    color="#B91C1C"
                    style={{ marginRight: 10 }}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.detectedAlertLabel}>
                      RESTRIÇÃO DETECTADA
                    </Text>
                    <Text style={styles.detectedAlertValue}>{frase}</Text>
                  </View>
                </View>
              );
            })}
          </>
        )}

        {/* BANNER DE VEREDITO: SEGURO (VERDE) */}
        {ehSeguro && (
          <View style={styles.verdictCardSafe}>
            <View style={styles.verdictIconCircleSafe}>
              <Ionicons
                name="checkmark-circle-outline"
                size={26}
                color="#FFFFFF"
              />
            </View>

            <View style={styles.verdictTextCol}>
              <Text style={styles.verdictTitle}>PRODUTO SEGURO</Text>
              <Text style={styles.verdictSubtitle}>
                Este produto é seguro para o seu perfil.
              </Text>
              <Text style={styles.verdictSafeDetail}>
                Nenhum ingrediente do seu perfil foi encontrado na lista lida.
              </Text>
            </View>

            <Ionicons
              name="checkmark-circle-outline"
              size={90}
              color="rgba(255,255,255,0.18)"
              style={styles.watermarkIcon}
            />
          </View>
        )}

        {/* BANNER DE VEREDITO: INCONCLUSIVO (ÂMBAR #F59E0B) */}
        {ehInconclusivo && (
          <View style={styles.verdictCardAmber}>
            <View style={styles.verdictIconCircleAmber}>
              <Ionicons name="help-circle" size={28} color="#FFFFFF" />
            </View>

            <View style={styles.verdictTextCol}>
              <Text style={styles.verdictTitle}>
                Não consegui ler com segurança
              </Text>
              <Text style={styles.verdictSubtitle}>
                O texto extraído da imagem está curto ou ilegível. Por
                segurança, este escaneamento não foi salvo.
              </Text>
            </View>

            <View style={styles.amberTipsBox}>
              <Text style={styles.amberTipsTitle}>
                Dicas para tentar novamente:
              </Text>
              <Text style={styles.amberTipItem}>
                • Procure um ambiente com mais luz e evite reflexos na
                embalagem.
              </Text>
              <Text style={styles.amberTipItem}>
                • Aproxime a câmera e aguarde o foco automático.
              </Text>
              <Text style={styles.amberTipItem}>
                • Enquadre apenas a lista de ingredientes do rótulo.
              </Text>
            </View>
          </View>
        )}

        {/* DETALHAMENTO DE INGREDIENTES */}
        {!ehInconclusivo && (
          <>
            <Text style={styles.sectionHeader}>
              DETALHAMENTO DE INGREDIENTES
            </Text>

            <View style={styles.ingredientsCard}>
              {detalhe?.ingredientesDetalhados &&
              detalhe.ingredientesDetalhados.length > 0 ? (
                detalhe.ingredientesDetalhados.map((ing, idx) => {
                  const isUltimo =
                    idx === detalhe.ingredientesDetalhados.length - 1;
                  return (
                    <View
                      key={`${ing.nome}-${idx}`}
                      style={[
                        styles.ingredientRow,
                        !isUltimo && styles.ingredientDivider,
                      ]}
                    >
                      {ing.risco ? (
                        <Ionicons
                          name="close-circle-outline"
                          size={20}
                          color="#B91C1C"
                          style={{ marginRight: 10 }}
                        />
                      ) : (
                        <Ionicons
                          name="checkmark-circle-outline"
                          size={20}
                          color="#16A34A"
                          style={{ marginRight: 10 }}
                        />
                      )}

                      <Text
                        style={[
                          styles.ingredientName,
                          ing.risco && styles.ingredientNameDanger,
                        ]}
                      >
                        {ing.nome}
                      </Text>

                      {ing.risco && ing.fonte ? (
                        <View style={styles.sourceBadge}>
                          <Text style={styles.sourceBadgeText}>
                            {ing.fonte}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                  );
                })
              ) : (
                <View style={styles.ingredientRow}>
                  <Ionicons
                    name="document-text-outline"
                    size={18}
                    color="#6B7280"
                    style={{ marginRight: 8 }}
                  />
                  <Text style={styles.ingredientName}>
                    Consulte o texto bruto lido no rótulo abaixo.
                  </Text>
                </View>
              )}
            </View>

            {/* TEXTO BRUTO LIDO PELO OCR (COLAPSÁVEL) */}
            {detalhe?.textoBruto ? (
              <View style={styles.rawTextSection}>
                <TouchableOpacity
                  style={styles.rawTextToggle}
                  onPress={() => setMostrarTextoBruto(!mostrarTextoBruto)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.rawTextToggleLabel}>
                    {mostrarTextoBruto
                      ? "Ocultar texto lido no rótulo"
                      : "Ver texto bruto lido no rótulo"}
                  </Text>
                  <Feather
                    name={mostrarTextoBruto ? "chevron-up" : "chevron-down"}
                    size={16}
                    color="#6B7280"
                  />
                </TouchableOpacity>

                {mostrarTextoBruto && (
                  <View style={styles.rawTextBox}>
                    <Text style={styles.rawTextContent}>
                      {detalhe.textoBruto}
                    </Text>
                  </View>
                )}
              </View>
            ) : null}
          </>
        )}

        {/* BOTÕES DE AÇÃO */}
        <TouchableOpacity
          style={styles.scanAgainButton}
          activeOpacity={0.85}
          onPress={() => router.replace("/scanner" as never)}
        >
          <MaterialCommunityIcons
            name="barcode-scan"
            size={20}
            color="#FFFFFF"
            style={{ marginRight: 8 }}
          />
          <Text style={styles.scanAgainText}>Escanear Novamente</Text>
        </TouchableOpacity>

        {!ehInconclusivo && (
          <TouchableOpacity
            style={styles.shareButton}
            activeOpacity={0.8}
            onPress={compartilharResultado}
          >
            <Feather
              name="share-2"
              size={18}
              color="#374151"
              style={{ marginRight: 8 }}
            />
            <Text style={styles.shareButtonText}>Compartilhar Resultado</Text>
          </TouchableOpacity>
        )}

        {/* AVISO LEGAL DISCRETO */}
        <Text style={styles.disclaimerText}>
          O RotuScan é um apoio e não substitui a conferência da embalagem nem
          a orientação do seu nutricionista.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F9FAFB",
  },
  loadingScreen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F9FAFB",
  },
  header: {
    minHeight: 58,
    paddingHorizontal: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: "flex-start",
    justifyContent: "center",
  },
  logoRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  logoRotu: {
    fontFamily: "Geist_700Bold",
    fontSize: 20,
    color: "#006D37",
    letterSpacing: -0.5,
  },
  logoScan: {
    fontFamily: "Geist_700Bold",
    fontSize: 20,
    color: "#F59E0B",
    letterSpacing: -0.3,
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  heartButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    alignItems: "center",
    justifyContent: "center",
  },
  headerAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#E5E7EB",
  },
  scrollContent: {
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 32,
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
    marginBottom: 12,
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
    marginBottom: 12,
  },
  sucessoBannerText: {
    flex: 1,
    fontFamily: "Geist_600SemiBold",
    fontSize: 12,
    color: "#15803D",
  },
  productCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#F1F5F9",
    padding: 18,
    alignItems: "center",
    marginBottom: 14,
  },
  productImage: {
    width: 180,
    height: 180,
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
    marginBottom: 12,
  },
  productTitleTouch: {
    alignItems: "center",
    width: "100%",
  },
  productNameRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  productName: {
    fontFamily: "Geist_700Bold",
    fontSize: 20,
    color: "#111827",
    textAlign: "center",
  },
  touchToRenameHint: {
    fontFamily: "Geist_500Medium",
    fontSize: 11,
    color: "#008B5E",
    marginTop: 2,
  },
  productBrand: {
    fontFamily: "Geist_400Regular",
    fontSize: 13,
    color: "#6B7280",
    marginTop: 4,
    textAlign: "center",
  },
  editMetaBox: {
    width: "100%",
    marginTop: 4,
  },
  editMetaLabel: {
    fontFamily: "Geist_600SemiBold",
    fontSize: 12,
    color: "#374151",
    marginBottom: 4,
    marginTop: 6,
  },
  editMetaInput: {
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontFamily: "Geist_400Regular",
    fontSize: 13.5,
    color: "#111827",
    backgroundColor: "#F8FAFC",
  },
  editMetaActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 8,
    marginTop: 12,
  },
  cancelMetaBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "#F1F5F9",
  },
  cancelMetaText: {
    fontFamily: "Geist_600SemiBold",
    fontSize: 12.5,
    color: "#475569",
  },
  saveMetaBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "#006D37",
  },
  saveMetaText: {
    fontFamily: "Geist_600SemiBold",
    fontSize: 12.5,
    color: "#FFFFFF",
  },
  // VEREDITO: PERIGOSO
  verdictCardDanger: {
    backgroundColor: "#BE2419",
    borderRadius: 18,
    paddingHorizontal: 18,
    paddingVertical: 20,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    position: "relative",
    overflow: "hidden",
  },
  verdictIconCircleDanger: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 16,
  },
  verdictTextCol: {
    flex: 1,
    zIndex: 2,
  },
  verdictTitle: {
    fontFamily: "Geist_700Bold",
    fontSize: 18,
    lineHeight: 23,
    color: "#FFFFFF",
    marginBottom: 6,
  },
  verdictSubtitle: {
    fontFamily: "Geist_400Regular",
    fontSize: 13,
    lineHeight: 18,
    color: "#FFFFFF",
  },
  verdictSafeDetail: {
    fontFamily: "Geist_500Medium",
    fontSize: 11.5,
    lineHeight: 16,
    color: "rgba(255,255,255,0.92)",
    marginTop: 4,
  },
  watermarkIcon: {
    position: "absolute",
    right: -10,
    bottom: -12,
  },
  detectedAlertBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FDF2F2",
    borderLeftWidth: 4,
    borderLeftColor: "#BE2419",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 12,
  },
  detectedAlertLabel: {
    fontFamily: "Geist_700Bold",
    fontSize: 10,
    color: "#991B1B",
    letterSpacing: 0.4,
  },
  detectedAlertValue: {
    fontFamily: "Geist_700Bold",
    fontSize: 16,
    color: "#7F1D1D",
    marginTop: 1,
  },
  // VEREDITO: SEGURO
  verdictCardSafe: {
    backgroundColor: "#22C55E",
    borderRadius: 18,
    paddingHorizontal: 18,
    paddingVertical: 20,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
    position: "relative",
    overflow: "hidden",
  },
  verdictIconCircleSafe: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(255,255,255,0.24)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 16,
  },
  // VEREDITO: INCONCLUSIVO
  verdictCardAmber: {
    backgroundColor: "#F59E0B",
    borderRadius: 18,
    padding: 18,
    marginBottom: 18,
  },
  verdictIconCircleAmber: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "rgba(255,255,255,0.25)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  amberTipsBox: {
    marginTop: 14,
    backgroundColor: "rgba(255,255,255,0.18)",
    borderRadius: 12,
    padding: 12,
  },
  amberTipsTitle: {
    fontFamily: "Geist_700Bold",
    fontSize: 12.5,
    color: "#FFFFFF",
    marginBottom: 6,
  },
  amberTipItem: {
    fontFamily: "Geist_500Medium",
    fontSize: 12,
    lineHeight: 18,
    color: "#FFFFFF",
    marginBottom: 3,
  },
  // INGREDIENTES
  sectionHeader: {
    fontFamily: "Geist_600SemiBold",
    fontSize: 12,
    letterSpacing: 0.5,
    color: "#4B5563",
    marginTop: 6,
    marginBottom: 10,
  },
  ingredientsCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#F1F5F9",
    paddingHorizontal: 14,
    paddingVertical: 4,
    marginBottom: 14,
  },
  ingredientRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
  },
  ingredientDivider: {
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  ingredientName: {
    flex: 1,
    fontFamily: "Geist_500Medium",
    fontSize: 13.5,
    color: "#4B5563",
  },
  ingredientNameDanger: {
    fontFamily: "Geist_700Bold",
    color: "#B91C1C",
  },
  sourceBadge: {
    backgroundColor: "#FDF2F2",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginLeft: 8,
  },
  sourceBadgeText: {
    fontFamily: "Geist_700Bold",
    fontSize: 10.5,
    color: "#B91C1C",
  },
  rawTextSection: {
    marginBottom: 16,
  },
  rawTextToggle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  rawTextToggleLabel: {
    fontFamily: "Geist_500Medium",
    fontSize: 12,
    color: "#6B7280",
  },
  rawTextBox: {
    backgroundColor: "#F3F4F6",
    borderRadius: 12,
    padding: 12,
    marginTop: 4,
  },
  rawTextContent: {
    fontFamily: "Geist_400Regular",
    fontSize: 11.5,
    lineHeight: 17,
    color: "#374151",
  },
  // BOTÕES DE AÇÃO
  scanAgainButton: {
    backgroundColor: "#006837",
    height: 50,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
    marginBottom: 10,
  },
  scanAgainText: {
    fontFamily: "Geist_700Bold",
    fontSize: 15,
    color: "#FFFFFF",
  },
  shareButton: {
    backgroundColor: "#FFFFFF",
    height: 50,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  shareButtonText: {
    fontFamily: "Geist_700Bold",
    fontSize: 14.5,
    color: "#374151",
  },
  disclaimerText: {
    fontFamily: "Geist_400Regular",
    fontSize: 11,
    lineHeight: 16,
    color: "#9CA3AF",
    textAlign: "center",
    paddingHorizontal: 12,
  },
});

