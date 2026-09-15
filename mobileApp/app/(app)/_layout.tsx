import { Ionicons } from "@expo/vector-icons";
import { Redirect, Tabs, type Href } from "expo-router";
import { ActivityIndicator, View } from "react-native";

import { useTheme } from "@/hooks/use-theme";
import { useProfile } from "@/hooks/useProfile";
import { ROLE_TABS, resolveTabRoute } from "@/shared/role-navigation";
import type { TabConfig } from "@/shared/role-navigation";

const TAB_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  home: "home",
  receipt: "receipt",
  box: "cube",
  wrench: "construct",
  settings: "settings",
  inbox: "mail",
  clipboard: "clipboard",
  balance: "scale",
  card: "card",
  pen: "create",
  gauge: "speedometer",
};

function LoadingScreen() {
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
      <ActivityIndicator size="large" />
    </View>
  );
}

export default function AppLayout() {
  const { theme } = useTheme();
  const { isHydrated, isAuthenticated, role } = useProfile();

  if (!isHydrated) return <LoadingScreen />;
  if (!isAuthenticated || !role) return <Redirect href="/sign-in" />;

  const roleTabs = ROLE_TABS[role];

  const primaryTab = roleTabs.tabs.find((tab) => tab.key === roleTabs.primary) ?? roleTabs.tabs[0];

  return (
    <Tabs
      initialRouteName={primaryTab.route}
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.colors.tabIconSelected,
        tabBarInactiveTintColor: theme.colors.tabIconDefault,
      }}
    >
      {roleTabs.tabs.map((tab: TabConfig) => (
        <Tabs.Screen
          key={tab.key}
          name={tab.route}
          options={{
            title: tab.title,
            href: resolveTabRoute(role, tab) as Href,
            tabBarIcon: ({ color, size }) => (
              <Ionicons name={TAB_ICONS[tab.icon] ?? "ellipse"} size={size} color={color} />
            ),
          }}
        />
      ))}
    </Tabs>
  );
}