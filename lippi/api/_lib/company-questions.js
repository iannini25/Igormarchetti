export const companyQuestions = [
  [
    "business",
    "What kind of organisation are you answering for?",
    [
      "Financial services",
      "Technology provider",
      "Professional services",
      "Other"
    ]
  ],
  [
    "market",
    "Which market is your current priority?",
    [
      "Ireland",
      "UK",
      "Other EU market",
      "Brazil",
      "Other market"
    ]
  ],
  [
    "milestone",
    "What is your next business milestone?",
    [
      "Product launch",
      "Market entry",
      "Partner approval",
      "Audit or regulatory review",
      "Team development",
      "Other"
    ]
  ],
  [
    "problem",
    "Which challenge most needs attention?",
    [
      "Risk ownership",
      "Regulatory requirements",
      "Control design or testing",
      "Third-party oversight",
      "AI governance",
      "Other"
    ]
  ],
  [
    "deadline",
    "When do you need to make progress?",
    [
      "Within a month",
      "In one to three months",
      "In four to six months",
      "Later or uncertain"
    ]
  ],
  [
    "evidence",
    "What evidence do you already have?",
    [
      "Documented controls and tests",
      "Policies only",
      "Informal practices",
      "Starting from scratch",
      "Unsure"
    ]
  ],
  [
    "tried",
    "What has your team tried so far?",
    [
      "Internal review",
      "External advice",
      "Training",
      "Software or templates",
      "Nothing yet",
      "Other"
    ]
  ],
  [
    "barrier",
    "What is the main obstacle?",
    [
      "Time",
      "Skills",
      "Ownership",
      "Budget",
      "Understanding requirements",
      "Other"
    ]
  ],
  [
    "audience",
    "Who most needs support?",
    [
      "Founders or leadership",
      "Risk or compliance",
      "Product or operations",
      "Several teams",
      "Unsure"
    ]
  ],
  [
    "outcome",
    "Which outcome would help most?",
    [
      "A practical workshop",
      "A tested controls checklist",
      "A risk assessment",
      "A decision on market entry",
      "Clear roles and next steps",
      "Other"
    ]
  ]
];

export const combinedQuestions = [
  [
    "business",
    "What kind of organisation are you answering for?",
    [
      "Financial services",
      "Technology provider",
      "Professional services",
      "Other"
    ]
  ],
  [
    "market",
    "Which market is your current priority?",
    [
      "Ireland",
      "UK",
      "Other EU market",
      "Brazil",
      "Other market"
    ]
  ],
  [
    "milestone",
    "What is your next business milestone?",
    [
      "Product launch",
      "Market entry",
      "Partner approval",
      "Audit or regulatory review",
      "Team development",
      "Other"
    ]
  ],
  [
    "problem",
    "Which challenge most needs attention?",
    [
      "Risk ownership",
      "Regulatory requirements",
      "Control design or testing",
      "Third-party oversight",
      "AI governance",
      "Other"
    ]
  ],
  [
    "outcome",
    "Which outcome would help most?",
    [
      "A practical workshop",
      "A tested controls checklist",
      "A risk assessment",
      "A decision on market entry",
      "Clear roles and next steps",
      "Other"
    ]
  ],
  [
    "pilot",
    "Would your team consider a Saturday workshop?",
    [
      "Yes",
      "Possibly",
      "No"
    ]
  ],
  [
    "topic",
    "Which workshop topic would be most useful?",
    [
      "Licensing and market entry",
      "Governance, risk and controls",
      "Regulatory requirements",
      "RegTech, cybersecurity and AI",
      "Unsure"
    ]
  ],
  [
    "format",
    "Which Saturday session would suit your team best?",
    [
  "Live online",
  "In person",
  "Team-building offsite at a hotel",
  "Market-entry strategy offsite",
  "Hybrid",
  "Unsure"
]
  ],
  [
    "language",
    "Which language would your team prefer?",
    [
      "English",
      "Portuguese",
      "Spanish",
      "Italian",
      "Other or unsure"
    ]
  ],
  [
    "budget",
    "What budget per person would you consider for one Saturday workshop?",
    [
      "Under €100",
      "€100–299",
      "€300–499",
      "€500–799",
      "€800 or more",
      "No budget yet",
      "Prefer not to say"
    ]
  ]
];

export function packCompanyAnswers(answers, combined = false) {
  const questions = combined ? combinedQuestions : companyQuestions;
  if (!answers || typeof answers !== 'object' || Array.isArray(answers) ||
      Object.keys(answers).length !== questions.length) return null;
  const entries = {};
  for (const [key, , choices] of questions) {
    const answer = answers[key];
    entries[key] = [[key, answer]];
    if (combined && answer && typeof answer === 'object') {
      const {choice, detail} = answer;
      if (typeof choice !== 'string' || !/^Other\b/.test(choice) ||
          !(choice === 'Other' || choices.includes(choice)) ||
          typeof detail !== 'string' || !detail.trim() || detail.length > 160 ||
          (answers.pilot === 'No' && ['topic','format','language','budget'].includes(key))) return null;
      entries[key] = [[key, choice], [key + '_other', detail.trim()]];
      continue;
    }
    if (combined && key === 'language' && answer === 'Unsure') continue;
    if (combined && answers.pilot === 'No' && ['topic','format','language','budget'].includes(key) && answers[key] === null) continue;
    if (!choices.includes(answers[key])) return null;
  }
  // Reuse the three existing research columns, grouped by company context,
  // controls and support. The version distinguishes these from legacy free text.
  return [questions.slice(0,3), questions.slice(3,7), questions.slice(7)]
    .map(group => JSON.stringify(Object.fromEntries(group.flatMap(([key]) => entries[key]))));
}

export function companySummary(rows) {
  const totals = Object.fromEntries([...companyQuestions,...combinedQuestions].map(([key]) => [key, {}]));
  for (const row of rows) {
    const answers = Object.assign({}, ...[row.milestone_risk,row.control_gap,row.support_needed].map(value => JSON.parse(value)));
    for (const [key] of (row.survey_version === 'company-v4' ? combinedQuestions : companyQuestions)) {
      const choice = answers[key];
      if (!choice) continue;
      totals[key][choice] = (totals[key][choice] || 0) + 1;
    }
  }
  return {completed_responses:rows.length, target_companies:150, counts:totals};
}
