import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { StatusBar } from 'expo-status-bar';

export default function App() {
  const [message, setMessage] = React.useState('Welcome to TasteTrails!');

  return (
    <View style={styles.container}>
      <StatusBar style="auto" />
      
      <View style={styles.header}>
        <Text style={styles.logo}>🍽️ TasteTrails</Text>
        <Text style={styles.subtitle}>Mobile App Preview</Text>
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>✅ App is Running!</Text>
          <Text style={styles.cardText}>
            Your mobile app is successfully configured and running on Expo.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>📱 What's Working</Text>
          <Text style={styles.cardText}>• Expo configuration loaded</Text>
          <Text style={styles.cardText}>• React Native rendering</Text>
          <Text style={styles.cardText}>• Metro bundler active</Text>
          <Text style={styles.cardText}>• QR code generated</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>⚠️ Next Steps</Text>
          <Text style={styles.cardText}>
            Your web components need to be converted to React Native.
            This is a starter screen to verify the app works.
          </Text>
        </View>

        <TouchableOpacity 
          style={styles.button}
          onPress={() => setMessage('Button works! 🎉')}
        >
          <Text style={styles.buttonText}>Test Button</Text>
        </TouchableOpacity>

        <Text style={styles.message}>{message}</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#fff',
    paddingTop: 50,
    paddingBottom: 20,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  logo: {
    fontSize: 32,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333',
  },
  cardText: {
    fontSize: 16,
    color: '#666',
    marginBottom: 5,
    lineHeight: 24,
  },
  button: {
    backgroundColor: '#007AFF',
    borderRadius: 12,
    padding: 15,
    marginTop: 10,
    marginBottom: 20,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  message: {
    fontSize: 18,
    textAlign: 'center',
    color: '#007AFF',
    marginBottom: 30,
    fontWeight: '500',
  },
});
