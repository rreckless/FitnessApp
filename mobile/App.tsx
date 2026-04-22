import { View, Text, StyleSheet } from 'react-native';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
  },
  text: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 20,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
  },
});

export default function App() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>FitQuest</Text>
      <Text style={styles.subtitle}>Gamified Fitness App</Text>
    </View>
  );
}
