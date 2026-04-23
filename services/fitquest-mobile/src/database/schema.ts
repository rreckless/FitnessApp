/**
 * SQLite Database Schema for FitQuest Mobile App
 * Defines all tables for offline-first architecture
 */

export const DATABASE_NAME = 'fitquest.db';
export const DATABASE_VERSION = 1;

export const SCHEMA = {
  // User data tables
  users: `
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      profilePicture TEXT,
      bio TEXT,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      syncedAt TEXT
    )
  `,

  // Workout data tables
  workouts: `
    CREATE TABLE IF NOT EXISTS workouts (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      startTime TEXT NOT NULL,
      endTime TEXT,
      duration INTEGER,
      totalVolume REAL DEFAULT 0,
      totalXP INTEGER DEFAULT 0,
      notes TEXT,
      status TEXT DEFAULT 'IN_PROGRESS',
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      syncedAt TEXT,
      FOREIGN KEY (userId) REFERENCES users(id)
    )
  `,

  workout_exercises: `
    CREATE TABLE IF NOT EXISTS workout_exercises (
      id TEXT PRIMARY KEY,
      workoutId TEXT NOT NULL,
      exerciseId TEXT NOT NULL,
      exerciseName TEXT NOT NULL,
      sets INTEGER NOT NULL,
      reps INTEGER NOT NULL,
      weight REAL,
      notes TEXT,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      FOREIGN KEY (workoutId) REFERENCES workouts(id)
    )
  `,

  workout_sets: `
    CREATE TABLE IF NOT EXISTS workout_sets (
      id TEXT PRIMARY KEY,
      exerciseId TEXT NOT NULL,
      reps INTEGER NOT NULL,
      weight REAL NOT NULL,
      volume REAL NOT NULL,
      notes TEXT,
      createdAt TEXT NOT NULL,
      FOREIGN KEY (exerciseId) REFERENCES workout_exercises(id)
    )
  `,

  // Exercise library (cached)
  exercises: `
    CREATE TABLE IF NOT EXISTS exercises (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      primaryMuscleGroup TEXT NOT NULL,
      secondaryMuscleGroups TEXT,
      difficulty TEXT,
      isCustom INTEGER DEFAULT 0,
      userId TEXT,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      FOREIGN KEY (userId) REFERENCES users(id)
    )
  `,

  // Muscle group ranks
  muscle_group_ranks: `
    CREATE TABLE IF NOT EXISTS muscle_group_ranks (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      muscleGroup TEXT NOT NULL,
      rank INTEGER DEFAULT 1,
      totalVolume REAL DEFAULT 0,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      syncedAt TEXT,
      UNIQUE(userId, muscleGroup),
      FOREIGN KEY (userId) REFERENCES users(id)
    )
  `,

  // Achievements
  achievements: `
    CREATE TABLE IF NOT EXISTS achievements (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      rarity TEXT NOT NULL,
      category TEXT NOT NULL,
      icon TEXT,
      createdAt TEXT NOT NULL
    )
  `,

  user_achievements: `
    CREATE TABLE IF NOT EXISTS user_achievements (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      achievementId TEXT NOT NULL,
      unlockedAt TEXT NOT NULL,
      syncedAt TEXT,
      UNIQUE(userId, achievementId),
      FOREIGN KEY (userId) REFERENCES users(id),
      FOREIGN KEY (achievementId) REFERENCES achievements(id)
    )
  `,

  // Personal records
  personal_records: `
    CREATE TABLE IF NOT EXISTS personal_records (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      exerciseId TEXT NOT NULL,
      weight REAL NOT NULL,
      reps INTEGER NOT NULL,
      recordedAt TEXT NOT NULL,
      syncedAt TEXT,
      FOREIGN KEY (userId) REFERENCES users(id),
      FOREIGN KEY (exerciseId) REFERENCES exercises(id)
    )
  `,

  // Social features
  friendships: `
    CREATE TABLE IF NOT EXISTS friendships (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      friendId TEXT NOT NULL,
      status TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      syncedAt TEXT,
      UNIQUE(userId, friendId),
      FOREIGN KEY (userId) REFERENCES users(id),
      FOREIGN KEY (friendId) REFERENCES users(id)
    )
  `,

  // Activity feed (cached)
  activity_feed: `
    CREATE TABLE IF NOT EXISTS activity_feed (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      actorId TEXT NOT NULL,
      activityType TEXT NOT NULL,
      entityType TEXT,
      entityId TEXT,
      metadata TEXT,
      createdAt TEXT NOT NULL,
      FOREIGN KEY (userId) REFERENCES users(id),
      FOREIGN KEY (actorId) REFERENCES users(id)
    )
  `,

  // Body tracking
  body_weight: `
    CREATE TABLE IF NOT EXISTS body_weight (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      weight REAL NOT NULL,
      notes TEXT,
      recordedAt TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      syncedAt TEXT,
      FOREIGN KEY (userId) REFERENCES users(id)
    )
  `,

  body_measurements: `
    CREATE TABLE IF NOT EXISTS body_measurements (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      chest REAL,
      waist REAL,
      hips REAL,
      arms REAL,
      thighs REAL,
      notes TEXT,
      recordedAt TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      syncedAt TEXT,
      FOREIGN KEY (userId) REFERENCES users(id)
    )
  `,

  progress_photos: `
    CREATE TABLE IF NOT EXISTS progress_photos (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      photoPath TEXT NOT NULL,
      notes TEXT,
      recordedAt TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      syncedAt TEXT,
      FOREIGN KEY (userId) REFERENCES users(id)
    )
  `,

  // Sync queue for offline-first architecture
  sync_queue: `
    CREATE TABLE IF NOT EXISTS sync_queue (
      id TEXT PRIMARY KEY,
      operation TEXT NOT NULL,
      entityType TEXT NOT NULL,
      entityId TEXT NOT NULL,
      payload TEXT NOT NULL,
      status TEXT NOT NULL,
      retryCount INTEGER DEFAULT 0,
      lastError TEXT,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    )
  `,
};

// Create indexes for better query performance
export const INDEXES = {
  workouts_userId: 'CREATE INDEX IF NOT EXISTS idx_workouts_userId ON workouts(userId)',
  workouts_createdAt: 'CREATE INDEX IF NOT EXISTS idx_workouts_createdAt ON workouts(createdAt)',
  workout_exercises_workoutId: 'CREATE INDEX IF NOT EXISTS idx_workout_exercises_workoutId ON workout_exercises(workoutId)',
  workout_sets_exerciseId: 'CREATE INDEX IF NOT EXISTS idx_workout_sets_exerciseId ON workout_sets(exerciseId)',
  exercises_primaryMuscleGroup: 'CREATE INDEX IF NOT EXISTS idx_exercises_primaryMuscleGroup ON exercises(primaryMuscleGroup)',
  muscle_group_ranks_userId: 'CREATE INDEX IF NOT EXISTS idx_muscle_group_ranks_userId ON muscle_group_ranks(userId)',
  user_achievements_userId: 'CREATE INDEX IF NOT EXISTS idx_user_achievements_userId ON user_achievements(userId)',
  personal_records_userId: 'CREATE INDEX IF NOT EXISTS idx_personal_records_userId ON personal_records(userId)',
  personal_records_exerciseId: 'CREATE INDEX IF NOT EXISTS idx_personal_records_exerciseId ON personal_records(exerciseId)',
  friendships_userId: 'CREATE INDEX IF NOT EXISTS idx_friendships_userId ON friendships(userId)',
  activity_feed_userId: 'CREATE INDEX IF NOT EXISTS idx_activity_feed_userId ON activity_feed(userId)',
  body_weight_userId: 'CREATE INDEX IF NOT EXISTS idx_body_weight_userId ON body_weight(userId)',
  body_measurements_userId: 'CREATE INDEX IF NOT EXISTS idx_body_measurements_userId ON body_measurements(userId)',
  progress_photos_userId: 'CREATE INDEX IF NOT EXISTS idx_progress_photos_userId ON progress_photos(userId)',
  sync_queue_status: 'CREATE INDEX IF NOT EXISTS idx_sync_queue_status ON sync_queue(status)',
};
