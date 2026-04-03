export const DOCS = [
  { id: 1, title: 'Biology Ch 4–8',     pages: 48, ago: '3 days ago',   pct: 72, subject: 'Biology'   },
  { id: 2, title: 'Chemistry Sem 2',    pages: 32, ago: '1 week ago',   pct: 45, subject: 'Chemistry' },
  { id: 3, title: 'Physics Mechanics',  pages: 60, ago: '2 weeks ago',  pct: 90, subject: 'Physics'   },
]

export const TOPICS = [
  { id: 1, title: 'Cell Structure & Function', mins: 45, score: 88, status: 'done',    chips: ['Nucleus', 'Mitochondria', 'Cell wall']          },
  { id: 2, title: 'Cell Division — Mitosis',   mins: 30, score: 76, status: 'done',    chips: ['Prophase', 'Metaphase', 'Anaphase']             },
  { id: 3, title: 'Photosynthesis',             mins: 60, score: 42, status: 'current', chips: ['Light reactions', 'Calvin cycle', 'Chlorophyll'] },
  { id: 4, title: 'Respiration',                mins: 45, score: null, status: 'pending', chips: ['Glycolysis', 'Krebs cycle', 'ATP']            },
  { id: 5, title: 'Genetics & Heredity',        mins: 90, score: null, status: 'pending', chips: ['DNA structure', "Mendel's laws", 'Mutations'] },
]

export const QUESTIONS = [
  {
    q: 'Which organelle is responsible for carrying out photosynthesis in plant cells?',
    opts: ['Mitochondria', 'Nucleus', 'Chloroplast', 'Ribosome'],
    correct: 2,
    exp: 'Your Chapter 5 notes state: Chloroplasts contain chlorophyll and are the sole site of photosynthesis in plant cells.',
  },
  {
    q: 'What is the chemical formula for glucose produced in photosynthesis?',
    opts: ['CO₂', 'H₂O', 'C₆H₁₂O₆', 'O₂'],
    correct: 2,
    exp: 'From Chapter 5: Glucose (C₆H₁₂O₆) is synthesised during the Calvin cycle using CO₂ and energy from light reactions.',
  },
  {
    q: 'Which stage of photosynthesis produces ATP and NADPH?',
    opts: ['Calvin Cycle', 'Light Reactions', 'Glycolysis', 'Krebs Cycle'],
    correct: 1,
    exp: 'Your notes explain: Light Reactions occur in the thylakoid membrane, producing ATP and NADPH used by the Calvin cycle.',
  },
]

export const INIT_MESSAGES = [
  { role: 'ai',   text: 'Hi! I have read your <strong>Biology Chapter 4–8</strong> notes. Ask me anything — I will answer only from what is in your document.' },
  { role: 'user', text: 'Explain photosynthesis in simple words' },
  { role: 'ai',   text: 'From your Chapter 5 notes:<br/><br/><strong>Photosynthesis</strong> is the process plants use to make food from sunlight. It happens in the <strong>chloroplasts</strong> inside leaves.<br/><br/>Formula: <em>6CO₂ + 6H₂O + light → C₆H₁₂O₆ + 6O₂</em>' },
]

export const HEAT = [0,1,1,2,2,3,3,0,1,2,3,2,1,0,0,1,1,0,2,3,2,0,1,2,1,2,3,3]

export const WEAK_TOPICS = [
  { topic: 'Photosynthesis — Light reactions',  score: 42 },
  { topic: 'Chemistry — Organic compounds',     score: 51 },
  { topic: 'Biology — Meiosis vs Mitosis',      score: 58 },
  { topic: 'Physics — Wave optics',             score: 63 },
]

export const STATS_DASHBOARD = [
  { label: 'Documents',      value: '4',    change: '+1 this week'    },
  { label: 'Topics Covered', value: '34',   change: '+8 this week'    },
  { label: 'Quiz Average',   value: '74%',  change: '+12% from last'  },
  { label: 'Exam Readiness', value: '68%',  change: '12 days to exam' },
]

export const STATS_PROGRESS = [
  { label: 'Study Streak',  value: '7 days', change: 'Personal best!' },
  { label: 'Quizzes Done',  value: '18',     change: '+5 this week'   },
  { label: 'Best Score',    value: '92%',    change: 'Physics Mech.'  },
  { label: 'Flashcards',    value: '124',    change: '43 due today'   },
]

export const SUBJECTS = [
  { label: 'Biology',   pct: 72, color: 'bg-violet-500' },
  { label: 'Chemistry', pct: 45, color: 'bg-emerald-500'},
  { label: 'Physics',   pct: 90, color: 'bg-amber-400'  },
]

export const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard',       section: 'Overview'  },
  { id: 'upload',    label: 'Upload Material',  section: null        },
  { id: 'roadmap',   label: 'Roadmap',          section: 'Learn'     },
  { id: 'quiz',      label: 'Quiz & Practice',  section: null        },
  { id: 'flashcards',label: 'Flashcards',       section: null        },
  { id: 'mocktest',  label: 'Mock Test',         section: null        },
  { id: 'progress',  label: 'My Progress',      section: null        },
]
