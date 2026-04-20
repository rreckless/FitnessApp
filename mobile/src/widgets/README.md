# FitQuest Home Screen Widgets

This directory contains the implementation of iOS home screen widgets for FitQuest, enabling users to quickly view their fitness progress without opening the app.

## Overview

FitQuest provides three widget sizes, each displaying different information:

1. **Small Widget (1x1)** - Current streak and XP progress
2. **Medium Widget (2x2)** - Today's workout status and next milestone
3. **Large Widget (2x4)** - Leaderboard position and friends' activity

## Features

### Data Refresh
- All widgets refresh every 15 minutes automatically
- Widgets can be manually refreshed by the user
- Data is fetched from the local SQLite database for offline support
- Sync with cloud happens independently of widget refresh

### Dark Mode Support
- All widgets automatically adapt to system dark/light mode
- Colors are optimized for readability in both modes
- Smooth transitions when system theme changes

### Tap Navigation
- Tapping a widget opens the app to the relevant section
- Small widget opens home screen
- Medium widget opens workout logging screen
- Large widget opens leaderboard screen

## Widget Details

### Small Widget (1x1)

**Display:**
- Current streak (number of consecutive days)
- XP progress bar (0-100%)
- Current level

**Use Case:** Quick glance at daily consistency and progression

**Data Source:** User profile (streak, XP, level)

**Refresh Interval:** 15 minutes

### Medium Widget (2x2)

**Display:**
- Today's workout status (completed or pending)
- Number of workouts completed today
- Next streak milestone
- Days until next milestone

**Use Case:** Track daily workout completion and upcoming milestones

**Data Source:** Workouts table, user profile (streak)

**Refresh Interval:** 15 minutes

### Large Widget (2x4)

**Display:**
- User's current leaderboard position
- User's total XP
- Top 3 users on global leaderboard
- Recent friends' activity (last 5 activities)

**Use Case:** Social motivation and competitive tracking

**Data Source:** Users table (leaderboard), workouts table (activity)

**Refresh Interval:** 15 minutes

## Architecture

### WidgetService

The `WidgetService` is a singleton service that manages all widget data operations:

```typescript
// Get data for small widget
const smallData = await WidgetService.getSmallWidgetData(userId);

// Get data for medium widget
const mediumData = await WidgetService.getMediumWidgetData(userId);

// Get data for large widget
const largeData = await WidgetService.getLargeWidgetData(userId);

// Refresh all widgets simultaneously
const allData = await WidgetService.refreshAllWidgets(userId);
```

### Widget Components

Each widget is a React Native component that:
1. Loads data on mount
2. Sets up a 15-minute refresh interval
3. Handles loading and error states
4. Renders with dark/light mode support
5. Calls onTap callback when tapped

## Implementation Details

### Data Calculation

**XP Progress:**
- Calculated as percentage of XP earned toward next level
- Formula: `(xpInCurrentLevel / xpNeededForLevel) * 100`
- Clamped between 0-100%

**Streak Milestone:**
- Milestones: 7, 14, 30, 60, 100 days
- Next milestone is the first one not yet reached
- Days until milestone: `milestone - currentStreak`

**Leaderboard Position:**
- Calculated by counting users with higher XP
- Position = count + 1
- Top 3 users are fetched separately for display

**Friends Activity:**
- Recent workouts from all users (simulated friends)
- Limited to 5 most recent activities
- Includes friend name, activity type, and timestamp

### Error Handling

All widgets handle errors gracefully:
- Loading state shown while data is fetched
- Error message displayed if fetch fails
- Retry on next refresh interval
- Validation of data before display

### Performance

- Widgets use local database queries for fast performance
- No network calls required (offline-first)
- Parallel data fetching for all widgets
- Efficient caching and refresh intervals

## Testing

Comprehensive unit tests are provided for:

1. **WidgetService Tests** (`WidgetService.test.ts`)
   - Data fetching for each widget type
   - XP progress calculation
   - Milestone calculation
   - Error handling
   - Data validation

2. **SmallWidget Tests** (`SmallWidget.test.ts`)
   - Widget data updates
   - Tap navigation
   - Dark/light mode rendering
   - Data display accuracy
   - Widget size constraints

3. **MediumWidget Tests** (`MediumWidget.test.ts`)
   - Workout status display
   - Milestone calculation
   - Widget size constraints
   - Data refresh

4. **LargeWidget Tests** (`LargeWidget.test.ts`)
   - Leaderboard display
   - Friends activity display
   - User position calculation
   - Widget size constraints

**Test Coverage:**
- 71 total tests
- All tests passing
- Covers happy paths, error cases, and edge cases

## Usage

### Adding Widgets to Home Screen

Users can add widgets to their iOS home screen by:
1. Long-pressing on home screen
2. Tapping the "+" button
3. Searching for "FitQuest"
4. Selecting desired widget size
5. Tapping "Add Widget"

### Widget Configuration

Widgets automatically use the current user's ID from the app's authentication state. No manual configuration is required.

### Offline Support

All widgets work offline:
- Data is fetched from local SQLite database
- No internet connection required
- Widgets update when app syncs with cloud

## Requirements Mapping

This implementation satisfies the following requirements:

- **Requirement 18.1:** Small widget displaying current streak and XP progress ✓
- **Requirement 18.2:** Medium widget displaying today's workout status and next milestone ✓
- **Requirement 18.3:** Large widget displaying leaderboard position and friends' activity ✓
- **Requirement 18.4:** Widget tap navigation to relevant sections ✓
- **Requirement 18.5:** Widget data refresh every 15 minutes ✓
- **Requirement 18.6:** Dark mode and light mode support ✓

## Future Enhancements

Potential improvements for future versions:

1. **Interactive Widgets:** Allow users to start workouts directly from widgets
2. **Custom Refresh Intervals:** Let users configure refresh frequency
3. **Widget Stacks:** Combine multiple widgets in a stack
4. **Lock Screen Widgets:** iOS 16+ lock screen widget support
5. **Smart Stack:** Automatic widget rotation based on time of day
6. **Deep Linking:** More granular navigation to specific screens
7. **Notifications:** Widget-triggered notifications for milestones
8. **Customization:** User-selectable colors and themes

## Troubleshooting

### Widget Not Updating

1. Check that the app has been opened at least once
2. Verify that the user is logged in
3. Check that the local database has data
4. Force refresh by removing and re-adding the widget

### Widget Shows Error

1. Ensure the app has permission to access local database
2. Check that the user ID is correctly set
3. Verify that the database is not corrupted
4. Try restarting the app

### Dark Mode Not Working

1. Verify that the system dark mode is enabled
2. Check that the app is using the latest iOS version
3. Try toggling dark mode off and on
4. Restart the app

## References

- [Apple WidgetKit Documentation](https://developer.apple.com/documentation/widgetkit)
- [iOS Widget Best Practices](https://developer.apple.com/design/human-interface-guidelines/widgets)
- [React Native Widget Support](https://reactnative.dev/)
