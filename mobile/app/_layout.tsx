import React from "react";
import { Stack } from "expo-router";
import { AuthProvider } from "../context/AuthContext";
import { NotificacoesProvider } from "../context/NotificacoesContext";

export default function RootLayout() {
  return (
    <AuthProvider>
      <NotificacoesProvider>
      <Stack
        screenOptions={{
          headerShown: false,
          animation: "fade",
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="cadastro" options={{ headerShown: false }} />
        <Stack.Screen
          name="vincular-nutricionista"
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="selectIntolerancia"
          options={{ headerShown: false }}
        />
        <Stack.Screen name="home" options={{ headerShown: false }} />
        <Stack.Screen name="scanner" options={{ headerShown: false }} />
        <Stack.Screen name="resultado" options={{ headerShown: false }} />
        <Stack.Screen name="historico" options={{ headerShown: false }} />
        <Stack.Screen name="itensCurtidos" options={{ headerShown: false }} />
        <Stack.Screen name="perfil" options={{ headerShown: false }} />
        <Stack.Screen name="editar-perfil" options={{ headerShown: false }} />
        <Stack.Screen name="dados-pessoais" options={{ headerShown: false }} />
        <Stack.Screen name="alertas" options={{ headerShown: false }} />
        <Stack.Screen name="ajuda" options={{ headerShown: false }} />
        <Stack.Screen name="configuracoes" options={{ headerShown: false }} />
        <Stack.Screen name="notificacoes" options={{ headerShown: false }} />
      </Stack>
      </NotificacoesProvider>
    </AuthProvider>
  );
}
