import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import * as Notifications from 'expo-notifications';
import { useMutation, useAction, useQuery } from 'convex/react';
import {
  requestPushPermissions,
  registerForPushNotifications,
  onTokenRefresh,
} from 'expo-push-easy/client';
import { api } from '@/convex/_generated/api';
import { setupNotificationHandler, setupNotificationChannel } from '@/lib/notifications';

setupNotificationHandler();

export default function HomeScreen() {
  const [token, setToken] = useState('');
  const [userId] = useState('demo-user');
  const [title, setTitle] = useState('Hello!');
  const [body, setBody] = useState('This is a test notification');
  const [loading, setLoading] = useState(false);

  const saveToken = useMutation(api.pushTokens.saveToken);
  const sendNotification = useAction((api as any).notify.sendNotificationToUser);
  const sendToAll = useAction((api as any).notify.sendToAll);
  const sendBatch = useAction((api as any).notify.sendBatch);
  const tokenCount = useQuery(api.pushTokens.getTokenCount);
  const allUserIds = useQuery(api.pushTokens.getAllUserIds);

  useEffect(() => {
    // Setup notification channel for Android
    setupNotificationChannel();
    
    const unsubscribe = onTokenRefresh((nextToken) => {
      setToken(nextToken.token);
      console.log('Token refreshed:', nextToken.token.slice(0, 30) + '...');
    });
    return unsubscribe;
  }, []);

  const handleSetup = async () => {
    setLoading(true);
    try {
      // Request permissions
      const permissionStatus = await requestPushPermissions();
      console.log('Permission:', permissionStatus);

      if (permissionStatus !== 'granted') {
        Alert.alert('Permission Denied', 'Push notifications require permission');
        return;
      }

      // For FCM tokens, use useDevicePushToken: true to get raw FCM registration tokens
      // This bypasses the need for projectId and works directly with Firebase
      const result = await registerForPushNotifications({ 
        useDevicePushToken: true  // This gets raw FCM tokens for Firebase
      });
      setToken(result.token);
      
      // Save token to Convex database
      await saveToken({ 
        userId, 
        token: result.token, 
        platform: result.type 
      });
      
      Alert.alert('Success!', `FCM token registered (${result.type})`);
      console.log('FCM Token registered:', result.token.slice(0, 30) + '...');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Setup failed';
      Alert.alert('Error', message);
      console.error('Setup error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSendToAll = async () => {
    if (!token) {
      Alert.alert('No Token', 'Register a push token first');
      return;
    }
    setLoading(true);
    try {
      const result = await sendToAll({ title, body, deepLink: 'expo-push-easy://convex-example' });
      if (result.ok) {
        Alert.alert('Sent!', `Notification sent to ${result.sent} device(s)`);
      } else {
        Alert.alert('Partial', result.error || 'Send completed with issues');
      }
    } catch (e) {
      Alert.alert('Error', String(e));
    } finally { setLoading(false); }
  };

  const handleSendTest = async () => {
    if (!token) {
      Alert.alert('No Token', 'Please setup push notifications first');
      return;
    }

    setLoading(true);
    try {
      // Use the Convex action to send notification (server-side)
      // This runs on Convex where crypto.subtle is available
      const result = await sendNotification({
        userId,
        title,
        body,
        deepLink: 'expo-push-easy://convex-example',
      });
      
      console.log('Full notification result:', JSON.stringify(result, null, 2));
      
      if (result.ok) {
        Alert.alert('Sent!', `Notification sent to ${result.sent} device(s). Check Convex logs for details.`);
        console.log('✅ Notification sent successfully via Convex');
        console.log('Results:', result.results);
      } else {
        Alert.alert('Failed', result.error || 'Unknown error');
        console.error('❌ Send failed:', result.error);
        console.error('Results:', result.results);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Send failed';
      Alert.alert('Error', message);
      console.error('❌ Send error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>FCM Push Notification Test</Text>
      <Text style={styles.subtitle}>expo-push-easy with FCM v1 + Convex example</Text>

      {/* Token Status */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>FCM Registration Token</Text>
        {token ? (
          <Text style={styles.tokenText} numberOfLines={2}>{token}</Text>
        ) : (
          <Text style={styles.noToken}>No FCM token registered yet</Text>
        )}
      </View>

      {/* Setup Button */}
      <Pressable
        onPress={handleSetup}
        disabled={loading}
        style={({ pressed }) => [
          styles.button, 
          styles.primaryButton, 
          pressed && styles.buttonPressed,
          loading && styles.buttonDisabled,
        ]}
      >
        <Text style={styles.primaryButtonText}>
          {token ? 'Re-register FCM Token' : 'Setup FCM Push Notifications'}
        </Text>
      </Pressable>

      {/* Message Inputs */}
      {token && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Test Notification</Text>
          <View style={styles.infoBox}>
            <Text style={styles.infoText}>
              ✓ Uses Convex server-side action to send notifications with crypto.subtle support
            </Text>
          </View>
          <TextInput
            style={styles.input}
            placeholder="Title"
            placeholderTextColor="#999"
            value={title}
            onChangeText={setTitle}
          />
          <TextInput
            style={[styles.input, styles.bodyInput]}
            placeholder="Body"
            placeholderTextColor="#999"
            value={body}
            onChangeText={setBody}
            multiline
          />
          <Pressable
            onPress={handleSendTest}
            disabled={loading}
            style={({ pressed }) => [
              styles.button, 
              styles.secondaryButton, 
              pressed && styles.buttonPressed,
              loading && styles.buttonDisabled,
            ]}
          >
            <Text style={styles.secondaryButtonText}>Send Test Notification</Text>
          </Pressable>
        </View>
      )}

      {/* Batch Send */}
      {token && (
        <View style={styles.card}>
          <View style={styles.cardHead}>
            <Text style={styles.cardTitle}>Batch Send</Text>
            <Text style={styles.infoChip}>
              {tokenCount !== undefined ? `${tokenCount} token(s)` : '...'}
            </Text>
          </View>
          <Pressable
            onPress={handleSendTest}
            disabled={loading}
            style={({ pressed }) => [
              styles.button, 
              styles.secondaryButton, 
              pressed && styles.buttonPressed,
              loading && styles.buttonDisabled,
            ]}
          >
            <Text style={styles.secondaryButtonText}>Send to Me</Text>
          </Pressable>
          {allUserIds && allUserIds.length > 1 && (
            <Pressable
              onPress={handleSendToAll}
              disabled={loading}
              style={({ pressed }) => [
                styles.button, 
                styles.tertiaryButton, 
                pressed && styles.buttonPressed,
                loading && styles.buttonDisabled,
              ]}
            >
              <Text style={styles.tertiaryButtonText}>
                Send to All ({allUserIds.length} user(s))
              </Text>
            </Pressable>
          )}
        </View>
      )}

      <Text style={styles.hint}>
        Uses Convex server-side actions for secure JWT signing with crypto.subtle
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: '#0a0a0a',
    padding: 20,
    paddingTop: 60,
    gap: 16,
  },
  title: {
    color: '#ffffff',
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 4,
  },
  subtitle: {
    color: '#888',
    fontSize: 14,
    marginBottom: 20,
  },
  card: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#333',
    gap: 12,
  },
  cardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  infoChip: {
    color: '#4ade80',
    fontSize: 12,
    fontWeight: '600',
  },
  cardTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  tokenText: {
    color: '#4ade80',
    fontSize: 12,
    fontFamily: 'monospace',
  },
  noToken: {
    color: '#666',
    fontSize: 13,
    fontStyle: 'italic',
  },
  button: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 10,
    alignItems: 'center',
  },
  primaryButton: {
    backgroundColor: '#3b82f6',
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    backgroundColor: '#10b981',
  },
  secondaryButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
  },
  tertiaryButton: {
    backgroundColor: '#8b5cf6',
  },
  tertiaryButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
  },
  buttonPressed: {
    opacity: 0.8,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  input: {
    backgroundColor: '#0a0a0a',
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#ffffff',
    fontSize: 14,
  },
  bodyInput: {
    minHeight: 60,
    textAlignVertical: 'top',
  },
  hint: {
    color: '#555',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 8,
  },
  infoBox: {
    backgroundColor: '#2d1b69',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  infoText: {
    color: '#a78bfa',
    fontSize: 12,
    lineHeight: 16,
  },
});
