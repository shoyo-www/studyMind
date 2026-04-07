# PrepPal — Complete Project Specification & Prompt

---

## 1. PRODUCT OVERVIEW

**StudyMind** is an AI-powered SaaS study platform built for Indian students. It turns any uploaded study material (PDF, DOCX, PPTX, YouTube links, article URLs, or handwritten note photos) into a full interactive learning system — including AI chat, auto-generated quizzes, learning roadmaps, flashcards, mock exams, and progress analytics.

**Core Promise:**
> Upload your notes once. Get an AI tutor that knows your exact syllabus, creates quizzes, tracks your weak areas, and tells you exactly how prepared you are for your exam.

**Target Users:**
- Indian students preparing for NEET, JEE, UPSC, CA, CAT, GATE, Class 12
- College students managing semester notes
- Self-learners and corporate learners
- Coaching institutes with multiple students

**Differentiator:**
- Works with YOUR notes, not generic content
- Native Hindi + English interface (bilingual)
- Affordable at ₹199/month max — built for Indian students
- Powered by Gemini 2.0 Flash (native PDF support, huge context window)

---

## 2. TECH STACK

| Layer          | Technology                        | Why                                              |
|----------------|-----------------------------------|--------------------------------------------------|
| Frontend       | React 18 + Vite                   | Fast, component-based, easy to deploy            |
| Styling        | Tailwind CSS v3                   | Utility-first, consistent design system          |
| Fonts          | Syne (headings) + DM Sans (body)  | Distinctive, non-generic typography              |
| Hindi Font     | Noto Sans Devanagari              | Beautiful Devanagari script rendering            |
| Backend        | Vercel Serverless Functions (api/)|  No separate server needed, deploys with frontend |
| Database       | Supabase (PostgreSQL)             | Free tier, built-in auth, Row Level Security     |
| Auth           | Supabase Auth (Google + Email)    | Simple OAuth, JWT tokens                         |
| File Storage   | Supabase Storage                  | Secure, private bucket, signed URLs              |
| AI Model       | Gemini 2.0 Flash                  | Native PDF support, cheapest, 1M token context   |
| Payments       | Razorpay                          | India-first, supports UPI, cards, Net Banking    |
| Email          | Resend                            | 3000 emails/month free                           |
| Hosting        | Vercel                            | Free tier, auto-deploy from GitHub               |
| i18n           | Custom React Context (useT hook)  | Lightweight, no external dependency              |

---

## 3. COMPLETE FILE STRUCTURE

```
preppal/
├── index.html                          # HTML entry point (loads Google Fonts)
├── package.json                        # Dependencies: react, vite, tailwind, lucide-react
├── vite.config.js                      # Vite + React plugin config
├── tailwind.config.js                  # Custom tokens: fonts, colors (surface, ink)
├── postcss.config.js                   # Tailwind + autoprefixer
├── vercel.json                         # Serverless function routing + memory config
├── supabase-schema.sql                 # Full DB schema + RLS policies + triggers
├── .env.example                        # All required env variables (never commit .env!)
├── .gitignore                          # Excludes .env, node_modules, dist/
│
├── api/                                # Vercel serverless functions (server-side only)
│   ├── _helpers.js                     # Shared: auth guard, rate limiter, Supabase admin client
│   ├── upload.js                       # POST /api/upload — PDF upload + Gemini processing
│   ├── chat.js                         # POST /api/chat — AI chat with document
│   ├── quiz.js                         # POST /api/quiz — Generate quiz questions
│   └── documents.js                    # GET/DELETE /api/documents — List + delete docs
│
└── src/
    ├── main.jsx                        # Entry: wraps App in LanguageProvider + StrictMode
    ├── App.jsx                         # Root router: landing → auth → app (with Supabase auth listener)
    ├── index.css                       # Tailwind directives + Hindi font switch + scrollbar styles
    │
    ├── data/
    │   └── index.js                    # All static/mock data: DOCS, TOPICS, QUESTIONS, STATS, NAV_ITEMS
    │
    ├── lib/
    │   ├── supabase.js                 # Frontend Supabase client (ANON key only) + auth helpers
    │   └── api.js                      # All frontend API calls → backend (documentsApi, chatApi, quizApi)
    │
    ├── i18n/
    │   ├── en.js                       # English translations (200+ strings)
    │   ├── hi.js                       # Hindi translations (200+ strings, full Devanagari)
    │   └── index.js                    # LanguageProvider context + useT() hook + localStorage persistence
    │
    ├── components/
    │   ├── Sidebar.jsx                 # Left navigation with icons, active state, language switcher
    │   ├── TopBar.jsx                  # Page header with title, subtitle, action slot
    │   ├── StatCard.jsx                # Reusable stat display (label + value + change)
    │   └── LanguageSwitcher.jsx        # EN ⇄ हिंदी toggle (compact sidebar or full topbar variant)
    │
    └── pages/
        ├── Landing.jsx                 # Full marketing landing page
        ├── Auth.jsx                    # Login + Signup (Google OAuth + email/password)
        ├── Dashboard.jsx               # Home: stats, document grid, today's tasks
        ├── Upload.jsx                  # File upload (drag & drop + link import)
        ├── Chat.jsx                    # AI chat with PDF notes (multi-doc sidebar)
        ├── Roadmap.jsx                 # Learning roadmap (topic list with status)
        ├── Quiz.jsx                    # Interactive quiz with feedback + explanations
        ├── Progress.jsx                # Analytics: readiness bars, heatmap, weak topics
        └── Pricing.jsx                 # 3-plan pricing with FAQ + CTA
```

---

## 4. ENVIRONMENT VARIABLES

Create a `.env` file in the project root (never commit this file):

```env
# Supabase (Dashboard → Settings → API)
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key               # Safe for frontend (RLS enforced)
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key    # SERVER ONLY — never expose in frontend

# Gemini AI (aistudio.google.com → Get API Key)
GEMINI_API_KEY=your-gemini-api-key

# App
VITE_API_URL=/api                                  # Frontend calls our own backend
ALLOWED_ORIGIN=https://yourdomain.com              # CORS origin

# Razorpay (when adding payments)
RAZORPAY_KEY_ID=rzp_live_...
RAZORPAY_KEY_SECRET=your-secret
```

---

## 5. DATABASE SCHEMA (Supabase)

### Tables

**profiles** — extends Supabase auth.users
```sql
id                  uuid (PK, references auth.users)
email               text
full_name           text
avatar_url          text
plan                text ('free' | 'pro' | 'institute')
uploads_this_month  int (default 0)
messages_today      int (default 0)
messages_reset_at   timestamptz
created_at          timestamptz
updated_at          timestamptz
```

**documents** — uploaded study materials
```sql
id            uuid (PK)
user_id       uuid (FK → profiles)
title         text
subject       text
storage_path  text (unique, format: {user_id}/{timestamp}-{filename})
total_pages   int
summary       text (2-3 sentence Gemini summary)
topics        jsonb (array of {title, estimatedMinutes, subtopics[]})
file_size     bigint
mime_type     text
pct_covered   int (0-100, updated as user progresses)
created_at    timestamptz
```

**messages** — chat history per document
```sql
id            uuid (PK)
user_id       uuid (FK → profiles)
document_id   uuid (FK → documents)
role          text ('user' | 'assistant')
content       text
created_at    timestamptz
```

**quizzes** — generated quiz sets
```sql
id            uuid (PK)
user_id       uuid (FK → profiles)
document_id   uuid (FK → documents)
topic         text
type          text ('mcq' | 'truefalse' | 'flashcard')
questions     jsonb (array of question objects)
score         int (null until attempted)
attempted     boolean
created_at    timestamptz
```

### Row Level Security
All 4 tables have RLS enabled. Every policy uses `auth.uid() = user_id` — users can ONLY access their own data, even if they use the anon key directly.

### Storage
Private bucket named `documents`. Storage policies ensure users can only upload/read/delete files inside their own `{user_id}/` folder.

### Auto-create profile trigger
When a user signs up, a Postgres trigger automatically creates a `profiles` row from `auth.users` metadata.

---

## 6. BACKEND API ROUTES

All routes live in `api/` as Vercel serverless functions. All keys are server-side only.

### Security layers applied to every route:
1. `requireAuth(req)` — validates Bearer token with Supabase, returns user or throws 401
2. `checkRateLimit(userId, maxPerMinute)` — in-memory rate limiter prevents abuse
3. `.eq('user_id', user.id)` on every DB query — ownership enforcement
4. Plan limit checks — free plan enforced server-side, cannot be bypassed

### POST /api/upload
- Parses multipart form (pdf-parse, formidable)
- Validates file type (PDF/DOCX only) and size (max 50MB)
- Checks user's monthly upload limit (free: 3, pro: unlimited)
- Uploads file to Supabase Storage at `{user_id}/{timestamp}-{filename}`
- Sends PDF to Gemini → extracts title, subject, topics, summary as JSON
- Saves document record to DB with topics JSON
- Increments `uploads_this_month` counter
- Returns: `{ document, topics, summary }`

### POST /api/chat
- Validates auth + rate limit (50 req/min burst)
- Checks daily message limit (free: 20/day, pro: 200/day)
- Fetches document from DB — verifies `user_id` matches
- Downloads PDF from Supabase Storage (server-side, not browser)
- Sends PDF + last 10 messages of history + user question to Gemini
- System prompt: "Answer ONLY from the document content"
- Saves message pair (user + assistant) to messages table
- Increments `messages_today` counter
- Returns: `{ reply, messagesUsed, messagesLimit }`

### POST /api/quiz
- Validates auth + rate limit (20 req/hour)
- Verifies document ownership
- Downloads PDF from Storage
- Sends to Gemini with structured prompt → returns JSON array of questions
- Supports types: `mcq` | `truefalse` | `flashcard`
- Supports topic filter (focus on specific chapter)
- Saves quiz to DB with `attempted: false`, `score: null`
- Returns: `{ quiz, questions }`

### GET /api/documents
- Returns all documents for authenticated user
- Fields: id, title, subject, pages, summary, topics, created_at, file_size
- Ordered by created_at DESC

### DELETE /api/documents
- Verifies ownership before deleting
- Deletes from Supabase Storage (file)
- Deletes related messages and quizzes
- Deletes document record

---

## 7. FRONTEND PAGES — FULL DESCRIPTION

### Landing.jsx
Full marketing page. Sections:
1. **Navbar** — sticky, gets bg on scroll, Logo + nav links + Login/Get Started buttons
2. **Hero** — headline "Upload your notes. Let AI teach you." + badge + CTAs + live app mockup screenshot
3. **Social proof bar** — 2,400+ students, 18,000+ PDFs, 4.9★, ₹199 max
4. **Features grid** — 6 features: Upload Anything, Chat with Notes, Auto Quiz, Smart Roadmap, Progress Analytics, Mock Exam Simulator
5. **How it works** — 3 steps: Upload → Get plan → Study smarter
6. **Testimonials** — 3 Indian student reviews (NEET, MBA, Class 12)
7. **Pricing teaser** — Free/Pro/Institute cards in compact grid
8. **Final CTA** — dark card "Start studying smarter today"
9. **Footer** — logo + links + "Made in India 🇮🇳"

### Auth.jsx
Split-screen layout:
- **Left panel (dark)** — logo, headline, benefits checklist, price callout (₹0 to start)
- **Right panel (white)** — Login/Signup toggle tabs
  - Google OAuth button → calls `auth.signInWithGoogle()`
  - Email + password form with validation
  - Error display (red banner)
  - Loading states on buttons
  - Forgot password link (mode=login)
  - Email confirmation screen after signup
  - Terms of service text on signup
  - Switch between login/signup modes

### Dashboard.jsx
- Greeting based on time of day (morning/afternoon/evening) in selected language
- 4 stat cards: Documents, Topics Covered, Quiz Average, Exam Readiness
- Document grid (3 per row + "Upload new" dashed card)
  - Each doc card: icon, title, pages + date, progress bar, % covered
- Today's Tasks section
  - 3 AI-generated tasks with colored dots and action buttons
  - Links to Quiz, Roadmap pages

### Upload.jsx
- Drag & drop zone (border turns violet on drag hover)
- "Choose File" button
- Divider with "or paste a link"
- Link input + Import button (YouTube, article, Google Drive)
- Supported formats chips (PDF, DOCX, PPTX, YouTube, Article URL, Image/Handwriting)
- Auto-generated features preview (Roadmap, Chat, Quiz, Progress)

### Chat.jsx
- Document sidebar (left) — list of user's docs with progress bars, active state
- Suggestion pills row — 5 quick question prompts
- Message thread — AI and user bubbles, AI avatar, loading dots animation
- Chat input — textarea + Send button (Enter key support)
- AI answers sourced from selected document only

### Roadmap.jsx
- Progress bar in TopBar showing % complete
- Legend: Completed (green) / In progress (violet) / Not started (gray)
- Topic list (timeline style):
  - Done: green circle with checkmark
  - Current: violet circle with play icon + "Practice →" button
  - Pending: numbered circles
  - Each topic: title, time estimate, quiz score, chip tags
  - Chips colored by status (green=done, violet=current, blue=pending)

### Quiz.jsx
- Progress bar + question counter + score badge
- Question card: number label, question text, 4 MCQ options (A/B/C/D)
- Option states: default, hover, selected (correct=green, wrong=red)
- Explanation card appears after answering
  - Shows ✓ Correct / ✗ Incorrect in color
  - Explanation text from document
  - "Next Question →" or "See Results" button
- Results screen: emoji, score, percentage, retake + next topic buttons

### Progress.jsx
- 4 stat cards: Study Streak, Quizzes Done, Best Score, Flashcards
- Subject Readiness bars (Biology, Chemistry, Physics with colored fills)
- Overall exam readiness bar + days to exam
- Study activity heatmap (28 days, 4 intensity levels)
  - Green levels with legend (Less → More)
  - Streak callout with 🔥 emoji
- Weak Topics list:
  - Topic name + mini progress bar
  - Score badge (red)
  - "Quiz →" link per topic

### Pricing.jsx
- Headline: "Learn smarter. Starting at ₹0."
- Savings pill: "Save 20% with yearly billing — Pro at ₹159/month"
- 3-column plan cards:
  - Free: ₹0/forever — 3 uploads, 20 msgs/day
  - Pro: ₹199/month — unlimited everything (dark card, "Most popular" badge)
  - Institute: ₹999/month — 25 students, teacher dashboard
  - Each: feature list with green ✓ / gray ✗ icons
- "Why ₹199 not ₹999?" callout (violet left-border card)
- 5 FAQs (cancel anytime, data safety, price lock, subjects, payments)
- Bottom CTA card (dark): "Start for free today" + two buttons

---

## 8. i18n SYSTEM

Custom language system — no external library needed.

**How it works:**
```jsx
import { useT } from '../i18n'
const { t, lang, setLang, isHindi } = useT()

t('dashboard.greeting')                           // → 'Good morning' or 'सुप्रभात'
t('dashboard.tasksToday', { count: 3 })           // → 'You have 3 topics to review today'
t('quiz.question', { current: 2, total: 10 })     // → 'Question 2 of 10'
```

**Supported languages:** English (en) + Hindi (hi)
**Language persistence:** Saved in `localStorage` as `preppal_lang`
**Font switching:** `[data-lang='hi']` CSS selector switches body font to Noto Sans Devanagari
**Fallback:** Missing Hindi keys fall back to English automatically

**Translation files cover:**
- common (save, cancel, send, start, etc.)
- nav (all sidebar items and section labels)
- dashboard (greeting variants, stat labels, task text)
- upload (dropzone text, formats, features)
- chat (suggestions, placeholder, greeting)
- roadmap (legend, topic status, progress)
- quiz (question counter, feedback, results)
- progress (all analytics labels)
- pricing (all plan copy, FAQ, CTA)
- auth (login/signup labels)
- errors (all error messages)

**To add a new language:**
1. Copy `src/i18n/hi.js` → `src/i18n/ta.js` (Tamil, Telugu, etc.)
2. Translate all strings
3. Import in `src/i18n/index.js` and add to `TRANSLATIONS` object
4. Add button in `LanguageSwitcher.jsx`

---

## 9. SECURITY ARCHITECTURE

```
BROWSER (React frontend)
  ↓ calls only /api/* routes
  ↓ sends JWT Bearer token (from Supabase Auth)
  ↓ never holds service role key or Gemini key

VERCEL SERVERLESS (api/ folder)
  ↓ requireAuth() validates JWT via Supabase
  ↓ checkRateLimit() prevents abuse
  ↓ uses SERVICE_ROLE_KEY (server-side only) for Supabase admin calls
  ↓ uses GEMINI_API_KEY (server-side only) for AI calls
  ↓ all DB queries include .eq('user_id', user.id)

SUPABASE DATABASE
  ↓ Row Level Security enabled on ALL tables
  ↓ Even with anon key, users can only read/write their own rows
  ↓ Storage policies enforce folder-level isolation

SUPABASE STORAGE
  ↓ Private bucket (not public)
  ↓ Signed URLs expire in 1 hour
  ↓ Users can only access files in their own {user_id}/ folder
```

**Rate limits enforced:**
- Uploads: 10 per hour per user
- Chat messages: 50 per minute (burst), 20/day (free), 200/day (pro)
- Quiz generation: 20 per hour per user

**Plan limits enforced server-side (cannot be bypassed):**
- Free: 3 uploads/month, 20 messages/day
- Pro: unlimited uploads, 200 messages/day

---

## 10. GEMINI AI INTEGRATION

Using **Gemini 2.0 Flash** — cheapest, fastest, native PDF support, 1M token context.

**Why Gemini over OpenAI:**
- Native PDF reading — no need for text extraction libraries
- 1M token context = can hold ~700 pages in one call
- $0.10 per 1M tokens — 10x cheaper than GPT-4o
- Context caching — cache PDF once, pay 75% less for all questions

**Cost calculation (with smart approach):**
```
50-page PDF ≈ 50,000 tokens
20 questions/day per user
With context caching: ~₹15-25/user/month
Revenue: ₹199/user/month
Profit margin: ~87%
```

**Prompts used:**

Upload → Topic extraction:
```
Analyse this document and return ONLY a JSON object:
{ title, subject, totalPages, topics: [{title, estimatedMinutes, subtopics[]}], summary }
```

Chat → Q&A:
```
System: Answer ONLY based on content in the provided document.
If the answer is not in the document, say "I couldn't find that in your document."
Keep answers clear, concise and student-friendly.
```

Quiz → MCQ generation:
```
Generate exactly {count} MCQ questions from this document.
Focus on topic: "{topic}" (if provided).
Return ONLY a JSON array:
[{ question, options: ["A)...", "B)..."], correct: 0-3, explanation, topic }]
```

---

## 11. PRICING STRATEGY

| Plan      | Price         | Limits                                    | Target             |
|-----------|---------------|-------------------------------------------|--------------------|
| Free      | ₹0/month      | 3 uploads, 20 msgs/day, 1 roadmap         | Student acquisition |
| Pro       | ₹199/month    | Unlimited uploads, 200 msgs/day, all features | Active students  |
| Institute | ₹999/month    | 25 student seats, teacher dashboard       | Coaching centres   |

**Yearly pricing:** 20% discount (Pro = ₹159/month, Institute = ₹799/month)

**Payment:** Razorpay — supports UPI, Debit/Credit cards, Net Banking, Paytm

**Revenue milestones:**
- 100 Pro users → ₹19,900/month
- 500 Pro users → ₹99,500/month
- 1000 Pro users → ₹1,99,000/month
- 10 Institute plans → ₹9,990/month additional

---

## 12. GO-TO-MARKET PLAN

### Phase 1 — Beta (Weeks 1–4)
- Get 100 free users from college WhatsApp/Telegram groups
- Post on Reddit: r/Indian_Academia, r/UPSC, r/JEE, r/CAT
- Share on LinkedIn with demo video
- Give free Pro to first 50 users in exchange for feedback
- Talk to every user personally (WhatsApp/email)

### Phase 2 — Launch (Weeks 5–8)
- Launch on Product Hunt
- Post on Twitter/X with before/after studying demo
- Reach out to 10–20 coaching centres for Institute plan pilot
- Start collecting testimonials

### Phase 3 — Growth (Months 3–6)
- SEO content: "How to study for NEET", "Best study tools for JEE"
- YouTube channel: study tips + PrepPal tutorials
- Referral program: give 1 month free for each referral that signs up
- Partner with coaching institutes for bulk Institute plans

---

## 13. WHAT IS DONE vs WHAT IS REMAINING

### ✅ Done (Frontend + Architecture)
- Full React + Tailwind UI — all 9 screens
- Landing page (complete marketing page)
- Auth page (Google + email login/signup)
- Dashboard, Upload, Chat, Roadmap, Quiz, Progress, Pricing screens
- Hindi + English i18n system (200+ strings each)
- Secure Vercel serverless API (4 routes)
- Supabase DB schema with RLS policies
- Gemini AI integration architecture
- Rate limiting + plan enforcement (server-side)
- File security (private storage, signed URLs, ownership checks)

### 🔜 Remaining (To go live)

**Week 1 — Wire real data:**
- Replace dummy data in Dashboard with real API calls
- Connect Upload page to `api/upload.js`
- Connect Chat to `api/chat.js`
- Connect Quiz generation to `api/quiz.js`
- Connect Roadmap to real topics from document

**Week 2 — Payments:**
- Add Razorpay script to index.html
- Create `api/payment/create.js` → generates Razorpay order
- Create `api/payment/verify.js` → validates signature + upgrades plan in DB
- Add upgrade UI to Pricing page

**Week 3 — Deploy:**
- Push to GitHub
- Connect repo to Vercel
- Add all environment variables in Vercel dashboard
- Run `supabase-schema.sql` in Supabase SQL editor
- Create `documents` storage bucket (private)
- Enable Google OAuth in Supabase Auth settings
- Test full flow end to end
- Point custom domain (preppal.in)

**Week 4 — Polish:**
- Add loading skeletons for all data fetches
- Add toast notifications (success/error)
- Add empty states ("No documents yet — upload your first!")
- Add document deletion confirmation modal
- Add profile/settings page
- Mobile responsiveness pass

---

## 14. HOW TO RUN LOCALLY

```bash
# 1. Unzip and enter the folder
unzip preppal.zip && cd preppal

# 2. Install dependencies
npm install

# 3. Copy env file and fill in your keys
cp .env.example .env
# Edit .env with your Supabase + Gemini keys

# 4. Start development server
npm run dev
# Opens at http://localhost:5173

# 5. Build for production
npm run build

# 6. Deploy to Vercel
npx vercel --prod
```

---

## 15. NEXT AI PROMPT TO USE

If you want to continue building this project with an AI assistant, paste this entire document and add:

> "Here is the complete specification for PrepPal. The frontend UI is fully built. I now need you to [SPECIFIC TASK]. Please refer to the file structure, tech stack, and API architecture described above."

Replace [SPECIFIC TASK] with one of:
- "wire the Upload page to the real Gemini API"
- "build the Razorpay payment integration"
- "build the profile and settings page"
- "add loading skeletons and empty states to all pages"
- "make the app fully mobile responsive"
- "build the teacher dashboard for the Institute plan"
- "add a flashcard review page with spaced repetition"
- "write the Supabase RLS policies and storage policies"
