import React from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ActivityIndicator,
} from "react-native";

type ConfirmModalProps = {
  visible: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  destructive?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export default function ConfirmModal({
  visible,
  title,
  message,
  confirmText = "Confirmar",
  cancelText = "Cancelar",
  destructive = false,
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onCancel}
    >
      <View style={styles.backdropContainer}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={loading ? undefined : onCancel}
        />

        <View style={styles.card}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>

          <View style={styles.actionsRow}>
            <TouchableOpacity
              style={[styles.button, styles.cancelButton]}
              activeOpacity={0.75}
              onPress={onCancel}
              disabled={loading}
              accessibilityRole="button"
              accessibilityLabel={cancelText}
            >
              <Text style={styles.cancelText}>{cancelText}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.button,
                destructive ? styles.destructiveButton : styles.confirmButton,
              ]}
              activeOpacity={0.8}
              onPress={onConfirm}
              disabled={loading}
              accessibilityRole="button"
              accessibilityLabel={confirmText}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.confirmText}>{confirmText}</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdropContainer: {
    flex: 1,
    backgroundColor: "rgba(17, 24, 39, 0.55)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  card: {
    width: "100%",
    maxWidth: 380,
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    paddingHorizontal: 22,
    paddingTop: 22,
    paddingBottom: 18,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.14,
    shadowRadius: 16,
    elevation: 6,
  },
  title: {
    fontFamily: "Geist_700Bold",
    fontSize: 17,
    color: "#111827",
    marginBottom: 8,
  },
  message: {
    fontFamily: "Geist_400Regular",
    fontSize: 13.5,
    lineHeight: 20,
    color: "#4B5563",
    marginBottom: 20,
  },
  actionsRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
  },
  button: {
    minHeight: 42,
    paddingHorizontal: 18,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelButton: {
    backgroundColor: "#F3F4F6",
  },
  confirmButton: {
    backgroundColor: "#006D37",
  },
  destructiveButton: {
    backgroundColor: "#DC2626",
  },
  cancelText: {
    fontFamily: "Geist_600SemiBold",
    fontSize: 13,
    color: "#374151",
  },
  confirmText: {
    fontFamily: "Geist_600SemiBold",
    fontSize: 13,
    color: "#FFFFFF",
  },
});

