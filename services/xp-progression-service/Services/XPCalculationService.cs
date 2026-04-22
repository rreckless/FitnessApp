namespace XPProgressionService.Services;

public enum ExerciseDifficulty
{
    Compound,
    Isolation,
    Cardio
}

public interface IXPCalculationService
{
    int CalculateXP(int totalVolume, ExerciseDifficulty difficulty, int streakDays = 0);
    bool ValidateWorkoutData(int maxRepsPerSet, int maxRepsPerExercise, int maxWeight);
}

public class XPCalculationService : IXPCalculationService
{
    private readonly ILogger<XPCalculationService> _logger;

    public XPCalculationService(ILogger<XPCalculationService> logger)
    {
        _logger = logger;
    }

    /// <summary>
    /// Calculate XP based on volume, difficulty, and streak bonus.
    /// Formula: max(volume / 100, 10) × difficulty multiplier × (1 + streak bonus)
    /// Difficulty multipliers: compound 1.2x, isolation 1.0x, cardio 0.8x
    /// Streak bonus: 5% per day, max 50%
    /// </summary>
    public int CalculateXP(int totalVolume, ExerciseDifficulty difficulty, int streakDays = 0)
    {
        // Base XP: max(volume / 100, 10)
        int baseXP = Math.Max(totalVolume / 100, 10);

        // Difficulty multiplier
        double difficultyMultiplier = difficulty switch
        {
            ExerciseDifficulty.Compound => 1.2,
            ExerciseDifficulty.Isolation => 1.0,
            ExerciseDifficulty.Cardio => 0.8,
            _ => 1.0
        };

        // Streak bonus: 5% per day, max 50%
        double streakBonus = Math.Min(streakDays * 0.05, 0.5);

        // Calculate final XP
        double finalXP = baseXP * difficultyMultiplier * (1 + streakBonus);

        return (int)Math.Round(finalXP);
    }

    /// <summary>
    /// Validate workout data against anti-cheat rules.
    /// Max 50 reps/set, max 100 reps/exercise, weight 1-1000 lbs
    /// </summary>
    public bool ValidateWorkoutData(int maxRepsPerSet, int maxRepsPerExercise, int maxWeight)
    {
        const int MAX_REPS_PER_SET = 50;
        const int MAX_REPS_PER_EXERCISE = 100;
        const int MIN_WEIGHT = 1;
        const int MAX_WEIGHT = 1000;

        if (maxRepsPerSet > MAX_REPS_PER_SET)
        {
            _logger.LogWarning($"Invalid reps per set: {maxRepsPerSet} (max: {MAX_REPS_PER_SET})");
            return false;
        }

        if (maxRepsPerExercise > MAX_REPS_PER_EXERCISE)
        {
            _logger.LogWarning($"Invalid reps per exercise: {maxRepsPerExercise} (max: {MAX_REPS_PER_EXERCISE})");
            return false;
        }

        if (maxWeight < MIN_WEIGHT || maxWeight > MAX_WEIGHT)
        {
            _logger.LogWarning($"Invalid weight: {maxWeight} (range: {MIN_WEIGHT}-{MAX_WEIGHT})");
            return false;
        }

        return true;
    }
}
