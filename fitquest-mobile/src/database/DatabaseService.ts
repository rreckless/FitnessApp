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

    const tables = Object.entries(SCHEMA);
    for (const [tableName, createTableSQL] of tables) {
      try {
        console.log(`[DB] Creating table '${tableName}' with SQL:`, createTableSQL.substring(0, 100) + '...');
        await this.db.executeSql(createTableSQL);
        console.log(`[DB] Table '${tableName}' created successfully`);
      } catch (error) {
        // Check if table already exists (error code 1 = "table already exists")
        const errorMsg = error instanceof Error ? error.message : String(error);
        if (errorMsg.includes('already exists') || errorMsg.includes('SQLITE_ERROR')) {
          console.log(`[DB] Table '${tableName}' already exists, skipping`);
        } else {
          console.error(`[DB] Error creating table '${tableName}':`, {
            error: errorMsg,
            sql: createTableSQL.substring(0, 100),
            fullError: error
          });
          throw error;
        }
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
      console.log(`[DB] Executing query:`, { sql, params });
      const result = await this.db.executeSql(sql, params);
      const rows: any[] = [];

      if (result.length > 0 && result[0].rows) {
        for (let i = 0; i < result[0].rows.length; i++) {
          rows.push(result[0].rows.item(i));
        }
      }

      console.log(`[DB] Query result:`, { rowsAffected: result[0].rowsAffected || 0, rowsReturned: rows.length });
      return {
        rows,
        rowsAffected: result[0].rowsAffected || 0,
      };
    } catch (error) {
      console.error(`[DB] Query error:`, {
        error: error instanceof Error ? error.message : String(error),
        sql,
        params,
        fullError: error
      });
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
    try {
      console.log(`[DB] Inserting into ${table}:`, { data });
      
      // Build SQL with proper escaping instead of using parameters
      // This works around a bug in react-native-sqlite-storage
      const columns = Object.keys(data);
      const values = columns.map(col => {
        const value = data[col];
        
        if (value === null || value === undefined) {
          return 'NULL';
        }
        
        if (typeof value === 'boolean') {
          return value ? '1' : '0';
        }
        
        if (typeof value === 'number') {
          return String(value);
        }
        
        if (typeof value === 'string') {
          // Escape single quotes by doubling them
          return `'${value.replace(/'/g, "''")}'`;
        }
        
        if (typeof value === 'object') {
          // For objects/arrays, convert to JSON string
          const jsonStr = JSON.stringify(value);
          return `'${jsonStr.replace(/'/g, "''")}'`;
        }
        
        return `'${String(value).replace(/'/g, "''")}'`;
      });
      
      const sql = `INSERT INTO ${table} (${columns.join(',')}) VALUES (${values.join(',')})`;
      
      console.log(`[DB] Executing insert SQL:`, sql.substring(0, 200) + '...');
      
      const result = await this.query(sql);
      console.log(`[DB] Successfully inserted into ${table}, rowsAffected:`, result.rowsAffected);

      if (result.rowsAffected === 0) {
        throw new Error(`Failed to insert into ${table} - no rows affected`);
      }

      return data.id || '';
    } catch (error) {
      console.error(`[DB] Insert error for ${table}:`, {
        error: error instanceof Error ? error.message : String(error),
        data,
        fullError: error
      });
      throw error;
    }
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
