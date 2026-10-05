/** Original mechanism sketches. Symbolic teaching geometry, never measured anatomy. */
export type CardVisual = 'brain' | 'tract' | 'circuit' | 'neuron' | 'synapse' | 'molecule' | 'channel' | 'plasticity';
export type CardVisualOptions = { visual: CardVisual | string; topicId: string; answerVisible: boolean; paused?: boolean };

const path = (d: string, cls = '', extra = '') => `<path d="${d}" class="${cls}" ${extra}/>`;
const dot = (x: number, y: number, r = 3, cls = '') => `<circle cx="${x}" cy="${y}" r="${r}" class="${cls}"/>`;
const flow = (d: string, delay = 0, cls = '') => path(d, `bcv-flow ${cls}`, `pathLength="100" style="--phase:${delay}s"`);
const callout = (label: string, x: number, y: number, d: string, anchor = 'start') => `<g class="bcv-callout">${d ? path(d) : ''}<text x="${x}" y="${y}" text-anchor="${anchor}">${label}</text></g>`;
function membrane(y: number, gap = 0, width = 310) {
  return Array.from({ length: 32 }, (_, i) => {
    const x = 55 + i * width / 31;
    if (Math.abs(x - 210) < gap) return '';
    return `${path(`M${x} ${y + 5}l-2 9m2-9l3 8`, 'bcv-lipid-tail')}${dot(x, y, 2.5, 'bcv-lipid')}`;
  }).join('');
}
function cell(x: number, y: number, inhibitory = false) {
  return `<g transform="translate(${x} ${y})" class="${inhibitory ? 'bcv-inhibitory' : 'bcv-excitatory'}">${path('M0-7L-4-21m4 14l5-17m-5 17l-16-8m10 14l-16 4m16-4L-9 17m14-16l15 9m-15-9l17-6', 'bcv-arbor')}${inhibitory ? dot(0, 0, 7, 'bcv-soma') : path('M0-10L-9 7L10 7Z', 'bcv-soma')}</g>`;
}

const visuals: Record<CardVisual, { description: string; body: () => string }> = {
  brain: {
    description: 'Schematic brain outline with activity moving between regions. Not to scale.',
    body: () => `
      ${path('M103 136C76 117 80 78 102 63C98 42 125 30 145 37C159 19 190 21 205 33C230 18 258 31 266 43C299 41 324 69 318 92C342 112 324 143 300 149C279 177 245 174 225 158L217 185L202 184L192 149C162 161 129 155 103 136Z', 'bcv-outline bcv-soft-fill')}
      ${path('M110 120C88 108 108 83 125 93C139 103 118 126 143 135M103 65C128 52 144 68 137 82C128 101 157 108 164 93M148 40C143 66 170 57 176 78C185 103 155 110 172 138M198 38C172 51 196 66 202 80C215 102 192 126 206 147M216 39C240 47 223 67 236 77C256 93 276 66 286 84M267 48C258 65 284 54 300 76M309 100C286 88 282 116 261 108C245 100 233 123 250 137M225 152C237 135 271 158 283 135C290 122 311 130 315 116', 'bcv-fold')}
      ${path('M250 146C262 135 285 137 295 149M249 151C262 143 281 143 290 154M248 157C260 149 275 150 285 159', 'bcv-fold bcv-violet')}
      ${path('M131 76C167 63 207 130 277 91', 'bcv-connection')}${flow('M131 76C167 63 207 130 277 91')}
      ${dot(131, 76, 5, 'bcv-node')}${dot(203, 107, 4, 'bcv-node bcv-amber')}${dot(277, 91, 5, 'bcv-node bcv-violet')}
      ${callout('Cortical folds', 43, 19, 'M114 56L87 25H43')}${callout('Connected regions', 301, 198, 'M279 97L333 160V179', 'middle')}`,
  },
  tract: {
    description: 'Schematic parallel fibers with traveling signal markers. Paths and timing are illustrative.',
    body: () => {
      const routes = [
        'M58 141C117 163 148 46 229 62S299 136 365 78',
        'M58 130C118 148 151 36 230 53S303 125 365 68',
        'M58 119C119 133 154 28 233 45S306 113 365 59',
        'M58 108C120 117 155 19 235 37S308 101 365 49',
      ];
      return `${path('M91 144C66 104 91 36 151 31C213 6 294 25 325 68C356 119 318 164 271 171C206 194 127 181 91 144Z', 'bcv-context')}
        ${routes.map((d, i) => path(d, `bcv-fiber ${i > 1 ? 'bcv-violet' : ''}`) + flow(d, -i * 1.25, i > 1 ? 'bcv-violet' : '')).join('')}
        ${routes.map((_, i) => dot(58, 141 - i * 11, 4, 'bcv-node') + dot(365, 78 - i * 10, 4, 'bcv-node bcv-violet')).join('')}
        ${callout('Parallel fibers', 44, 204, 'M107 146L86 183H44')}${callout('Signals travel', 332, 199, 'M300 111L317 177H358', 'middle')}`;
    },
  },
  circuit: {
    description: 'Schematic excitatory and inhibitory circuit with both an inhibitory return to the recruiting cell and inhibition of a downstream cell. Connections and timing are illustrative, not an exact topic-specific circuit.',
    body: () => `
      ${path('M92 77C133 52 175 46 222 59M230 67C264 60 295 70 322 91M95 82C107 108 111 129 131 149M228 67C243 91 245 119 242 150M142 151C174 145 208 145 233 153M314 101C302 133 280 147 250 153', 'bcv-connection')}
      ${path('M128 146C85 155 55 116 75 85', 'bcv-connection bcv-violet')}
      ${flow('M92 77C133 52 175 46 222 59', 0)}${flow('M230 67C264 60 295 70 322 91', -1.8)}${flow('M95 82C107 108 111 129 131 149', -1)}${flow('M142 151C174 145 208 145 233 153', -3, 'bcv-violet')}${flow('M128 146C85 155 55 116 75 85', -3, 'bcv-violet')}
      ${path('M213 49l10 10-13 4M306 84l17 8-14 7M115 131l10 8-1-12', 'bcv-arrow')}${path('M226 143l2 18M71 82l9 6', 'bcv-inhibitory-stop')}
      ${cell(87, 77)}${cell(225, 56)}${cell(326, 96)}${cell(134, 150, true)}${cell(244, 155)}
      ${callout('Schematic E/I circuit', 210, 16, '', 'middle')}${callout('Feedback', 34, 195, 'M72 124L52 177H34')}${callout('Feedforward', 246, 195, 'M183 150L205 178H246')}`,
  },
  neuron: {
    description: 'Schematic cell body, branching processes and a segmented axon with a signal marker. Not to scale.',
    body: () => `
      ${path('M160 95C157 70 159 54 152 34M157 64L136 48L126 27M136 48L111 46M157 77L180 54L191 31M179 55L203 54M152 105L119 86L94 72L73 77M119 86L104 107L80 113M155 122L129 141L119 168M128 142L101 145L84 160M172 124L180 149L200 163M180 149L165 171', 'bcv-dendrite')}
      ${path('M183 111C220 122 243 109 275 115S326 132 354 120', 'bcv-axon')}
      ${[225, 254, 284, 314].map((x, i) => `<rect x="${x}" y="${i > 1 ? 111 : 104}" width="21" height="20" rx="8" class="bcv-myelin" transform="rotate(${i > 1 ? 7 : -4} ${x + 10} 115)"/>`).join('')}
      ${path('M354 120L374 102M354 120L376 128M354 120L366 146', 'bcv-axon')}${dot(375, 101, 5, 'bcv-terminal')}${dot(377, 128, 5, 'bcv-terminal')}${dot(366, 146, 5, 'bcv-terminal')}
      ${path('M151 93C171 79 189 96 189 112C192 128 170 140 153 128C138 119 139 102 151 93Z', 'bcv-cell-body')}${dot(165, 110, 10, 'bcv-nucleus')}
      ${flow('M152 34C158 60 157 86 166 105C199 127 241 108 275 115S326 132 354 120', 0, 'bcv-amber')}
      ${dot(164, 111, 27, 'bcv-integration-glow')}
      ${callout('Branching inputs', 35, 20, 'M109 78L85 30H35')}${callout('Axonal signal', 282, 194, 'M292 124L292 176H330')}`,
  },
  synapse: {
    description: 'Schematic synaptic terminal and receiving membrane. Vesicle, release and receptor motions illustrate a sequence.',
    body: () => `
      ${path('M123 22C113 58 94 68 102 91C108 114 141 117 170 117H250C285 117 311 109 317 90C324 65 300 54 297 22', 'bcv-terminal-outline bcv-soft-fill')}
      ${path('M94 149C143 145 178 148 210 147S277 145 324 149M94 158C143 154 179 157 211 156S278 154 324 158', 'bcv-post-membrane')}
      ${[135, 177, 265, 289].map((x, i) => `<g>${dot(x, i % 2 ? 50 : 76, 11, 'bcv-vesicle-shell')}${dot(x - 3, i % 2 ? 48 : 74, 2, 'bcv-cargo')}${dot(x + 4, i % 2 ? 52 : 78, 2, 'bcv-cargo')}</g>`).join('')}
      <g class="bcv-docking-vesicle">${dot(211, 86, 11, 'bcv-vesicle-shell')}${dot(207, 83, 2, 'bcv-cargo')}${dot(215, 84, 2, 'bcv-cargo')}${dot(211, 90, 2, 'bcv-cargo')}</g>
      ${[-9, 0, 9].map((x, i) => `<g class="bcv-transmitter" style="--phase:${i * .18}s;--spread:${x}px">${dot(211, 117, 2.8, 'bcv-cargo')}</g>`).join('')}
      ${[168, 211, 255].map(x => `${path(`M${x - 7} 140v24m14-24v24`, 'bcv-receptor')}${dot(x - 7, 138, 4, 'bcv-receptor-head')}${dot(x + 7, 138, 4, 'bcv-receptor-head')}`).join('')}
      ${flow('M211 163L211 193', 0, 'bcv-amber bcv-postsynaptic-current')}
      ${callout('Release site', 23, 198, 'M190 118L120 127L81 181H23')}${callout('Receptors', 285, 198, 'M259 161L275 182H320')}`,
  },
  molecule: {
    description: 'Conceptual ligand and binding-pocket sketch. Shapes do not depict a named compound, specific atoms or an experimental conformation.',
    body: () => `
      ${path('M111 90C77 95 75 136 99 159C118 182 154 179 179 186C217 198 264 181 291 163C318 145 341 108 313 91C295 81 272 92 255 104C237 118 232 142 209 142C188 143 175 119 157 105C141 92 124 87 111 90Z', 'bcv-protein-pocket')}
      ${path('M132 112C160 106 175 157 209 158C244 158 255 114 280 111', 'bcv-pocket-edge')}
      <g class="bcv-binding-ligand">${path('M186 51L211 37L236 53L224 79L197 80Z', 'bcv-ligand-bond')}${path('M211 37L209 65L236 53M209 65L197 80', 'bcv-ligand-bond')}${dot(186, 51, 8, 'bcv-ligand-node')}${dot(211, 37, 8, 'bcv-ligand-node bcv-violet')}${dot(236, 53, 8, 'bcv-ligand-node')}${dot(224, 79, 8, 'bcv-ligand-node bcv-amber')}${dot(197, 80, 8, 'bcv-ligand-node')}${dot(209, 65, 7, 'bcv-ligand-node bcv-violet')}</g>
      ${path('M209 105V123M186 107L192 127M231 107L225 127', 'bcv-binding-contacts')}
      ${callout('Generic ligand', 278, 28, 'M252 59L276 37H300')}${callout('Binding pocket', 25, 204, 'M145 162L119 184H25')}`,
  },
  channel: {
    description: 'Schematic membrane pore with opening and ion movement. Protein shape, ions and timing are illustrative.',
    body: () => `
      <g class="bcv-bilayer">${membrane(102, 35)}<g transform="translate(0 240) scale(1 -1)">${membrane(102, 35)}</g></g>
      <g class="bcv-channel-half bcv-channel-left">${path('M182 70C163 62 154 78 161 97L165 119L157 148C153 167 174 178 187 160L193 138L193 95Z', 'bcv-channel-protein')}${path('M173 83l8 11-10 13 9 12-10 14 8 14', 'bcv-protein-detail')}</g>
      <g class="bcv-channel-half bcv-channel-right">${path('M238 70C257 62 266 78 259 97L255 119L263 148C267 167 246 178 233 160L227 138L227 95Z', 'bcv-channel-protein bcv-violet')}${path('M247 83l-8 11 10 13-9 12 10 14-8 14', 'bcv-protein-detail')}</g>
      ${[0, 1, 2].map(i => `<g class="bcv-permeating-ion" style="--phase:${i * .45}s">${dot(210, 49, 4, 'bcv-ion')}</g>`).join('')}
      ${dot(187, 38, 3, 'bcv-ion bcv-idle-ion')}${dot(237, 34, 3, 'bcv-ion bcv-idle-ion')}${dot(222, 188, 3, 'bcv-ion bcv-idle-ion')}
      ${callout('Selective pore', 270, 38, 'M226 82L263 50H300')}${callout('Membrane', 51, 195, 'M111 145L98 178H51')}`,
  },
  plasticity: {
    description: 'Schematic synaptic contact showing spine remodeling and receptor traffic. This is a conceptual example, not a universal plasticity mechanism.',
    body: () => `
      ${path('M66 173C146 160 265 178 353 162M66 184C146 171 265 189 353 173', 'bcv-dendrite-shaft')}
      ${path('M195 166C201 144 195 130 190 120M215 165C209 143 217 131 222 120', 'bcv-spine-neck')}
      <g class="bcv-remodeling-spine">${path('M190 120C161 113 169 88 194 83C215 77 246 83 244 100C243 114 232 120 222 120Z', 'bcv-spine-head')}${[184, 197, 210, 223, 236].map(x => path(`M${x} 85v-8m-3 0h6`, 'bcv-spine-receptor')).join('')}</g>
      ${path('M177 28C165 42 170 54 186 60C205 68 237 61 243 48C245 39 239 32 235 28', 'bcv-terminal-outline bcv-soft-fill')}
      ${[189, 212, 230].map(x => dot(x, 45, 4, 'bcv-vesicle-shell')).join('')}
      ${path('M278 148C262 150 247 116 235 105', 'bcv-traffic-route')}${flow('M278 148C262 150 247 116 235 105', -2, 'bcv-violet')}${dot(278, 148, 9, 'bcv-vesicle-shell bcv-violet')}
      ${path('M201 156L198 128M207 157L213 128M203 148L216 140', 'bcv-actin')}
      ${callout('Spine remodeling', 17, 22, 'M174 101L145 40H17')}${callout('Receptor traffic', 258, 207, 'M278 156L286 185H297')}`,
  },
};

/** Replaces the given illustration host only. Cleanup is safe after a later render. */
export function renderCardVisual(host: HTMLElement, options: CardVisualOptions): () => void {
  const kind: CardVisual = Object.prototype.hasOwnProperty.call(visuals, options.visual) ? options.visual as CardVisual : 'neuron';
  const definition = visuals[kind];
  const wrapper = host.ownerDocument.createElement('div');
  wrapper.className = `brain-card-visual bcv-${kind}`;
  wrapper.dataset.paused = String(Boolean(options.paused));
  wrapper.dataset.answer = String(options.answerVisible);
  wrapper.dataset.direction = /potassium/i.test(options.topicId) ? 'outward' : 'inward';
  wrapper.dataset.change = /(^|-)ltd($|-)|depression/.test(options.topicId) ? 'decrease' : 'increase';
  wrapper.innerHTML = `<svg viewBox="0 0 420 210" xmlns="http://www.w3.org/2000/svg" role="img"><g class="bcv-guide" aria-hidden="true">${path('M36 105H49M371 105H384M210 10V18M210 192V200')}${dot(36, 105, 1)}${dot(384, 105, 1)}</g>${definition.body()}</svg>`;
  const svg = wrapper.firstElementChild!;
  svg.setAttribute('aria-label', options.answerVisible ? definition.description : 'Neuroscience mechanism sketch. Symbolic geometry, not to scale.');
  // Callouts are answer-side additions. Keep them out of the accessibility tree on the front.
  wrapper.querySelectorAll('.bcv-callout').forEach(node => node.setAttribute('aria-hidden', String(!options.answerVisible)));
  host.replaceChildren(wrapper);
  return () => { if (wrapper.parentElement === host) wrapper.remove(); };
}
