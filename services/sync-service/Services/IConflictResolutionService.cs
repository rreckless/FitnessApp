namespace SyncService.Services;

/// <summary>
/// Interface for conflict resolution service.
/// </summary>
public interface IConflictResolutionService
{
    /// <summary>
    /// Resolves a sync conflict using last-write-wins strategy with timestamp validation.
    /// </summary>
    /// <param name="localData">The local data with timestamp.</param>
    /// <param name="cloudData">The cloud data with timestamp.</param>
    /// <returns>The resolved data (either local or cloud).</returns>
    (bool useLocal, DateTime resolvedTimestamp) ResolveConflict(DateTime localTimestamp, DateTime cloudTimestamp);

    /// <summary>
    /// Detects if a conflict exists between local and cloud data.
    /// </summary>
    /// <param name="localTimestamp">The local data timestamp.</param>
    /// <param name="cloudTimestamp">The cloud data timestamp.</param>
    /// <returns>True if a conflict exists, false otherwise.</returns>
    bool DetectConflict(DateTime localTimestamp, DateTime cloudTimestamp);
}
