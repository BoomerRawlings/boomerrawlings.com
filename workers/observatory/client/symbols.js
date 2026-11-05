// Illustrative diagrams, not measurements or previews of protected records.
// The mapping from a destination to a diagram is supplied by the private catalog.
const NS = 'http://www.w3.org/2000/svg';
const path = (d, className = '', extra = {}) => ['path', { d, class: className, ...extra }];
const line = (x1, y1, x2, y2, className = '') => ['line', { x1, y1, x2, y2, class: className }];
const circle = (cx, cy, r, className = '') => ['circle', { cx, cy, r, class: className }];
const rect = (x, y, width, height, className = '', extra = {}) => ['rect', { x, y, width, height, class: className, ...extra }];
const group = (className, ...children) => ['g', { class: className }, children];
const trace = (d, className) => path(d, className, { pathLength: 1 });

export const symbolDescriptions = Object.freeze({
  dialogue: 'Transcript passages take turns, linked by a line of conversation.',
  futures: 'One starting point branches into three alternative paths, considered in sequence.',
  folio: 'An indexed book opens and a page turns across its spine.',
  atlas: 'A route is traced between linked entries in a changing map.',
  vessel: 'A submarine profile is read by a moving depth scan and a sonar return.',
  neuron: 'A signal travels from a branching dendrite through a neuron to its terminals.',
  race: 'A timed course curves from its starting mark to a checkered finish as a split marker advances.',
  directory: 'Six entries arranged around a central index.',
});

const diagrams = Object.freeze({
  dialogue: () => [
    path('M52 48H144V212H52Z M158 88H250V252H158Z', 'symbol-paper'),
    path('M62 38H134 M168 78H240', 'symbol-faint'),
    line(68, 68, 102, 68, 'symbol-gold'), line(174, 108, 208, 108, 'symbol-cyan'),
    path('M68 89H128 M68 99H118 M68 109H124 M68 141H128 M68 151H116 M68 161H124 M68 187H112', 'symbol-faint'),
    path('M174 129H234 M174 139H223 M174 149H229 M174 181H234 M174 191H220 M174 201H230 M174 227H218', 'symbol-faint'),
    group('dialogue-turn dialogue-turn-a', line(68, 99, 118, 99, 'symbol-gold'), line(68, 109, 124, 109, 'symbol-gold'), path('M60 91V116', 'symbol-gold')),
    group('dialogue-turn dialogue-turn-b', line(174, 139, 223, 139, 'symbol-cyan'), line(174, 149, 229, 149, 'symbol-cyan'), path('M242 131V156', 'symbol-cyan')),
    group('dialogue-turn dialogue-turn-c', line(68, 151, 116, 151, 'symbol-gold'), line(68, 161, 124, 161, 'symbol-gold'), path('M60 143V168', 'symbol-gold')),
    path('M130 104H150V144H168 M168 194H150V156H130', 'symbol-faint'),
    trace('M130 104H150V144H168', 'symbol-gold dialogue-reply dialogue-reply-a'),
    trace('M168 194H150V156H130', 'symbol-cyan dialogue-reply dialogue-reply-b'),
  ],
  futures: () => [
    line(41, 150, 98, 150, 'symbol-gold'), circle(37, 150, 4, 'symbol-node symbol-gold'),
    path('M98 150L141 88H224 M98 150H224 M98 150L141 212H224', 'symbol-faint'),
    path('M180 88L204 56H244 M180 212L204 244H244', 'symbol-hairline'),
    trace('M98 150L141 88H224', 'symbol-gold future-path future-a'),
    trace('M98 150H224', 'symbol-cyan future-path future-b'),
    trace('M98 150L141 212H224', 'symbol-gold future-path future-c'),
    rect(92, 144, 12, 12, 'symbol-node symbol-ink', { transform: 'rotate(45 98 150)' }),
    group('future-end future-a', path('M216 81L225 88L216 95', 'symbol-gold'), circle(238, 88, 7, 'symbol-node symbol-gold')),
    group('future-end future-b', path('M216 143L225 150L216 157', 'symbol-cyan'), circle(238, 150, 7, 'symbol-node symbol-cyan')),
    group('future-end future-c', path('M216 205L225 212L216 219', 'symbol-gold'), circle(238, 212, 7, 'symbol-node symbol-gold')),
    circle(251, 56, 3, 'symbol-faint'), circle(251, 244, 3, 'symbol-faint'),
    path('M73 245H108 M73 250V240 M108 250V240', 'symbol-hairline'),
  ],
  folio: () => [
    path('M43 90V233Q95 211 150 233Q205 211 257 233V90', 'symbol-faint'),
    path('M50 83Q102 66 150 87Q198 66 250 83V224Q199 207 150 228Q101 207 50 224Z', 'symbol-paper'),
    path('M150 87V228', 'symbol-gold'),
    path('M69 105Q99 98 131 108 M69 119Q99 112 131 122 M69 146Q99 139 131 149 M69 160Q99 153 131 163 M69 174Q99 167 124 175 M69 201Q97 194 118 200', 'symbol-faint'),
    path('M169 108Q202 98 231 105 M169 122Q202 112 231 119 M169 149Q202 139 231 146 M169 163Q202 153 231 160 M169 177Q202 167 222 172 M169 203Q197 194 218 198', 'symbol-faint'),
    path('M250 111H264V124H250 M250 141H260V154H250 M250 171H264V184H250', 'symbol-cyan'),
    group('folio-leaf',
      path('M150 87Q198 66 245 83V224Q197 207 150 228Z', 'symbol-leaf'),
      path('M166 109Q197 99 227 104 M166 123Q197 113 227 118 M166 150Q197 140 227 145 M166 164Q197 154 227 159 M166 178Q197 168 219 172', 'symbol-faint'),
      line(166, 195, 192, 190, 'symbol-cyan'),
    ),
    path('M137 229V248L150 240L163 248V229', 'symbol-gold'),
  ],
  atlas: () => [
    path('M31 99L66 42L135 49L174 30L244 68L270 135L243 186L251 252L169 268L105 255L48 268L27 210L43 153Z', 'symbol-contour'),
    path('M45 107L78 59L136 65L177 48L228 80L252 137L226 184L231 234L168 249L106 239L64 250L44 208L59 154Z', 'symbol-contour'),
    path('M65 99L147 74L232 112L210 218L106 233L73 177L65 99 M65 99L145 148L232 112 M145 148L210 218 M145 148L106 233 M73 177L145 148', 'symbol-faint'),
    trace('M65 99L147 74L232 112L145 148L106 233', 'symbol-cyan atlas-route'),
    circle(65, 99, 6, 'symbol-node symbol-gold atlas-node atlas-node-a'),
    rect(141, 68, 12, 12, 'symbol-node symbol-gold atlas-node atlas-node-b'),
    circle(232, 112, 6, 'symbol-node symbol-gold atlas-node atlas-node-c'),
    rect(137, 140, 16, 16, 'symbol-node symbol-gold atlas-node atlas-node-d'),
    circle(106, 233, 6, 'symbol-node symbol-gold atlas-node atlas-node-e'),
    circle(210, 218, 4, 'symbol-node symbol-faint'), circle(73, 177, 4, 'symbol-node symbol-faint'),
    path('M54 87V76H66 M232 128V139H220 M94 246H83V235', 'symbol-hairline'),
  ],
  vessel: () => [
    path('M30 67H258', 'symbol-waterline'),
    path('M273 69V239 M267 78H273 M263 106H273 M267 134H273 M263 162H273 M267 190H273 M263 218H273', 'symbol-depth'),
    path('M31 231H249', 'symbol-hairline'),
    group('vessel-profile',
      path('M71 135H209Q227 137 243 151L249 156L243 161Q226 176 209 178H71C31 178 31 135 71 135Z', 'symbol-hull'),
      path('M72 145H209 M72 168H209', 'symbol-faint'),
      path('M132 135V112Q145 105 160 112L170 135 M143 107V91H153 M153 112V100', 'symbol-gold'),
      path('M215 142L225 124H235L231 151 M215 170L225 188H235L231 161', 'symbol-gold'),
      path('M249 156H259 M258 145V167 M254 148L263 164 M254 164L263 148', 'symbol-cyan'),
      path('M64 136V177', 'symbol-faint'),
      circle(84, 156, 2, 'symbol-faint'), circle(96, 156, 2, 'symbol-faint'), circle(108, 156, 2, 'symbol-faint'),
    ),
    group('vessel-scan', line(29, 133, 262, 133, 'symbol-cyan'), path('M278 129L272 133L278 137', 'symbol-cyan')),
    path('M31 137Q13 156 31 175', 'symbol-sonar sonar-a'),
    path('M24 128Q-1 156 24 184', 'symbol-sonar sonar-b'),
    path('M17 119Q-15 156 17 193', 'symbol-sonar sonar-c'),
  ],
  neuron: () => [
    path('M98 129L79 104L84 72 M79 104L49 96L32 73 M49 96L34 113 M87 147L56 140L36 151 M56 140L47 121 M92 169L65 187L48 216 M65 187L34 183 M108 177L99 208L116 234 M99 208L80 230 M113 126L129 97L125 69 M129 97L151 80', 'symbol-dendrite'),
    path('M124 155C151 178 178 135 208 154L230 174 M208 154L231 130L251 121 M230 174L249 179 M230 174L231 201L248 216', 'symbol-axon'),
    path('M138 160L150 161 M160 156L171 151 M182 149L193 150', 'symbol-myelin'),
    trace('M32 73L49 96L79 104L98 129Q106 141 124 155C151 178 178 135 208 154L230 174L249 179', 'symbol-impulse'),
    path('M96 128C109 119 124 130 128 144C139 156 128 175 115 181C99 185 85 174 83 160C78 146 84 134 96 128Z', 'symbol-soma'),
    circle(105, 152, 9, 'symbol-nucleus'),
    circle(251, 121, 3.5, 'symbol-terminal terminal-a'), circle(249, 179, 3.5, 'symbol-terminal terminal-b'), circle(248, 216, 3.5, 'symbol-terminal terminal-c'),
    path('M260 116L267 111 M260 179H269 M257 220L265 225', 'symbol-synapse'),
  ],
  race: () => [
    path('M36 233H66C105 233 107 187 128 153S165 97 211 97H264 M36 205H61C85 205 86 167 105 138S156 69 211 69H264', 'symbol-faint'),
    path('M41 247V191 M47 247V191 M250 56V110 M256 56V110', 'symbol-hairline'),
    trace('M40 219H63C95 219 96 177 117 145S160 83 211 83H260', 'symbol-gold race-course'),
    trace('M40 219H63C95 219 96 177 117 145S160 83 211 83H260', 'symbol-cyan race-run'),
    circle(41, 219, 5, 'symbol-node symbol-gold'),
    group('race-finish',
      rect(244, 61, 24, 44, 'symbol-paper'),
      ...[[244, 61], [256, 72], [244, 83], [256, 94]].map(([x, y]) => rect(x, y, 12, 11, 'race-check')),
    ),
    circle(73, 84, 29, 'symbol-faint'),
    path('M73 49V43 M67 43H79 M97 60L102 55 M73 59V63 M98 84H94 M73 109V105 M48 84H52', 'symbol-hairline'),
    group('race-clock', line(73, 84, 73, 64, 'symbol-cyan')),
    circle(73, 84, 3, 'symbol-node symbol-gold'),
    group('race-speed', path('M165 177H198 M152 190H219 M168 203H205', 'symbol-hairline')),
    path('M134 243H254 M134 239V247 M164 241V245 M194 239V247 M224 241V245 M254 239V247', 'symbol-hairline'),
  ],
  directory: () => [
    path('M150 78V124 M84 112L128 138 M216 112L172 138 M84 198L128 162 M216 198L172 162 M150 222V176', 'symbol-faint'),
    rect(132, 132, 36, 36, 'symbol-paper'),
    ...[[140, 52], [62, 94], [218, 94], [62, 192], [218, 192], [140, 228]].map(([x, y]) => rect(x, y, 20, 20, 'symbol-gold')),
  ],
});

function element(document, [tag, attributes, children = []]) {
  const node = document.createElementNS(NS, tag);
  for (const [name, value] of Object.entries(attributes)) if (value !== '') node.setAttribute(name, String(value));
  for (const child of children) node.append(element(document, child));
  return node;
}

export function renderSymbol(container, requestedKind) {
  if (!container?.ownerDocument) return 'directory';
  const kind = typeof requestedKind === 'string' && Object.hasOwn(diagrams, requestedKind) ? requestedKind : 'directory';
  const document = container.ownerDocument;
  const svg = element(document, ['svg', { viewBox: '0 0 300 300', class: `observatory-symbol symbol-${kind}`, role: 'img', 'aria-label': symbolDescriptions[kind], focusable: 'false' }, diagrams[kind]()]);
  container.dataset.symbol = kind;
  container.replaceChildren(svg);
  return kind;
}
