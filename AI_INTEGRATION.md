# AI Study Plan Integration

## Overview

StudyFlow now includes **AI-powered study plan generation** using OpenAI's GPT-4o model. The AI analyzes your Canvas coursework data and generates personalized study strategies, priority recommendations, and time management tips.

## Features

### 🤖 AI-Generated Study Plans Include:

1. **Overall Study Strategy**
   - High-level approach considering workload and deadlines
   - Personalized to your specific course load

2. **Priority Focus Areas**
   - Which courses need immediate attention
   - Rationale for prioritization
   - Urgency based on upcoming deadlines

3. **Weekly Study Recommendations**
   - Suggested time allocation per course
   - Best practices for managing your workload
   - Realistic scheduling advice

4. **Exam Preparation Tips**
   - Specific strategies for upcoming exams
   - Timeline recommendations
   - Course-specific prep advice

5. **Time Management Insights**
   - Based on estimated task durations
   - Actionable tips for your schedule
   - Work-life balance considerations

## How It Works

### Data Analysis Process

1. **Canvas Data Collection**
   - Fetches all tasks from your synced Canvas courses
   - Groups by course and categorizes by type (exam, quiz, assignment, etc.)
   - Identifies urgent tasks (due within 7 days)

2. **AI Processing**
   - Sends course breakdown to ChatGPT (GPT-4o)
   - Includes task counts, deadlines, and time estimates
   - Requests specific, actionable study advice

3. **Plan Generation**
   - AI analyzes your unique workload
   - Generates markdown-formatted recommendations
   - Saves to Firestore for real-time display

4. **Storage & Display**
   - Plan stored in `users/{uid}/plans/active` document
   - Real-time updates via Firestore listeners
   - Formatted display in Study Plan page

## Usage

### Automatic Generation

After syncing Canvas:
1. Go to **Settings**
2. Click **"Sync now"**
3. AI study plan automatically generated
4. Navigate to **Study Plan** page to view

### Manual Generation

From Study Plan page:
1. Click **"Generate AI Plan"** button
2. Wait for AI processing (5-15 seconds)
3. Plan appears immediately when complete
4. Click **"Regenerate"** to create a new plan anytime

## Technical Implementation

### API Route

**Endpoint:** `POST /api/plan/ai-generate`

**Authentication:** Firebase ID token required

**Process:**
```typescript
1. Verify user authentication
2. Check OpenAI API key configuration
3. Fetch all tasks from Firestore
4. Group and analyze by course
5. Calculate urgent tasks
6. Generate ChatGPT prompt
7. Call OpenAI API (GPT-4o)
8. Save plan to Firestore
9. Return plan + statistics
```

**Response:**
```json
{
  "ok": true,
  "studyPlan": "# Overall Study Strategy\n...",
  "stats": {
    "totalCourses": 5,
    "totalTasks": 23,
    "urgentTasks": 4
  }
}
```

### UI Component

**Component:** `AIStudyPlan.tsx`

**Features:**
- Real-time plan display
- Generate/Regenerate functionality
- Markdown formatting with custom parser
- Loading states and error handling
- Timestamp display

**Markdown Support:**
- Headers (`#`, `##`, `###`)
- Bold text (`**text**`)
- Bullet lists (`-`, `*`)
- Paragraphs
- Auto-formatting

### Data Schema

**Firestore Document:** `users/{uid}/plans/active`

**Fields:**
```typescript
{
  aiStudyPlan: string          // Markdown-formatted AI response
  aiGeneratedAt: number        // Timestamp (milliseconds)
  aiModel: string              // "gpt-4o"
  updatedAt: number            // Last update timestamp
  // ... other plan fields
}
```

## Configuration

### Environment Variables

**Required:**
```bash
OPENAI_API_KEY=sk-...your_openai_api_key
```

### OpenAI Setup

1. **Sign up for OpenAI**
   - Visit [platform.openai.com](https://platform.openai.com)
   - Create an account or sign in

2. **Create API Key**
   - Navigate to API Keys section
   - Click "Create new secret key"
   - Copy the key (starts with `sk-`)

3. **Add Billing**
   - GPT-4 access requires billing setup
   - Add payment method
   - Set usage limits (optional but recommended)

4. **Configure App**
   - Add key to `.env.local`
   - Restart development server

### Cost Considerations

**GPT-4o Pricing** (as of 2024):
- Input: ~$2.50 per 1M tokens
- Output: ~$10 per 1M tokens

**Typical Usage:**
- Input per request: ~500-1000 tokens
- Output per request: ~500-800 tokens
- **Cost per plan:** ~$0.01-0.02

**Monthly Estimate:**
- Daily sync: ~$0.30/month
- Weekly sync: ~$0.08/month
- As-needed: Variable, very low

**Recommendations:**
- Set OpenAI usage limits
- Monitor via OpenAI dashboard
- Generate plans as-needed vs. automatically

## Error Handling

### Missing API Key
```json
{
  "error": "OpenAI API key not configured"
}
```
**Solution:** Add `OPENAI_API_KEY` to environment variables

### No Tasks Found
```json
{
  "error": "No tasks found. Please sync Canvas first."
}
```
**Solution:** Sync Canvas data before generating plan

### API Errors
```json
{
  "error": "Failed to generate study plan"
}
```
**Possible causes:**
- Rate limiting
- Invalid API key
- Network issues
- OpenAI service outage

## Security

### API Key Protection
- ✅ Server-side only (never exposed to client)
- ✅ Environment variable storage
- ✅ Not included in build output
- ✅ Protected API route with authentication

### Data Privacy
- ✅ Only task metadata sent to OpenAI
- ✅ No personal information in prompts
- ✅ No student names or IDs
- ✅ Plan stored in user's Firestore document

### Firestore Rules
Existing rules cover AI plan data:
```javascript
match /plans/{planId} {
  allow read, write: if isOwner(userId);
}
```

## Customization

### Prompt Engineering

Edit the prompt in `src/app/api/plan/ai-generate/route.ts`:

**Current prompt includes:**
- Total courses and tasks
- Course breakdown by type
- Upcoming deadlines
- Urgent task count

**To customize:**
1. Add more context (preferences, study style, etc.)
2. Request different output format
3. Adjust tone (formal, casual, motivational)
4. Add specific sections

**Example addition:**
```typescript
const userPrefs = await getUserPreferences(user.uid)
prompt += `\n\nStudent Preferences:\n- Prefers: ${userPrefs.studyStyle}\n`
```

### AI Model Selection

**Current:** `gpt-4o` (optimized for speed + quality)

**Alternatives:**
- `gpt-4o-mini` - Faster, cheaper, slightly less capable
- `gpt-4-turbo` - More capable, slower, more expensive
- `gpt-3.5-turbo` - Much cheaper, less sophisticated

**To change:**
```typescript
model: 'gpt-4o-mini', // in ai-generate/route.ts
```

### Output Formatting

Customize `formatStudyPlan()` in `AIStudyPlan.tsx`:
- Add emoji support
- Custom styling
- Interactive elements
- Collapsible sections

## Troubleshooting

### Plan Not Generating

**Check:**
1. OpenAI API key is set correctly
2. Tasks exist in Firestore (sync Canvas first)
3. Browser console for errors
4. Network tab for API response

### Plan Not Displaying

**Check:**
1. Firestore real-time listener connected
2. User authenticated
3. Document exists: `users/{uid}/plans/active`
4. Browser console for component errors

### Slow Generation

**Normal:** 5-15 seconds for GPT-4o

**If slower:**
- Check internet connection
- OpenAI service status
- Try `gpt-4o-mini` for faster responses

### Formatting Issues

**Check:**
- AI output is valid markdown
- `formatStudyPlan()` handles all markdown patterns
- CSS styles applied correctly

## Future Enhancements

Potential improvements:

### Features
- [ ] Study style preferences (visual, auditory, kinesthetic)
- [ ] Historical performance analysis
- [ ] Weekly plan regeneration schedule
- [ ] Email/push notification of plans
- [ ] Plan comparison over time
- [ ] Export to PDF/calendar

### Technical
- [ ] Streaming responses for faster perceived loading
- [ ] Caching to reduce API calls
- [ ] A/B testing different prompts
- [ ] Usage analytics
- [ ] Cost tracking dashboard

### AI Improvements
- [ ] Include past session completion rates
- [ ] Analyze time-of-day productivity
- [ ] Consider course difficulty ratings
- [ ] Integrate with calendar for true availability
- [ ] Multi-language support

## Testing

### Manual Testing Checklist

- [ ] Generate plan with no tasks (should error)
- [ ] Generate plan with minimal tasks (1-2)
- [ ] Generate plan with typical load (10-20 tasks)
- [ ] Generate plan with heavy load (50+ tasks)
- [ ] Regenerate existing plan
- [ ] Test without OpenAI key (should error gracefully)
- [ ] Test with invalid API key
- [ ] Verify Firestore updates
- [ ] Check real-time display updates
- [ ] Test markdown formatting

### Automated Testing

**Example test:**
```typescript
// tests/api/ai-generate.test.ts
describe('AI Study Plan Generation', () => {
  it('should generate plan with valid tasks', async () => {
    // Mock OpenAI response
    // Mock Firestore tasks
    // Call API route
    // Verify response
  })
})
```

## Resources

### Documentation
- [OpenAI API Docs](https://platform.openai.com/docs)
- [GPT-4 Guide](https://platform.openai.com/docs/models/gpt-4)
- [Prompt Engineering](https://platform.openai.com/docs/guides/prompt-engineering)

### Monitoring
- [OpenAI Usage Dashboard](https://platform.openai.com/usage)
- [API Status](https://status.openai.com)

### Support
- [OpenAI Community](https://community.openai.com)
- [API Support](https://help.openai.com)

---

**Implementation Date:** November 8, 2025  
**Version:** 1.0  
**Model:** GPT-4o  
**Status:** ✅ Production Ready

