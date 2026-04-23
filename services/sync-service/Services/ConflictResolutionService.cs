namespace SyncService.Services;

/// <summary>
/// Service for resolving sync conflicts using last-write-wins strategy.
/// </summary>
public class ConflictResolutionService : IConflictResolutionService
{
    private readonly ILogger<ConflictResolutionService> _logger;

    /// <summary>
    /// Initializes a new instance of the ConflictResolutionService class.
    /// </summary>
    public ConflictResolutionService(ILogger<ConflictResolutionService> logger)
    {
        _logger = logger;
    }

    /// <summary>
    /// Resolves a sync conflict using last-write-wins strategy with timestamp validation.
    /// The entity with the most recent timestamp wins. If timestamps are equal, local data wins.
    /// </summary>
    /// <param name="localTimestamp">The local data timestamp.</param>
    /// <param name="cloudTimestamp">The cloud data timestamp.</param>
    /// <returns>Tuple indicating whether to use local data and the resolved timestamp.</returns>
    public (bool useLocal, DateTime resolvedTimestamp) ResolveConflict(DateTime localTimestamp, DateTime cloudTimestamp)
    {
        _logger.LogInformation("Resolving conflict: Local={LocalTime}, Cloud={CloudTime}", 
            localTimestamp, cloudTimestamp);

        if (localTimestamp > cloudTimestamp)
        {
            _logger.LogInformation("Conflict resolved: Using local data (newer timestamp)");
            return (true, localTimestamp);
        }
        else if (cloudTimestamp > localTimestamp)
        {
            _logger.LogInformation("Conflict resolved: Using cloud data (newer timestamp)");
            return (false, cloudTimestamp);
        }
        else
        {
            // Same timestamp - use local data as tiebreaker
            _logger.LogInformation("Conflict resolved: Using local data (same timestamp, local wins as tiebreaker)");
            return (true, localTimestamp);
        }
    }

    /// <summary>
    /// Detects if a conflict exists between local and cloud data.
    /// A conflict exists when both have been modified (different timestamps).
    /// </summary>
    /// <param name="localTimestamp">The local data timestamp.</param>
    /// <param name="cloudTimestamp">The cloud data timestamp.</param>
    /// <returns>True if a conflict exists, false otherwise.</returns>
    public bool DetectConflict(DateTime localTimestamp, DateTime cloudTimestamp)
    {
        // Conflict exists if timestamps are different (both have been modified)
        bool hasConflict = localTimestamp != cloudTimestamp;
        
        if (hasConflict)
        {
            _logger.LogWarning("Conflict detected: Local={LocalTime}, Cloud={CloudTime}", 
                localTimestamp, cloudTimestamp);
        }

        return hasConflict;
    }
}
