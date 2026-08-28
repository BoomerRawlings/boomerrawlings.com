export const academicHonors = [
  {
    value: '2026',
    title: 'Student of Distinction Award (SODA)',
    href: 'https://www.swccd.edu/swc-community/swc-foundation/soda-student-awards-ceremony.aspx',
    summary:
      'Recipient of Southwestern College’s highest student award, recognizing academic excellence, leadership, and commitment to a goal or purpose.',
  },
  {
    value: '4×',
    title: 'President’s List',
    href: 'https://catalog.swccd.edu/academic-regulations/grading-academic-record-symbols/',
    summary: 'Four-time honoree for 4.0 semester academic performance at Southwestern College.',
  },
] as const;

export const courseworkByInstitution = [
  {
    id: 'southwestern-college',
    institution: 'Southwestern College',
    period: 'SPRING 2025 - SPRING 2026',
    groups: [
      {
        title: 'Research + data',
        courses: [
          ['PSYC 255', 'Introduction to Psychological Research'],
          ['PSYC 270', 'Statistics for the Behavioral Sciences'],
          ['PSYC 271', 'Data Analysis in Psychology and Sociology'],
          ['CIS 106', 'Introduction to Programming Logic and Design Using Python'],
        ],
      },
      {
        title: 'Behavior + cognition',
        courses: [
          ['PSYC 211', 'Introduction to Cognitive Psychology'],
          ['PSYC 116', 'Introduction to Social Psychology'],
          ['PSYC 260', 'Introduction to Physiological Psychology'],
          ['PSYC 250', 'Abnormal Psychology'],
        ],
      },
      {
        title: 'Writing + communication',
        courses: [
          ['ENGL C1001', 'Critical Thinking and Writing'],
          ['COMM 104', 'Public Speaking'],
          ['COMM 174', 'Interpersonal Communication'],
        ],
      },
    ],
  },
] as const;

export const selectedAcademicWork = [
  {
    meta: 'May 2025 · Research essay',
    title: 'Social Justice through Financial Literacy',
    href: '/writing/social-justice-through-financial-literacy/',
    summary:
      'An argument for teaching financial capability through real accounts and guided experience, written before the federal Trump Accounts program became law.',
  },
  {
    meta: 'December 2025 · Rhetorical analysis',
    title: 'Comparing Opposing Texts on the Death Penalty',
    href: '/writing/rhetorical-analysis-death-penalty/',
    summary:
      'A comparison of authority, evidence, emotion, tone, and accessibility in opposing Federalist Society and Amnesty International texts.',
  },
  {
    meta: 'May 2026 · Student research proposal',
    title: 'Attention Bias Modification and Aggression',
    href: '/writing/attention-bias-modification-aggression/',
    summary:
      'A course research proposal asking whether attention-bias modification could reduce hostile attention bias and aggression among justice-impacted young adults. The study was not conducted.',
  },
  {
    meta: 'May 2026 · Research + document systems',
    title: 'Research and Publishing Systems',
    href: '/work/research-publishing-systems/',
    summary:
      'Source-checking, information-structure, and page-verification workflows, including a UCSD Psychology transfer handbook assembled from official program and policy sources.',
  },
  {
    meta: 'August 2026 · Independent research proposal',
    title: 'Self-Inflicted Pain as Error Correction',
    href: '/writing/self-inflicted-pain-error-correction/',
    summary:
      'A five-study research program defining a possible error-correction function of self-injury and testing whether nonpunitive correction can preserve learning and accountability.',
  },
] as const;
