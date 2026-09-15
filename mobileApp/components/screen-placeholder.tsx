import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTheme } from "@/hooks/use-theme";
import { useProfile } from "@/hooks/useProfile";
import { roleLabels } from "@shared-lib/operations-types";

export function ScreenPlaceholder({ title, hint }: { title: string; hint?: string }) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { role } = useProfile();
  const { colors } = theme;

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top + theme.spacing.lg }]}>
      <Text style={{ color: colors.text, fontSize: theme.fontSizes.xxl, fontWeight: theme.fontWeights.heavy }}>{title}</Text>
      <Text style={[styles.subtitle, { color: colors.textMuted }]}>
        {role ? roleLabels[role]?.en : ""} workspace
      </Text>
      <View style={[styles.card, { borderColor: colors.border }]}>
        <Text style={[styles.hint, { color: colors.accent }]}>
          {hint ?? "Screen scaffolded — live module wiring follows."}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 20 },
  subtitle: { fontSize: 13, marginTop: 4, marginBottom: 20 },
  card: { borderWidth: 1, borderRadius: 12, padding: 16 },
  hint: { fontSize: 13, lineHeight: 19 },
});