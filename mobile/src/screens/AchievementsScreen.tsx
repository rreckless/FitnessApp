import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
} from 'react-native';

interface AchievementsScreenProps {
  userId: string;
  onBack: () => void;
}

export const AchievementsScreen: React.FC<AchievementsScreenProps> = ({ userId, onBack }) => {
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'strength' | 'consistency' | 'social'>('all');

  const achievements = [
    { id: 1, name: 'First Workout', icon: '🏋️', rarity: 'Common', xp: 25, unlocked: true, category: 'strength' },
    { id: 2, name: 'Week Warrior', icon: '📅', rarity: 'Rare', xp: 50, unlocked: true, category: 'consistency' },
    { id: 3, name: 'Century Club', icon: '💯', rarity: 'Epic', xp: 100, unlocked: false, category: 'strength' },
    { id: 4, name: 'Social Butterfly', icon: '🦋', rarity: 'Rare', xp: 50, unlocked: false, category: 'social' },
    { id: 5, name: 'Legendary', icon: '👑', rarity: 'Legendary', xp: 250, unlocked: false, category: 'strength' },
    { id: 6, name: '100 Day Streak', icon: '🔥', rarity: 'Legendary', xp: 250, unlocked: false, category: 'consistency' },
  ];

  const categories = [
    { id: 'all', name: 'All', count: achievements.length },
    { id: 'strength', name: 'Strength', count: achievements.filter(a => a.category === 'strength').length },
    { id: 'consistency', name: 'Consistency', count: achievements.filter(a => a.category === 'consistency').length },
    { id: 'social', name: 'Social', count: achievements.filter(a => a.category === 'social').length },
  ];

  const filtered = selectedCategory === 'all' 
    ? achievements 
    : achievements.filter(a => a.category === selectedCategory);

  const unlockedCount = achievements.filter(a => a.unlocked).length;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack}>
          <Text style={styles.backButton}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Achievements</Text>
        <View style={{ width: 50 }} />
      </View>

      <View style={styles.progressSection}>
        <Text style={styles.progressText}>{unlockedCount} of {achievements.length} Unlocked</Text>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${(unlockedCount / achievements.length) * 100}%` }]} />
        </View>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.categoriesScroll}
        contentContainerStyle={styles.categoriesContainer}
      >
        {categories.map((cat) => (
          <TouchableOpacity
            key={cat.id}
            style={[styles.categoryButton, selectedCategory === cat.id && styles.activeCategoryButton]}
            onPress={() => setSelectedCategory(cat.id as any)}
          >
            <Text style={[styles.categoryText, selectedCategory === cat.id && styles.activeCategoryText]}>
              {cat.name}
            </Text>
            <Text style={[styles.categoryCount, selectedCategory === cat.id && styles.activeCategoryCount]}>
              {cat.count}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        <View style={styles.achievementGrid}>
          {filtered.map((achievement) => (
            <View
              key={achievement.id}
              style={[styles.achievementCard, !achievement.unlocked && styles.lockedCard]}
            >
              <View style={styles.iconContainer}>
                <Text style={styles.achievementIcon}>{achievement.icon}</Text>
                {!achievement.unlocked && <View style={styles.lockOverlay} />}
              </View>
              <Text style={styles.achievementName}>{achievement.name}</Text>
              <Text style={styles.rarityBadge}>{achievement.rarity}</Text>
              <Text style={styles.xpReward}>+{achievement.xp} XP</Text>
            </View>
          ))}
        </View>
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
  progressSection: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  progressText: {
    fontSize: 12,
    color: '#888',
    marginBottom: 8,
  },
  progressBar: {
    height: 6,
    backgroundColor: '#2a2a2a',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#00ff00',
  },
  categoriesScroll: {
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  categoriesContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  categoryButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 8,
    borderRadius: 16,
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#333',
  },
  activeCategoryButton: {
    backgroundColor: '#00ff00',
    borderColor: '#00ff00',
  },
  categoryText: {
    fontSize: 12,
    color: '#888',
    fontWeight: '500',
  },
  activeCategoryText: {
    color: '#000',
  },
  categoryCount: {
    fontSize: 10,
    color: '#666',
  },
  activeCategoryCount: {
    color: '#000',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
  },
  achievementGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  achievementCard: {
    width: '48%',
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    alignItems: 'center',
  },
  lockedCard: {
    opacity: 0.5,
  },
  iconContainer: {
    position: 'relative',
    marginBottom: 8,
  },
  achievementIcon: {
    fontSize: 40,
  },
  lockOverlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 20,
    height: 20,
    backgroundColor: '#ff4444',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  achievementName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 4,
  },
  rarityBadge: {
    fontSize: 10,
    color: '#888',
    marginBottom: 4,
  },
  xpReward: {
    fontSize: 11,
    color: '#00ff00',
    fontWeight: '600',
  },
});
