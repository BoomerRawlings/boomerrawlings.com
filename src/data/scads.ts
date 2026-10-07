export const scadsSource = 'https://github.com/BoomerRawlings/scads-2026-problems';
export const scadsAuthorship = 'Individual research and development by Boomer Rawlings, undertaken after the original submission and grading dates. These are independent projects, not group submissions.';
export const projectedDisclaimer = 'Projected solution. Implementation has not begun; this project is not completed. The paper presents a proposed method, evaluation plan, and implementation roadmap.';
export const scadsProjects = [
  {
    slug: '01-sensemaking', number: '01', title: 'Organizational sensemaking', short: 'Follow the evidence.',
    category: 'Agents · evidence · provenance', status: 'In progress',
    problem: 'How can an agent understand an organization whose activities, dependencies, and claims are spread across many sources?',
    solution: 'I built an evidence workspace that resolves an organization, follows its relationships, retrieves source material, and produces a brief with a traceable record of the investigation.',
    explanation: 'A small set of MCP tools separates entity lookup, graph traversal, source retrieval, and reporting. Each consequential statement can be traced to an evidence ID and a source location. Images and sampled video frames provide another view of the same evidence.',
    method: [
      ['Resolve', 'Match the organization before investigating. Ambiguous names produce a clarification request.'],
      ['Trace', 'Follow relevant relationships and read the evidence behind each connection.'],
      ['Explain', 'Separate source claims from observations and inferences in a cited analytic brief.'],
    ],
    evidence: 'The documented Riverwatch investigation uses 15 tool calls and 9 sources. Its review assesses one authored synthetic case; the record preserves the report, citations, and tool sequence.',
    evidencePath: 'docs/local-validation.md',
    technologies: 'Python · MCP · local models · source-linked reports',
    pip: [
      'This is the sensemaking workspace. The task is to understand an organization by following its evidence and relationships.',
      'Try the evidence selector below. A relationship is useful because you can inspect the source behind it, including disagreements between sources.',
      'The research paper explains the investigation method and the recorded Riverwatch example. GitHub contains the tools, fixtures, and reproduction instructions.',
      'You can return to the problem-set overview when you are ready. Each project is a separate branch of the collection.',
    ],
  },
  {
    slug: '02-311-analytics', number: '02', title: 'Conversational 311 analytics', short: 'Ask a city-sized question.',
    category: 'Civic data · analytics · reproducibility', status: 'In progress',
    problem: 'How can an analyst ask questions about NYC 311 requests and receive inspectable summaries, geographic results, and reusable data?',
    solution: 'I built a query service that turns structured analytical requests into filtered records, grouped statistics, geographic queries, period comparisons, and recoverable CSV exports.',
    explanation: 'A conversational agent selects tools; the service owns the calculations. The same request contract works with a small local fixture and an Elasticsearch adapter. Explicit dataset definitions, query records, and export metadata make each answer inspectable.',
    method: [
      ['Define', 'Inspect the dataset catalog and choose fields, filters, and a grouping.'],
      ['Calculate', 'Execute the request through the analytical service, with geography and time handled explicitly.'],
      ['Reuse', 'Inspect the result, save the query, or export records with recovery checkpoints.'],
    ],
    evidence: 'The browser example calculates directly over the project’s 32-record synthetic fixture. The source documents seven MCP tools and versioned checks for query execution, export recovery, and resource guards.',
    evidencePath: 'docs/tool-contract.md',
    technologies: 'Python · MCP · Elasticsearch adapter · CSV',
    pip: [
      'This project gives a conversational agent a precise set of analytical tools for NYC 311 service requests.',
      'Change the filters below. The browser recalculates the displayed totals from a small synthetic dataset, so the numbers are easy to inspect.',
      'The full service also supports geographic queries and recoverable exports. The paper and source explain how requests become reproducible results.',
      'Return to the collection to choose another problem, or follow the source link to run the analytical service.',
    ],
  },
  {
    slug: '03-semantic-discovery', number: '03', title: 'Semantic discovery in technical manuals', short: 'Find the specification.',
    category: 'Document discovery · OCR · offline search', status: 'In progress',
    problem: 'How can a reader find equipment and technical specifications inside scanned manuals without exposing the original document collection?',
    solution: 'I built VOPT, an offline pipeline that extracts candidate specifications, preserves their evidence, supports review, and releases a controlled metadata catalog for discovery.',
    explanation: 'Private document processing and public discovery have separate responsibilities. Page extraction preserves units, qualifiers, and source locations. Reviewed observations enter a versioned catalog, where an inspectable query plan finds relevant equipment and specifications.',
    method: [
      ['Extract', 'Read page text and geometry, using local OCR for image pages. Preserve the supporting passage.'],
      ['Review', 'Inspect candidate observations and their units, scope, and provenance before release.'],
      ['Discover', 'Search a controlled metadata snapshot by equipment, attribute, and value.'],
    ],
    evidence: 'A source-inspected development comparison records 13 of 17 selected extraction matches for the layout-aware rules and 4 of 17 for the line-rule baseline. The paper identifies the evaluation set and its interpretation.',
    evidencePath: 'reports/acceptance-status.md',
    technologies: 'Python · local OCR · SQLite FTS · versioned metadata',
    pip: [
      'VOPT helps a reader find equipment specifications inside technical manuals. Discovery begins with the equipment and the kind of specification needed.',
      'Try selecting an equipment record or specification below. The demonstration uses source-inspected observations and keeps the manual reference beside the value.',
      'The full pipeline separates extraction, review, and catalog release. The paper explains that boundary and the development evaluation.',
      'The collection overview is your next stop; the source link opens this project’s own directory and operating guide.',
    ],
  },
  {
    slug: '04-org-knowledge-graphs', number: '04', title: 'Organizational knowledge graphs', short: 'Make structure inspectable.',
    category: 'Networks · organizational structure · review', status: 'In progress',
    problem: 'How can communication records help an analyst explore organizational structure while keeping supporting evidence and uncertainty visible?',
    solution: 'I built a local graph workspace with guided import, communication analysis, dated snapshots, source inspection, and recorded analyst reviews.',
    explanation: 'The system profiles the input before saving it, then builds a conservative graph. Communication, explicit reporting statements, and analyst decisions remain distinguishable. The interface moves between groups, branches, people, and their nearby connections.',
    method: [
      ['Inspect', 'Profile people, records, and field coverage before admitting a corpus.'],
      ['Build', 'Generate sparse relationship candidates and retain their supporting records.'],
      ['Explore', 'Move through organizational views, inspect a connection, and record an analyst decision.'],
    ],
    evidence: 'The implementation includes synthetic-data workflows, immutable snapshots, and review history. The public example uses authored roster and communication records so every displayed connection has an inspectable basis.',
    evidencePath: 'docs/verification.md',
    technologies: 'Python · FastAPI · SQLite · React · SVG',
    pip: [
      'Here the organization becomes a graph. People and connections provide an entry point into the underlying communication records.',
      'Select a person below to inspect their neighborhood and evidence. Communication alone is not treated as proof that someone reports to someone else.',
      'The full application adds guided import, semantic zoom, dated snapshots, and analyst review. The paper explains how those views preserve the evidence.',
      'Return to the problem sets to compare this structural view with the other approaches.',
    ],
  },
  {
    slug: '05-graphrag-discovery', number: '05', title: 'GraphRAG discovery', short: 'See what changed, and why.',
    category: 'Retrieval · temporal evidence · local models', status: 'In progress',
    problem: 'How can an analyst discover relationships in a changing corpus and distinguish new knowledge, real-world changes, corrections, and withdrawals?',
    solution: 'I built a local evidence workspace that combines search, graph tracing, versioned sources, saved investigations, and comparisons between knowledge snapshots.',
    explanation: 'Search selects evidence within a pinned snapshot. Graph relationships retain their source passages and versions. Baseline comparisons distinguish when a claim was known from when an event was said to occur, while local model adapters support extraction and embeddings.',
    method: [
      ['Pin', 'Choose a knowledge snapshot and an evidence scope for the investigation.'],
      ['Trace', 'Search passages and follow cited relationships back to source revisions.'],
      ['Compare', 'Compare with a saved baseline and inspect corrections and withdrawals separately.'],
    ],
    evidence: 'An authored five-batch Pump P fixture exercises versioned claims, corrections, and withdrawal behavior. Separate local-model records document actual extraction and embedding calls.',
    evidencePath: 'docs/temporal-workflow.md',
    technologies: 'Python · SQLite · lexical and vector retrieval · llama.cpp',
    pip: [
      'GraphRAG connects retrieved passages with relationships and the history of those relationships.',
      'Switch snapshots in the Pump P example below. Notice how a later correction changes the evidence available to an investigation.',
      'The distinction is between a change in the world and a change in what the system knows. The paper and source show how the snapshot model keeps those separate.',
      'That completes this project’s introduction. Return to the overview whenever you want to explore another problem.',
    ],
  },
  {
    slug: '06-agentic-retrieval', number: '06', title: 'Agentic retrieval from selected resources', short: 'Build context from a transcript.',
    category: 'Research planning · constrained retrieval', status: 'Not started',
    problem: 'How could an agent enrich a presentation transcript with credible context about its speakers, topics, venue, and related talks from a predefined set of sources?',
    solution: 'I propose an allowlisted research agent that plans its next lookup from the evidence it finds, resolves ambiguous identities, and produces a source-linked contextual dossier.',
    explanation: 'The proposed workflow starts with transcript anchors and an explicit source registry. A bounded planner chooses lookups, tracks unresolved questions, and cross-checks claims. A fixed-workflow baseline and held-out transcripts would test whether adaptive planning improves useful coverage within the same budget.',
    method: [['Anchor', 'Identify transcript claims, people, and topics with precise transcript locations.'], ['Investigate', 'Choose permitted resources dynamically and record the basis for each lookup.'], ['Verify', 'Cross-reference claims and assemble a dossier with source and transcript citations.']],
    evidence: 'The proposed evaluation compares adaptive retrieval with fixed retrieval under matched request and time budgets. Coverage, citation support, identity errors, and reproducibility would be measured on held-out presentations.',
    evidencePath: 'ROADMAP.md', technologies: 'Proposed: source registry · agent planner · evidence ledger',
    pip: ['This is a projected solution for enriching a talk transcript from a predefined set of resources. Implementation has not begun.', 'The proposal follows three stages: anchor the transcript, investigate through permitted resources, and verify the resulting claims.', 'Read the proposal for the research design and roadmap. The source directory contains the plan; it does not contain an implemented product.', 'Return to the collection to explore another problem.'],
  },
  {
    slug: '07-efficient-agentic-rag', number: '07', title: 'Efficient agentic RAG and evaluation', short: 'Retrieve deliberately. Evaluate carefully.',
    category: 'Research planning · multilingual retrieval', status: 'Not started',
    problem: 'How could a lightweight agent decide when to retrieve, bridge languages, and produce grounded answers with an evaluation method that agrees with human judgments?',
    solution: 'I propose a budget-aware retrieval controller paired with a separately evaluated judging framework for relevance, attribution, completeness, and cross-lingual faithfulness.',
    explanation: 'The design compares fixed retrieval with selective retrieval, query reformulation, and cross-lingual retrieval under matched budgets. Human labels and reserved test queries anchor evaluation. Judge consistency, language effects, and sensitivity to answer order would be measured separately from answer quality.',
    method: [['Retrieve', 'Select and reformulate queries under a fixed retrieval and inference budget.'], ['Ground', 'Connect answer claims to passages across the query and document languages.'], ['Evaluate', 'Compare retrieval and answer outcomes with reserved labels and calibrated judging.']],
    evidence: 'The proposed study uses task-appropriate TREC resources, paired comparisons, language-stratified reporting, and ablations of agent decisions. Dataset access, splits, and labeling would be fixed before experiments.',
    evidencePath: 'ROADMAP.md', technologies: 'Proposed: multilingual retrieval · bounded agents · judge calibration',
    pip: ['This projected study connects retrieval efficiency with trustworthy evaluation. Implementation has not begun.', 'The proposed agent chooses when more retrieval is worthwhile. Its answers and its evaluator would be tested separately.', 'The paper specifies baselines, language comparisons, evaluation controls, and the implementation roadmap.', 'Return to the problem sets when you are ready.'],
  },
  {
    slug: '08-capability-benchmarks', number: '08', title: 'Task-specific AI capability benchmarks', short: 'Measure the work that matters.',
    category: 'Research planning · measurement validity', status: 'Not started',
    problem: 'How could a benchmark measure AI capabilities for specific research and software tasks without mistaking a public benchmark score for real-world readiness?',
    solution: 'I propose a task-family benchmark with executable checks, evidence-based rubrics, separate human adjudication, and reserved evaluation items.',
    explanation: 'The plan starts from concrete use cases and observable success criteria. Task variants separate superficial wording from the underlying capability. Capability, refusal behavior, cost, and failure severity would be reported separately, with contamination checks and uncertainty estimates.',
    method: [['Specify', 'Define the intended use, construct, observable behavior, and scoring rubric.'], ['Construct', 'Author task families and reserve evaluation items before model comparison.'], ['Assess', 'Combine executable checks and independent adjudication with uncertainty reporting.']],
    evidence: 'The proposed evaluation examines inter-rater agreement, task-family generalization, repeatability, and model ranking stability. A small research-assistance and software-maintenance pilot would establish scoring behavior before expanding scope.',
    evidencePath: 'ROADMAP.md', technologies: 'Proposed: executable tasks · rubric scoring · reproducible assessment',
    pip: ['This is a proposal for measuring AI performance on clearly defined tasks. Implementation has not begun.', 'The central question is what a score actually measures. The design connects each task to a construct, evidence, and a scoring rule.', 'The paper includes task-family design, human adjudication, reserved evaluation, and an implementation roadmap.', 'Return to the collection to compare the other research directions.'],
  },
  {
    slug: '09-core-to-edge', number: '09', title: 'Core-to-edge model validation', short: 'Validate before the edge.',
    category: 'Research planning · deployment reliability', status: 'Not started',
    problem: 'How could a model retain useful quality and reliability as it moves from a development environment to resource-constrained edge hardware?',
    solution: 'I propose a staged validation pipeline linking model optimization, controlled core tests, representative device measurements, release criteria, and lightweight monitoring.',
    explanation: 'The plan treats quality and resource budgets as joint acceptance criteria. Quantized or distilled models would be compared with a reference model under matched data and workload conditions. Signed release manifests, bounded telemetry, and rollback criteria would connect those measurements to deployment decisions.',
    method: [['Qualify', 'Measure quality, latency, memory, and robustness against a reference model.'], ['Validate', 'Repeat representative workloads on target devices under realistic resource constraints.'], ['Monitor', 'Track bounded operational signals and use explicit update and rollback criteria.']],
    evidence: 'The proposed study separates simulated constraints from measurements on physical devices. Quality changes, tail latency, memory, energy where measurable, and monitoring overhead would be reported with workload and hardware provenance.',
    evidencePath: 'ROADMAP.md', technologies: 'Proposed: model optimization · device validation · edge monitoring',
    pip: ['This is a projected validation pipeline for deploying models on constrained devices. Implementation has not begun.', 'The proposal connects core evaluation with measurements on real target hardware, then carries those requirements into release and monitoring.', 'The paper lays out the experimental matrix, acceptance criteria, and staged implementation roadmap.', 'Return to the collection whenever you want to explore another problem.'],
  },
] as const;

export function scadsSchema(title: string, slug?: string) {
  const root = 'https://boomerrawlings.com';
  const path = '/work/scads-2026/' + (slug ? `${slug}/` : '');
  return [{
    '@type': 'CreativeWork', '@id': `${root}${path}#project`, name: title,
    creator: { '@id': `${root}/#person` }, url: `${root}${path}`,
    datePublished: '2026-10-07', creativeWorkStatus: slug ? scadsProjects.find(p => p.slug === slug)?.status : 'In progress',
  }, {
    '@type': 'BreadcrumbList', itemListElement: [
      ['Home', '/'], ['Projects', '/work/'], ['SCADS 2026 problem sets', '/work/scads-2026/'],
      ...(slug ? [[title, path]] : []),
    ].map(([name, href], i) => ({ '@type': 'ListItem', position: i + 1, name, item: `${root}${href}` })),
  }];
}
