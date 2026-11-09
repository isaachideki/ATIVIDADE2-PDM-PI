import { StyleSheet } from "react-native";

export const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "flex-end",
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
    paddingTop: 8,
    paddingHorizontal: 8,
  },

  tab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-end",
    paddingBottom: 4,
  },

  iconPill: {
    width: 48,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 2,
  },

  iconPillAtivo: {
    backgroundColor: "#DCFCE7",
  },

  label: {
    fontFamily: "Geist_600SemiBold",
    fontSize: 11,
    color: "#9CA3AF",
  },

  labelAtivo: {
    color: "#006D37",
  },

  scanTab: {
    flex: 1,
    alignItems: "center",
  },

  scanButton: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: "#15803D",
    borderWidth: 4,
    borderColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    marginTop: -26,
    marginBottom: 4,
    shadowColor: "#006D37",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 6,
  },

  scanButtonAtivo: {
    backgroundColor: "#006D37",
    borderColor: "#DCFCE7",
  },
});
