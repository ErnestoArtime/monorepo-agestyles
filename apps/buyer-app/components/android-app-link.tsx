import { Colors } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

const apkUrl = process.env.EXPO_PUBLIC_ANDROID_APK_URL?.trim();

export function AndroidAppLink() {
  if (Platform.OS !== 'web' || !apkUrl) return null;

  return (
    <View style={styles.container}>
      <View style={styles.message}>
        <Ionicons name="phone-portrait-outline" size={20} color={Colors.light.text} />
        <View style={styles.messageText}>
          <Text style={styles.label}>Lleva AgeStyles contigo</Text>
          <Text style={styles.caption}>APK de prueba para Android</Text>
        </View>
      </View>
      <Pressable
        accessibilityRole="link"
        accessibilityLabel="Descargar la aplicación AgeStyles para Android"
        onPress={() => void Linking.openURL(apkUrl)}
        style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}>
        <Text style={styles.buttonText}>Descargar app Android</Text>
        <Ionicons name="arrow-down-outline" size={16} color="#FFFFFF" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    minHeight: 68,
    marginHorizontal: 16,
    marginTop: 18,
    marginBottom: 8,
    padding: 12,
    backgroundColor: '#FFFFFF',
    borderColor: Colors.light.border,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  message: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  label: {
    color: Colors.light.text,
    fontSize: 13,
    fontWeight: '500',
  },
  messageText: {
    flexShrink: 1,
    gap: 2,
  },
  caption: {
    color: '#6F6F6B',
    fontSize: 11,
  },
  button: {
    minHeight: 42,
    paddingHorizontal: 14,
    backgroundColor: Colors.light.tint,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  buttonPressed: {
    opacity: 0.78,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
});
