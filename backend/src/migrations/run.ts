import fs from 'fs';
import path from 'path';
import { getPool, initializeDatabase, closeDatabase } from '../database/connection';
import { logger } from '../logging/logger';

/**
 * Run database migrations
 */
async function runMigrations(): Promise<void> {
  try {
    // Initialize database connection
    await initializeDatabase();

    const pool = getPool();
    const schemaPath = path.join(__dirname, '../database/schema.sql');

    // Read schema file
    const schema = fs.readFileSync(schemaPath, 'utf-8');

    // Execute schema
    await pool.query(schema);

    logger.info('Database migrations completed successfully');
  } catch (error) {
    logger.error('Migration failed', error as Error);
    throw error;
  } finally {
    await closeDatabase();
  }
}

// Run migrations if executed directly
if (require.main === module) {
  runMigrations()
    .then(() => {
      console.log('Migrations completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration error:', error);
      process.exit(1);
    });
}

export { runMigrations };
