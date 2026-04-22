# FitQuest UI Testing Checklist

## Pre-Testing Setup

- [ ] Node.js and npm installed
- [ ] React Native CLI installed
- [ ] Xcode installed (for iOS simulator)
- [ ] iOS simulator available
- [ ] Project dependencies installed (`npm install`)

## Getting Started

- [ ] Start Metro Bundler: `cd mobile && npm start`
- [ ] Run on iOS Simulator: `npx react-native run-ios`
- [ ] App launches successfully
- [ ] Login screen displays correctly

## Login Screen Tests

### UI Elements
- [ ] FitQuest title displays
- [ ] Subtitle "Gamified Fitness" displays
- [ ] Email input field is visible
- [ ] Password input field is visible
- [ ] Login button is visible
- [ ] "Don't have an account? Sign Up" link is visible
- [ ] "Try Demo Account" button is visible
- [ ] Footer text displays

### Login Functionality
- [ ] Can enter email address
- [ ] Can enter password
- [ ] Login button is clickable
- [ ] Loading indicator appears during login
- [ ] Success alert appears on successful login
- [ ] Navigates to home screen after login

### Email Validation
- [ ] Valid email accepted: `test@example.com`
- [ ] Invalid email rejected: `notanemail`
- [ ] Invalid email rejected: `@domain.com`
- [ ] Invalid email rejected: `user@`
- [ ] Error message displays for invalid email

### Password Validation
- [ ] Password field accepts input
- [ ] Password is masked (shows dots)
- [ ] Empty password shows error
- [ ] Error message displays for empty password

### Mode Switching
- [ ] Can click "Don't have an account? Sign Up"
- [ ] Form switches to sign-up mode
- [ ] Username field appears
- [ ] Confirm password field appears
- [ ] Button text changes to "Create Account"
- [ ] Link text changes to "Already have an account? Login"

## Sign-Up Screen Tests

### UI Elements
- [ ] Username input field is visible
- [ ] Email input field is visible
- [ ] Password input field is visible
- [ ] Confirm password input field is visible
- [ ] Create Account button is visible
- [ ] Login toggle link is visible

### Sign-Up Functionality
- [ ] Can enter username
- [ ] Can enter email
- [ ] Can enter password
- [ ] Can enter confirm password
- [ ] Create Account button is clickable
- [ ] Loading indicator appears during creation
- [ ] Success alert appears on successful creation
- [ ] Navigates to home screen after creation

### Username Validation
- [ ] Username field accepts input
- [ ] Empty username shows error
- [ ] Error message displays for empty username

### Email Validation (Sign-Up)
- [ ] Valid email accepted: `test@example.com`
- [ ] Invalid email rejected: `notanemail`
- [ ] Error message displays for invalid email

### Password Validation (Sign-Up)
- [ ] Password field accepts input
- [ ] Password is masked
- [ ] Short password rejected: `pass123` (7 chars)
- [ ] Valid password accepted: `password123` (8+ chars)
- [ ] Error message displays for short password

### Confirm Password Validation
- [ ] Confirm password field accepts input
- [ ] Confirm password is masked
- [ ] Matching passwords accepted
- [ ] Mismatched passwords rejected
- [ ] Error message displays for mismatch

### Mode Switching (Sign-Up)
- [ ] Can click "Already have an account? Login"
- [ ] Form switches to login mode
- [ ] Username field disappears
- [ ] Confirm password field disappears
- [ ] Button text changes to "Login"
- [ ] Link text changes to "Don't have an account? Sign Up"

## Demo Account Tests

- [ ] "Try Demo Account" button is visible
- [ ] Can click "Try Demo Account" button
- [ ] Loading indicator appears
- [ ] Navigates to home screen
- [ ] User ID displays (demo-user-123)

## Home Screen Tests

### UI Elements
- [ ] Welcome message displays
- [ ] User ID displays
- [ ] Logout button is visible (top-right)
- [ ] Stats cards display (Level, XP, Streak, Workouts)
- [ ] Feature cards display (6 cards)
- [ ] App status section displays
- [ ] Content is scrollable

### Stats Cards
- [ ] Level card shows value (1)
- [ ] XP card shows value (0)
- [ ] Streak card shows value (0)
- [ ] Workouts card shows value (0)
- [ ] All cards have labels

### Feature Cards
- [ ] Log Workout card displays
- [ ] Progress Tracking card displays
- [ ] Leaderboard card displays
- [ ] Achievements card displays
- [ ] GPS Tracking card displays
- [ ] Body Tracking card displays
- [ ] Each card has icon and description
- [ ] Cards are clickable (no errors)

### App Status Section
- [ ] Phase displays: "4 Complete"
- [ ] Tests displays: "600+ Passing"
- [ ] Services displays: "20+ Implemented"

### Logout Functionality
- [ ] Logout button is clickable
- [ ] Clicking logout returns to login screen
- [ ] Can login again after logout
- [ ] Can create new account after logout

## Navigation Tests

### Login → Home
- [ ] Create account → Home screen
- [ ] Login → Home screen
- [ ] Demo account → Home screen

### Home → Login
- [ ] Logout → Login screen
- [ ] Can login again

### Screen Transitions
- [ ] Transitions are smooth
- [ ] No visual glitches
- [ ] No console errors

## Responsive Design Tests

### Portrait Mode
- [ ] All elements visible
- [ ] Text is readable
- [ ] Buttons are clickable
- [ ] No overlapping elements
- [ ] Scrolling works smoothly

### Landscape Mode
- [ ] All elements visible
- [ ] Layout adapts correctly
- [ ] Text is readable
- [ ] Buttons are clickable

### Different Screen Sizes
- [ ] iPhone SE (small)
- [ ] iPhone 8 (medium)
- [ ] iPhone X (large with notch)
- [ ] iPad (extra large)

## Accessibility Tests

### Touch Targets
- [ ] Buttons are at least 44x44 points
- [ ] Input fields are easy to tap
- [ ] No overlapping touch targets

### Color Contrast
- [ ] Text is readable on background
- [ ] Buttons have sufficient contrast
- [ ] Error messages are visible

### Keyboard Navigation
- [ ] Can tab through input fields
- [ ] Can submit form with keyboard
- [ ] Keyboard appears for text inputs
- [ ] Keyboard dismisses properly

## Error Handling Tests

### Network Errors
- [ ] App handles network timeouts gracefully
- [ ] Error messages are clear
- [ ] Can retry after error

### Validation Errors
- [ ] Invalid email shows error
- [ ] Short password shows error
- [ ] Mismatched passwords show error
- [ ] Empty fields show error
- [ ] Error messages are clear

### Edge Cases
- [ ] Very long email accepted
- [ ] Very long password accepted
- [ ] Special characters in password accepted
- [ ] Spaces in email rejected
- [ ] Multiple @ symbols rejected

## Performance Tests

- [ ] App launches quickly
- [ ] Screen transitions are smooth
- [ ] No lag when typing
- [ ] No lag when scrolling
- [ ] No memory leaks (check with Xcode)

## Visual Design Tests

### Colors
- [ ] Background is dark (#0a0a0a)
- [ ] Accent color is neon green (#00ff00)
- [ ] Text is white (#fff)
- [ ] Secondary text is gray (#888)
- [ ] Borders are subtle (#333)

### Typography
- [ ] Title is large and bold
- [ ] Headings are clear
- [ ] Body text is readable
- [ ] Labels are visible

### Spacing
- [ ] Padding is consistent
- [ ] Margins are balanced
- [ ] No crowded elements
- [ ] Good use of whitespace

### Icons/Emojis
- [ ] Emojis display correctly
- [ ] Icons are clear
- [ ] Icons match descriptions

## State Management Tests

- [ ] Auth state persists during navigation
- [ ] User ID is passed correctly
- [ ] Token is stored correctly
- [ ] Logout clears state
- [ ] Can login again after logout

## Integration Tests

- [ ] All screens work together
- [ ] Navigation flows smoothly
- [ ] No broken links
- [ ] No missing screens
- [ ] All buttons work

## Final Verification

- [ ] All tests passed
- [ ] No console errors
- [ ] No warnings
- [ ] App is stable
- [ ] Ready for Phase 5 integration

## Sign-Off

- [ ] Tested by: ________________
- [ ] Date: ________________
- [ ] Status: ✅ READY FOR TESTING

---

## Notes

Use this space to document any issues or observations:

```
[Add notes here]
```

## Issues Found

| Issue | Severity | Status | Notes |
|-------|----------|--------|-------|
| | | | |
| | | | |
| | | | |

---

## Summary

- **Total Tests**: 100+
- **Passed**: ___
- **Failed**: ___
- **Skipped**: ___
- **Overall Status**: ✅ READY / ⚠️ NEEDS FIXES / ❌ BLOCKED

---

**Created**: April 22, 2026
**Last Updated**: [Date]
**Version**: 1.0
