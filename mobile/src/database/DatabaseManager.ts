import SQLite from 'react-native-sqlite-storage';
import { Platform } from 'react-native';

SQLite.DEBUG(false);
SQLite.enablePromise(true);

export class DatabaseManager {
  private static instance: DatabaseManager;
  private db: SQLite.SQLiteDatabase | null = null;

  private constructor() {}

  static getInstance(): DatabaseManager {
    if (!DatabaseManager.instance) {
      DatabaseManager.instance = new DatabaseManager();
    }
    return DatabaseManager.instance;
  }

  async initialize(): Promise<void> {
    try {
      this.db = await SQLite.openDatabase({
        name: 'fitquest.db',
        location: Platform.OS === 'ios' ? 'Library' : 'default',
        createFromLocation: '~fitquest.db',
      });

      await this.createTables();
      console.log('Database initialized successfully');
    } catch (error) {
      console.error('Failed to initialize database:', error);
      throw error;
    }
  }

  private async createTables(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const tables = [
      `CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE,
        name TEXT,
        level INTEGER DEFAULT 1,
        totalXP INTEGER DEFAULT 0,
        currentStreak INTEGER DEFAULT 0,
        longestStreak INTEGER DEFAULT 0,
        createdAt TEXT,
        updatedAt TEXT
      )`,

      `CREATE TABLE IF NOT EXISTS workouts (
        id TEXT PRIMARY KEY,
        userId TEXT NOT NULL,
        startTime TEXT NOT NULL,
        endTime TEXT,
        duration INTEGER,
        totalVolume INTEGER DEFAULT 0,
        totalXP INTEGER DEFAULT 0,
        notes TEXT,
        isOfflineCreated INTEGER DEFAULT 1,
        syncedAt TEXT,
        createdAt TEXT,
        updatedAt TEXT,
        deletedAt TEXT,
        FOREIGN KEY(userId) REFERENCES users(id)
      )`,

      `CREATE TABLE IF NOT EXISTS workout_exercises (
        id TEXT PRIMARY KEY,
        workoutId TEXT NOT NULL,
        exerciseId TEXT NOT NULL,
        exerciseOrder INTEGER,
        sets TEXT,
        totalVolume INTEGER DEFAULT 0,
        createdAt TEXT,
        updatedAt TEXT,
        FOREIGN KEY(workoutId) REFERENCES workouts(id)
      )`,

      `CREATE TABLE IF NOT EXISTS exercises (
        id TEXT PRIMARY KEY,
        name TEXT UNIQUE,
        description TEXT,
        primaryMuscleGroup TEXT,
        secondaryMuscleGroups TEXT,
        difficulty TEXT,
        equipment TEXT,
        formTips TEXT,
        videoUrl TEXT,
        createdAt TEXT,
        updatedAt TEXT
      )`,

      `CREATE TABLE IF NOT EXISTS sync_queue (
        id TEXT PRIMARY KEY,
        userId TEXT NOT NULL,
        operation TEXT,
        entityType TEXT,
        entityId TEXT,
        payload TEXT,
        status TEXT DEFAULT 'PENDING',
        retryCount INTEGER DEFAULT 0,
        lastError TEXT,
        createdAt TEXT,
        updatedAt TEXT,
        FOREIGN KEY(userId) REFERENCES users(id)
      )`,
    ];

    for (const table of tables) {
      try {
        await this.db.executeSql(table);
      } catch (error) {
        console.error('Failed to create table:', error);
      }
    }
  }

  async executeSql(sql: string, params: any[] = []): Promise<SQLite.ResultSet> {
    if (!this.db) throw new Error('Database not initialized');
    return this.db.executeSql(sql, params);
  }

  async transaction(callback: (db: SQLite.SQLiteDatabase) => Promise<void>): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    try {
      await this.db.transaction(async (tx) => {
        await callback(this.db!);
      });
    } catch (error) {
      console.error('Transaction failed:', error);
      throw error;
    }
  }

  async close(): Promise<void> {
    if (this.db) {
      await this.db.close();
      this.db = null;
    }
  }
}

export default DatabaseManager.getInstance();
