import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useAction, useMutation, useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import {
  scheduleLocalNotification,
  cancelAllScheduledNotifications,
  getScheduledNotifications,
} from 'expo-push-easy/client';

export default function ScheduleScreen() {
  const [userId] = useState('demo-user');
  const [title, setTitle] = useState('Scheduled push');
  const [body, setBody] = useState('This was scheduled!');
  const [delayMin, setDelayMin] = useState('1');
  const [deepLink, setDeepLink] = useState('expo-push-easy://convex-example');
  const [loading, setLoading] = useState(false);

  const scheduleAction = useAction((api as any).scheduled.scheduleAction);
  const cancelAllUser = useMutation((api as any).scheduled.cancelForUser);
  const scheduledItems = useQuery((api as any).scheduled.getAllPending);
  const tokenCount = useQuery(api.pushTokens.getTokenCount);

  const handleScheduleServer = async () => {
    const mins = parseInt(delayMin, 10);
    if (!mins || mins < 1) { Alert.alert('Invalid', 'Enter delay in minutes (min 1)'); return; }
    setLoading(true);
    try {
      const result = await scheduleAction({ userId, title, body, deepLink, delayMinutes: mins });
      const at = new Date(result.scheduledFor).toLocaleTimeString();
      Alert.alert('Scheduled!', `Notification queued for ${at} (in ${mins} min)`);
    } catch (e) {
      Alert.alert('Error', String(e));
    } finally { setLoading(false); }
  };

  const handleScheduleLocal = async () => {
    const mins = parseInt(delayMin, 10);
    if (!mins || mins < 1) { Alert.alert('Invalid', 'Enter delay in seconds (min 1)'); return; }
    setLoading(true);
    try {
      const id = await scheduleLocalNotification({
        title,
        body,
        data: { source: 'schedule-screen', deepLink: deepLink || '' },
        trigger: { type: 'timeInterval', seconds: mins * 60, repeats: false },
      });
      Alert.alert('Scheduled!', `Local notification in ${mins} min (id: ${id.slice(0, 12)}...)`);
    } catch (e) {
      Alert.alert('Error', String(e));
    } finally { setLoading(false); }
  };

  const handleCancelAll = async () => {
    setLoading(true);
    try {
      await cancelAllScheduledNotifications();
      await cancelAllUser({ userId });
      Alert.alert('Cancelled', 'All scheduled notifications cancelled');
    } catch (e) {
      Alert.alert('Error', String(e));
    } finally { setLoading(false); }
  };

  return (
    <ScrollView contentContainerStyle={styles.screen}>
      <Text style={styles.title}>Scheduled Notifications</Text>
      <Text style={styles.subtitle}>Server-side (Convex) + device-side (expo-notifications)</Text>

      {tokenCount !== undefined && (
        <Text style={styles.info}>Registered tokens in DB: {tokenCount}</Text>
      )}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Notification Content</Text>
        <TextInput style={styles.input} placeholder="Title" value={title} onChangeText={setTitle} />
        <TextInput style={[styles.input, styles.bodyInput]} placeholder="Body" value={body} onChangeText={setBody} multiline />
        <TextInput style={styles.input} placeholder="Deep link" value={deepLink} onChangeText={setDeepLink} />
        <TextInput
          style={styles.input}
          placeholder="Delay (minutes)"
          value={delayMin}
          onChangeText={setDelayMin}
          keyboardType="number-pad"
        />
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Server-Side (Convex Scheduler)</Text>
        <Text style={styles.hint}>
          Stored in Convex DB, processed by Convex cron at the scheduled time.
          Works even if the app is closed.
        </Text>
        <Pressable
          onPress={handleScheduleServer}
          disabled={loading}
          style={({ pressed }) => [styles.btn, styles.btnPrimary, pressed && styles.btnPressed, loading && styles.btnDisabled]}
        >
          <Text style={styles.btnPrimaryText}>Schedule Server Push</Text>
        </Pressable>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Device-Side (Local Notification)</Text>
        <Text style={styles.hint}>
          Scheduled on-device via expo-notifications. Works offline, but reset on app reinstall.
        </Text>
        <Pressable
          onPress={handleScheduleLocal}
          disabled={loading}
          style={({ pressed }) => [styles.btn, styles.btnGhost, pressed && styles.btnPressed, loading && styles.btnDisabled]}
        >
          <Text style={styles.btnText}>Schedule Local Notification</Text>
        </Pressable>
      </View>

      {scheduledItems && scheduledItems.length > 0 && (
        <View style={styles.card}>
          <View style={styles.cardHead}>
            <Text style={styles.cardTitle}>Pending Server Schedules</Text>
            <Text style={styles.badge}>{scheduledItems.length}</Text>
          </View>
          {scheduledItems.slice(0, 5).map((item: any) => (
            <View key={item._id} style={styles.logRow}>
              <View style={[styles.dot, item.status === 'pending' ? styles.dotPending : item.status === 'cancelled' ? styles.dotCancelled : styles.dotFailed]} />
              <View style={styles.logCopy}>
                <Text style={styles.logLabel}>{item.title}</Text>
                <Text style={styles.logValue}>
                  {new Date(item.scheduledFor).toLocaleString()} — {item.status}
                  {item.error ? `: ${item.error}` : ''}
                </Text>
              </View>
            </View>
          ))}
        </View>
      )}

      <Pressable
        onPress={handleCancelAll}
        disabled={loading}
        style={({ pressed }) => [styles.btn, styles.btnDanger, pressed && styles.btnPressed]}
      >
        <Text style={styles.btnDangerText}>Cancel All Scheduled</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flexGrow: 1, backgroundColor: '#060B18', padding: 16, paddingTop: 64, gap: 12, paddingBottom: 32 },
  title: { color: '#F8FBFF', fontSize: 26, fontWeight: '800', letterSpacing: -0.6 },
  subtitle: { color: '#B4C2DE', fontSize: 14, lineHeight: 20 },
  info: { color: '#63D9FF', fontSize: 12, fontWeight: '600' },
  card: { borderRadius: 20, padding: 16, backgroundColor: 'rgba(12, 19, 37, 0.9)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', gap: 10 },
  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardTitle: { color: '#F8FBFF', fontSize: 16, fontWeight: '800' },
  hint: { color: '#60708E', fontSize: 12, lineHeight: 17 },
  input: { backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, color: '#F4F8FF', fontSize: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  bodyInput: { minHeight: 60, textAlignVertical: 'top' },
  btn: { minHeight: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14 },
  btnPrimary: { backgroundColor: '#63D9FF' },
  btnGhost: { backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  btnDanger: { backgroundColor: 'rgba(255,122,26,0.15)', borderWidth: 1, borderColor: 'rgba(255,122,26,0.3)' },
  btnText: { color: '#F4F8FF', fontSize: 13, fontWeight: '800' },
  btnPrimaryText: { color: '#07111F', fontSize: 13, fontWeight: '800' },
  btnDangerText: { color: '#FF7A1A', fontSize: 13, fontWeight: '800' },
  btnPressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
  btnDisabled: { opacity: 0.55 },
  badge: { backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, color: '#B4C2DE', fontSize: 12, fontWeight: '800' },
  logRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  dot: { width: 8, height: 8, borderRadius: 8, marginTop: 5 },
  dotPending: { backgroundColor: '#63D9FF' },
  dotCancelled: { backgroundColor: '#60708E' },
  dotFailed: { backgroundColor: '#FF7A1A' },
  logCopy: { flex: 1 },
  logLabel: { color: '#F4F8FF', fontSize: 13, fontWeight: '700' },
  logValue: { color: '#92A2C7', fontSize: 12, fontFamily: 'monospace', lineHeight: 17 },
});
