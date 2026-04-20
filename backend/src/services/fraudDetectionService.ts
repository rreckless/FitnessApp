import { query } from '../database/connection';
import { logger, SecurityEventType } from '../logging/logger';

interface WorkoutValidationResult {
  isValid: boolean;
  errors: string[];
  isSuspicious: boolean;
  suspiciousReasons: string[];
}

interface FlaggedWorkout {
  id: string;
  userId: string;
  reason: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  flaggedAt: string;
  reviewed: boolean;
  reviewedAt?: string;
  reviewedBy?: string;
  reviewNotes?: string;
}

/**
 * ✅ Task 3.2: Validate workout data for anti-cheat
 * Enforces realistic workout constraints
 */
export function validateWorkoutData(
  repsPerSet: number[],
  weight: number,
  exerciseDuration: number,
  totalReps: number
): WorkoutValidationResult {
  const errors: string[] = [];
  const suspiciousReasons: string[] = [];

  // Validate reps per set (max 50)
  for (let i = 0; i < repsPerSet.length; i++) {
    if (repsPerSet[i] > 50) {
      errors.push(`Set ${i + 1}: Maximum 50 reps per set allowed (got ${repsPerSet[i]})`);
    }
  }

  // Validate total reps per exercise (max 100)
  if (totalReps > 100) {
    errors.push(`Maximum 100 total reps per exercise allowed (got ${totalReps})`);
  }

  // Validate weight range (1-1000 lbs)
  if (weight < 1 || weight > 1000) {
    errors.push(`Weight must be between 1 and 1000 lbs (got ${weight})`);
  }

  // Validate exercise duration (5 min - 4 hours = 300-14400 seconds)
  if (exerciseDuration < 300 || exerciseDuration > 14400) {
    errors.push(`Exercise duration must be between 5 minutes and 4 hours (got ${Math.round(exerciseDuration / 60)} minutes)`);
  }

  // Check for suspicious patterns
  if (totalReps > 80) {
    suspiciousReasons.push('Unusually high rep count (>80 reps)');
  }

  if (weight > 500) {
    suspiciousReasons.push('Very heavy weight (>500 lbs)');
  }

  if (repsPerSet.some(reps => reps > 40)) {
    suspiciousReasons.push('Very high reps in single set (>40)');
  }

  // Check for unrealistic rep/weight combinations
  if (weight > 300 && totalReps > 50) {
    suspiciousReasons.push('Unusually high reps with very heavy weight');
  }

  return {
    isValid: errors.length === 0,
    errors,
    isSuspicious: suspiciousReasons.length > 0,
    suspiciousReasons,
  };
}

/**
 * ✅ Task 3.2: Detect fraud patterns in user workouts
 * Analyzes user history for outliers and suspicious patterns
 */
export async function detectFraudPatterns(userId: string, workoutData: any): Promise<{
  isFraudulent: boolean;
  confidence: number;
  reasons: string[];
}> {
  try {
    // Get user's recent workouts
    const recentWorkouts = await query(
      `SELECT total_volume, total_xp, duration, created_at
       FROM workouts
       WHERE user_id = $1 AND deleted_at IS NULL
       ORDER BY created_at DESC
       LIMIT 20`,
      [userId]
    );

    if (recentWorkouts.rows.length === 0) {
      // New user - no history to compare
      return { isFraudulent: false, confidence: 0, reasons: [] };
    }

    const reasons: string[] = [];
    let suspicionScore = 0;

    // Calculate average volume and XP
    const avgVolume = recentWorkouts.rows.reduce((sum: number, w: any) => sum + w.total_volume, 0) / recentWorkouts.rows.length;
    const avgXP = recentWorkouts.rows.reduce((sum: number, w: any) => sum + w.total_xp, 0) / recentWorkouts.rows.length;
    const avgDuration = recentWorkouts.rows.reduce((sum: number, w: any) => sum + w.duration, 0) / recentWorkouts.rows.length;

    // Check for volume outliers (>3x average)
    if (workoutData.totalVolume > avgVolume * 3) {
      reasons.push(`Volume is 3x higher than user average (${workoutData.totalVolume} vs ${Math.round(avgVolume)})`);
      suspicionScore += 30;
    }

    // Check for XP outliers (>3x average)
    if (workoutData.totalXP > avgXP * 3) {
      reasons.push(`XP is 3x higher than user average (${workoutData.totalXP} vs ${Math.round(avgXP)})`);
      suspicionScore += 30;
    }

    // Check for duration outliers (>2x average)
    if (workoutData.duration > avgDuration * 2) {
      reasons.push(`Duration is 2x longer than user average (${Math.round(workoutData.duration / 60)} vs ${Math.round(avgDuration / 60)} minutes)`);
      suspicionScore += 20;
    }

    // Check for rapid consecutive workouts (multiple in same hour)
    const lastWorkout = recentWorkouts.rows[0];
    const timeSinceLastWorkout = (new Date().getTime() - new Date(lastWorkout.created_at).getTime()) / 1000;

    if (timeSinceLastWorkout < 3600) {
      // Less than 1 hour since last workout
      reasons.push('Multiple workouts logged within 1 hour');
      suspicionScore += 15;
    }

    // Check for unrealistic volume/duration ratio
    const volumePerMinute = workoutData.totalVolume / (workoutData.duration / 60);
    const avgVolumePerMinute = avgVolume / (avgDuration / 60);

    if (volumePerMinute > avgVolumePerMinute * 2) {
      reasons.push('Unusually high volume per minute of exercise');
      suspicionScore += 20;
    }

    // Determine if fraudulent based on suspicion score
    const isFraudulent = suspicionScore >= 50;
    const confidence = Math.min(suspicionScore / 100, 1);

    return {
      isFraudulent,
      confidence,
      reasons,
    };
  } catch (error) {
    logger.error('Error detecting fraud patterns', error as Error);
    return { isFraudulent: false, confidence: 0, reasons: [] };
  }
}

/**
 * ✅ Task 3.2: Flag suspicious workout for admin review
 */
export async function flagWorkout(
  workoutId: string,
  userId: string,
  reason: string,
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
): Promise<void> {
  try {
    await query(
      `INSERT INTO flagged_workouts (workout_id, user_id, reason, severity, flagged_at, reviewed)
       VALUES ($1, $2, $3, $4, NOW(), FALSE)`,
      [workoutId, userId, reason, severity]
    );

    logger.logSecurityEvent(SecurityEventType.FRAUD_WORKOUT_FLAGGED, {
      workoutId,
      userId,
      reason,
      severity,
    });
  } catch (error) {
    logger.error('Error flagging workout', error as Error);
    throw error;
  }
}

/**
 * ✅ Task 3.2: Get flagged workouts for admin review
 */
export async function getFlaggedWorkouts(
  limit: number = 50,
  offset: number = 0,
  reviewed?: boolean
): Promise<FlaggedWorkout[]> {
  try {
    let sql = `SELECT id, workout_id, user_id, reason, severity, flagged_at, reviewed, reviewed_at, reviewed_by, review_notes
               FROM flagged_workouts`;
    const params: any[] = [];

    if (reviewed !== undefined) {
      sql += ` WHERE reviewed = $1`;
      params.push(reviewed);
    }

    sql += ` ORDER BY flagged_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const result = await query(sql, params);

    return result.rows.map((row: any) => ({
      id: row.id,
      userId: row.user_id,
      reason: row.reason,
      severity: row.severity,
      flaggedAt: row.flagged_at,
      reviewed: row.reviewed,
      reviewedAt: row.reviewed_at,
      reviewedBy: row.reviewed_by,
      reviewNotes: row.review_notes,
    }));
  } catch (error) {
    logger.error('Error getting flagged workouts', error as Error);
    throw error;
  }
}

/**
 * ✅ Task 3.2: Review flagged workout
 */
export async function reviewFlaggedWorkout(
  flaggedWorkoutId: string,
  approved: boolean,
  reviewNotes: string,
  reviewedBy: string
): Promise<void> {
  try {
    const status = approved ? 'APPROVED' : 'REJECTED';

    await query(
      `UPDATE flagged_workouts
       SET reviewed = TRUE, reviewed_at = NOW(), reviewed_by = $1, review_notes = $2, status = $3
       WHERE id = $4`,
      [reviewedBy, reviewNotes, status, flaggedWorkoutId]
    );

    logger.logSecurityEvent(SecurityEventType.FRAUD_WORKOUT_REVIEWED, {
      flaggedWorkoutId,
      approved,
      reviewedBy,
    });
  } catch (error) {
    logger.error('Error reviewing flagged workout', error as Error);
    throw error;
  }
}

/**
 * ✅ Task 3.2: Rollback XP for fraudulent workout
 */
export async function rollbackWorkoutXP(workoutId: string, userId: string): Promise<void> {
  try {
    // Get workout details
    const workoutResult = await query(
      `SELECT total_xp FROM workouts WHERE id = $1 AND user_id = $2`,
      [workoutId, userId]
    );

    if (workoutResult.rows.length === 0) {
      throw new Error('Workout not found');
    }

    const xpToRollback = workoutResult.rows[0].total_xp;

    // Start transaction
    const client = await (query as any).connect();

    try {
      await client.query('BEGIN');

      // Subtract XP from user
      await client.query(
        `UPDATE users SET total_xp = total_xp - $1 WHERE id = $2`,
        [xpToRollback, userId]
      );

      // Mark workout as fraudulent
      await client.query(
        `UPDATE workouts SET deleted_at = NOW() WHERE id = $1`,
        [workoutId]
      );

      // Create audit log
      await client.query(
        `INSERT INTO fraud_audit_log (workout_id, user_id, xp_rolled_back, action, created_at)
         VALUES ($1, $2, $3, 'XP_ROLLBACK', NOW())`,
        [workoutId, userId, xpToRollback]
      );

      await client.query('COMMIT');

      logger.logSecurityEvent(SecurityEventType.FRAUD_WORKOUT_XP_ROLLED_BACK, {
        workoutId,
        userId,
        xpRolledBack: xpToRollback,
      });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    logger.error('Error rolling back workout XP', error as Error);
    throw error;
  }
}

/**
 * ✅ Task 3.2: Get fraud statistics
 */
export async function getFraudStatistics(): Promise<{
  totalFlaggedWorkouts: number;
  reviewedWorkouts: number;
  approvedWorkouts: number;
  rejectedWorkouts: number;
  totalXPRolledBack: number;
}> {
  try {
    // Get flagged workouts count
    const flaggedResult = await query(
      `SELECT COUNT(*) as count FROM flagged_workouts`
    );

    // Get reviewed workouts count
    const reviewedResult = await query(
      `SELECT COUNT(*) as count FROM flagged_workouts WHERE reviewed = TRUE`
    );

    // Get approved workouts count
    const approvedResult = await query(
      `SELECT COUNT(*) as count FROM flagged_workouts WHERE reviewed = TRUE AND status = 'APPROVED'`
    );

    // Get rejected workouts count
    const rejectedResult = await query(
      `SELECT COUNT(*) as count FROM flagged_workouts WHERE reviewed = TRUE AND status = 'REJECTED'`
    );

    // Get total XP rolled back
    const xpResult = await query(
      `SELECT COALESCE(SUM(xp_rolled_back), 0) as total FROM fraud_audit_log WHERE action = 'XP_ROLLBACK'`
    );

    return {
      totalFlaggedWorkouts: parseInt(flaggedResult.rows[0].count, 10),
      reviewedWorkouts: parseInt(reviewedResult.rows[0].count, 10),
      approvedWorkouts: parseInt(approvedResult.rows[0].count, 10),
      rejectedWorkouts: parseInt(rejectedResult.rows[0].count, 10),
      totalXPRolledBack: parseInt(xpResult.rows[0].total, 10),
    };
  } catch (error) {
    logger.error('Error getting fraud statistics', error as Error);
    throw error;
  }
}
