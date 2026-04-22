import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  TextInput,
} from 'react-native';

interface BodyTrackingScreenProps {
  userId: string;
  onBack: () => void;
}

export const BodyTrackingScreen: React.FC<BodyTrackingScreenProps> = ({ userId, onBack }) => {
  const [selectedTab, setSelectedTab] = useState<'weight' | 'measurements' | 'photos'>('weight');
  const [newWeight, setNewWeight] = useState('');

  const weightHistory = [
    { date: 'Today', weight: 185, change: '-2 lbs' },
    { date: 'Yesterday', weight: 187, change: '-1 lb' },
    { date: '2 days ago', weight: 188, change: '+0.5 lbs' },
    { date: '1 week ago', weight: 192, change: '-7 lbs' },
  ];

  const measurements = [
    { name: 'Chest', value: 40, unit: 'in', change: '+0.5 in' },
    { name: 'Waist', value: 32, unit: 'in', change: '-1 in' },
    { name: 'Arms', value: 14.5, unit: 'in', change: '+0.25 in' },
    { name: 'Thighs', value: 24, unit: 'in', change: '+0.75 in' },
  ];

  const photos = [
    { id: 1, date: 'Today', type: 'Front' },
    { id: 2, date: '1 week ago', type: 'Front' },
    { id: 3, date: '1 month ago', type: 'Front' },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack}>
          <Text style={styles.backButton}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Body Tracking</Text>
        <View style={{ width: 50 }} />
      </View>

      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, selectedTab === 'weight' && styles.activeTab]}
          onPress={() => setSelectedTab('weight')}
        >
          <Text style={[styles.tabText, selectedTab === 'weight' && styles.activeTabText]}>
            Weight
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, selectedTab === 'measurements' && styles.activeTab]}
          onPress={() => setSelectedTab('measurements')}
        >
          <Text style={[styles.tabText, selectedTab === 'measurements' && styles.activeTabText]}>
            Measurements
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, selectedTab === 'photos' && styles.activeTab]}
          onPress={() => setSelectedTab('photos')}
        >
          <Text style={[styles.tabText, selectedTab === 'photos' && styles.activeTabText]}>
            Photos
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        {selectedTab === 'weight' && (
          <View>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Log Weight</Text>
              <View style={styles.inputRow}>
                <TextInput
                  style={styles.input}
                  placeholder="Weight (lbs)"
                  placeholderTextColor="#666"
                  value={newWeight}
                  onChangeText={setNewWeight}
                  keyboardType="decimal-pad"
                />
                <TouchableOpacity style={styles.addButton}>
                  <Text style={styles.addButtonText}>Add</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Weight History</Text>
              {weightHistory.map((entry, index) => (
                <View key={index} style={styles.historyCard}>
                  <View>
                    <Text style={styles.historyDate}>{entry.date}</Text>
                    <Text style={styles.historyValue}>{entry.weight} lbs</Text>
                  </View>
                  <Text style={styles.historyChange}>{entry.change}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {selectedTab === 'measurements' && (
          <View>
            <Text style={styles.sectionTitle}>Body Measurements</Text>
            {measurements.map((m, index) => (
              <View key={index} style={styles.measurementCard}>
                <View style={styles.measurementInfo}>
                  <Text style={styles.measurementName}>{m.name}</Text>
                  <Text style={styles.measurementValue}>
                    {m.value} {m.unit}
                  </Text>
                </View>
                <Text style={styles.measurementChange}>{m.change}</Text>
              </View>
            ))}
          </View>
        )}

        {selectedTab === 'photos' && (
          <View>
            <Text style={styles.sectionTitle}>Progress Photos</Text>
            <TouchableOpacity style={styles.uploadButton}>
              <Text style={styles.uploadIcon}>📸</Text>
              <Text style={styles.uploadText}>Upload Photo</Text>
            </TouchableOpacity>

            {photos.map((photo) => (
              <View key={photo.id} style={styles.photoCard}>
                <View style={styles.photoPlaceholder}>
                  <Text style={styles.photoIcon}>📷</Text>
                </View>
                <View style={styles.photoInfo}>
                  <Text style={styles.photoDate}>{photo.date}</Text>
                  <Text style={styles.photoType}>{photo.type} View</Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  backButton: {
    color: '#00ff00',
    fontSize: 18,
    fontWeight: '600',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  tabs: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: '#00ff00',
  },
  tabText: {
    fontSize: 12,
    color: '#888',
    fontWeight: '500',
  },
  activeTabText: {
    color: '#00ff00',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 12,
  },
  inputRow: {
    flexDirection: 'row',
    gap: 8,
  },
  input: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#fff',
    fontSize: 14,
  },
  addButton: {
    backgroundColor: '#00ff00',
    borderRadius: 8,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  addButtonText: {
    color: '#000',
    fontWeight: '600',
  },
  historyCard: {
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  historyDate: {
    fontSize: 12,
    color: '#888',
    marginBottom: 2,
  },
  historyValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  historyChange: {
    fontSize: 12,
    color: '#00ff00',
    fontWeight: '600',
  },
  measurementCard: {
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  measurementInfo: {
    flex: 1,
  },
  measurementName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 2,
  },
  measurementValue: {
    fontSize: 12,
    color: '#888',
  },
  measurementChange: {
    fontSize: 12,
    color: '#00ff00',
    fontWeight: '600',
  },
  uploadButton: {
    backgroundColor: '#1a3a1a',
    borderWidth: 1,
    borderColor: '#00ff00',
    borderRadius: 8,
    paddingVertical: 24,
    alignItems: 'center',
    marginBottom: 16,
  },
  uploadIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  uploadText: {
    color: '#00ff00',
    fontSize: 14,
    fontWeight: '600',
  },
  photoCard: {
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  photoPlaceholder: {
    width: 60,
    height: 60,
    backgroundColor: '#2a2a2a',
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  photoIcon: {
    fontSize: 24,
  },
  photoInfo: {
    flex: 1,
  },
  photoDate: {
    fontSize: 12,
    color: '#888',
    marginBottom: 2,
  },
  photoType: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
});
