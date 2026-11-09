import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  LayoutChangeEvent,
  PanResponder,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

export type NivelSensibilidade = 0 | 1 | 2;

export const NIVEIS_LABELS: Record<NivelSensibilidade, string> = {
  0: "Leve",
  1: "Moderado",
  2: "Grave",
};

const FILL_FRACTIONS: Record<NivelSensibilidade, number> = {
  0: 0.15,
  1: 0.5,
  2: 1.0,
};

type SensitivitySliderProps = {
  nivel: NivelSensibilidade;
  onChangeNivel?: (novoNivel: NivelSensibilidade) => void;
  onRequestActivate?: () => void;
  ativo?: boolean;
  readOnly?: boolean;
  label?: string;
  onGestureActiveChange?: (active: boolean) => void;
};

export default function SensitivitySlider({
  nivel,
  onChangeNivel,
  ativo = true,
  readOnly = false,
  label = "Nível de Sensibilidade",
  onGestureActiveChange,
}: SensitivitySliderProps) {
  const [larguraBarra, setLarguraBarra] = useState(0);
  const animFraction = useRef(
    new Animated.Value(FILL_FRACTIONS[nivel] ?? 0.5)
  ).current;

  const nivelRef = useRef<NivelSensibilidade>(nivel);
  nivelRef.current = nivel;

  const larguraRef = useRef(0);
  const startXRef = useRef(0);

  const podeInteragir = !readOnly && ativo && Boolean(onChangeNivel);
  const podeInteragirRef = useRef(podeInteragir);
  podeInteragirRef.current = podeInteragir;

  const onChangeRef = useRef(onChangeNivel);
  onChangeRef.current = onChangeNivel;

  const onGestureActiveChangeRef = useRef(onGestureActiveChange);
  onGestureActiveChangeRef.current = onGestureActiveChange;

  useEffect(() => {
    Animated.spring(animFraction, {
      toValue: FILL_FRACTIONS[nivel] ?? 0.5,
      useNativeDriver: false,
      friction: 8,
      tension: 65,
    }).start();
  }, [nivel, animFraction]);

  const calcularNivelPorPosicaoX = (x: number): NivelSensibilidade => {
    const w = larguraRef.current;
    if (w <= 0) return nivelRef.current;
    const ratio = Math.max(0, Math.min(1, x / w));
    if (ratio < 0.325) return 0;
    if (ratio < 0.75) return 1;
    return 2;
  };

  const aplicarNovoNivel = (novo: NivelSensibilidade) => {
    if (!podeInteragirRef.current) return;
    onChangeRef.current?.(novo);
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => podeInteragirRef.current,
      onMoveShouldSetPanResponder: () => podeInteragirRef.current,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (evt) => {
        if (!podeInteragirRef.current) return;
        onGestureActiveChangeRef.current?.(true);
        const x = evt.nativeEvent.locationX;
        startXRef.current = x;
        const novo = calcularNivelPorPosicaoX(x);
        aplicarNovoNivel(novo);
      },
      onPanResponderMove: (_evt, gestureState) => {
        if (!podeInteragirRef.current || larguraRef.current <= 0) return;
        const xAtual = startXRef.current + gestureState.dx;
        const xClamped = Math.max(0, Math.min(larguraRef.current, xAtual));
        const novo = calcularNivelPorPosicaoX(xClamped);
        if (novo !== nivelRef.current) {
          aplicarNovoNivel(novo);
        }
      },
      onPanResponderRelease: (_evt, gestureState) => {
        if (podeInteragirRef.current && larguraRef.current > 0) {
          const xFinal = startXRef.current + gestureState.dx;
          const xClamped = Math.max(0, Math.min(larguraRef.current, xFinal));
          const novo = calcularNivelPorPosicaoX(xClamped);
          aplicarNovoNivel(novo);
        }
        onGestureActiveChangeRef.current?.(false);
      },
      onPanResponderTerminate: () =>
        onGestureActiveChangeRef.current?.(false),
    })
  ).current;

  const handleLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    larguraRef.current = w;
    setLarguraBarra(w);
  };

  const selecionarNivelDireto = (novo: NivelSensibilidade) => {
    if (!podeInteragir) return;
    onChangeNivel?.(novo);
  };

  const corBarraAtiva = ativo ? "#20B86A" : "#CBD5E1";
  const corBarraFundo = ativo ? "#DDE2E6" : "#E5E7EB";
  const corTextoNivel = ativo ? "#009B67" : "#9CA3AF";

  const widthInterpolada = animFraction.interpolate({
    inputRange: [0, 1],
    outputRange: ["0%", "100%"],
  });

  const leftThumbInterpolada =
    larguraBarra > 0
      ? animFraction.interpolate({
          inputRange: [0, 1],
          outputRange: [0, Math.max(0, larguraBarra - 16)],
        })
      : 0;

  return (
    <View
      style={[styles.wrapper, !ativo && styles.wrapperDisabled]}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      accessibilityValue={{
        min: 0,
        max: 2,
        now: nivel,
        text: ativo ? NIVEIS_LABELS[nivel] : "Desativado",
      }}
    >
      <View style={styles.headerRow}>
        <Text style={[styles.title, !ativo && styles.textDisabled]}>
          {label}
        </Text>
        <Text style={[styles.currentLevel, { color: corTextoNivel }]}>
          {NIVEIS_LABELS[nivel]}
        </Text>
      </View>

      {}
      <View
        style={styles.trackTouchArea}
        onLayout={handleLayout}
        {...(podeInteragir ? panResponder.panHandlers : {})}
      >
        <View
          pointerEvents="none"
          style={[styles.trackBackground, { backgroundColor: corBarraFundo }]}
        />

        <Animated.View
          pointerEvents="none"
          style={[
            styles.trackFill,
            {
              width: widthInterpolada,
              backgroundColor: corBarraAtiva,
            },
          ]}
        >
          {ativo && <View style={styles.trackFillHighlight} />}
        </Animated.View>

        {}
        {([0, 1, 2] as NivelSensibilidade[]).map((pt) => {
          const posPercent = pt === 0 ? "15%" : pt === 1 ? "50%" : "100%";
          const preenchido = FILL_FRACTIONS[nivel] >= FILL_FRACTIONS[pt];
          return (
            <View
              key={pt}
              pointerEvents="none"
              style={[
                styles.stepPoint,
                {
                  left: posPercent,
                  marginLeft: pt === 2 ? -8 : -4,
                  backgroundColor: preenchido ? corBarraAtiva : corBarraFundo,
                },
              ]}
            />
          );
        })}

        {}
        {larguraBarra > 0 && (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.thumb,
              {
                transform: [{ translateX: leftThumbInterpolada }],
                backgroundColor: corBarraAtiva,
              },
            ]}
          />
        )}
      </View>

      {}
      <View style={styles.labelsRow}>
        {([0, 1, 2] as NivelSensibilidade[]).map((item) => {
          const selecionado = nivel === item;
          return (
            <TouchableOpacity
              key={item}
              activeOpacity={0.65}
              disabled={!podeInteragir}
              onPress={() => selecionarNivelDireto(item)}
              style={[
                styles.labelButton,
                item === 0
                  ? styles.labelButtonLeft
                  : item === 1
                  ? styles.labelButtonCenter
                  : styles.labelButtonRight,
              ]}
              hitSlop={{ top: 8, bottom: 8, left: 10, right: 10 }}
            >
              <Text
                style={[
                  styles.levelLabel,
                  selecionado && ativo && styles.levelLabelActive,
                  !ativo && styles.textDisabled,
                ]}
              >
                {NIVEIS_LABELS[item]}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {}
      {ativo && nivel === 0 && (
        <Text style={styles.leveCaption}>
          Avisos de &apos;pode conter&apos; serão ignorados para este alérgeno
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    width: "100%",
  },
  wrapperDisabled: {
    opacity: 0.65,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    width: "100%",
    marginBottom: 6,
  },
  title: {
    fontFamily: "Geist_600SemiBold",
    fontSize: 12,
    color: "#3D4A3E",
  },
  currentLevel: {
    fontFamily: "Geist_700Bold",
    fontSize: 11.5,
  },
  trackTouchArea: {
    width: "100%",
    height: 30,
    justifyContent: "center",
    position: "relative",
  },
  trackBackground: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 6,
    borderRadius: 4,
  },
  trackFill: {
    position: "absolute",
    left: 0,
    height: 6,
    borderRadius: 4,
    overflow: "hidden",
  },
  trackFillHighlight: {
    position: "absolute",
    right: 0,
    top: 0,
    bottom: 0,
    width: "40%",
    backgroundColor: "#008B5E",
    opacity: 0.35,
  },
  stepPoint: {
    position: "absolute",
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  thumb: {
    position: "absolute",
    left: 0,
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2.5,
    borderColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.25,
    shadowRadius: 2,
    elevation: 3,
  },
  labelsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    width: "100%",
    marginTop: 2,
  },
  labelButton: {
    flex: 1,
    paddingVertical: 6,
  },
  labelButtonLeft: {
    alignItems: "flex-start",
  },
  labelButtonCenter: {
    alignItems: "center",
  },
  labelButtonRight: {
    alignItems: "flex-end",
  },
  levelLabel: {
    fontFamily: "Geist_500Medium",
    fontSize: 11,
    color: "#737D87",
  },
  levelLabelActive: {
    fontFamily: "Geist_700Bold",
    color: "#008B5E",
  },
  textDisabled: {
    color: "#9CA3AF",
  },
  leveCaption: {
    fontFamily: "Geist_400Regular",
    fontSize: 10.5,
    color: "#B45309",
    marginTop: 6,
    lineHeight: 14,
  },
});
