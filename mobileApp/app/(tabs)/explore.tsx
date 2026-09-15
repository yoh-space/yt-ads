import { ScrollView, StyleSheet, Text, View } from 'react-native';

const capabilities = [
  {
    category: 'Send',
    icon: '↗',
    items: [
      { name: 'send', desc: 'Auto-detect token type & route to Expo Push or FCM' },
      { name: 'sendBatch', desc: 'Send multiple notifications in parallel' },
      { name: 'sendToAll', desc: 'Broadcast to every registered token in DB' },
      { name: 'sendExpoPush', desc: 'Send directly to Expo Push API' },
      { name: 'sendFcm', desc: 'Send directly to FCM v1 API' },
      { name: 'detectTokenType', desc: 'Identify token as Expo Push or FCM' },
    ],
  },
  {
    category: 'Client',
    icon: '📱',
    items: [
      { name: 'registerForPushNotifications', desc: 'Get Expo or device push token' },
      { name: 'getPushPermissionStatus', desc: 'Check current notification permission' },
      { name: 'requestPushPermissions', desc: 'Request notification permission' },
      { name: 'onTokenRefresh', desc: 'Subscribe to push token refresh events' },
    ],
  },
  {
    category: 'Local Scheduling',
    icon: '⏰',
    items: [
      { name: 'scheduleLocalNotification', desc: 'Schedule with timeInterval / daily / weekly / calendar triggers' },
      { name: 'cancelScheduledNotification', desc: 'Cancel a specific scheduled notification' },
      { name: 'cancelAllScheduledNotifications', desc: 'Cancel every pending notification' },
      { name: 'getScheduledNotifications', desc: 'List all scheduled notifications' },
    ],
  },
  {
    category: 'Payload',
    icon: '📦',
    items: [
      { name: 'PushPayload', desc: 'title · body · subtitle · image · sound · badge · data · deepLink' },
      { name: 'Android config', desc: 'channelId · priority · color · tag · sticky · ttl · icon · visibility' },
      { name: 'APNs config', desc: 'badge · sound · contentAvailable · mutableContent · interruptionLevel · threadId' },
      { name: 'Web config', desc: 'icon · image · actions · badge · requireInteraction · tag · link' },
    ],
  },
  {
    category: 'Token Adapters',
    icon: '🔌',
    items: [
      { name: 'Convex', desc: 'convexTokenHelpers — saveToken getTokensForUser removeToken updateToken' },
      { name: 'Supabase', desc: 'createSupabaseTokenStore — TokenStore interface with RLS policies' },
      { name: 'Firebase', desc: 'createFirebaseTokenStore — Firestore-based token persistence' },
    ],
  },
  {
    category: 'Server Scheduling',
    icon: '⏳',
    items: [
      { name: 'Convex scheduler', desc: 'Cron-based delayed push via Convex internalMutation' },
      { name: 'Schedule + cancel', desc: 'Schedule push for any user, cancel pending' },
      { name: 'Bulk schedule', desc: 'Schedule the same push for multiple users' },
    ],
  },
  {
    category: 'FCM Auth',
    icon: '🔐',
    items: [
      { name: 'getFcmAccessToken', desc: 'Generate OAuth2 access token from service account' },
      { name: 'clearFcmTokenCache', desc: 'Clear cached FCM access tokens' },
      { name: 'getFcmTokenCacheSize', desc: 'Check number of cached tokens' },
    ],
  },
  {
    category: 'Notification History',
    icon: '📋',
    items: [
      { name: 'history.save', desc: 'Log every sent notification to Convex DB' },
      { name: 'history.getHistory', desc: 'View sent notifications per user' },
      { name: 'history.getAllHistory', desc: 'View all sent notifications' },
      { name: 'history.clearHistory', desc: 'Clear history for a user or all' },
    ],
  },
  {
    category: 'Push Tokens',
    icon: '🔑',
    items: [
      { name: 'getAllTokens', desc: 'List every registered push token' },
      { name: 'getAllUserIds', desc: 'Get unique user IDs with tokens' },
      { name: 'getTokenCount', desc: 'Count total registered tokens' },
    ],
  },
];

export default function CapabilitiesScreen() {
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.scrollContent}>
      <View style={styles.backdropTop} />
      <View style={styles.backdropBottom} />

      <Text style={styles.kicker}>expo-push-easy</Text>
      <Text style={styles.title}>Every API, at a glance.</Text>
      <Text style={styles.subtitle}>
        All library capabilities grouped by concern — send, client, scheduling, payload, adapters, auth, history, and tokens.
      </Text>

      <View style={styles.cardStack}>
        {capabilities.map((group) => (
          <View key={group.category} style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardIcon}>{group.icon}</Text>
              <Text style={styles.cardCategory}>{group.category}</Text>
            </View>
            {group.items.map((item) => (
              <View key={item.name} style={styles.itemRow}>
                <Text style={styles.itemDot}>•</Text>
                <View style={styles.itemContent}>
                  <Text style={styles.itemName}>{item.name}</Text>
                  <Text style={styles.itemDesc}>{item.desc}</Text>
                </View>
              </View>
            ))}
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#060B18',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 64,
    paddingBottom: 40,
  },
  backdropTop: {
    position: 'absolute',
    top: 36,
    right: -70,
    width: 180,
    height: 180,
    borderRadius: 180,
    backgroundColor: 'rgba(99, 217, 255, 0.11)',
  },
  backdropBottom: {
    position: 'absolute',
    bottom: 40,
    left: -60,
    width: 180,
    height: 180,
    borderRadius: 180,
    backgroundColor: 'rgba(255, 122, 26, 0.08)',
  },
  kicker: {
    color: '#63D9FF',
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1.8,
    marginBottom: 8,
  },
  title: {
    color: '#F8FBFF',
    fontSize: 26,
    lineHeight: 32,
    fontWeight: '800',
    letterSpacing: -0.7,
    marginBottom: 10,
  },
  subtitle: {
    color: '#B4C2DE',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
  },
  cardStack: {
    gap: 12,
    paddingBottom: 24,
  },
  card: {
    borderRadius: 20,
    padding: 16,
    backgroundColor: 'rgba(12, 19, 37, 0.9)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    gap: 8,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  cardIcon: {
    fontSize: 16,
  },
  cardCategory: {
    color: '#63D9FF',
    fontSize: 15,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
  },
  itemDot: {
    color: '#60708E',
    fontSize: 13,
    lineHeight: 20,
    width: 10,
  },
  itemContent: {
    flex: 1,
  },
  itemName: {
    color: '#F4F8FF',
    fontSize: 13,
    fontWeight: '700',
    fontFamily: 'monospace',
  },
  itemDesc: {
    color: '#92A2C7',
    fontSize: 12,
    lineHeight: 17,
    marginTop: 1,
  },
});
