import React, { useState } from "react";
import { View, Text, TextInput, Pressable, ScrollView, KeyboardAvoidingView, Platform, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Defs, Pattern, Rect, Line, RadialGradient, Stop } from "react-native-svg";
import { useFonts } from "expo-font";
import {
  Fredoka_500Medium,
  Fredoka_600SemiBold,
  Fredoka_700Bold,
} from "@expo-google-fonts/fredoka";
import {
  JetBrainsMono_400Regular,
  JetBrainsMono_500Medium,
  JetBrainsMono_700Bold,
} from "@expo-google-fonts/jetbrains-mono";
import {
  NotoSerif_400Regular,
  NotoSerif_400Regular_Italic,
} from "@expo-google-fonts/noto-serif";

import { F } from "@/lib/fonts";
import { colors } from "@/lib/theme";

// LAYER 2 — radial glow at top-right of brand panel
function RadialGlow() {
  return (
    <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
      <Defs>
        <RadialGradient id="glow" cx="80%" cy="20%" r="40%">
          <Stop offset="0%" stopColor="#f4ede0" stopOpacity={0.12} />
          <Stop offset="100%" stopColor="#f4ede0" stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Rect width="100%" height="100%" fill="url(#glow)" />
    </Svg>
  );
}

// LAYER 3 — diagonal hatch, 45°, 32px spacing, 4% alpha cream
function HatchOverlay() {
  return (
    <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
      <Defs>
        <Pattern id="hatch" patternUnits="userSpaceOnUse" width={32} height={32} patternTransform="rotate(45)">
          <Line x1={0} y1={0} x2={0} y2={32} stroke="rgba(244,237,224,0.04)" strokeWidth={2} />
        </Pattern>
      </Defs>
      <Rect width="100%" height="100%" fill="url(#hatch)" />
    </Svg>
  );
}

function Field({
  label,
  value,
  onChangeText,
  secureTextEntry = false,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  secureTextEntry?: boolean;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={{ marginBottom: 16 }}>
      <Text
        style={{
          fontFamily: "JetBrainsMono_500Medium",
          fontSize: 11,
          letterSpacing: 1.65,
          color: colors.inkMuted,
          marginBottom: 8,
        }}
      >
        {label}
      </Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        secureTextEntry={secureTextEntry}
        autoCapitalize="none"
        autoCorrect={false}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          width: "100%",
          paddingVertical: 14,
          paddingHorizontal: 18,
          borderWidth: 1.5,
          borderColor: focused ? colors.accent : colors.lineStrong,
          borderRadius: 4,
          fontFamily: F.text,
          fontSize: 20,
          color: colors.ink,
        }}
      />
    </View>
  );
}

export default function LoginScreen({
  onSubmit,
  error,
  busy,
  apiBaseUrl,
}: {
  onSubmit?: (creds: { username: string; pin: string }) => void;
  error?: string | null;
  busy?: boolean;
  apiBaseUrl?: string;
}) {
  const [fontsLoaded] = useFonts({
    Fredoka_500Medium,
    Fredoka_600SemiBold,
    Fredoka_700Bold,
    NotoSerif_400Regular,
    NotoSerif_400Regular_Italic,
    JetBrainsMono_400Regular,
    JetBrainsMono_500Medium,
    JetBrainsMono_700Bold,
  });

  const [username, setUsername] = useState("maria.s");
  const [pin, setPin] = useState("");

  if (!fontsLoaded) return null;

  const wordmarkVariation = [
    { axis: "opsz", value: 144 },
    { axis: "SOFT", value: 30 },
    { axis: "WONK", value: 1 },
    { axis: "wght", value: 400 },
  ];

  const wonkItalicVariation = [
    { axis: "opsz", value: 96 },
    { axis: "SOFT", value: 50 },
    { axis: "WONK", value: 1 },
    { axis: "wght", value: 400 },
  ];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.paper }}>
      <View style={{ flex: 1, flexDirection: "row" }}>
        {/* LEFT — Brand panel (red, ~52%) */}
        <View style={{ flex: 1.1, position: "relative", overflow: "hidden" }}>
          {/* LAYER 1 — main gradient (160deg approx) */}
          <LinearGradient
            colors={[colors.accent, colors.accentDeep, colors.accentDark]}
            locations={[0, 0.5, 1]}
            start={{ x: 0.1, y: 0 }}
            end={{ x: 0.9, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <RadialGlow />
          <HatchOverlay />

          <View style={{ flex: 1, padding: 56, justifyContent: "space-between", zIndex: 1 }}>
            <View>
              <Text
                style={{
                  fontFamily: "JetBrainsMono_400Regular",
                  fontSize: 13,
                  letterSpacing: 3.9,
                  color: colors.paper,
                  opacity: 0.7,
                }}
              >
                EST. 2026 — MANILA
              </Text>
              <Text
                style={{
                  fontFamily: F.headingBold,
                  fontSize: 52,
                  color: colors.paper,
                  lineHeight: 52 * 1.05,
                  letterSpacing: -0.8,
                  marginTop: 12,
                }}
              >
                Popcraft
              </Text>
            </View>

            <Text
              style={{
                fontFamily: F.text,
                fontSize: 16,
                lineHeight: 24,
                color: colors.paper,
                opacity: 0.85,
                maxWidth: 280,
              }}
            >
              A concept space for arts and collectibles. Every piece, hand-picked. Every sale, a story.
            </Text>

            <View
              style={{
                borderTopWidth: 1,
                borderTopColor: "rgba(244, 237, 224, 0.25)",
                paddingTop: 24,
                flexDirection: "row",
                justifyContent: "space-between",
              }}
            >
              <Text style={{ fontFamily: "JetBrainsMono_400Regular", fontSize: 11, letterSpacing: 1.65, color: colors.paper, opacity: 0.65 }}>
                POS / TERMINAL 01
              </Text>
              <Text style={{ fontFamily: "JetBrainsMono_400Regular", fontSize: 11, letterSpacing: 1.65, color: colors.paper, opacity: 0.65 }}>
                v0.1.0
              </Text>
            </View>
          </View>
        </View>

        {/* RIGHT — Form panel (cream, ~48%) */}
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={{ flex: 1 }}
        >
          <ScrollView
            contentContainerStyle={{
              flexGrow: 1,
              paddingHorizontal: 72,
              paddingVertical: 32,
              justifyContent: "center",
            }}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            showsVerticalScrollIndicator={false}
            automaticallyAdjustKeyboardInsets
          >
          <Text
            style={{
              fontFamily: "JetBrainsMono_500Medium",
              fontSize: 14,
              letterSpacing: 2.8,
              color: colors.inkMuted,
              marginBottom: 12,
            }}
          >
            SIGN IN
          </Text>

          <Text
            style={{
              fontSize: 36,
              color: colors.ink,
              lineHeight: 36 * 1.15,
              letterSpacing: -0.7,
              marginBottom: 20,
              fontFamily: F.heading,
            }}
          >
            Welcome back,{" "}
            <Text
              style={{
                color: colors.accent,
                fontFamily: F.headingSemibold,
              }}
            >
              cashier
            </Text>
            .
          </Text>

          <Field label="USERNAME" value={username} onChangeText={setUsername} />
          <Field label="PIN / PASSWORD" value={pin} onChangeText={setPin} secureTextEntry />

          {error ? (
            <Text
              style={{
                marginTop: 4,
                marginBottom: 4,
                fontFamily: "JetBrainsMono_500Medium",
                fontSize: 12,
                letterSpacing: 1.2,
                color: colors.accentDeep,
              }}
              numberOfLines={3}
            >
              ✕ {error}
            </Text>
          ) : null}

          <Pressable
            onPress={() => onSubmit?.({ username, pin })}
            disabled={busy}
            android_ripple={{ color: colors.accent }}
            style={{
              alignSelf: "stretch",
              minHeight: 56,
              paddingVertical: 18,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: colors.ink,
              borderRadius: 4,
              marginTop: 16,
              opacity: busy ? 0.55 : 1,
            }}
          >
            <Text
              style={{
                fontFamily: "JetBrainsMono_500Medium",
                fontSize: 13,
                letterSpacing: 2.6,
                color: colors.paper,
                textAlign: "center",
                textTransform: "uppercase",
              }}
            >
              {busy ? "Signing in…" : "Login"}
            </Text>
          </Pressable>

          {apiBaseUrl ? (
            <Text
              style={{
                marginTop: 18,
                fontFamily: "JetBrainsMono_400Regular",
                fontSize: 10,
                letterSpacing: 0.8,
                color: colors.inkFaint,
                textAlign: "center",
              }}
              numberOfLines={1}
            >
              {apiBaseUrl}
            </Text>
          ) : null}
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </SafeAreaView>
  );
}
