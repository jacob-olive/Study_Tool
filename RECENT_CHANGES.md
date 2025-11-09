# Recent Changes - Session Generation Fix

## Issue
- Recompute was returning `{"ok":true,"sessions":0}` with no study sessions generated
- Canvas sync wasn't properly categorizing quizzes and exams

## Root Causes

1. **Extremely Limited Default Availability**
   - Previous: Only 6 hours per week (Mon/Wed 6-8 PM, Fri 10-12 AM)
   - This left very little time for session generation

2. **All Canvas Items Labeled as "assignment"**
   - No differentiation between quizzes, exams, assignments, or discussions
   - Standalone quizzes not being fetched from Canvas API

## Changes Made

### 1. Expanded Default Availability (`src/app/api/plan/recompute/route.ts`)

**Before:**
```typescript
weekly: {
  1: [{ start: '18:00', end: '20:00' }],  // Monday 6-8 PM
  3: [{ start: '18:00', end: '20:00' }],  // Wednesday 6-8 PM
  5: [{ start: '10:00', end: '12:00' }]   // Friday 10-12 AM
}
// Total: 6 hours/week
```

**After:**
```typescript
weekly: {
  0: [{ start: '10:00', end: '16:00' }], // Sunday 10 AM - 4 PM
  1: [{ start: '09:00', end: '17:00' }], // Monday 9 AM - 5 PM
  2: [{ start: '09:00', end: '17:00' }], // Tuesday 9 AM - 5 PM
  3: [{ start: '09:00', end: '17:00' }], // Wednesday 9 AM - 5 PM
  4: [{ start: '09:00', end: '17:00' }], // Thursday 9 AM - 5 PM
  5: [{ start: '09:00', end: '17:00' }], // Friday 9 AM - 5 PM
  6: [{ start: '10:00', end: '16:00' }], // Saturday 10 AM - 4 PM
}
// Total: 52 hours/week
```

**Impact:**
- Weekdays: 8 hours/day (9 AM - 5 PM)
- Weekends: 6 hours/day (10 AM - 4 PM)
- **Total: 52 hours per week** available for study sessions
- With 60-minute sessions + 10-minute buffer: ~44 sessions per week possible

### 2. Enhanced Canvas Sync (`src/app/api/canvas/sync/route.ts`)

**New Features:**
- ✅ Fetches quizzes separately from `/api/v1/courses/{id}/quizzes`
- ✅ Auto-categorizes assignments by type:
  - **Exam**: Detected by keywords (EXAM, TEST, MIDTERM, FINAL) in title
  - **Quiz**: Detected by `online_quiz` submission type or "QUIZ" in title
  - **Discussion**: Detected by `discussion_topic` submission type
  - **Assignment**: Default for all other assignments
- ✅ Prevents duplicate quizzes (checks if quiz already linked to assignment)
- ✅ Stores submission types for future filtering/categorization

**Assignment Type Detection Logic:**
```typescript
if (submissionTypes.includes('online_quiz') || nameUpper.includes('QUIZ')) {
  assignmentType = 'quiz'
} else if (nameUpper.includes('EXAM') || nameUpper.includes('TEST') || 
           nameUpper.includes('MIDTERM') || nameUpper.includes('FINAL')) {
  assignmentType = 'exam'
} else if (submissionTypes.includes('discussion_topic')) {
  assignmentType = 'discussion'
}
```

**Quiz Time Estimation:**
- Uses quiz time limit if available
- Minimum 30 minutes
- Example: 60-minute quiz → 60-minute study session

### 3. Improved Study Plan Display (`src/components/StudyPlanBoard.tsx`)

**New Features:**
- ✅ Fetches task details for each session
- ✅ Displays task title (not just ID)
- ✅ Shows course name
- ✅ Color-coded type badges:
  - 🔴 **Exam** - Red badge
  - 🟡 **Quiz** - Yellow badge
  - 🔵 **Assignment** - Blue badge
  - 🟢 **Discussion** - Green badge
  - 🟣 **Module** - Purple badge

**UI Improvements:**
```
┌─────────────────────────────────────────────┐
│ Wed, Nov 13 2:00 PM → 3:00 PM      [exam]  │
│ Chemistry Final Exam                         │
│ CHEM 101                                     │
│ planned                                      │
└─────────────────────────────────────────────┘
```

## Testing Instructions

### 1. Re-sync Canvas Data
```
Settings → Sync now
```
This will re-import all assignments with the new categorization.

### 2. Recompute Study Plan
```
Study Plan → Recompute
```
Should now generate many more sessions with the expanded availability.

### 3. Expected Results
- ✅ Sessions spread across all 7 days of the week
- ✅ Proper type labels (exam, quiz, assignment, etc.)
- ✅ Readable task titles instead of IDs
- ✅ Course names displayed
- ✅ Color-coded badges by type

### 4. Verify in Browser
```bash
npm run dev
```
1. Navigate to Settings and sync Canvas
2. Check console for import count
3. Go to Study Plan
4. Click Recompute
5. Verify sessions appear with proper details

## Build Status

✅ **Build Successful**
```
npm run build
```
- All TypeScript types valid
- No linter errors
- Production build ready

## Impact Summary

| Metric | Before | After |
|--------|--------|-------|
| Available hours/week | 6 | 52 |
| Possible sessions/week | ~5 | ~44 |
| Assignment types | 1 (generic) | 5 (categorized) |
| Quiz sources | Assignments only | Assignments + Quizzes endpoint |
| Task display | ID only | Title + Course + Type |

## Future Improvements

- [ ] Allow users to customize availability in UI (currently using defaults)
- [ ] Add filters by task type (show only exams, quizzes, etc.)
- [ ] Add search/filter for specific courses
- [ ] Implement timezone support (currently UTC)
- [ ] Add session length preferences per task type
- [ ] Bulk operations (mark multiple sessions complete)

---

**Date**: November 8, 2025  
**Build Status**: ✅ Passing  
**Deployment Ready**: Yes

