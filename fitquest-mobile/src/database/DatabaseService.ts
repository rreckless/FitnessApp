/**
 * DatabaseService - Manages SQLite database initialization and operations
 * Handles database creation, migrations, and provides query interface
 */

import SQLite from 'react-native-sqlite-storage';
import { SCHEMA, INDEXES, DATABASE_NAME, DATABASE_VERSION } from './schema';

export interface QueryResult {
  rows: any[];
  rowsAffected: number;
}

export class DatabaseService {
  private static instance: DatabaseService;
  private db: SQLite.SQLiteDatabase | null = null;
  private isInitialized = false;

  private constructor() {}

  static getInstance(): DatabaseService {
    if (!DatabaseService.instance) {
      DatabaseService.instance = new DatabaseService();
    }
    return DatabaseService.instance;
  }

  /**
   * Initialize the database and create all tables
   */
  async initialize(): Promise<void> {
    if (this.isInitialized && this.db) {
      return;
    }

    try {
      // Enable debug mode in development
      SQLite.DEBUG(false);

      // Open or create database
      this.db = await SQLite.openDatabase({
        name: DATABASE_NAME,
        location: 'default',
        createFromLocation: '~www/fitquest.db',
      });

      // Create all tables
      await this.createTables();

      // Create indexes
      await this.createIndexes();

      this.isInitialized = true;
      console.log('Database initialized successfully');
    } catch (error) {
      console.error('Failed to initialize database:', error);
      throw error;
    }
  }

  /**
   * Create all database tables
   */
  private async createTables(): Promise<void> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    const tables = Object.values(SCHEMA);
    for (const createTableSQL of tables) {
      try {
        await this.db.executeSql(createTableSQL);
      } catch (error) {
        console.error('Error creating table:', error);
        throw error;
      }
    }
  }

  /**
   * Create all database indexes
   */
  private async createIndexes(): Promise<void> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    const indexes = Object.values(INDEXES);
    for (const createIndexSQL of indexes) {
      try {
        await this.db.executeSql(createIndexSQL);
      } catch (error) {
        console.error('Error creating index:', error);
        // Indexes are not critical, continue
      }
    }
  }

  /**
   * Execute a SQL query with parameters
   */
  async query(sql: string, params: any[] = []): Promise<QueryResult> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    try {
      const result = await this.db.executeSql(sql, params);
      const rows: any[] = [];

      if (result.length > 0 && result[0].rows) {
        for (let i = 0; i < result[0].rows.length; i++) {
          rows.push(result[0].rows.item(i));
        }
      }

      return {
        rows,
        rowsAffected: result[0].rowsAffected || 0,
      };
    } catch (error) {
      console.error('Query error:', error, 'SQL:', sql, 'Params:', params);
      throw error;
    }
  }

  /**
   * Execute a single query and return first row
   */
  async queryOne(sql: string, params: any[] = []): Promise<any | null> {
    const result = await this.query(sql, params);
    return result.rows.length > 0 ? result.rows[0] : null;
  }

  /**
   * Execute a single query and return all rows
   */
  async queryAll(sql: string, params: any[] = []): Promise<any[]> {
    const result = await this.query(sql, params);
    return result.rows;
  }

  /**
   * Insert a record
   */
  async insert(table: string, data: Record<string, any>): Promise<string> {
    const columns = Object.keys(data);
    const values = Object.values(data);
    const placeholders = columns.map(() => '?').join(',');

    const sql = `INSERT INTO ${table} (${columns.join(',')}) VALUES (${placeholders})`;
    const result = await this.query(sql, values);

    if (result.rowsAffected === 0) {
      throw new Error(`Failed to insert into ${table}`);
    }

    return data.id || '';
  }

  /**
   * Update a record
   */
  async update(table: string, data: Record<string, any>, whereClause: string, whereParams: any[] = []): Promise<number> {
    const columns = Object.keys(data);
    const values = Object.values(data);
    const setClause = columns.map(col => `${col} = ?`).join(',');

    const sql = `UPDATE ${table} SET ${setClause} WHERE ${whereClause}`;
    const result = await this.query(sql, [...values, ...whereParams]);

    return result.rowsAffected;
  }

  /**
   * Delete a record
   */
  async delete(table: string, whereClause: string, whereParams: any[] = []): Promise<number> {
    const sql = `DELETE FROM ${table} WHERE ${whereClause}`;
    const result = await this.query(sql, whereParams);
    return result.rowsAffected;
  }

  /**
   * Begin a transaction
   */
  async beginTransaction(): Promise<void> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }
    await this.db.executeSql('BEGIN TRANSACTION');
  }

  /**
   * Commit a transaction
   */
  async commit(): Promise<void> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }
    await this.db.executeSql('COMMIT');
  }

  /**
   * Rollback a transaction
   */
  async rollback(): Promise<void> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }
    await this.db.executeSql('ROLLBACK');
  }

  /**
   * Close the database connection
   */
  async close(): Promise<void> {
    if (this.db) {
      await this.db.close();
      this.db = null;
      this.isInitialized = false;
    }
  }

  /**
   * Check if database is initialized
   */
  isReady(): boolean {
    return this.isInitialized && this.db !== null;
  }
}

export default DatabaseService;
