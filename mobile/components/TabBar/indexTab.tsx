import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { styles } from "./style";

export type AbaId =
  | "inicio"
  | "historico"
  | "escanear"
  | "itensCurtidos"
  | "perfil";

type Props = {
  abaAtiva: AbaId;
};

export default function TabBar({ abaAtiva }: Props) {
  const insets = useSafeAreaInsets();

  const tabs = [
    {
      id: "inicio" as AbaId,
      label: "Início",
      icon: "home" as const,
      route: "/home",
    },
    {
      id: "historico" as AbaId,
      label: "Histórico",
      icon: "clock" as const,
      route: "/historico",
    },
    {
      id: "itensCurtidos" as AbaId,
      label: "Curtidos",
      icon: "heart" as const,
      route: "/itensCurtidos",
    },
    {
      id: "perfil" as AbaId,
      label: "Perfil",
      icon: "user" as const,
      route: "/perfil",
    },
  ];

  return (
    <View
      style={[
        styles.container,
        { paddingBottom: Math.max(insets.bottom, 8) },
      ]}
    >
      {}
      {tabs.slice(0, 2).map((tab) => {
        const ativo = abaAtiva === tab.id;

        return (
          <TouchableOpacity
            key={tab.id}
            style={styles.tab}
            activeOpacity={0.7}
            onPress={() => router.push(tab.route as never)}
          >
            <View
              style={[
                styles.iconPill,
                ativo && styles.iconPillAtivo,
              ]}
            >
              <Feather
                name={tab.icon}
                size={20}
                color={ativo ? "#006D37" : "#9CA3AF"}
              />
            </View>

            <Text
              style={[
                styles.label,
                ativo && styles.labelAtivo,
              ]}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        );
      })}

      {}
      <View style={styles.scanTab}>
        <TouchableOpacity
          activeOpacity={0.85}
          style={[
            styles.scanButton,
            abaAtiva === "escanear" && styles.scanButtonAtivo,
          ]}
          onPress={() => router.push("/scanner" as never)}
          accessibilityRole="button"
          accessibilityLabel="Escanear produto"
        >
          <MaterialCommunityIcons
            name="barcode-scan"
            size={24}
            color="#FFFFFF"
          />
        </TouchableOpacity>

        <Text
          style={[
            styles.label,
            abaAtiva === "escanear" && styles.labelAtivo,
          ]}
        >
          Escanear
        </Text>
      </View>

      {}
      {tabs.slice(2).map((tab) => {
        const ativo = abaAtiva === tab.id;

        return (
          <TouchableOpacity
            key={tab.id}
            style={styles.tab}
            activeOpacity={0.7}
            onPress={() => router.push(tab.route as never)}
          >
            <View
              style={[
                styles.iconPill,
                ativo && styles.iconPillAtivo,
              ]}
            >
              <Feather
                name={tab.icon}
                size={20}
                color={ativo ? "#006D37" : "#9CA3AF"}
              />
            </View>

            <Text
              style={[
                styles.label,
                ativo && styles.labelAtivo,
              ]}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}
