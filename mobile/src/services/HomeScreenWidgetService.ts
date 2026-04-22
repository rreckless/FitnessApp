import axios, { AxiosInstance } from 'axios';
import SQLite from 'react-native-sqlite-storage';
import uuid from 'react-native-uuid';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface WidgetData {
  id: string;
  userId: string;
  widgetType: 'SMALL' | 'MEDIUM' | 'LARGE';
  currentStreak: number;
  longestStreak: number;
  currentXP: number;
  xpToNextLevel: number;
  currentLevel: number;
  todayWorkoutStatus: 'COMPLETED' | 'IN_PROGRESS' | 'NOT_STARTED';
  nextMilestone: string;
  leaderboardPosition: number;
  leaderboardTotal: number;
  friendsActivity: FriendActivity[];
  isDarkMode: boolean;
  lastUpdated: string;
  createdAt: string;
}

export interface FriendActivity {
  friendId: string;
  friendName: string;
  activity: string;
  timestamp: string;
  icon?: string;
}

export interface WidgetRefreshConfig {
  refreshInterval: number; // milliseconds
  autoRefresh: boolean;
  lastRefreshTime?: string;
}

interface CacheEntry {
  data: any;
  timestamp: number;
}

export class HomeScreenWidgetService {
  private apiClient: AxiosInstance;
  private db: SQLite.SQLiteDatabase | null = null;
  private userId: string;
  private apiBaseUrl: string;
  private cache: Map<string, CacheEntry> = new Map();
  private cacheExpiry = 15 * 60 * 1000; // 15 minutes
  private refreshInterval: NodeJS.Timeout | null = null;
  private listeners: Map<string, Function[]> = new Map();
  private refreshConfig: WidgetRefreshConfig = {
    refreshInterval: 15 * 60 * 1000, // 15 minutes
    autoRefresh: true,
  };

  constructor(apiBaseUrl: string, userId: string) {
    this.apiBaseUrl = apiBaseUrl;
    this.userId = userId;
    this.apiClient = axios.create({
      baseURL: apiBaseUrl,
      headers: {
        'Content-Type': 'application/json',
        'X-User-ID': userId,
      },
    });
    this.initializeDatabase();
  }

  private async initializeDatabase(): Promise<void> {
    try {
      this.db = await SQLite.openDatabase({
        name: 'fitquest.db',
        location: 'default',
      });

      await this.db.executeSql(`
        CREATE TABLE IF NOT EXISTS widget_data (
          id TEXT PRIMARY KEY,
          userId TEXT NOT NULL,
          widgetType TEXT NOT NULL,
          currentStreak INTEGER NOT NULL,
          longestStreak INTEGER NOT NULL,
          currentXP INTEGER NOT NULL,
          xpToNextLevel INTEGER NOT NULL,
          currentLevel INTEGER NOT NULL,
          todayWorkoutStatus TEXT NOT NULL,
          nextMilestone TEXT,
          leaderboardPosition INTEGER,
          leaderboardTotal INTEGER,
          friendsActivity TEXT,
          isDarkMode INTEGER NOT NULL,
          lastUpdated TEXT NOT NULL,
          createdAt TEXT NOT NULL,
          synced INTEGER DEFAULT 0
        )
      `);

      await this.db.executeSql(`
        CREATE TABLE IF NOT EXISTS widget_cache (
          key TEXT PRIMARY KEY,
          data TEXT NOT NULL,
          timestamp INTEGER NOT NULL
        )
      `);
    } catch (error) {
      console.error('Failed to initialize HomeScreenWidgetService database:', error);
    }
  }

  /**
   * Get small widget data (streak and XP progress)
   */
  async getSmallWidgetData(isDarkMode: boolean = false): Promise<WidgetData> {
    const cacheKey = `widget_small_${isDarkMode}`;
    const cached = this.getFromCache(cacheKey);

    if (cached) {
      return cached;
    }

    try {
      const response = await this.apiClient.get('/users/me/widget/small');
      const data: WidgetData = {
        ...response.data,
        id: uuid.v4().toString(),
        userId: this.userId,
        widgetType: 'SMALL',
        isDarkMode,
        createdAt: new Date().toISOString(),
      };

      await this.storeWidgetDataLocally(data);
      this.setCache(cacheKey, data);

      return data;
    } catch (error) {
      console.error('Failed to get small widget data:', error);
      return this.getDefaultSmallWidget(isDarkMode);
    }
  }

  /**
   * Get medium widget data (today's workout status and next milestone)
   */
  async getMediumWidgetData(isDarkMode: boolean = false): Promise<WidgetData> {
    const cacheKey = `widget_medium_${isDarkMode}`;
    const cached = this.getFromCache(cacheKey);

    if (cached) {
      return cached;
    }

    try {
      const response = await this.apiClient.get('/users/me/widget/medium');
      const data: WidgetData = {
        ...response.data,
        id: uuid.v4().toString(),
        userId: this.userId,
        widgetType: 'MEDIUM',
        isDarkMode,
        createdAt: new Date().toISOString(),
      };

      await this.storeWidgetDataLocally(data);
      this.setCache(cacheKey, data);

      return data;
    } catch (error) {
      console.error('Failed to get medium widget data:', error);
      return this.getDefaultMediumWidget(isDarkMode);
    }
  }

  /**
   * Get large widget data (leaderboard position and friends' activity)
   */
  async getLargeWidgetData(isDarkMode: boolean = false): Promise<WidgetData> {
    const cacheKey = `widget_large_${isDarkMode}`;
    const cached = this.getFromCache(cacheKey);

    if (cached) {
      return cached;
    }

    try {
      const response = await this.apiClient.get('/users/me/widget/large');
      const data: WidgetData = {
        ...response.data,
        id: uuid.v4().toString(),
        userId: this.userId,
        widgetType: 'LARGE',
        isDarkMode,
        createdAt: new Date().toISOString(),
      };

      await this.storeWidgetDataLocally(data);
      this.setCache(cacheKey, data);

      return data;
    } catch (error) {
      console.error('Failed to get large widget data:', error);
      return this.getDefaultLargeWidget(isDarkMode);
    }
  }

  /**
   * Refresh all widget data
   */
  async refreshAllWidgets(isDarkMode: boolean = false): Promise<void> {
    try {
      await Promise.all([
        this.getSmallWidgetData(isDarkMode),
        this.getMediumWidgetData(isDarkMode),
        this.getLargeWidgetData(isDarkMode),
      ]);

      this.emit('widgetsRefreshed', {
        timestamp: new Date().toISOString(),
        isDarkMode,
      });
    } catch (error) {
      console.error('Failed to refresh widgets:', error);
    }
  }

  /**
   * Start auto-refresh of widgets
   */
  startAutoRefresh(isDarkMode: boolean = false): void {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }

    if (!this.refreshConfig.autoRefresh) {
      return;
    }

    this.refreshInterval = setInterval(async () => {
      await this.refreshAllWidgets(isDarkMode);
    }, this.refreshConfig.refreshInterval);

    this.emit('autoRefreshStarted', this.refreshConfig);
  }

  /**
   * Stop auto-refresh of widgets
   */
  stopAutoRefresh(): void {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }

    this.emit('autoRefreshStopped', null);
  }

  /**
   * Set refresh configuration
   */
  setRefreshConfig(config: Partial<WidgetRefreshConfig>): void {
    this.refreshConfig = {
      ...this.refreshConfig,
      ...config,
    };

    // Restart auto-refresh if interval changed
    if (config.refreshInterval || config.autoRefresh !== undefined) {
      this.stopAutoRefresh();
      this.startAutoRefresh();
    }
  }

  /**
   * Get refresh configuration
   */
  getRefreshConfig(): WidgetRefreshConfig {
    return { ...this.refreshConfig };
  }

  /**
   * Handle widget tap (open app to relevant section)
   */
  handleWidgetTap(widgetType: 'SMALL' | 'MEDIUM' | 'LARGE'): string {
    const routes: Record<string, string> = {
      SMALL: 'home',
      MEDIUM: 'workouts',
      LARGE: 'leaderboard',
    };

    return routes[widgetType] || 'home';
  }

  /**
   * Get default small widget data (offline fallback)
   */
  private getDefaultSmallWidget(isDarkMode: boolean): WidgetData {
    return {
      id: uuid.v4().toString(),
      userId: this.userId,
      widgetType: 'SMALL',
      currentStreak: 0,
      longestStreak: 0,
      currentXP: 0,
      xpToNextLevel: 500,
      currentLevel: 1,
      todayWorkoutStatus: 'NOT_STARTED',
      nextMilestone: 'Level 2',
      leaderboardPosition: 0,
      leaderboardTotal: 0,
      friendsActivity: [],
      isDarkMode,
      lastUpdated: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };
  }

  /**
   * Get default medium widget data (offline fallback)
   */
  private getDefaultMediumWidget(isDarkMode: boolean): WidgetData {
    return {
      id: uuid.v4().toString(),
      userId: this.userId,
      widgetType: 'MEDIUM',
      currentStreak: 0,
      longestStreak: 0,
      currentXP: 0,
      xpToNextLevel: 500,
      currentLevel: 1,
      todayWorkoutStatus: 'NOT_STARTED',
      nextMilestone: 'Complete 1 workout',
      leaderboardPosition: 0,
      leaderboardTotal: 0,
      friendsActivity: [],
      isDarkMode,
      lastUpdated: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };
  }

  /**
   * Get default large widget data (offline fallback)
   */
  private getDefaultLargeWidget(isDarkMode: boolean): WidgetData {
    return {
      id: uuid.v4().toString(),
      userId: this.userId,
      widgetType: 'LARGE',
      currentStreak: 0,
      longestStreak: 0,
      currentXP: 0,
      xpToNextLevel: 500,
      currentLevel: 1,
      todayWorkoutStatus: 'NOT_STARTED',
      nextMilestone: 'Reach Level 2',
      leaderboardPosition: 0,
      leaderboardTotal: 0,
      friendsActivity: [],
      isDarkMode,
      lastUpdated: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };
  }

  /**
   * Store widget data locally
   */
  private async storeWidgetDataLocally(data: WidgetData): Promise<void> {
    if (!this.db) {
      return;
    }

    try {
      await this.db.executeSql(
        `INSERT OR REPLACE INTO widget_data 
         (id, userId, widgetType, currentStreak, longestStreak, currentXP, xpToNextLevel, 
          currentLevel, todayWorkoutStatus, nextMilestone, leaderboardPosition, leaderboardTotal, 
          friendsActivity, isDarkMode, lastUpdated, createdAt, synced)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
        [
          data.id,
          data.userId,
          data.widgetType,
          data.currentStreak,
          data.longestStreak,
          data.currentXP,
          data.xpToNextLevel,
          data.currentLevel,
          data.todayWorkoutStatus,
          data.nextMilestone || null,
          data.leaderboardPosition || null,
          data.leaderboardTotal || null,
          JSON.stringify(data.friendsActivity),
          data.isDarkMode ? 1 : 0,
          data.lastUpdated,
          data.createdAt,
        ]
      );
    } catch (error) {
      console.error('Failed to store widget data locally:', error);
    }
  }

  /**
   * Get widget data from cache
   */
  private getFromCache(key: string): WidgetData | null {
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    const now = Date.now();
    if (now - entry.timestamp > this.cacheExpiry) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  /**
   * Set widget data in cache
   */
  private setCache(key: string, data: WidgetData): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
    });
  }

  /**
   * Subscribe to widget events
   */
  on(event: string, callback: Function): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(callback);
  }

  /**
   * Unsubscribe from widget events
   */
  off(event: string, callback: Function): void {
    if (!this.listeners.has(event)) {
      return;
    }
    const callbacks = this.listeners.get(event)!;
    const index = callbacks.indexOf(callback);
    if (index > -1) {
      callbacks.splice(index, 1);
    }
  }

  /**
   * Emit widget events
   */
  private emit(event: string, data: any): void {
    if (!this.listeners.has(event)) {
      return;
    }
    this.listeners.get(event)!.forEach((callback) => callback(data));
  }

  /**
   * Clear cache
   */
  async clearCache(): Promise<void> {
    this.cache.clear();
    if (!this.db) {
      return;
    }

    try {
      await this.db.executeSql(`DELETE FROM widget_cache`);
    } catch (error) {
      console.error('Failed to clear cache:', error);
    }
  }

  /**
   * Close database connection
   */
  async close(): Promise<void> {
    this.stopAutoRefresh();

    if (this.db) {
      await this.db.close();
      this.db = null;
    }
  }
}
