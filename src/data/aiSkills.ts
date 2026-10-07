export const workflowDisplay = {
  name: 'Workflow Display',
  href: 'https://github.com/BoomerRawlings/Skills/tree/main/skills/workflow-display',
  summary:
    'Builds workflow displays with paired explanations and artifacts, smooth transitions, and animated connections. Use the starter directly or hand it to an agent.',
  agentPrompt:
    'Read https://raw.githubusercontent.com/BoomerRawlings/Skills/main/skills/workflow-display/SKILL.md and use its bundled starter to build a display for my workflow. Keep explanation and artifact cards paired, with smooth transitions and animated connections. Ask me for the workflow content you need; adapt the typography and colors to my project.',
} as const;

export const aiSkills = [
  workflowDisplay,
  {
    name: 'Research Briefing Assistant',
    href: 'https://github.com/BoomerRawlings/research-briefing-assistant',
    summary:
      'Builds evidence-weighted research briefings from independent ChatGPT and Gemini passes, with claim-level reconciliation and auditable quality gates.',
  },
  {
    name: 'Printable',
    href: 'https://github.com/BoomerRawlings/Skills/tree/main/skills/printable',
    summary:
      'Prepares PDF and DOCX files for duplex printing with a cover, verified table of contents, and outside-edge page numbers.',
  },
  {
    name: 'BW Printable',
    href: 'https://github.com/BoomerRawlings/Skills/tree/main/skills/bw-printable',
    summary:
      'Makes color-dependent visuals understandable in grayscale, then produces a print-ready PDF.',
  },
  {
    name: 'Lecture Study Guide',
    href: 'https://github.com/BoomerRawlings/Skills/tree/main/skills/lecture-study-guide',
    summary:
      'Organizes lecture materials into cited, printable study guides with practice questions and separate source and visual audits.',
  },
] as const;
