import { useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useRouter, type Href } from "expo-router";

import { useTheme } from "@/hooks/use-theme";
import { useAuthStore } from "@/stores/auth.store";
import { homeTabForRole } from "@/shared/role-navigation";

const DEMO_ACCOUNTS = [
  { role: "Manager", email: "ytadvert+manager@gmail.com" },
  { role: "Admin", email: "ytadvert+admin@gmail.com" },
  { role: "Storekeeper", email: "ytadvert+storekeeper@gmail.com" },
  { role: "Receptionist", email: "ytadvert+receptionist@gmail.com" },
  { role: "Laser Operator", email: "ytadvert+laser@gmail.com" },
  { role: "CNC Operator", email: "ytadvert+cnc@gmail.com" },
];

export default function SignInScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const { colors } = theme;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showDemo, setShowDemo] = useState(false);

  async function onSubmit() {
    setError(null);
    setLoading(true);
    try {
      const result = await useAuthStore.getState().signIn(email, password);
      if (result.error) {
        setError(result.error);
        return;
      }
      const { role, isHydrated } = useAuthStore.getState();
      if (!role) {
        setError("No staff profile is linked to this account yet.");
        return;
      }
      if (isHydrated) router.replace(homeTabForRole(role) as Href);
    } finally {
      setLoading(false);
    }
  }

  function fillCredentials(accountEmail: string) {
    setEmail(accountEmail);
    setPassword("password123");
    setError(null);
  }

  const text = colors.text;
  const muted = colors.textMuted;
  const inputBg = colors.inputBg;
  const inputBorder = colors.inputBorder;
  const accent = colors.accent;

  return (
    <KeyboardAvoidingView
      style={[styles.flex, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView contentContainerStyle={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.body}>
          <Text style={[styles.brand, { color: text }]}>YT ADVERTISEMENT</Text>
          <Text style={[styles.subtitle, { color: muted }]}>Staff Operations · የሰራተኞች መግቢያ</Text>

          <Text style={[styles.label, { color: muted }]}>Email / ኢሜይል</Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
            placeholder="staff@ytadvert.com"
            placeholderTextColor={muted}
            style={[styles.input, { backgroundColor: inputBg, borderColor: inputBorder, color: text }]}
          />

          <Text style={[styles.label, { color: muted }]}>Password / የይለፍ ቃል</Text>
          <TextInput
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="password"
            placeholder="••••••••••"
            placeholderTextColor={muted}
            style={[styles.input, { backgroundColor: inputBg, borderColor: inputBorder, color: text }]}
          />

          {error ? (
            <View style={[styles.errorBox, { backgroundColor: colors.dangerMuted }]}>
              <Text style={[styles.errorText, { color: colors.danger }]}>{error}</Text>
            </View>
          ) : null}

          <Pressable
            onPress={() => void onSubmit()}
            disabled={loading}
            style={({ pressed }) => [styles.button, { backgroundColor: accent }, pressed && styles.pressed, loading && styles.disabled]}
          >
            {loading ? <ActivityIndicator color={colors.onPrimary} /> : <Text style={[styles.buttonText, { color: colors.onPrimary }]}>{loading ? "" : "Sign In"}</Text>}
          </Pressable>

          {__DEV__ ? (
            <View style={[styles.demoWrap, { borderTopColor: colors.divider }]}>
              <Pressable onPress={() => setShowDemo((s) => !s)}>
                <Text style={[styles.demoToggle, { color: accent }]}>Test Role Accounts (የሙከራ መለያዎች)</Text>
              </Pressable>
              {showDemo ? (
                <View style={styles.demoList}>
                  <Text style={[styles.demoHint, { color: muted }]}>
                    Default password: password123
                  </Text>
                  {DEMO_ACCOUNTS.map((acc) => (
                    <Pressable
                      key={acc.email}
                      onPress={() => fillCredentials(acc.email)}
                      style={({ pressed }) => [styles.demoRow, { borderColor: inputBorder }, pressed && styles.pressed]}
                    >
                      <Text style={[styles.demoRole, { color: text }]}>{acc.role}</Text>
                      <Text style={[styles.demoEmail, { color: muted }]}>{acc.email}</Text>
                    </Pressable>
                  ))}
                </View>
              ) : null}
            </View>
          ) : null}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flexGrow: 1, justifyContent: "center", padding: 24 },
  body: { width: "100%", maxWidth: 440, alignSelf: "center", gap: 10 },
  brand: { fontSize: 22, fontWeight: "800", letterSpacing: 2, textAlign: "center" },
  subtitle: { fontSize: 13, textAlign: "center", marginBottom: 24 },
  label: { fontSize: 12, fontWeight: "600", marginTop: 6 },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  errorBox: { borderRadius: 8, padding: 12, marginTop: 8 },
  errorText: { fontSize: 13 },
  button: { borderRadius: 8, paddingVertical: 14, alignItems: "center", marginTop: 14 },
  buttonText: { fontSize: 15, fontWeight: "700" },
  pressed: { opacity: 0.8 },
  disabled: { opacity: 0.5 },
  demoWrap: { marginTop: 28, borderTopWidth: 1, paddingTop: 16 },
  demoToggle: { fontSize: 13, fontWeight: "600", textAlign: "center" },
  demoList: { marginTop: 12, gap: 8 },
  demoHint: { fontSize: 12 },
  demoRow: { borderWidth: 1, borderRadius: 8, padding: 10, gap: 2 },
  demoRole: { fontSize: 13, fontWeight: "600" },
  demoEmail: { fontSize: 12 },
});