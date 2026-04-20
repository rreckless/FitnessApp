-- Users table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    bio TEXT,
    profile_picture_url VARCHAR(500),
    level INTEGER DEFAULT 1,
    total_xp INTEGER DEFAULT 0,
    current_streak INTEGER DEFAULT 0,
    longest_streak INTEGER DEFAULT 0,
    subscription_tier VARCHAR(50) DEFAULT 'FREE',
    subscription_expires_at TIMESTAMP,
    api_secret_hash VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_sync_at TIMESTAMP
);

-- User preferences table
CREATE TABLE IF NOT EXISTS user_preferences (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    fitness_goals TEXT[],
    experience_level VARCHAR(50),
    workout_frequency INTEGER,
    available_equipment TEXT[],
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Exercises table
CREATE TABLE IF NOT EXISTS exercises (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) UNIQUE NOT NULL,
    description TEXT,
    primary_muscle_group VARCHAR(50) NOT NULL,
    secondary_muscle_groups TEXT[],
    difficulty VARCHAR(50),
    equipment TEXT[],
    form_tips TEXT[],
    video_url VARCHAR(500),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Workouts table
CREATE TABLE IF NOT EXISTS workouts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    start_time TIMESTAMP NOT NULL,
    end_time TIMESTAMP,
    duration INTEGER,
    total_volume INTEGER,
    total_xp INTEGER,
    notes TEXT,
    is_offline_created BOOLEAN DEFAULT FALSE,
    synced_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP
);

-- Workout exercises table
CREATE TABLE IF NOT EXISTS workout_exercises (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workout_id UUID NOT NULL REFERENCES workouts(id) ON DELETE CASCADE,
    exercise_id UUID NOT NULL REFERENCES exercises(id),
    exercise_order INTEGER,
    sets JSONB,
    total_volume INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Muscle group ranks table
CREATE TABLE IF NOT EXISTS muscle_group_ranks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    muscle_group VARCHAR(50) NOT NULL,
    rank INTEGER,
    total_volume INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, muscle_group)
);

-- Achievements table
CREATE TABLE IF NOT EXISTS achievements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    rarity VARCHAR(50) NOT NULL,
    category VARCHAR(50) NOT NULL,
    xp_reward INTEGER,
    unlocked_condition JSONB,
    icon VARCHAR(500),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User achievements table
CREATE TABLE IF NOT EXISTS user_achievements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    achievement_id UUID NOT NULL REFERENCES achievements(id),
    unlocked_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, achievement_id)
);

-- Personal records table
CREATE TABLE IF NOT EXISTS personal_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    exercise_id UUID NOT NULL REFERENCES exercises(id),
    weight INTEGER,
    reps INTEGER,
    recorded_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Friendships table
CREATE TABLE IF NOT EXISTS friendships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id_1 UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    user_id_2 UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(50) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CHECK (user_id_1 < user_id_2)
);

-- Activity feed table
CREATE TABLE IF NOT EXISTS activity_feed (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    activity_type VARCHAR(50) NOT NULL,
    related_entity_id UUID,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Challenges table
CREATE TABLE IF NOT EXISTS challenges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    creator_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    type VARCHAR(50) NOT NULL,
    goal_type VARCHAR(50) NOT NULL,
    target_value INTEGER,
    duration INTEGER,
    start_date TIMESTAMP,
    end_date TIMESTAMP,
    participants UUID[],
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Challenge progress table
CREATE TABLE IF NOT EXISTS challenge_progress (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    challenge_id UUID NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    current_value INTEGER,
    rank INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(challenge_id, user_id)
);

-- Body weight table
CREATE TABLE IF NOT EXISTS body_weight (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    weight DECIMAL(5, 2) NOT NULL,
    notes TEXT,
    recorded_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Body measurements table
CREATE TABLE IF NOT EXISTS body_measurements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    chest DECIMAL(5, 2),
    waist DECIMAL(5, 2),
    hips DECIMAL(5, 2),
    arms DECIMAL(5, 2),
    thighs DECIMAL(5, 2),
    notes TEXT,
    recorded_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Progress photos table
CREATE TABLE IF NOT EXISTS progress_photos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    image_url VARCHAR(500) NOT NULL,
    thumbnail_url VARCHAR(500),
    notes TEXT,
    recorded_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- GPS routes table
CREATE TABLE IF NOT EXISTS gps_routes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255),
    description TEXT,
    coordinates JSONB,
    distance DECIMAL(10, 2),
    estimated_time INTEGER,
    difficulty VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Sync queue table
CREATE TABLE IF NOT EXISTS sync_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    operation VARCHAR(50) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id UUID NOT NULL,
    payload JSONB,
    status VARCHAR(50) DEFAULT 'PENDING',
    retry_count INTEGER DEFAULT 0,
    last_error TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- MFA settings table
CREATE TABLE IF NOT EXISTS mfa_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    totp_secret VARCHAR(255),
    totp_enabled BOOLEAN DEFAULT FALSE,
    backup_codes_generated_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Backup codes table
CREATE TABLE IF NOT EXISTS backup_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    code_hash VARCHAR(255) NOT NULL,
    used BOOLEAN DEFAULT FALSE,
    used_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Flagged workouts table (for fraud detection)
CREATE TABLE IF NOT EXISTS flagged_workouts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workout_id UUID NOT NULL REFERENCES workouts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reason TEXT NOT NULL,
    severity VARCHAR(50) NOT NULL,
    flagged_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    reviewed BOOLEAN DEFAULT FALSE,
    reviewed_at TIMESTAMP,
    reviewed_by UUID REFERENCES users(id),
    review_notes TEXT,
    status VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Fraud audit log table
CREATE TABLE IF NOT EXISTS fraud_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workout_id UUID NOT NULL REFERENCES workouts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    xp_rolled_back INTEGER,
    action VARCHAR(50) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_workouts_user_id ON workouts(user_id);
CREATE INDEX IF NOT EXISTS idx_workouts_created_at ON workouts(created_at);
CREATE INDEX IF NOT EXISTS idx_sync_queue_user_id ON sync_queue(user_id);
CREATE INDEX IF NOT EXISTS idx_sync_queue_status ON sync_queue(status);
CREATE INDEX IF NOT EXISTS idx_activity_feed_user_id ON activity_feed(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_feed_created_at ON activity_feed(created_at);
CREATE INDEX IF NOT EXISTS idx_muscle_group_ranks_user_id ON muscle_group_ranks(user_id);
CREATE INDEX IF NOT EXISTS idx_personal_records_user_id ON personal_records(user_id);
CREATE INDEX IF NOT EXISTS idx_friendships_user_id_1 ON friendships(user_id_1);
CREATE INDEX IF NOT EXISTS idx_friendships_user_id_2 ON friendships(user_id_2);
CREATE INDEX IF NOT EXISTS idx_backup_codes_user_id ON backup_codes(user_id);
CREATE INDEX IF NOT EXISTS idx_flagged_workouts_user_id ON flagged_workouts(user_id);
CREATE INDEX IF NOT EXISTS idx_flagged_workouts_reviewed ON flagged_workouts(reviewed);
CREATE INDEX IF NOT EXISTS idx_flagged_workouts_flagged_at ON flagged_workouts(flagged_at);
CREATE INDEX IF NOT EXISTS idx_fraud_audit_log_user_id ON fraud_audit_log(user_id);
