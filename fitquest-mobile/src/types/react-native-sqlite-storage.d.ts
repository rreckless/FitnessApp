declare module 'react-native-sqlite-storage' {
  export interface SQLiteDatabase {
    executeSql(sql: string, params?: any[]): Promise<any[]>;
    close(): Promise<void>;
  }

  export interface OpenDatabaseOptions {
    name: string;
    location?: string;
    createFromLocation?: string;
  }

  export function openDatabase(options: OpenDatabaseOptions): Promise<SQLiteDatabase>;
  export function DEBUG(enable: boolean): void;
}
