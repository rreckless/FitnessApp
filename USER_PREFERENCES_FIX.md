# User Preferences JSON Parse Error - Fixed ✅

## Issue

**Error**: `TypeError: cannot convert undefined value to object sql`

**Root Cause**: When retrieving user preferences from the database, the `availableEquipment` field (and potentially `fitnessGoals`) could be `undefined` or `null`. When `JSON.parse()` was called on these undefined values, it threw an error.

## Solution

Updated the `mapRowToUserPreferences()` method in both `UserProfileService` implementations to safely handle undefined/null JSON fields:

### Before (Broken)
```typescript
private mapRowToUserPreferences(row: any): UserPreferences {
  return {
    userId: row.userId,
    fitnessGoals: JSON.parse(row.fitnessGoals),  // ❌ Fails if undefined
    experienceLevel: row.experienceLevel,
    workoutFrequency: row.workoutFrequency,
    availableEquipment: JSON.parse(row.availableEquipment),  // ❌ Fails if undefined
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    syncedAt: row.syncedAt,
  };
}
```

### After (Fixed)
```typescript
private mapRowToUserPreferences(row: any): UserPreferences {
  return {
    userId: row.userId,
    fitnessGoals: row.fitnessGoals ? JSON.parse(row.fitnessGoals) : [],  // ✅ Safe
    experienceLevel: row.experienceLevel,
    workoutFrequency: row.workoutFrequency,
    availableEquipment: row.availableEquipment ? JSON.parse(row.availableEquipment) : [],  // ✅ Safe
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    syncedAt: row.syncedAt,
  };
}
```

## Files Modified

1. **FitQuestNative/src/services/UserProfileService.ts**
   - Updated `mapRowToUserPreferences()` method (line ~790)
   - Added null/undefined checks before JSON.parse()

2. **fitquest-mobile/src/services/UserProfileService.ts**
   - Updated `mapRowToUserPreferences()` method (line ~707)
   - Added null/undefined checks before JSON.parse()

## How It Works

The fix uses the ternary operator to check if the field exists before parsing:
- If the field is truthy (has a value), parse it as JSON
- If the field is falsy (undefined, null, empty string), use an empty array as default

This ensures:
- ✅ No errors when fields are undefined
- ✅ Graceful fallback to empty arrays
- ✅ Type safety maintained
- ✅ Backward compatible with existing data

## Testing

The fix maintains backward compatibility:
- Existing preferences with valid JSON continue to work
- New preferences without equipment/goals default to empty arrays
- No database schema changes required
- All existing tests should continue to pass

## Prevention

To prevent similar issues in the future:
1. Always check for undefined/null before calling JSON.parse()
2. Use optional chaining and nullish coalescing operators
3. Add validation in the insert/update methods to ensure fields are always set
4. Consider using a JSON schema validator

## Related Code

The `createUserPreferences()` method already properly stringifies these fields:
```typescript
await this.db.insert('user_preferences', {
  userId: preferences.userId,
  fitnessGoals: JSON.stringify(preferences.fitnessGoals),  // ✅ Always stringified
  experienceLevel: preferences.experienceLevel,
  workoutFrequency: preferences.workoutFrequency,
  availableEquipment: JSON.stringify(preferences.availableEquipment),  // ✅ Always stringified
  createdAt: preferences.createdAt,
  updatedAt: preferences.updatedAt,
});
```

The issue only occurred during retrieval, not insertion.
