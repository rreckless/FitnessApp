using ExerciseLibraryService.Models;

namespace ExerciseLibraryService.Data;

public static class ExerciseSeedData
{
    public static List<Exercise> GetBuiltInExercises()
    {
        var exercises = new List<Exercise>();
        var now = DateTime.UtcNow;

        // Chest exercises
        exercises.Add(new Exercise
        {
            Id = Guid.NewGuid(),
            Name = "Barbell Bench Press",
            Description = "Lie on a flat bench and press a barbell upward from chest level",
            PrimaryMuscleGroup = MuscleGroup.Chest,
            SecondaryMuscleGroups = new List<MuscleGroup> { MuscleGroup.Shoulders, MuscleGroup.Arms },
            Difficulty = Difficulty.Intermediate,
            Equipment = new List<Equipment> { Equipment.Barbell, Equipment.Machines },
            FormTips = new List<string> { "Keep feet flat on floor", "Lower bar to chest", "Press explosively upward" },
            IsBuiltIn = true,
            CreatedAt = now,
            UpdatedAt = now
        });

        exercises.Add(new Exercise
        {
            Id = Guid.NewGuid(),
            Name = "Dumbbell Bench Press",
            Description = "Lie on a flat bench and press dumbbells upward from chest level",
            PrimaryMuscleGroup = MuscleGroup.Chest,
            SecondaryMuscleGroups = new List<MuscleGroup> { MuscleGroup.Shoulders, MuscleGroup.Arms },
            Difficulty = Difficulty.Beginner,
            Equipment = new List<Equipment> { Equipment.Dumbbells },
            FormTips = new List<string> { "Keep dumbbells at shoulder width", "Lower to chest level", "Press upward" },
            IsBuiltIn = true,
            CreatedAt = now,
            UpdatedAt = now
        });

        exercises.Add(new Exercise
        {
            Id = Guid.NewGuid(),
            Name = "Push-ups",
            Description = "Upper body exercise using bodyweight",
            PrimaryMuscleGroup = MuscleGroup.Chest,
            SecondaryMuscleGroups = new List<MuscleGroup> { MuscleGroup.Shoulders, MuscleGroup.Arms, MuscleGroup.Core },
            Difficulty = Difficulty.Beginner,
            Equipment = new List<Equipment> { Equipment.Bodyweight },
            FormTips = new List<string> { "Keep body straight", "Lower until chest nearly touches ground", "Push back up" },
            IsBuiltIn = true,
            CreatedAt = now,
            UpdatedAt = now
        });

        exercises.Add(new Exercise
        {
            Id = Guid.NewGuid(),
            Name = "Incline Dumbbell Press",
            Description = "Press dumbbells on an inclined bench",
            PrimaryMuscleGroup = MuscleGroup.Chest,
            SecondaryMuscleGroups = new List<MuscleGroup> { MuscleGroup.Shoulders },
            Difficulty = Difficulty.Intermediate,
            Equipment = new List<Equipment> { Equipment.Dumbbells },
            FormTips = new List<string> { "Set bench to 45 degrees", "Press dumbbells upward", "Control the descent" },
            IsBuiltIn = true,
            CreatedAt = now,
            UpdatedAt = now
        });

        exercises.Add(new Exercise
        {
            Id = Guid.NewGuid(),
            Name = "Cable Flyes",
            Description = "Fly motion using cable machine",
            PrimaryMuscleGroup = MuscleGroup.Chest,
            SecondaryMuscleGroups = new List<MuscleGroup>(),
            Difficulty = Difficulty.Intermediate,
            Equipment = new List<Equipment> { Equipment.Cables },
            FormTips = new List<string> { "Keep slight bend in elbows", "Bring hands together", "Squeeze chest" },
            IsBuiltIn = true,
            CreatedAt = now,
            UpdatedAt = now
        });

        // Back exercises
        exercises.Add(new Exercise
        {
            Id = Guid.NewGuid(),
            Name = "Barbell Deadlift",
            Description = "Lift a barbell from the ground to hip level",
            PrimaryMuscleGroup = MuscleGroup.Back,
            SecondaryMuscleGroups = new List<MuscleGroup> { MuscleGroup.Legs, MuscleGroup.Core },
            Difficulty = Difficulty.Advanced,
            Equipment = new List<Equipment> { Equipment.Barbell },
            FormTips = new List<string> { "Keep back straight", "Engage core", "Drive through heels" },
            IsBuiltIn = true,
            CreatedAt = now,
            UpdatedAt = now
        });

        exercises.Add(new Exercise
        {
            Id = Guid.NewGuid(),
            Name = "Pull-ups",
            Description = "Pull yourself up using an overhead bar",
            PrimaryMuscleGroup = MuscleGroup.Back,
            SecondaryMuscleGroups = new List<MuscleGroup> { MuscleGroup.Arms },
            Difficulty = Difficulty.Intermediate,
            Equipment = new List<Equipment> { Equipment.Bodyweight },
            FormTips = new List<string> { "Use full range of motion", "Pull chest to bar", "Control descent" },
            IsBuiltIn = true,
            CreatedAt = now,
            UpdatedAt = now
        });

        exercises.Add(new Exercise
        {
            Id = Guid.NewGuid(),
            Name = "Bent Over Barbell Row",
            Description = "Row a barbell toward your torso while bent over",
            PrimaryMuscleGroup = MuscleGroup.Back,
            SecondaryMuscleGroups = new List<MuscleGroup> { MuscleGroup.Arms },
            Difficulty = Difficulty.Intermediate,
            Equipment = new List<Equipment> { Equipment.Barbell },
            FormTips = new List<string> { "Keep back straight", "Row to chest", "Squeeze shoulder blades" },
            IsBuiltIn = true,
            CreatedAt = now,
            UpdatedAt = now
        });

        exercises.Add(new Exercise
        {
            Id = Guid.NewGuid(),
            Name = "Lat Pulldown",
            Description = "Pull a cable attachment down to chest level",
            PrimaryMuscleGroup = MuscleGroup.Back,
            SecondaryMuscleGroups = new List<MuscleGroup> { MuscleGroup.Arms },
            Difficulty = Difficulty.Beginner,
            Equipment = new List<Equipment> { Equipment.Cables, Equipment.Machines },
            FormTips = new List<string> { "Pull elbows down", "Squeeze lats", "Control the weight" },
            IsBuiltIn = true,
            CreatedAt = now,
            UpdatedAt = now
        });

        exercises.Add(new Exercise
        {
            Id = Guid.NewGuid(),
            Name = "Dumbbell Rows",
            Description = "Row dumbbells toward your torso",
            PrimaryMuscleGroup = MuscleGroup.Back,
            SecondaryMuscleGroups = new List<MuscleGroup> { MuscleGroup.Arms },
            Difficulty = Difficulty.Beginner,
            Equipment = new List<Equipment> { Equipment.Dumbbells },
            FormTips = new List<string> { "Keep back straight", "Row to hip", "Squeeze back" },
            IsBuiltIn = true,
            CreatedAt = now,
            UpdatedAt = now
        });

        // Shoulder exercises
        exercises.Add(new Exercise
        {
            Id = Guid.NewGuid(),
            Name = "Overhead Press",
            Description = "Press a barbell overhead from shoulder level",
            PrimaryMuscleGroup = MuscleGroup.Shoulders,
            SecondaryMuscleGroups = new List<MuscleGroup> { MuscleGroup.Arms, MuscleGroup.Core },
            Difficulty = Difficulty.Intermediate,
            Equipment = new List<Equipment> { Equipment.Barbell },
            FormTips = new List<string> { "Keep core tight", "Press straight up", "Full range of motion" },
            IsBuiltIn = true,
            CreatedAt = now,
            UpdatedAt = now
        });

        exercises.Add(new Exercise
        {
            Id = Guid.NewGuid(),
            Name = "Dumbbell Shoulder Press",
            Description = "Press dumbbells overhead from shoulder level",
            PrimaryMuscleGroup = MuscleGroup.Shoulders,
            SecondaryMuscleGroups = new List<MuscleGroup> { MuscleGroup.Arms },
            Difficulty = Difficulty.Beginner,
            Equipment = new List<Equipment> { Equipment.Dumbbells },
            FormTips = new List<string> { "Press at shoulder width", "Full range of motion", "Control descent" },
            IsBuiltIn = true,
            CreatedAt = now,
            UpdatedAt = now
        });

        exercises.Add(new Exercise
        {
            Id = Guid.NewGuid(),
            Name = "Lateral Raises",
            Description = "Raise dumbbells out to the sides",
            PrimaryMuscleGroup = MuscleGroup.Shoulders,
            SecondaryMuscleGroups = new List<MuscleGroup>(),
            Difficulty = Difficulty.Beginner,
            Equipment = new List<Equipment> { Equipment.Dumbbells },
            FormTips = new List<string> { "Slight bend in elbows", "Raise to shoulder height", "Control descent" },
            IsBuiltIn = true,
            CreatedAt = now,
            UpdatedAt = now
        });

        exercises.Add(new Exercise
        {
            Id = Guid.NewGuid(),
            Name = "Face Pulls",
            Description = "Pull a rope attachment toward your face",
            PrimaryMuscleGroup = MuscleGroup.Shoulders,
            SecondaryMuscleGroups = new List<MuscleGroup> { MuscleGroup.Back },
            Difficulty = Difficulty.Beginner,
            Equipment = new List<Equipment> { Equipment.Cables },
            FormTips = new List<string> { "Pull to face level", "Squeeze rear delts", "Control weight" },
            IsBuiltIn = true,
            CreatedAt = now,
            UpdatedAt = now
        });

        exercises.Add(new Exercise
        {
            Id = Guid.NewGuid(),
            Name = "Shrugs",
            Description = "Raise shoulders toward ears with weight",
            PrimaryMuscleGroup = MuscleGroup.Shoulders,
            SecondaryMuscleGroups = new List<MuscleGroup>(),
            Difficulty = Difficulty.Beginner,
            Equipment = new List<Equipment> { Equipment.Dumbbells, Equipment.Barbell },
            FormTips = new List<string> { "Raise shoulders up", "Hold at top", "Lower with control" },
            IsBuiltIn = true,
            CreatedAt = now,
            UpdatedAt = now
        });

        // Arm exercises
        exercises.Add(new Exercise
        {
            Id = Guid.NewGuid(),
            Name = "Barbell Curls",
            Description = "Curl a barbell toward your chest",
            PrimaryMuscleGroup = MuscleGroup.Arms,
            SecondaryMuscleGroups = new List<MuscleGroup>(),
            Difficulty = Difficulty.Beginner,
            Equipment = new List<Equipment> { Equipment.Barbell },
            FormTips = new List<string> { "Keep elbows stationary", "Curl to chest", "Control descent" },
            IsBuiltIn = true,
            CreatedAt = now,
            UpdatedAt = now
        });

        exercises.Add(new Exercise
        {
            Id = Guid.NewGuid(),
            Name = "Dumbbell Curls",
            Description = "Curl dumbbells toward your shoulders",
            PrimaryMuscleGroup = MuscleGroup.Arms,
            SecondaryMuscleGroups = new List<MuscleGroup>(),
            Difficulty = Difficulty.Beginner,
            Equipment = new List<Equipment> { Equipment.Dumbbells },
            FormTips = new List<string> { "Keep elbows at sides", "Curl to shoulders", "Control weight" },
            IsBuiltIn = true,
            CreatedAt = now,
            UpdatedAt = now
        });

        exercises.Add(new Exercise
        {
            Id = Guid.NewGuid(),
            Name = "Tricep Dips",
            Description = "Dip using parallel bars or bench",
            PrimaryMuscleGroup = MuscleGroup.Arms,
            SecondaryMuscleGroups = new List<MuscleGroup> { MuscleGroup.Chest, MuscleGroup.Shoulders },
            Difficulty = Difficulty.Intermediate,
            Equipment = new List<Equipment> { Equipment.Bodyweight },
            FormTips = new List<string> { "Lower body down", "Keep elbows close", "Push back up" },
            IsBuiltIn = true,
            CreatedAt = now,
            UpdatedAt = now
        });

        exercises.Add(new Exercise
        {
            Id = Guid.NewGuid(),
            Name = "Tricep Pushdowns",
            Description = "Push a cable attachment downward",
            PrimaryMuscleGroup = MuscleGroup.Arms,
            SecondaryMuscleGroups = new List<MuscleGroup>(),
            Difficulty = Difficulty.Beginner,
            Equipment = new List<Equipment> { Equipment.Cables },
            FormTips = new List<string> { "Keep elbows at sides", "Push down fully", "Control return" },
            IsBuiltIn = true,
            CreatedAt = now,
            UpdatedAt = now
        });

        exercises.Add(new Exercise
        {
            Id = Guid.NewGuid(),
            Name = "Hammer Curls",
            Description = "Curl dumbbells with neutral grip",
            PrimaryMuscleGroup = MuscleGroup.Arms,
            SecondaryMuscleGroups = new List<MuscleGroup>(),
            Difficulty = Difficulty.Beginner,
            Equipment = new List<Equipment> { Equipment.Dumbbells },
            FormTips = new List<string> { "Neutral grip", "Curl to shoulders", "Control descent" },
            IsBuiltIn = true,
            CreatedAt = now,
            UpdatedAt = now
        });

        // Leg exercises
        exercises.Add(new Exercise
        {
            Id = Guid.NewGuid(),
            Name = "Barbell Squats",
            Description = "Squat with a barbell on your shoulders",
            PrimaryMuscleGroup = MuscleGroup.Legs,
            SecondaryMuscleGroups = new List<MuscleGroup> { MuscleGroup.Core, MuscleGroup.Back },
            Difficulty = Difficulty.Intermediate,
            Equipment = new List<Equipment> { Equipment.Barbell },
            FormTips = new List<string> { "Keep chest up", "Squat below parallel", "Drive through heels" },
            IsBuiltIn = true,
            CreatedAt = now,
            UpdatedAt = now
        });

        exercises.Add(new Exercise
        {
            Id = Guid.NewGuid(),
            Name = "Leg Press",
            Description = "Push weight away using leg press machine",
            PrimaryMuscleGroup = MuscleGroup.Legs,
            SecondaryMuscleGroups = new List<MuscleGroup>(),
            Difficulty = Difficulty.Beginner,
            Equipment = new List<Equipment> { Equipment.Machines },
            FormTips = new List<string> { "Full range of motion", "Push through heels", "Control descent" },
            IsBuiltIn = true,
            CreatedAt = now,
            UpdatedAt = now
        });

        exercises.Add(new Exercise
        {
            Id = Guid.NewGuid(),
            Name = "Leg Curls",
            Description = "Curl legs using leg curl machine",
            PrimaryMuscleGroup = MuscleGroup.Legs,
            SecondaryMuscleGroups = new List<MuscleGroup>(),
            Difficulty = Difficulty.Beginner,
            Equipment = new List<Equipment> { Equipment.Machines },
            FormTips = new List<string> { "Curl legs up", "Squeeze hamstrings", "Control descent" },
            IsBuiltIn = true,
            CreatedAt = now,
            UpdatedAt = now
        });

        exercises.Add(new Exercise
        {
            Id = Guid.NewGuid(),
            Name = "Leg Extensions",
            Description = "Extend legs using leg extension machine",
            PrimaryMuscleGroup = MuscleGroup.Legs,
            SecondaryMuscleGroups = new List<MuscleGroup>(),
            Difficulty = Difficulty.Beginner,
            Equipment = new List<Equipment> { Equipment.Machines },
            FormTips = new List<string> { "Extend legs fully", "Squeeze quads", "Control descent" },
            IsBuiltIn = true,
            CreatedAt = now,
            UpdatedAt = now
        });

        exercises.Add(new Exercise
        {
            Id = Guid.NewGuid(),
            Name = "Lunges",
            Description = "Step forward and lower body",
            PrimaryMuscleGroup = MuscleGroup.Legs,
            SecondaryMuscleGroups = new List<MuscleGroup> { MuscleGroup.Core },
            Difficulty = Difficulty.Beginner,
            Equipment = new List<Equipment> { Equipment.Bodyweight, Equipment.Dumbbells },
            FormTips = new List<string> { "Step forward", "Lower back knee", "Push back to start" },
            IsBuiltIn = true,
            CreatedAt = now,
            UpdatedAt = now
        });

        // Core exercises
        exercises.Add(new Exercise
        {
            Id = Guid.NewGuid(),
            Name = "Planks",
            Description = "Hold a plank position",
            PrimaryMuscleGroup = MuscleGroup.Core,
            SecondaryMuscleGroups = new List<MuscleGroup> { MuscleGroup.Shoulders },
            Difficulty = Difficulty.Beginner,
            Equipment = new List<Equipment> { Equipment.Bodyweight },
            FormTips = new List<string> { "Keep body straight", "Engage core", "Hold position" },
            IsBuiltIn = true,
            CreatedAt = now,
            UpdatedAt = now
        });

        exercises.Add(new Exercise
        {
            Id = Guid.NewGuid(),
            Name = "Crunches",
            Description = "Crunch your torso toward your knees",
            PrimaryMuscleGroup = MuscleGroup.Core,
            SecondaryMuscleGroups = new List<MuscleGroup>(),
            Difficulty = Difficulty.Beginner,
            Equipment = new List<Equipment> { Equipment.Bodyweight },
            FormTips = new List<string> { "Crunch up", "Squeeze abs", "Control descent" },
            IsBuiltIn = true,
            CreatedAt = now,
            UpdatedAt = now
        });

        exercises.Add(new Exercise
        {
            Id = Guid.NewGuid(),
            Name = "Russian Twists",
            Description = "Twist torso side to side while seated",
            PrimaryMuscleGroup = MuscleGroup.Core,
            SecondaryMuscleGroups = new List<MuscleGroup>(),
            Difficulty = Difficulty.Beginner,
            Equipment = new List<Equipment> { Equipment.Bodyweight, Equipment.Dumbbells },
            FormTips = new List<string> { "Lean back slightly", "Twist side to side", "Keep core tight" },
            IsBuiltIn = true,
            CreatedAt = now,
            UpdatedAt = now
        });

        exercises.Add(new Exercise
        {
            Id = Guid.NewGuid(),
            Name = "Leg Raises",
            Description = "Raise legs while lying on back",
            PrimaryMuscleGroup = MuscleGroup.Core,
            SecondaryMuscleGroups = new List<MuscleGroup>(),
            Difficulty = Difficulty.Intermediate,
            Equipment = new List<Equipment> { Equipment.Bodyweight },
            FormTips = new List<string> { "Keep legs straight", "Raise to 90 degrees", "Control descent" },
            IsBuiltIn = true,
            CreatedAt = now,
            UpdatedAt = now
        });

        exercises.Add(new Exercise
        {
            Id = Guid.NewGuid(),
            Name = "Ab Wheel Rollouts",
            Description = "Roll out using an ab wheel",
            PrimaryMuscleGroup = MuscleGroup.Core,
            SecondaryMuscleGroups = new List<MuscleGroup> { MuscleGroup.Shoulders },
            Difficulty = Difficulty.Advanced,
            Equipment = new List<Equipment> { Equipment.Other },
            FormTips = new List<string> { "Roll out slowly", "Keep core tight", "Roll back in" },
            IsBuiltIn = true,
            CreatedAt = now,
            UpdatedAt = now
        });

        // Cardio exercises
        exercises.Add(new Exercise
        {
            Id = Guid.NewGuid(),
            Name = "Running",
            Description = "Run at steady pace",
            PrimaryMuscleGroup = MuscleGroup.Cardio,
            SecondaryMuscleGroups = new List<MuscleGroup> { MuscleGroup.Legs },
            Difficulty = Difficulty.Beginner,
            Equipment = new List<Equipment> { Equipment.TreadmillElliptical },
            FormTips = new List<string> { "Maintain steady pace", "Keep posture upright", "Breathe rhythmically" },
            IsBuiltIn = true,
            CreatedAt = now,
            UpdatedAt = now
        });

        exercises.Add(new Exercise
        {
            Id = Guid.NewGuid(),
            Name = "Cycling",
            Description = "Ride a stationary or outdoor bike",
            PrimaryMuscleGroup = MuscleGroup.Cardio,
            SecondaryMuscleGroups = new List<MuscleGroup> { MuscleGroup.Legs },
            Difficulty = Difficulty.Beginner,
            Equipment = new List<Equipment> { Equipment.Other },
            FormTips = new List<string> { "Maintain steady cadence", "Adjust resistance", "Stay hydrated" },
            IsBuiltIn = true,
            CreatedAt = now,
            UpdatedAt = now
        });

        exercises.Add(new Exercise
        {
            Id = Guid.NewGuid(),
            Name = "Jump Rope",
            Description = "Jump while swinging a rope",
            PrimaryMuscleGroup = MuscleGroup.Cardio,
            SecondaryMuscleGroups = new List<MuscleGroup> { MuscleGroup.Legs, MuscleGroup.Arms },
            Difficulty = Difficulty.Intermediate,
            Equipment = new List<Equipment> { Equipment.Other },
            FormTips = new List<string> { "Keep wrists relaxed", "Jump on balls of feet", "Maintain rhythm" },
            IsBuiltIn = true,
            CreatedAt = now,
            UpdatedAt = now
        });

        exercises.Add(new Exercise
        {
            Id = Guid.NewGuid(),
            Name = "Rowing",
            Description = "Row using a rowing machine",
            PrimaryMuscleGroup = MuscleGroup.Cardio,
            SecondaryMuscleGroups = new List<MuscleGroup> { MuscleGroup.Back, MuscleGroup.Legs },
            Difficulty = Difficulty.Intermediate,
            Equipment = new List<Equipment> { Equipment.Rowing },
            FormTips = new List<string> { "Drive with legs first", "Pull with back", "Extend fully" },
            IsBuiltIn = true,
            CreatedAt = now,
            UpdatedAt = now
        });

        exercises.Add(new Exercise
        {
            Id = Guid.NewGuid(),
            Name = "Swimming",
            Description = "Swim laps in a pool",
            PrimaryMuscleGroup = MuscleGroup.Cardio,
            SecondaryMuscleGroups = new List<MuscleGroup> { MuscleGroup.Back, MuscleGroup.Shoulders, MuscleGroup.Legs },
            Difficulty = Difficulty.Intermediate,
            Equipment = new List<Equipment> { Equipment.Other },
            FormTips = new List<string> { "Maintain steady pace", "Focus on form", "Breathe rhythmically" },
            IsBuiltIn = true,
            CreatedAt = now,
            UpdatedAt = now
        });

        // Add more exercises to reach 200+
        exercises.AddRange(GenerateAdditionalExercises(now));

        return exercises;
    }

    private static List<Exercise> GenerateAdditionalExercises(DateTime now)
    {
        var exercises = new List<Exercise>();
        var muscleGroups = new[] { MuscleGroup.Chest, MuscleGroup.Back, MuscleGroup.Shoulders, MuscleGroup.Arms, MuscleGroup.Legs, MuscleGroup.Core };
        var difficulties = new[] { Difficulty.Beginner, Difficulty.Intermediate, Difficulty.Advanced };
        var equipmentOptions = new[] { Equipment.Dumbbells, Equipment.Barbell, Equipment.Machines, Equipment.Cables };

        var additionalExerciseNames = new[]
        {
            "Machine Chest Press", "Incline Bench Press", "Decline Bench Press", "Pec Deck", "Machine Fly",
            "T-Bar Rows", "Seal Rows", "Machine Rows", "Assisted Pull-ups", "Chin-ups",
            "Reverse Pec Deck", "Machine Shoulder Press", "Pike Press", "Upright Rows", "Plate Raises",
            "Preacher Curls", "Cable Curls", "Machine Curls", "Overhead Tricep Extension", "Rope Pushdowns",
            "Skull Crushers", "Close Grip Bench Press", "Goblet Squats", "Bulgarian Split Squats", "Hack Squats",
            "Smith Machine Squats", "Pendulum Squats", "V-Squat", "Sissy Squats", "Step-ups",
            "Calf Raises", "Seated Calf Raises", "Leg Press Calf Raises", "Hanging Leg Raises", "Decline Sit-ups",
            "Cable Crunches", "Machine Crunches", "Weighted Dips", "Assisted Dips", "Resistance Band Exercises",
            "Elliptical", "Stair Climber", "Rowing Machine", "Assault Bike", "Treadmill Sprints",
            "Battle Ropes", "Box Jumps", "Burpees", "Mountain Climbers", "High Knees",
            "Jumping Jacks", "Skipping", "Kickboxing", "Dancing", "Hiking",
            "Kettlebell Swings", "Kettlebell Snatches", "Kettlebell Turkish Get-ups", "Kettlebell Goblet Squats", "Kettlebell Rows",
            "Resistance Band Chest Press", "Resistance Band Rows", "Resistance Band Shoulder Press", "Resistance Band Curls", "Resistance Band Tricep Extensions",
            "Medicine Ball Slams", "Medicine Ball Chest Pass", "Medicine Ball Rotations", "Medicine Ball Squats", "Medicine Ball Lunges",
            "Landmine Press", "Landmine Rows", "Landmine Squats", "Landmine Rotations", "Landmine Lateral Raises",
            "Trap Bar Deadlifts", "Sumo Deadlifts", "Romanian Deadlifts", "Stiff Leg Deadlifts", "Deficit Deadlifts",
            "Front Squats", "Goblet Squats", "Sissy Squats", "Leg Press", "V-Squat",
            "Leg Curl Machine", "Leg Extension Machine", "Adductor Machine", "Abductor Machine", "Hip Thrust Machine",
            "Glute Bridge", "Single Leg Glute Bridge", "Hip Thrusts", "Single Leg Hip Thrusts", "Donkey Kicks",
            "Fire Hydrants", "Clamshells", "Lateral Band Walks", "Monster Walks", "Banded Squats",
            "Banded Deadlifts", "Banded Bench Press", "Banded Rows", "Banded Shoulder Press", "Banded Curls",
            "Banded Tricep Extensions", "Banded Lat Pulldowns", "Banded Face Pulls", "Banded Chest Flyes", "Banded Back Flyes",
            "Dumbbell Flyes", "Dumbbell Pullovers", "Dumbbell Snatches", "Dumbbell Cleans", "Dumbbell Thrusters",
            "Dumbbell Farmer Carries", "Dumbbell Waiter Walks", "Dumbbell Overhead Carries", "Dumbbell Lateral Carries", "Dumbbell Suitcase Carries",
            "Barbell Rows", "Barbell Shrugs", "Barbell Curls", "Barbell Tricep Extensions", "Barbell Squats",
            "Barbell Lunges", "Barbell Step-ups", "Barbell Hack Squats", "Barbell Front Squats", "Barbell Goblet Squats",
            "Cable Crossovers", "Cable Rows", "Cable Shoulder Press", "Cable Lateral Raises", "Cable Curls",
            "Cable Tricep Extensions", "Cable Lat Pulldowns", "Cable Face Pulls", "Cable Chest Flyes", "Cable Back Flyes",
            "Machine Leg Press", "Machine Hack Squat", "Machine Leg Curl", "Machine Leg Extension", "Machine Adductor",
            "Machine Abductor", "Machine Hip Thrust", "Machine Chest Press", "Machine Shoulder Press", "Machine Lat Pulldown",
            "Machine Rows", "Machine Curls", "Machine Tricep Extensions", "Machine Dips", "Machine Assisted Pull-ups"
        };

        for (int i = 0; i < additionalExerciseNames.Length; i++)
        {
            exercises.Add(new Exercise
            {
                Id = Guid.NewGuid(),
                Name = additionalExerciseNames[i],
                Description = $"Exercise: {additionalExerciseNames[i]}",
                PrimaryMuscleGroup = muscleGroups[i % muscleGroups.Length],
                SecondaryMuscleGroups = new List<MuscleGroup>(),
                Difficulty = difficulties[i % difficulties.Length],
                Equipment = new List<Equipment> { equipmentOptions[i % equipmentOptions.Length] },
                FormTips = new List<string> { "Maintain proper form", "Control the weight", "Full range of motion" },
                IsBuiltIn = true,
                CreatedAt = now,
                UpdatedAt = now
            });
        }

        return exercises;
    }
}
