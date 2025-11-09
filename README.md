# StudyFlow

**StudyFlow** is an intelligent study planning and scheduling application that integrates with Canvas LMS to automatically generate personalized study schedules based on your coursework, deadlines, and availability.

## Overview

StudyFlow transforms your Canvas assignments and course modules into a structured, time-blocked study plan. By analyzing due dates, workload estimates, and your available time, it creates an optimized schedule to help you stay on track with your academic commitments.

## Key Features

### 🔐 Authentication
- **Firebase Authentication** with multiple sign-in options:
  - Google OAuth
  - Email/Password
- Secure session management with HTTP-only cookies
- Protected routes with server-side verification

### 📚 Canvas LMS Integration
- **Seamless Connection**: Connect your Canvas account using Personal Access Tokens (PAT)
- **Automated Sync**: Import courses, assignments, quizzes, and modules automatically
- **Smart Categorization**: Auto-detects and labels exams, quizzes, assignments, and discussions
- **Smart Estimates**: Automatically estimates study time based on assignment weight or quiz duration
- **Secure Storage**: Canvas tokens encrypted with AES-256-GCM and stored in Firestore

### 🗓️ Intelligent Scheduling
- **Priority-Based Planning**: Tasks sorted by due date and priority level
- **Automatic Session Generation**: Creates study sessions based on your availability
- **Time Block Management**: Respects session length preferences and buffer times
- **Dynamic Replanning**: Automatically adjusts schedule when tasks are completed or priorities change

### 🤖 AI-Powered Study Recommendations
- **ChatGPT Integration**: Analyzes your Canvas coursework to generate personalized study strategies
- **Contextual Insights**: Provides priority focus areas based on your actual deadlines and workload
- **Actionable Advice**: Get specific time management tips and exam preparation strategies
- **Auto-Generation**: Study plan automatically created after Canvas sync

### 📊 Study Management
- **Real-Time Dashboard**: Live updates using Firestore real-time listeners
- **Session Tracking**: Monitor planned, in-progress, and completed sessions
- **Progress Updates**: Mark sessions complete and trigger automatic replanning
- **Task Organization**: View all imported tasks with course context

## Architecture

### Tech Stack

**Frontend:**
- Next.js 15 (React 19)
- TypeScript
- Tailwind CSS 4
- Firebase Client SDK

**Backend:**
- Next.js API Routes
- Firebase Admin SDK
- Firestore Database
- Server-side Authentication

**Key Libraries:**
- `date-fns` - Date manipulation and formatting
- `zod` - Runtime type validation
- `@headlessui/react` - Accessible UI components

### Project Structure

```
src/
├── app/
│   ├── (auth)/
│   │   └── login/              # Authentication pages
│   ├── api/
│   │   ├── auth/
│   │   │   └── session/        # Session cookie management
│   │   ├── canvas/
│   │   │   ├── connect/        # Canvas PAT connection
│   │   │   ├── status/         # Check connection status
│   │   │   └── sync/           # Sync Canvas data
│   │   ├── plan/
│   │   │   └── recompute/      # Regenerate study schedule
│   │   └── user/
│   │       └── me/             # User profile endpoint
│   ├── page.tsx                # Dashboard
│   ├── plan/
│   │   └── page.tsx            # Study plan view
│   ├── session/
│   │   └── [id]/
│   │       └── page.tsx        # Session timer/player
│   └── settings/
│       └── page.tsx            # Canvas & preferences
├── components/
│   ├── CanvasConnectCard.tsx   # Canvas integration UI
│   ├── StudyPlanBoard.tsx      # Session list display
│   ├── SessionPlayer.tsx       # Timer component
│   ├── Protected.tsx           # Server-side auth wrapper
│   └── ...                     # Shared UI components
├── lib/
│   ├── firebase/
│   │   ├── client.ts           # Firebase client initialization
│   │   └── admin.ts            # Firebase Admin SDK
│   ├── auth.ts                 # Server auth helpers
│   ├── canvas.ts               # Encryption utilities
│   ├── scheduling.ts           # Scheduling algorithm
│   └── schema.ts               # Type definitions & validation
```

### Database Schema

**Firestore Collections:**

```
users/{userId}/
  ├── (document)                # User profile & preferences
  ├── private/
  │   └── canvas                # Encrypted Canvas tokens (server-only)
  ├── plans/
  │   └── active/
  │       ├── tasks/            # Imported assignments & modules
  │       └── sessions/         # Generated study sessions
  └── events/                   # User calendar events (future)
```

### Security

**Firestore Rules:**
- User documents: Read/write by owner only
- Private subcollection: No client access (server-only)
- Tasks & sessions: Scoped to authenticated user
- Token encryption: AES-256-GCM with environment-based key

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- Firebase project with Firestore enabled
- Canvas LMS account with API access

### Installation

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd Study_Tool-1
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up Firebase**
   - Create a Firebase project at [console.firebase.google.com](https://console.firebase.google.com)
   - Enable Authentication (Google + Email/Password)
   - Create a Firestore database
   - Download service account key (for Admin SDK)

4. **Configure environment variables**

   Create `.env.local` in the project root:

   ```bash
   # Firebase Client Configuration
   NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
   NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id

   # Firebase Admin SDK (Service Account JSON)
   FIREBASE_SERVICE_ACCOUNT_KEY='{"type":"service_account","project_id":"...","private_key":"...","client_email":"..."}'

   # Token Encryption (generate with: openssl rand -hex 32)
   TOKEN_ENCRYPTION_KEY=your_64_character_hex_string

   # OpenAI API (for AI study plan generation)
   OPENAI_API_KEY=sk-...your_openai_api_key

   # Application
   NEXT_PUBLIC_APP_URL=http://localhost:3000
   ```

   See `.env.local.example` for a complete template.

5. **Get OpenAI API Key** (for AI features)
   - Sign up at [platform.openai.com](https://platform.openai.com)
   - Navigate to API Keys section
   - Create a new secret key
   - Add billing information (GPT-4 access required)
   - Copy the key to your `.env.local` file

6. **Deploy Firestore rules**
   ```bash
   firebase deploy --only firestore:rules
   ```

7. **Generate Canvas Personal Access Token**
   - Log in to your Canvas account
   - Navigate to Account → Settings
   - Under "Approved Integrations", click "+ New Access Token"
   - Set purpose: "StudyFlow Integration"
   - Copy the generated token (you'll need it in the app)

### Running Locally

**Development mode:**
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

**Production build:**
```bash
npm run build
npm start
```

## Usage Guide

### 1. Sign In
- Visit `/login`
- Choose Google sign-in or email/password
- Create an account if you're a new user

### 2. Connect Canvas
- Go to Settings from the dashboard
- Enter your Canvas instance URL (e.g., `https://canvas.instructure.com` or your school's Canvas URL)
- Paste your Personal Access Token
- Click "Connect"

### 3. Sync Your Courses
- After connecting, click "Sync now" in Settings
- StudyFlow will import:
  - All active courses
  - Assignments (auto-categorized as exams, quizzes, assignments, or discussions)
  - Standalone quizzes
  - Course modules
- Tasks are automatically estimated based on points/complexity or quiz duration
- Check the response to see how many tasks were imported

### 4. View Your AI Study Plan
- Navigate to "Study Plan" from the dashboard
- **AI Study Recommendations** appear at the top:
  - Overall study strategy for your current workload
  - Priority focus areas and which courses need attention
  - Weekly study recommendations with time allocation
  - Exam preparation tips and timeline suggestions
  - Time management insights based on your tasks
- Click "Generate AI Plan" to create or refresh recommendations

### 5. Review Study Sessions
- See all scheduled study sessions chronologically
- Sessions show:
  - Date and time
  - Task title and course name
  - Color-coded type badge (exam/quiz/assignment/discussion/module)
  - Status (planned/in-progress/done)

### 6. Start a Study Session
- Click any session to open the timer
- Use the countdown timer to track your study time
- Mark complete when finished
- Plan automatically recomputes to adjust remaining sessions

### 7. Recompute Plan
- Click "Recompute" on the Study Plan page
- Manually trigger a schedule refresh
- Useful after:
  - Changing availability preferences
  - Completing multiple sessions
  - Adding/removing tasks manually

## Scheduling Algorithm

The scheduling engine (`src/lib/scheduling.ts`) implements a smart planning algorithm:

1. **Task Sorting**
   - Primary: Due date (earliest first)
   - Secondary: Priority level (high → normal → low)
   - Filters out completed tasks

2. **Availability Slots**
   - Generates time slots from weekly availability template
   - Default schedule:
     - Weekdays (Mon-Fri): 9 AM - 5 PM (8 hours/day)
     - Weekends (Sat-Sun): 10 AM - 4 PM (6 hours/day)
     - Total: ~52 hours per week available
   - Respects session length preferences (default: 60 minutes)
   - Adds buffer time between sessions (default: 10 minutes)
   - Plans up to 21 days in advance
   - ~44 sessions per week possible with defaults

3. **Session Planning**
   - Assigns tasks to earliest available slots
   - Breaks large tasks into multiple sessions
   - Continues until all tasks scheduled or slots exhausted

4. **Dynamic Adjustment**
   - Preserves completed sessions
   - Replans incomplete sessions when triggered
   - Adapts to task completion and priority changes

## Canvas Integration Details

### Supported Canvas Data

**Courses:**
- Active enrollments only
- Course name and ID captured

**Assignments:**
- Title, due date, points possible
- HTML URL for quick access
- Auto-categorized by type:
  - **Exams**: Keywords (EXAM, TEST, MIDTERM, FINAL) → Red badge
  - **Quizzes**: `online_quiz` submission type or "QUIZ" keyword → Yellow badge
  - **Discussions**: `discussion_topic` submission type → Green badge
  - **Assignments**: All other types → Blue badge
- Auto-estimates study time: `min(240, max(30, points × 10))` minutes
- High priority if due date exists

**Quizzes** (standalone, not linked to assignments):
- Title, due date, time limit
- HTML URL for quick access
- Uses quiz time limit as study time estimate (minimum 30 minutes)
- High priority if due date exists
- Yellow badge in UI

**Modules:**
- Module name and ID
- Default 60-minute estimate
- Normal priority (no due dates)
- Purple badge in UI

### Data Synchronization

- **On-Demand**: Triggered manually via "Sync now" button
- **Upsert Strategy**: Updates existing tasks, adds new ones
- **Task IDs**: Generated from type, course, and title hash
- **Automatic Recompute**: Schedule regenerated after each sync

## API Routes

### Authentication
- `POST /api/auth/session` - Create session cookie from Firebase ID token
- `DELETE /api/auth/session` - Clear session cookie (sign out)

### Canvas Integration
- `POST /api/canvas/connect` - Store encrypted Canvas PAT
- `GET /api/canvas/status` - Check connection status
- `POST /api/canvas/sync` - Fetch and import Canvas data

### Planning
- `POST /api/plan/recompute` - Regenerate study schedule
- `POST /api/plan/ai-generate` - Generate AI study plan using ChatGPT

### User
- `GET /api/user/me` - Get current user profile

## Environment Variables Reference

| Variable | Description | Required |
|----------|-------------|----------|
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Firebase Web API key | Yes |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Firebase Auth domain | Yes |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Firebase project ID | Yes |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | Firebase storage bucket | Yes |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | FCM sender ID | Yes |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | Firebase app ID | Yes |
| `FIREBASE_SERVICE_ACCOUNT_KEY` | Admin SDK service account JSON | Yes |
| `TOKEN_ENCRYPTION_KEY` | 64-char hex string for AES-256 | Yes |
| `OPENAI_API_KEY` | OpenAI API key for AI study plans | Yes |
| `NEXT_PUBLIC_APP_URL` | Application base URL | Optional |

## Development

### Code Quality

**Formatting:**
```bash
npm run format
```

**Linting:**
```bash
npm run lint
```

**Type Checking:**
```bash
npx tsc --noEmit
```

### Testing Locally

As per project rules, always test locally before deploying:

1. Run development server: `npm run dev`
2. Test authentication flow (Google + Email)
3. Connect Canvas and sync data
4. Verify study plan generation
5. Test session completion flow
6. Check browser console for errors

**Production Build Verification:**
```bash
npm run build
```
Fix any TypeScript or build errors before deploying to Vercel.

## Deployment

### Vercel Deployment

1. **Connect repository to Vercel**

2. **Configure environment variables**
   - Add all variables from `.env.local` to Vercel project settings
   - Use the same values, especially encryption key

3. **Deploy**
   ```bash
   vercel deploy --prod
   ```

4. **Verify deployment**
   - Test authentication
   - Test Canvas sync
   - Check Firestore security rules are active

### Firebase Configuration

Ensure production Firebase project has:
- ✅ Authentication enabled (Google + Email/Password)
- ✅ Firestore database created
- ✅ Security rules deployed
- ✅ Service account key generated
- ✅ Domain added to authorized domains (Vercel URL)

## Troubleshooting

### Canvas Connection Issues

**"Invalid token" error:**
- Verify the PAT is copied correctly (no extra spaces)
- Check token hasn't expired
- Ensure token has required permissions

**No courses showing:**
- Confirm you have active enrollments
- Check Canvas base URL is correct
- Verify API access is enabled for your account

### Authentication Problems

**"Admin SDK not configured" warning:**
- Check `FIREBASE_SERVICE_ACCOUNT_KEY` is valid JSON
- Verify service account has necessary permissions
- Client-side auth still works, but session cookies won't be created

**Redirect loop on protected pages:**
- Clear browser cookies
- Sign out and sign in again
- Check Firestore rules allow user document reads

### Scheduling Issues

**No sessions generated:**
- Verify tasks were imported (check Settings → Sync)
- Ensure availability preferences are set (future feature)
- Check tasks have valid due dates or priorities

**Sessions not updating:**
- Firestore real-time listener may be disconnected
- Refresh the page
- Check browser console for errors

## Future Enhancements

Planned features based on implementation plan:

- [ ] **Availability Editor**: Weekly schedule grid for custom availability
- [ ] **Session Preferences**: Customizable session length and buffer times
- [ ] **Task Difficulty**: Manual adjustment of time estimates
- [ ] **Calendar Integration**: Google Calendar sync for busy blocks
- [ ] **Notifications**: Reminders before study sessions
- [ ] **Progress Analytics**: Study time tracking and insights
- [ ] **Manual Tasks**: Add custom tasks not from Canvas
- [ ] **Mobile Optimization**: Responsive design improvements
- [ ] **Dark Mode Preference**: Persistent theme selection

## Contributing

This is a personal project. If you find bugs or have suggestions:

1. Open an issue with details
2. For bugs: Include error messages, browser info, and reproduction steps
3. For features: Describe use case and expected behavior

## License

This project uses the [Tailwind Plus license](https://tailwindcss.com/plus/license) for the original Compass template. StudyFlow-specific code and integrations are proprietary.

## Acknowledgments

- **Template**: Built on Tailwind Plus Compass template
- **Frameworks**: Next.js, React, Tailwind CSS
- **Backend**: Firebase (Auth + Firestore)
- **Icons**: Headless UI, custom SVG icons
- **Inspiration**: Canvas LMS API integration

## Support

For questions or issues:
- Review this README and troubleshooting section
- Check browser console for error messages
- Verify environment variables are configured correctly
- Ensure Firebase and Canvas are properly set up

---

**Built with ❤️ for students managing their coursework**
