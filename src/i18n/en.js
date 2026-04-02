// src/i18n/en.js — English translations

const en = {
  // ── Common ──────────────────────────────────────────────
  common: {
    save:         'Save',
    cancel:       'Cancel',
    delete:       'Delete',
    edit:         'Edit',
    back:         'Back',
    next:         'Next',
    done:         'Done',
    loading:      'Loading...',
    retry:        'Try again',
    upgrade:      'Upgrade to Pro',
    learnMore:    'Learn more',
    send:         'Send',
    start:        'Start',
    resume:       'Resume',
    practice:     'Practice',
    comingSoon:   'Coming soon',
  },

  // ── Nav ─────────────────────────────────────────────────
  nav: {
    dashboard:  'Dashboard',
    upload:     'Upload Material',
    chat:       'Chat with Notes',
    roadmap:    'Roadmap',
    quiz:       'Quiz & Practice',
    progress:   'My Progress',
    pricing:    'Pricing',
    overview:   'Overview',
    learn:      'Learn',
    account:    'Account',
  },

  // ── Dashboard ───────────────────────────────────────────
  dashboard: {
    greeting:         'Good morning',
    greetingAfternoon:'Good afternoon',
    greetingEvening:  'Good evening',
    tasksToday:       'You have {{count}} topics to review today',
    uploadNew:        'Upload new',
    yourDocuments:    'Your Documents',
    todaysTasks:      "Today's Tasks",
    pages:            'pages',
    covered:          'covered',
    stats: {
      documents:    'Documents',
      topics:       'Topics Covered',
      quizAvg:      'Quiz Average',
      readiness:    'Exam Readiness',
      daysLeft:     'days to exam',
      thisWeek:     'this week',
    },
    tasks: {
      reviewWeak:   'Review {{topic}} — your weakest topic ({{score}}%)',
      continueRoadmap: 'Continue {{doc}} roadmap — {{count}} topics left',
      takeMock:     'Take Mock Exam — {{subject}}, you are ready!',
    },
  },

  // ── Upload ──────────────────────────────────────────────
  upload: {
    title:        'Upload Study Material',
    subtitle:     'PDF, PPT, Word docs, or paste a link',
    dropzone:     'Drop your files here',
    dropzoneSub:  'PDF, DOCX, PPTX · up to 50 MB',
    chooseFile:   'Choose file',
    pasteLink:    'or paste a link',
    linkPlaceholder: 'Paste YouTube, article, or Google Drive link...',
    import:       'Import',
    formats:      'Supported formats',
    autoGenerate: 'Auto-generated after upload',
    features: {
      roadmap:    'Learning Roadmap',
      roadmapSub: 'Topics ordered by difficulty',
      chat:       'AI Chat Interface',
      chatSub:    'Ask anything from your notes',
      quiz:       'Quiz & Flashcards',
      quizSub:    'MCQ, true/false, and spaced repetition',
      progress:   'Progress Tracking',
      progressSub:'Weak topics, readiness score, streak',
    },
  },

  // ── Chat ────────────────────────────────────────────────
  chat: {
    title:        'Chat with Notes',
    subtitle:     'AI answers only from your uploaded material',
    placeholder:  'Ask anything from your notes...',
    documents:    'Documents',
    suggestions: [
      'Explain this simply',
      'What are key points?',
      'Give me a summary',
      'What is the formula?',
      'Create a quiz question',
    ],
    aiGreeting:   'Hi! I have read your <strong>{{title}}</strong> notes. Ask me anything!',
    notFound:     'I could not find that in your document.',
  },

  // ── Roadmap ─────────────────────────────────────────────
  roadmap: {
    title:      'Learning Roadmap',
    subtitle:   '{{subject}} — {{count}} topics',
    progress:   'Progress',
    legend: {
      completed:  'Completed',
      inProgress: 'In progress',
      notStarted: 'Not started',
    },
    topic: {
      mins:       '{{mins}} min',
      quizScore:  'Quiz: {{score}}%',
      needsWork:  '— needs work',
      notStarted: 'Not started',
      practice:   'Practice →',
    },
  },

  // ── Quiz ────────────────────────────────────────────────
  quiz: {
    title:        'Quiz',
    subtitle:     'Auto-generated from your notes',
    newQuiz:      'New Quiz',
    question:     'Question {{current}} of {{total}}',
    correct:      '{{score}} correct',
    result: {
      title:      'Quiz Complete',
      score:      'You scored {{score}} out of {{total}}',
      great:      'Great job!',
      keepGoing:  'Keep practising!',
      retake:     'Retake Quiz',
      nextTopic:  'Next Topic →',
    },
    feedback: {
      correct:    '✓ Correct!',
      incorrect:  '✗ Incorrect',
    },
  },

  // ── Progress ────────────────────────────────────────────
  progress: {
    title:          'My Progress',
    subtitle:       'Last 30 days overview',
    mockExam:       'Take Mock Exam',
    readiness:      'Subject Readiness',
    activity:       'Study Activity',
    weakTopics:     'Weak Topics — needs revision',
    practiceAll:    'Practice all →',
    quizLink:       'Quiz →',
    daysAgo:        '28 days ago',
    today:          'Today',
    less:           'Less',
    more:           'More',
    streak:         '{{count}} day streak',
    streakSub:      'Personal best — keep it up!',
    onTrack:        "You're on track!",
    daysToExam:     '{{count}} days to exam ·',
    overallReady:   'Overall exam readiness',
    stats: {
      streak:     'Study Streak',
      quizzes:    'Quizzes Done',
      best:       'Best Score',
      flashcards: 'Flashcards',
      dueToday:   'due today',
    },
  },

  // ── Pricing ─────────────────────────────────────────────
  pricing: {
    title:      'Pricing',
    subtitle:   'Simple, affordable plans for every student',
    headline:   'Learn smarter.',
    headlineSub:'Starting at ₹0.',
    desc:       'No hidden fees. Cancel anytime.',
    savingsBanner: 'Save 20% with yearly billing — Pro at just ₹159/month',
    whyTitle:   'Why ₹199 and not ₹999?',
    whyDesc:    'Most students in India cannot afford expensive tools. ₹199 is less than a samosa plate at a dhaba. No student should be priced out of studying smarter.',
    faq:        'Frequently asked questions',
    ctaTitle:   'Start for free today',
    ctaSub:     'No credit card needed. Upgrade when ready.',
    ctaBtn:     "Get started — it's free",
    demoBtn:    'See demo →',
    plans: {
      free:       'Free',
      pro:        'Pro',
      institute:  'Institute',
      forever:    'forever',
      perMonth:   'per month',
      mostPopular:'Most popular',
      freeCta:    'Get started free',
      proCta:     'Start 7-day free trial',
      instCta:    'Contact us',
      freeDesc:   'Perfect to get started',
      proDesc:    'For serious students',
      instDesc:   'For coaching centres',
    },
  },

  // ── Auth ────────────────────────────────────────────────
  auth: {
    login:          'Log in',
    signup:         'Sign up',
    logout:         'Log out',
    googleLogin:    'Continue with Google',
    emailLabel:     'Email address',
    passwordLabel:  'Password',
    noAccount:      'Don\'t have an account?',
    hasAccount:     'Already have an account?',
    freePlan:       'Free plan',
  },

  // ── Errors ──────────────────────────────────────────────
  errors: {
    uploadLimit:    'Upload limit reached. Upgrade to Pro for unlimited uploads.',
    messageLimit:   'Daily message limit reached. Upgrade to Pro for 200 messages/day.',
    notFound:       'Document not found.',
    generic:        'Something went wrong. Please try again.',
    noFile:         'Please select a file first.',
    fileTooLarge:   'File is too large. Maximum size is 50MB.',
    invalidType:    'Only PDF and DOCX files are allowed.',
  },
}

export default en
