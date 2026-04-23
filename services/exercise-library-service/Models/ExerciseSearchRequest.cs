namespace ExerciseLibraryService.Models;

public class ExerciseSearchRequest
{
    public string? Query { get; set; }
    public MuscleGroup? MuscleGroup { get; set; }
    public Difficulty? Difficulty { get; set; }
    public int Page { get; set; } = 1;
    public int PageSize { get; set; } = 20;
}

public class ExerciseResponse
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string PrimaryMuscleGroup { get; set; } = string.Empty;
    public List<string> SecondaryMuscleGroups { get; set; } = new();
    public string Difficulty { get; set; } = string.Empty;
    public List<string> Equipment { get; set; } = new();
    public List<string> FormTips { get; set; } = new();
    public string? VideoUrl { get; set; }
    public bool IsBuiltIn { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class CreateCustomExerciseRequest
{
    public string Name { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public MuscleGroup PrimaryMuscleGroup { get; set; }
    public List<MuscleGroup> SecondaryMuscleGroups { get; set; } = new();
    public Difficulty Difficulty { get; set; }
    public List<Equipment> Equipment { get; set; } = new();
    public List<string> FormTips { get; set; } = new();
    public string? VideoUrl { get; set; }
}

public class PaginatedResponse<T>
{
    public List<T> Items { get; set; } = new();
    public int Page { get; set; }
    public int PageSize { get; set; }
    public int TotalCount { get; set; }
    public int TotalPages => (TotalCount + PageSize - 1) / PageSize;
}
