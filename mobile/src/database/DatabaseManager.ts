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

      `CREATE TABLE IF NOT EXISTS body_weight (
        id TEXT PRIMARY KEY,
        userId TEXT NOT NULL,
        weight REAL NOT NULL,
        notes TEXT,
        recordedAt TEXT,
        createdAt TEXT,
        updatedAt TEXT,
        FOREIGN KEY(userId) REFERENCES users(id)
      )`,

      `CREATE TABLE IF NOT EXISTS body_measurements (
        id TEXT PRIMARY KEY,
        userId TEXT NOT NULL,
        chest REAL,
        waist REAL,
        hips REAL,
        arms REAL,
        thighs REAL,
        notes TEXT,
        recordedAt TEXT,
        createdAt TEXT,
        updatedAt TEXT,
        FOREIGN KEY(userId) REFERENCES users(id)
      )`,

      `CREATE TABLE IF NOT EXISTS progress_photos (
        id TEXT PRIMARY KEY,
        userId TEXT NOT NULL,
        imageUrl TEXT NOT NULL,
        thumbnailUrl TEXT,
        notes TEXT,
        recordedAt TEXT,
        createdAt TEXT,
        updatedAt TEXT,
        FOREIGN KEY(userId) REFERENCES users(id)
      )`,

      `CREATE TABLE IF NOT EXISTS rest_sessions (
        id TEXT PRIMARY KEY,
        exerciseId TEXT NOT NULL,
        exerciseType TEXT NOT NULL,
        suggestedDuration INTEGER NOT NULL,
        actualDuration INTEGER,
        startedAt TEXT NOT NULL,
        completedAt TEXT,
        createdAt TEXT,
        updatedAt TEXT
      )`,

      `CREATE TABLE IF NOT EXISTS gps_sessions (
        id TEXT PRIMARY KEY,
        startTime TEXT NOT NULL,
        endTime TEXT,
        distance REAL DEFAULT 0,
        pace REAL DEFAULT 0,
        elevationGain REAL DEFAULT 0,
        elevationLoss REAL DEFAULT 0,
        isActive INTEGER DEFAULT 1,
        signalLost INTEGER DEFAULT 0,
        lastSignalTime TEXT,
        createdAt TEXT,
        updatedAt TEXT
      )`,

      `CREATE TABLE IF NOT EXISTS gps_coordinates (
        id TEXT PRIMARY KEY,
        sessionId TEXT NOT NULL,
        latitude REAL NOT NULL,
        longitude REAL NOT NULL,
        elevation REAL,
        accuracy REAL,
        timestamp TEXT NOT NULL,
        FOREIGN KEY(sessionId) REFERENCES gps_sessions(id)
      )`,

      `CREATE TABLE IF NOT EXISTS routes (
        id TEXT PRIMARY KEY,
        userId TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        startLatitude REAL NOT NULL,
        startLongitude REAL NOT NULL,
        endLatitude REAL NOT NULL,
        endLongitude REAL NOT NULL,
        distance REAL NOT NULL,
        estimatedTime INTEGER NOT NULL,
        difficulty TEXT,
        coordinates TEXT,
        rating REAL,
        reviewCount INTEGER DEFAULT 0,
        isOfflineCreated INTEGER DEFAULT 1,
        syncedAt TEXT,
        createdAt TEXT,
        updatedAt TEXT,
        FOREIGN KEY(userId) REFERENCES users(id)
      )`,

      `CREATE TABLE IF NOT EXISTS route_shares (
        id TEXT PRIMARY KEY,
        routeId TEXT NOT NULL,
        sharedWithUserId TEXT NOT NULL,
        sharedAt TEXT,
        createdAt TEXT,
        FOREIGN KEY(routeId) REFERENCES routes(id),
        FOREIGN KEY(sharedWithUserId) REFERENCES users(id)
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

  // MARK: - Body Weight Methods

  async insertBodyWeight(entry: any): Promise<void> {
    const sql = `
      INSERT OR REPLACE INTO body_weight (id, userId, weight, notes, recordedAt, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;
    await this.executeSql(sql, [
      entry.id,
      entry.userId || 'local',
      entry.weight,
      entry.notes || null,
      entry.recordedAt,
      entry.createdAt,
      entry.updatedAt,
    ]);
  }

  async updateBodyWeight(id: string, entry: any): Promise<void> {
    const sql = `
      UPDATE body_weight
      SET weight = ?, notes = ?, recordedAt = ?, updatedAt = ?
      WHERE id = ?
    `;
    await this.executeSql(sql, [entry.weight, entry.notes || null, entry.recordedAt, entry.updatedAt, id]);
  }

  async deleteBodyWeight(id: string): Promise<void> {
    const sql = `DELETE FROM body_weight WHERE id = ?`;
    await this.executeSql(sql, [id]);
  }

  async getBodyWeightHistory(limit: number = 100, offset: number = 0): Promise<any[]> {
    const sql = `
      SELECT id, weight, notes, recordedAt, createdAt, updatedAt
      FROM body_weight
      ORDER BY recordedAt DESC
      LIMIT ? OFFSET ?
    `;
    const result = await this.executeSql(sql, [limit, offset]);
    return result.rows.raw();
  }

  // MARK: - Body Measurement Methods

  async insertBodyMeasurement(entry: any): Promise<void> {
    const sql = `
      INSERT OR REPLACE INTO body_measurements (id, userId, chest, waist, hips, arms, thighs, notes, recordedAt, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    await this.executeSql(sql, [
      entry.id,
      entry.userId || 'local',
      entry.chest || null,
      entry.waist || null,
      entry.hips || null,
      entry.arms || null,
      entry.thighs || null,
      entry.notes || null,
      entry.recordedAt,
      entry.createdAt,
      entry.updatedAt,
    ]);
  }

  async updateBodyMeasurement(id: string, entry: any): Promise<void> {
    const sql = `
      UPDATE body_measurements
      SET chest = ?, waist = ?, hips = ?, arms = ?, thighs = ?, notes = ?, recordedAt = ?, updatedAt = ?
      WHERE id = ?
    `;
    await this.executeSql(sql, [
      entry.chest || null,
      entry.waist || null,
      entry.hips || null,
      entry.arms || null,
      entry.thighs || null,
      entry.notes || null,
      entry.recordedAt,
      entry.updatedAt,
      id,
    ]);
  }

  async deleteBodyMeasurement(id: string): Promise<void> {
    const sql = `DELETE FROM body_measurements WHERE id = ?`;
    await this.executeSql(sql, [id]);
  }

  async getBodyMeasurementHistory(limit: number = 100, offset: number = 0): Promise<any[]> {
    const sql = `
      SELECT id, chest, waist, hips, arms, thighs, notes, recordedAt, createdAt, updatedAt
      FROM body_measurements
      ORDER BY recordedAt DESC
      LIMIT ? OFFSET ?
    `;
    const result = await this.executeSql(sql, [limit, offset]);
    return result.rows.raw();
  }
}

export default DatabaseManager.getInstance();

  // MARK: - Progress Photo Methods

  async insertProgressPhoto(entry: any): Promise<void> {
    const sql = `
      INSERT OR REPLACE INTO progress_photos (id, userId, imageUrl, thumbnailUrl, notes, recordedAt, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;
    await this.executeSql(sql, [
      entry.id,
      entry.userId || 'local',
      entry.imageUrl,
      entry.thumbnailUrl || null,
      entry.notes || null,
      entry.recordedAt,
      entry.createdAt,
      entry.updatedAt,
    ]);
  }

  async updateProgressPhoto(id: string, entry: any): Promise<void> {
    const sql = `
      UPDATE progress_photos
      SET imageUrl = ?, thumbnailUrl = ?, notes = ?, recordedAt = ?, updatedAt = ?
      WHERE id = ?
    `;
    await this.executeSql(sql, [
      entry.imageUrl,
      entry.thumbnailUrl || null,
      entry.notes || null,
      entry.recordedAt,
      entry.updatedAt,
      id,
    ]);
  }

  async deleteProgressPhoto(id: string): Promise<void> {
    const sql = `DELETE FROM progress_photos WHERE id = ?`;
    await this.executeSql(sql, [id]);
  }

  async getProgressPhotoGallery(limit: number = 100, offset: number = 0): Promise<any[]> {
    const sql = `
      SELECT id, imageUrl, thumbnailUrl, notes, recordedAt, createdAt, updatedAt
      FROM progress_photos
      ORDER BY recordedAt DESC
      LIMIT ? OFFSET ?
    `;
    const result = await this.executeSql(sql, [limit, offset]);
    return result.rows.raw();
  }

  async getProgressPhoto(id: string): Promise<any> {
    const sql = `
      SELECT id, imageUrl, thumbnailUrl, notes, recordedAt, createdAt, updatedAt
      FROM progress_photos
      WHERE id = ?
    `;
    const result = await this.executeSql(sql, [id]);
    if (result.rows.length === 0) {
      throw new Error('Progress photo not found');
    }
    return result.rows.raw()[0];
  }
}

export default DatabaseManager.getInstance();
