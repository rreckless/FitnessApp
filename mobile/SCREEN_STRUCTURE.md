# FitQuest Screen Structure

## App Navigation Flow

```
┌─────────────────────────────────────────────────────────┐
│                      App.tsx                             │
│                  (Navigation Logic)                      │
└─────────────────────────────────────────────────────────┘
                          │
                ┌─────────┴─────────┐
                │                   │
        ┌───────▼────────┐  ┌──────▼──────────┐
        │  AuthScreen    │  │  HomeScreen    │
        │  (Login/SignUp)│  │  (Main App)    │
        └────────────────┘  └────────────────┘
```

## AuthScreen Component

### File
`mobile/src/screens/AuthScreen.tsx`

### States
- **Login Mode** (default)
  - Email input
  - Password input
  - Login button
  - Sign-up toggle

- **Sign-Up Mode**
  - Username input
  - Email input
  - Password input
  - Confirm password input
  - Create account button
  - Login toggle

### Features
- Form validation
- Loading indicators
- Error alerts
- Success alerts
- Demo account quick login

### Props
```typescript
interface AuthScreenProps {
  onLoginSuccess: (userId: string, token: string) => void;
}
```

### Layout
```
┌─────────────────────────────────────┐
│                                     │
│         FitQuest Logo               │
│      Gamified Fitness               │
│                                     │
├─────────────────────────────────────┤
│                                     │
│  [Email Input Field]                │
│  [Password Input Field]             │
│  [Confirm Password] (SignUp only)   │
│  [Username] (SignUp only)           │
│                                     │
│  [Login/Create Account Button]      │
│  [Toggle Sign-Up/Login Link]        │
│                                     │
│  ─────────── OR ───────────         │
│                                     │
│  [Try Demo Account Button]          │
│                                     │
├─────────────────────────────────────┤
│  Phase 4 Complete • 600+ Tests      │
└─────────────────────────────────────┘
```

## HomeScreen Component

### File
`mobile/src/screens/HomeScreen.tsx`

### Features
- User greeting
- Stats display
- Feature cards
- App status
- Logout button

### Props
```typescript
interface HomeScreenProps {
  userId: string;
  token: string;
  onLogout: () => void;
}
```

### Layout
```
┌─────────────────────────────────────┐
│  Welcome back!          [Logout]    │
│  user-abc123def                     │
├─────────────────────────────────────┤
│                                     │
│  ┌──────────┐  ┌──────────┐        │
│  │    1     │  │    0     │        │
│  │  Level   │  │   XP     │        │
│  └──────────┘  └──────────┘        │
│  ┌──────────┐  ┌──────────┐        │
│  │    0     │  │    0     │        │
│  │  Streak  │  │ Workouts │        │
│  └──────────┘  └──────────┘        │
│                                     │
├─────────────────────────────────────┤
│  Features                           │
│                                     │
│  💪 Log Workout                     │
│     Track your exercises and sets   │
│                                     │
│  📊 Progress Tracking               │
│     View your personal records      │
│                                     │
│  🏆 Leaderboard                     │
│     Compete with friends            │
│                                     │
│  🎯 Achievements                    │
│     Unlock badges and rewards       │
│                                     │
│  📍 GPS Tracking                    │
│     Track outdoor workouts          │
│                                     │
│  ⚖️ Body Tracking                   │
│     Monitor weight and measurements │
│                                     │
├─────────────────────────────────────┤
│  App Status                         │
│  Phase: 4 Complete                  │
│  Tests: 600+ Passing                │
│  Services: 20+ Implemented          │
└─────────────────────────────────────┘
```

## Component Hierarchy

```
App
├── AuthScreen (when not authenticated)
│   ├── ScrollView
│   ├── Header
│   │   ├── Title
│   │   └── Subtitle
│   ├── FormContainer
│   │   ├── TextInput (Email)
│   │   ├── TextInput (Password)
│   │   ├── TextInput (Confirm Password) [SignUp]
│   │   ├── TextInput (Username) [SignUp]
│   │   ├── Button (Login/Create Account)
│   │   ├── Button (Toggle Mode)
│   │   ├── Divider
│   │   └── Button (Demo Login)
│   └── Footer
│
└── HomeScreen (when authenticated)
    ├── SafeAreaView
    ├── ScrollView
    ├── Header
    │   ├── Greeting
    │   └── LogoutButton
    ├── StatsGrid
    │   ├── StatCard (Level)
    │   ├── StatCard (XP)
    │   ├── StatCard (Streak)
    │   └── StatCard (Workouts)
    ├── FeaturesSection
    │   ├── FeatureCard (Log Workout)
    │   ├── FeatureCard (Progress Tracking)
    │   ├── FeatureCard (Leaderboard)
    │   ├── FeatureCard (Achievements)
    │   ├── FeatureCard (GPS Tracking)
    │   └── FeatureCard (Body Tracking)
    └── StatusSection
        ├── StatusItem (Phase)
        ├── StatusItem (Tests)
        └── StatusItem (Services)
```

## Data Flow

```
User Input
    │
    ▼
AuthScreen
    │
    ├─ Validation
    │   ├─ Email format
    │   ├─ Password length
    │   └─ Password matching
    │
    ├─ Mock API Call
    │   └─ Simulate 1.5s delay
    │
    └─ Success/Error
        │
        ├─ Error: Show Alert
        │
        └─ Success: Call onLoginSuccess()
            │
            ▼
        App.tsx
            │
            ├─ Update authState
            │   ├─ isAuthenticated = true
            │   ├─ userId = "user-xxx"
            │   └─ token = "token-xxx"
            │
            └─ Render HomeScreen
                │
                ├─ Display user stats
                ├─ Show features
                └─ Enable logout
```

## Styling System

### Colors
```
Primary Background:    #0a0a0a
Secondary Background:  #1a1a1a
Border Color:          #333
Primary Text:          #fff
Secondary Text:        #888
Accent Color:          #00ff00
Error Color:           #ff4444
```

### Spacing
```
Small:    8px
Medium:   12px
Large:    16px
XLarge:   20px
```

### Border Radius
```
Small:    6px
Medium:   8px
Large:    12px
```

### Typography
```
Title:           48px, Bold, #00ff00
Heading:         24px, Bold, #fff
Section Title:   18px, Bold, #fff
Body:            16px, Regular, #fff
Label:           14px, Regular, #888
Small:           12px, Regular, #888
```

## State Management

### App.tsx
```typescript
interface AuthState {
  isAuthenticated: boolean;
  userId: string | null;
  token: string | null;
}
```

### AuthScreen
```typescript
- email: string
- password: string
- confirmPassword: string
- username: string
- isSignUp: boolean
- loading: boolean
```

### HomeScreen
```typescript
- userStats: {
    level: number
    xp: number
    streak: number
    workouts: number
  }
```

## Event Handlers

### AuthScreen
- `handleSignUp()` - Validate and create account
- `handleLogin()` - Validate and login
- `handleDemoLogin()` - Quick demo login
- `validateEmail()` - Email format validation
- `validatePassword()` - Password length validation

### HomeScreen
- `onLogout()` - Logout and return to auth

### App.tsx
- `handleLoginSuccess()` - Update auth state
- `handleLogout()` - Clear auth state

## Responsive Design

### Breakpoints
- **Small**: < 375px (iPhone SE)
- **Medium**: 375-667px (iPhone 8)
- **Large**: 667-812px (iPhone X)
- **XLarge**: > 812px (iPad)

### Adaptations
- Stat cards: 2 columns on all sizes
- Feature cards: Full width, stack vertically
- Padding: Consistent 16px on all sizes
- Font sizes: Optimized for readability

## Accessibility

- ✅ Clear labels for inputs
- ✅ High contrast colors
- ✅ Touch-friendly button sizes (44x44 minimum)
- ✅ Keyboard navigation support
- ✅ Error messages are descriptive
- ✅ Loading states are clear
- ✅ Safe area support for notched devices

## Performance Optimizations

- ✅ Minimal re-renders
- ✅ Efficient state management
- ✅ Optimized images (emoji)
- ✅ Lazy loading for scrollable content
- ✅ Memoized components (where needed)
- ✅ Proper cleanup in useEffect

## Testing Scenarios

1. **Happy Path**: Create account → Login → Logout
2. **Validation**: Test all validation rules
3. **Demo Account**: Quick login with demo
4. **Error Handling**: Test error alerts
5. **Loading States**: Verify loading indicators
6. **Navigation**: Test screen transitions
