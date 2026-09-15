import { useMutation, useQuery } from 'convex/react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { api } from '@/convex/_generated/api';

export default function HistoryScreen() {
  const [userId] = useState('demo-user');
  const history = useQuery((api as any).history.getHistory, { userId, limit: 50 });
  const clearHistory = useMutation((api as any).history.clearHistory);

  return (
    <ScrollView contentContainerStyle={styles.screen}>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.title}>Notification History</Text>
          <Text style={styles.subtitle}>
            {history !== undefined ? `${history.length} recent sends` : 'Loading...'}
          </Text>
        </View>
        {history && history.length > 0 && (
          <Pressable
            onPress={() => clearHistory({ userId })}
            style={({ pressed }) => [styles.clearBtn, pressed && { opacity: 0.7 }]}
          >
            <Text style={styles.clearBtnText}>Clear</Text>
          </Pressable>
        )}
      </View>

      {history && history.length === 0 && (
        <View style={styles.card}>
          <Text style={styles.emptyText}>No notification history yet.{'\n'}Send a notification to see it here.</Text>
        </View>
      )}

      {history?.map((entry: any) => (
        <View key={entry._id} style={styles.card}>
          <View style={styles.cardHead}>
            <Text style={styles.cardTitle}>{entry.title}</Text>
            <View style={[styles.statusBadge, entry.success ? styles.statusSuccess : styles.statusFailed]}>
              <Text style={[styles.statusText, entry.success ? styles.statusTextSuccess : styles.statusTextFailed]}>
                {entry.success ? 'Sent' : 'Failed'}
              </Text>
            </View>
          </View>
          <Text style={styles.bodyText}>{entry.body}</Text>
          <View style={styles.metaRow}>
            <Text style={styles.metaText}>Provider: {entry.provider}</Text>
            <Text style={styles.metaText}>{new Date(entry.sentAt).toLocaleString()}</Text>
          </View>
          {entry.error && <Text style={styles.errorText}>{entry.error}</Text>}
          {entry.deepLink && <Text style={styles.metaText}>Deep link: {entry.deepLink}</Text>}
        </View>
      ))}

      <View style={{ height: 24 }} />
    </ScrollView>
  );
}

import { useState } from 'react';

const styles = StyleSheet.create({
  screen: { flexGrow: 1, backgroundColor: '#060B18', padding: 16, paddingTop: 64, gap: 10, paddingBottom: 32 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 },
  title: { color: '#F8FBFF', fontSize: 26, fontWeight: '800', letterSpacing: -0.6 },
  subtitle: { color: '#B4C2DE', fontSize: 14, lineHeight: 20 },
  clearBtn: { backgroundColor: 'rgba(255,122,26,0.15)', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: 'rgba(255,122,26,0.3)' },
  clearBtnText: { color: '#FF7A1A', fontSize: 13, fontWeight: '800' },
  card: { borderRadius: 16, padding: 14, backgroundColor: 'rgba(12, 19, 37, 0.9)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', gap: 6 },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle: { color: '#F8FBFF', fontSize: 15, fontWeight: '800', flex: 1 },
  bodyText: { color: '#B4C2DE', fontSize: 13, lineHeight: 18 },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 },
  metaText: { color: '#60708E', fontSize: 11, fontFamily: 'monospace' },
  errorText: { color: '#FF7A1A', fontSize: 11, fontFamily: 'monospace' },
  emptyText: { color: '#60708E', fontSize: 14, textAlign: 'center', lineHeight: 22, paddingVertical: 20 },
  statusBadge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3, marginLeft: 8 },
  statusSuccess: { backgroundColor: 'rgba(3, 196, 120, 0.15)' },
  statusFailed: { backgroundColor: 'rgba(255, 122, 26, 0.15)' },
  statusText: { fontSize: 11, fontWeight: '800' },
  statusTextSuccess: { color: '#03C478' },
  statusTextFailed: { color: '#FF7A1A' },
});
