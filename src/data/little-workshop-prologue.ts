export type PrologueCharacterId = 'pyotter' | 'mikwhale';
export type PrologueSpeakerLabel = 'Otter' | 'Whale';
export type ProloguePlacement = 'otter' | 'middle' | 'whale';
export type PrologueCommunicationLevel = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;
export type PrologueActionName =
  | 'look-at-otter'
  | 'look-at-whale'
  | 'look-forward'
  | 'look-at-object'
  | 'approach-object'
  | 'pick-up'
  | 'put-down'
  | 'hand-over'
  | 'toss'
  | 'think'
  | 'nod'
  | 'pause'
  | 'point'
  | 'inspect'
  | 'share'
  | 'excited'
  | 'suspicious'
  | 'annoyed'
  | 'laugh'
  | 'move-object-left'
  | 'move-object-center'
  | 'move-object-right';

export type ProloguePhase =
  | 'character-establishment'
  | 'principles-in-action'
  | 'placement-patterns'
  | 'intentionality-tests'
  | 'first-address'
  | 'three-position-language'
  | 'answer-mapping'
  | 'introduction';

export type PrologueStateValue = string | number | boolean | null;

export interface PrologueObjectRef {
  id: string;
  label: string;
}

export interface PrologueBeat {
  speaker: PrologueCharacterId;
  label: PrologueSpeakerLabel;
  text: string;
  action?: PrologueActionName;
}

export interface PrologueActionCue {
  actor: PrologueCharacterId | 'both' | 'environment';
  action: PrologueActionName;
  target?: string;
}

export interface ProloguePlacementOutcome {
  beats: readonly PrologueBeat[];
  actionCues: readonly PrologueActionCue[];
  stateEffects: Readonly<Record<string, PrologueStateValue>>;
}

export interface PrologueBranch {
  id: string;
  when: {
    source: 'state' | 'input';
    key?: string;
    operator: 'equals' | 'empty' | 'matches' | 'default';
    value?: PrologueStateValue | readonly PrologueStateValue[];
  };
  beats: readonly PrologueBeat[];
  actionCues?: readonly PrologueActionCue[];
  stateEffects?: Readonly<Record<string, PrologueStateValue>>;
}

export interface PrologueChoiceInput {
  kind: 'placement-choice';
  id: string;
  prompt: string;
  options: readonly {
    value: string;
    label: string;
    placement: ProloguePlacement;
  }[];
}

export interface PrologueTextInput {
  kind: 'free-text';
  id: string;
  prompt: string;
  maxLength: number;
  autocomplete: 'name';
}

export type PrologueInput = PrologueChoiceInput | PrologueTextInput;

export interface PrologueInteraction {
  sequence: number;
  id: string;
  phase: ProloguePhase;
  requiredCommunicationLevel: PrologueCommunicationLevel;
  unlocksCommunicationLevel?: PrologueCommunicationLevel;
  object: PrologueObjectRef;
  setup: readonly PrologueBeat[];
  placements: Readonly<Record<ProloguePlacement, ProloguePlacementOutcome>>;
  input?: PrologueInput;
  branches?: readonly PrologueBranch[];
  stopAfter?: boolean;
}

export const prologueCommunicationLevels = {
  0: 'unaware',
  1: 'object-pattern-noticed',
  2: 'intentional-placement-suspected',
  3: 'observing-agent-suspected',
  4: 'agent-testing',
  5: 'three-position-language',
  6: 'multiple-choice-language',
  7: 'name-known',
} as const satisfies Record<PrologueCommunicationLevel, string>;

const otter = (text: string, action?: PrologueActionName): PrologueBeat => ({
  speaker: 'pyotter',
  label: 'Otter',
  text,
  ...(action ? { action } : {}),
});

const whale = (text: string, action?: PrologueActionName): PrologueBeat => ({
  speaker: 'mikwhale',
  label: 'Whale',
  text,
  ...(action ? { action } : {}),
});

const cue = (
  actor: PrologueActionCue['actor'],
  action: PrologueActionName,
  target?: string,
): PrologueActionCue => ({ actor, action, ...(target ? { target } : {}) });

const outcome = (
  beats: readonly PrologueBeat[],
  actionCues: readonly PrologueActionCue[],
  stateEffects: Readonly<Record<string, PrologueStateValue>>,
): ProloguePlacementOutcome => ({ beats, actionCues, stateEffects });

export const objectReuseDialogue = {
  setup: {
    unaware: [
      otter('The {{object}} again.', 'look-at-object'),
      whale('Still worth examining.', 'inspect'),
    ],
    aware: [
      otter('You brought the {{object}} back.', 'look-forward'),
      whale('Deliberately, I assume.', 'inspect'),
    ],
  },
  placements: {
    otter: {
      beats: [otter('Another turn with it.'), whale('Try not to adopt it.')],
      actionCues: [cue('pyotter', 'inspect', 'reused-object')],
    },
    middle: {
      beats: [whale('A second arrangement.'), otter('Maybe it behaves differently.')],
      actionCues: [cue('both', 'inspect', 'reused-object')],
    },
    whale: {
      beats: [whale('Still considering it.'), otter('Thoroughly.')],
      actionCues: [cue('mikwhale', 'inspect', 'reused-object')],
    },
  },
} as const;

export const littleWorkshopPrologue = [
  {
    sequence: 1,
    id: 'apple-introduction',
    phase: 'character-establishment',
    requiredCommunicationLevel: 0,
    object: { id: 'apple', label: 'Apple' },
    setup: [otter('An apple.'), whale('A suspiciously symmetrical lunch.')],
    placements: {
      otter: outcome(
        [otter('Half for you.'), whale('That half is larger.'), otter('Then take it quickly.')],
        [cue('pyotter', 'share', 'apple')],
        { appleHome: 'otter', appleShared: true },
      ),
      middle: outcome(
        [otter('We can split it.'), whale('After we see who is hungry.')],
        [cue('both', 'share', 'apple')],
        { appleHome: 'middle', appleShared: true },
      ),
      whale: outcome(
        [
          whale('This appears to be mine.'),
          otter('For the moment.'),
          whale('Half is yours.'),
          otter('A very brief moment.'),
        ],
        [cue('mikwhale', 'hand-over', 'apple')],
        { appleHome: 'whale', appleShared: true },
      ),
    },
  },
  {
    sequence: 2,
    id: 'ball-rules',
    phase: 'character-establishment',
    requiredCommunicationLevel: 0,
    object: { id: 'ball', label: 'Ball' },
    setup: [whale('Round object. Excellent credentials.'), otter('It may roll better than it argues.')],
    placements: {
      otter: outcome(
        [otter('A gentle start.'), whale('I will catch it if it comes close.')],
        [cue('pyotter', 'toss', 'ball'), cue('mikwhale', 'hand-over', 'ball')],
        { ballOpening: 'otter', ballRule: 'optional-return' },
      ),
      middle: outcome(
        [
          otter('It can choose the first direction.'),
          whale('Objects cannot choose.'),
          otter('Then we can take turns pretending.'),
        ],
        [cue('both', 'share', 'ball')],
        { ballOpening: 'middle', ballRule: 'shared-turns' },
      ),
      whale: outcome(
        [whale('I wanted the first bounce.'), whale('You take the second.'), otter('Gladly.')],
        [cue('mikwhale', 'toss', 'ball')],
        { ballOpening: 'whale', ballRule: 'self-start' },
      ),
    },
  },
  {
    sequence: 3,
    id: 'flower-care',
    phase: 'character-establishment',
    requiredCommunicationLevel: 0,
    object: { id: 'flower', label: 'Flower' },
    setup: [otter('A flower with travel fatigue.'), whale('No speeches until water.')],
    placements: {
      otter: outcome(
        [otter('I will keep it upright.'), whale('I will look for water.')],
        [cue('pyotter', 'pick-up', 'flower')],
        { flowerKeeper: 'otter', flowerPosition: 'held-upright' },
      ),
      middle: outcome(
        [otter('Somewhere both can notice it.'), whale('I will steady the stem.')],
        [cue('both', 'put-down', 'flower')],
        { flowerKeeper: 'shared', flowerPosition: 'middle' },
      ),
      whale: outcome(
        [whale('I will hold it while you check the petals.'), otter('Carefully.')],
        [cue('mikwhale', 'pick-up', 'flower')],
        { flowerKeeper: 'whale', flowerPosition: 'whale-side' },
      ),
    },
  },
  {
    sequence: 4,
    id: 'cup-purpose',
    phase: 'character-establishment',
    requiredCommunicationLevel: 0,
    object: { id: 'cup', label: 'Cup' },
    setup: [whale('A cup.'), otter('Very observant.')],
    placements: {
      otter: outcome(
        [otter('Tea, eventually.'), whale('Save me the stronger half.')],
        [cue('pyotter', 'put-down', 'cup')],
        { cupCustodian: 'otter', cupUse: 'tea' },
      ),
      middle: outcome(
        [otter('Useful emptiness.'), whale('We can decide once it contains something.')],
        [cue('both', 'put-down', 'cup')],
        { cupCustodian: 'shared', cupUse: 'unassigned' },
      ),
      whale: outcome(
        [whale('It floats.'), otter('A second qualification.')],
        [cue('mikwhale', 'inspect', 'cup')],
        { cupCustodian: 'whale', cupUse: 'floating-bowl' },
      ),
    },
  },
  {
    sequence: 5,
    id: 'first-book',
    phase: 'character-establishment',
    requiredCommunicationLevel: 0,
    object: { id: 'book', label: 'Book' },
    setup: [otter('A book.'), whale('Check whether the ending permits escape.')],
    placements: {
      otter: outcome(
        [otter('I will read the useful parts aloud.'), whale('I choose the voices.')],
        [cue('pyotter', 'pick-up', 'book')],
        { bookCustodian: 'otter', bookUse: 'read-aloud' },
      ),
      middle: outcome(
        [otter('A shared reading copy.'), whale('With separate bookmarks.')],
        [cue('both', 'share', 'book')],
        { bookCustodian: 'shared', bookUse: 'parallel-bookmarks' },
      ),
      whale: outcome(
        [whale('I will begin in the middle.'), otter('Tell me if the ending wanders past.')],
        [cue('mikwhale', 'pick-up', 'book')],
        { bookCustodian: 'whale', bookUse: 'nonlinear-reading' },
      ),
    },
  },
  {
    sequence: 6,
    id: 'cookie-consent',
    phase: 'character-establishment',
    requiredCommunicationLevel: 0,
    object: { id: 'cookie', label: 'Cookie' },
    setup: [whale('That smells excellent.'), otter('A rigorous assessment.')],
    placements: {
      otter: outcome(
        [otter('I broke it badly. The larger piece is yours.'), whale('Conveniently.')],
        [cue('pyotter', 'share', 'cookie')],
        { cookieKeeper: 'otter', cookieOffer: 'open' },
      ),
      middle: outcome(
        [otter('Pick a side.'), whale('The crisp edge is yours.')],
        [cue('both', 'share', 'cookie')],
        { cookieKeeper: 'shared', cookieOffer: 'self-portioned' },
      ),
      whale: outcome(
        [whale('You prefer the crisp edge.'), otter('You remembered.'), whale('Unfortunately.')],
        [cue('mikwhale', 'share', 'cookie')],
        { cookieKeeper: 'whale', cookieOffer: 'accepted' },
      ),
    },
  },
  {
    sequence: 7,
    id: 'pencil-authorship',
    phase: 'character-establishment',
    requiredCommunicationLevel: 0,
    object: { id: 'pencil', label: 'Pencil' },
    setup: [otter('A small machine for moving thoughts.'), whale('With an eraser. Sensible.')],
    placements: {
      otter: outcome(
        [otter('First, a list of things worth repairing.'), whale('Leave room for corrections.')],
        [cue('pyotter', 'inspect', 'pencil')],
        { pencilKeeper: 'otter', pencilMark: 'repair-list' },
      ),
      middle: outcome(
        [otter('One page, two margins.'), whale('You take the left. I write straighter on the right.')],
        [cue('both', 'inspect', 'pencil')],
        { pencilKeeper: 'shared', pencilMark: 'two-margins' },
      ),
      whale: outcome(
        [whale('I will draw the exits first.'), otter('Then the entrances can stop pretending.')],
        [cue('mikwhale', 'inspect', 'pencil')],
        { pencilKeeper: 'whale', pencilMark: 'route-sketch' },
      ),
    },
  },
  {
    sequence: 8,
    id: 'paper-possibility',
    phase: 'character-establishment',
    requiredCommunicationLevel: 0,
    object: { id: 'paper', label: 'Paper' },
    setup: [whale('Blank.'), otter('Not empty. Available.')],
    placements: {
      otter: outcome(
        [otter('A folding pattern, then copies.'), whale('Keep one sheet uncommitted.')],
        [cue('pyotter', 'inspect', 'paper')],
        { paperKeeper: 'otter', paperForm: 'folding-pattern' },
      ),
      middle: outcome(
        [otter('A common page.'), whale('Written lightly enough to revise.')],
        [cue('both', 'share', 'paper')],
        { paperKeeper: 'shared', paperForm: 'erasable-note' },
      ),
      whale: outcome(
        [whale('Blankness may remain blank.'), otter('A perfectly good use.')],
        [cue('mikwhale', 'pause', 'paper')],
        { paperKeeper: 'whale', paperForm: 'blank' },
      ),
    },
  },
  {
    sequence: 9,
    id: 'block-structure',
    phase: 'character-establishment',
    requiredCommunicationLevel: 0,
    object: { id: 'block', label: 'Wooden Block' },
    setup: [otter('Foundation?'), whale('Or removable obstruction.')],
    placements: {
      otter: outcome(
        [otter('A low bridge begins with one useful piece.'), whale('Let me test whether it wobbles.')],
        [cue('pyotter', 'put-down', 'block')],
        { blockKeeper: 'otter', blockUse: 'bridge-start' },
      ),
      middle: outcome(
        [whale('Test it before naming it permanent.'), otter('A temporary table, then.')],
        [cue('both', 'inspect', 'block')],
        { blockKeeper: 'shared', blockUse: 'temporary-table' },
      ),
      whale: outcome(
        [whale('A very serious doorstop.'), otter('It lacks a door.'), whale('Details.')],
        [cue('mikwhale', 'put-down', 'block')],
        { blockKeeper: 'whale', blockUse: 'movable-marker' },
      ),
    },
  },
  {
    sequence: 10,
    id: 'string-knots',
    phase: 'character-establishment',
    requiredCommunicationLevel: 0,
    object: { id: 'string', label: 'String' },
    setup: [whale('Potential entanglement.'), otter('Potential connection.')],
    placements: {
      otter: outcome(
        [otter('A loose net for carrying several small things.'), whale('Loose is doing important work.')],
        [cue('pyotter', 'inspect', 'string')],
        { stringKeeper: 'otter', knotType: 'loose-net' },
      ),
      middle: outcome(
        [otter('One knot together?'), whale('One knot with two free ends.')],
        [cue('both', 'put-down', 'string')],
        { stringKeeper: 'shared', knotType: 'two-free-ends' },
      ),
      whale: outcome(
        [whale('Quick release.'), otter('Fast enough to count as kindness.')],
        [cue('mikwhale', 'inspect', 'string')],
        { stringKeeper: 'whale', knotType: 'quick-release' },
      ),
    },
  },

  {
    sequence: 11,
    id: 'key-access',
    phase: 'principles-in-action',
    requiredCommunicationLevel: 0,
    object: { id: 'key', label: 'Key' },
    setup: [otter('A key without its lock.'), whale('Already the more honest half.')],
    placements: {
      otter: outcome(
        [otter('Keep it visible until its door appears.'), whale('And copy it before the door becomes important.')],
        [cue('pyotter', 'put-down', 'key')],
        { keyCustodian: 'otter', keyPolicy: 'visible' },
      ),
      middle: outcome(
        [otter('Common reach.'), whale('Common knowledge of what it opens.')],
        [cue('both', 'put-down', 'key')],
        { keyCustodian: 'shared', keyPolicy: 'documented' },
      ),
      whale: outcome(
        [whale('First question: who made the lock?'), otter('Second: who needs the door?')],
        [cue('mikwhale', 'inspect', 'key')],
        { keyCustodian: 'whale', keyPolicy: 'lock-audit' },
      ),
    },
  },
  {
    sequence: 12,
    id: 'coin-claims',
    phase: 'principles-in-action',
    requiredCommunicationLevel: 0,
    object: { id: 'coin', label: 'Coin' },
    setup: [whale('A tiny metal argument.'), otter('It may also be a washer.')],
    placements: {
      otter: outcome(
        [otter('A washer is immediately useful.'), whale('Better than letting it issue commands.')],
        [cue('pyotter', 'inspect', 'coin')],
        { coinCustodian: 'otter', coinUse: 'possible-washer' },
      ),
      middle: outcome(
        [whale('No debt appears merely because metal arrived.'), otter('Agreed. It can wait without accruing importance.')],
        [cue('both', 'put-down', 'coin')],
        { coinCustodian: 'shared', coinUse: 'unassigned' },
      ),
      whale: outcome(
        [whale('Ownership noted. Authority not included.'), otter('A concise receipt.')],
        [cue('mikwhale', 'hand-over', 'coin')],
        { coinCustodian: 'whale', coinUse: 'ownership-test' },
      ),
    },
  },
  {
    sequence: 13,
    id: 'seed-scarcity',
    phase: 'principles-in-action',
    requiredCommunicationLevel: 0,
    object: { id: 'seed', label: 'Seed' },
    setup: [otter('One seed can become an unreasonable number.'), whale('If the first seed survives the plan.')],
    placements: {
      otter: outcome(
        [otter('Plant it, save the next generation widely.'), whale('Keep one portion outside the shared jar.')],
        [cue('pyotter', 'put-down', 'seed')],
        { seedCustodian: 'otter', seedPlan: 'grow-and-share' },
      ),
      middle: outcome(
        [otter('A common sprout.'), whale('With a marked reserve if the common pot fails.')],
        [cue('both', 'put-down', 'seed')],
        { seedCustodian: 'shared', seedPlan: 'shared-with-reserve' },
      ),
      whale: outcome(
        [whale('Not every future must begin in the same pot.'), otter('Then this one becomes the spare line.')],
        [cue('mikwhale', 'pick-up', 'seed')],
        { seedCustodian: 'whale', seedPlan: 'independent-reserve' },
      ),
    },
  },
  {
    sequence: 14,
    id: 'box-control',
    phase: 'principles-in-action',
    requiredCommunicationLevel: 0,
    object: { id: 'box', label: 'Small Box' },
    setup: [whale('Closed.'), otter('Unlabeled.')],
    placements: {
      otter: outcome(
        [otter('Open storage for things easily lost.'), whale('No invisible membership rules.')],
        [cue('pyotter', 'inspect', 'box')],
        { boxCustodian: 'otter', boxState: 'open-labeled' },
      ),
      middle: outcome(
        [whale('Test the lid, then leave it unlatched.'), otter('Shared storage with an obvious inventory.')],
        [cue('both', 'put-down', 'box')],
        { boxCustodian: 'shared', boxState: 'unlatched-inventoried' },
      ),
      whale: outcome(
        [whale('A container is not entitled to secrecy.'), otter('Nor are its contents entitled to exposure.')],
        [cue('mikwhale', 'inspect', 'box')],
        { boxCustodian: 'whale', boxState: 'privacy-respected' },
      ),
    },
  },
  {
    sequence: 15,
    id: 'hammer-recurrence',
    phase: 'principles-in-action',
    requiredCommunicationLevel: 0,
    object: { id: 'hammer', label: 'Hammer' },
    setup: [otter('That crescent nick looks familiar.'), whale('Objects have begun keeping appointments.')],
    placements: {
      otter: outcome(
        [otter('First repair: the loose block.'), whale('Strike only what agreed to become flatter.')],
        [cue('pyotter', 'inspect', 'hammer')],
        { hammerCustodian: 'otter', repetitionNoticed: true },
      ),
      middle: outcome(
        [whale('The balance still feels right.'), otter('And the nick survived another adventure.')],
        [cue('both', 'put-down', 'hammer')],
        { hammerCustodian: 'shared', repetitionNoticed: true },
      ),
      whale: outcome(
        [whale('Tool accepted. Handle inspected.'), otter('The nick remains a better signature than a crown.')],
        [cue('mikwhale', 'inspect', 'hammer')],
        { hammerCustodian: 'whale', repetitionNoticed: true },
      ),
    },
    branches: [
      {
        id: 'otter-favored-so-far',
        when: { source: 'state', key: 'repeatedly_favors_otter', operator: 'equals', value: true },
        beats: [
          whale('You seem eager to fix the block.'),
          otter('It wobbled at me.'),
          whale('A grave provocation.'),
        ],
      },
      {
        id: 'whale-favored-so-far',
        when: { source: 'state', key: 'repeatedly_favors_whale', operator: 'equals', value: true },
        beats: [
          otter('You inspect every handle twice.'),
          whale('Only suspicious handles.'),
          otter('That is every handle.'),
        ],
      },
      {
        id: 'middle-favored-so-far',
        when: { source: 'state', key: 'frequently_uses_middle', operator: 'equals', value: true },
        beats: [
          whale('You have already planned three repairs.'),
          otter('Four.'),
          whale('I was protecting myself from the fourth.'),
        ],
      },
    ],
  },
  {
    sequence: 16,
    id: 'battery-arrangements',
    phase: 'principles-in-action',
    requiredCommunicationLevel: 0,
    object: { id: 'battery', label: 'Battery' },
    setup: [otter('Stored work.'), whale('Stored dependence, if there is only one.')],
    placements: {
      otter: outcome(
        [otter('A small rail could power several useful lights.'), whale('With a bypass around the rail.')],
        [cue('pyotter', 'share', 'battery')],
        { batteryCustodian: 'otter', batteryPlan: 'shared-rail' },
      ),
      middle: outcome(
        [otter('Shared charge, visible limits.'), whale('And one cell kept separate for failure.')],
        [cue('both', 'inspect', 'battery')],
        { batteryCustodian: 'shared', batteryPlan: 'rail-plus-reserve' },
      ),
      whale: outcome(
        [whale('Independent cell. Independent switch.'), otter('Useful enough to copy later.')],
        [cue('mikwhale', 'inspect', 'battery')],
        { batteryCustodian: 'whale', batteryPlan: 'independent-cell' },
      ),
    },
  },
  {
    sequence: 17,
    id: 'lamp-switches',
    phase: 'principles-in-action',
    requiredCommunicationLevel: 0,
    object: { id: 'lamp', label: 'Lamp' },
    setup: [whale('Light with a single opinion.'), otter('The opinion appears to be off.')],
    placements: {
      otter: outcome(
        [otter('Aim it where both can read.'), whale('Add a switch within both reaches.')],
        [cue('pyotter', 'inspect', 'lamp')],
        { lampCustodian: 'otter', lampMode: 'shared-light' },
      ),
      middle: outcome(
        [otter('One pool of light.'), whale('Two switches. No throne.')],
        [cue('both', 'share', 'lamp')],
        { lampCustodian: 'shared', lampMode: 'dual-control' },
      ),
      whale: outcome(
        [whale('Local light, local switch.'), otter('Turned outward when company wants it.')],
        [cue('mikwhale', 'inspect', 'lamp')],
        { lampCustodian: 'whale', lampMode: 'local-control' },
      ),
    },
  },
  {
    sequence: 18,
    id: 'magnet-boundaries',
    phase: 'principles-in-action',
    requiredCommunicationLevel: 0,
    object: { id: 'magnet', label: 'Magnet' },
    setup: [otter('A tool for retrieving tiny lost things.'), whale('And moving them without asking.')],
    placements: {
      otter: outcome(
        [otter('Useful near the repair tray.'), whale('Marked clearly for everything it should avoid.')],
        [cue('pyotter', 'inspect', 'magnet')],
        { magnetCustodian: 'otter', magnetUse: 'repair-retrieval' },
      ),
      middle: outcome(
        [
          whale('I expected shared use to blur the safe boundary.'),
          otter('The marked range helps?'),
          whale('It does. I was wrong about that part.'),
        ],
        [cue('both', 'inspect', 'magnet')],
        { magnetCustodian: 'shared', magnetUse: 'bounded-tool' },
      ),
      whale: outcome(
        [whale('Power that acts at a distance needs a short leash.'), otter('String has returned to relevance.')],
        [cue('mikwhale', 'inspect', 'magnet')],
        { magnetCustodian: 'whale', magnetUse: 'tethered-tool' },
      ),
    },
  },
  {
    sequence: 19,
    id: 'bell-signals',
    phase: 'principles-in-action',
    requiredCommunicationLevel: 0,
    object: { id: 'bell', label: 'Bell' },
    setup: [whale('A demand disguised as a sound.'), otter('Or an invitation with poor manners.')],
    placements: {
      otter: outcome(
        [otter('One ring means tea is available.'), whale('Available. Not summoned.')],
        [cue('pyotter', 'excited', 'bell')],
        { bellCustodian: 'otter', bellRule: 'optional-invitation' },
      ),
      middle: outcome(
        [otter('A shared signal needs a shared meaning.'), whale('And the right to ignore it.')],
        [cue('both', 'share', 'bell')],
        { bellCustodian: 'shared', bellRule: 'agreed-and-ignorable' },
      ),
      whale: outcome(
        [whale('First improvement: a mute.'), otter('Second improvement: quieter enthusiasm.')],
        [cue('mikwhale', 'inspect', 'bell')],
        { bellCustodian: 'whale', bellRule: 'locally-muted' },
      ),
    },
  },
  {
    sequence: 20,
    id: 'second-book-redundancy',
    phase: 'principles-in-action',
    requiredCommunicationLevel: 0,
    object: { id: 'book-copy', label: 'Second Book' },
    setup: [otter('The book has acquired a sibling.'), whale('Good. One copy cannot govern the bookmarks.')],
    placements: {
      otter: outcome(
        [otter('One copy for notes, one for lending.'), whale('Neither becomes the sacred original.')],
        [cue('pyotter', 'inspect', 'book-copy')],
        { secondBookCustodian: 'otter', bookSystem: 'lending-copy' },
      ),
      middle: outcome(
        [otter('Two copies, two readers.'), whale('Disagreement no longer requires taking turns.')],
        [cue('both', 'share', 'book-copy')],
        { secondBookCustodian: 'shared', bookSystem: 'parallel-reading' },
      ),
      whale: outcome(
        [whale('A backup that may wander away.'), otter('Portability improves a library.')],
        [cue('mikwhale', 'inspect', 'book-copy')],
        { secondBookCustodian: 'whale', bookSystem: 'portable-backup' },
      ),
    },
  },

  {
    sequence: 21,
    id: 'apple-position-pattern',
    phase: 'placement-patterns',
    requiredCommunicationLevel: 0,
    unlocksCommunicationLevel: 1,
    object: { id: 'apple', label: 'Apple' },
    setup: [otter('The apple returned nearer one side than the other.'), whale('Distance may be part of the object now.')],
    placements: {
      otter: outcome(
        [otter('Nearer here, again.'), whale('Record proximity before inventing meaning.')],
        [cue('pyotter', 'put-down', 'apple')],
        { position21: 'otter', positionPatternSeen: true },
      ),
      middle: outcome(
        [whale('Precisely between.'), otter('The center may be its own category.')],
        [cue('both', 'inspect', 'apple')],
        { position21: 'middle', positionPatternSeen: true },
      ),
      whale: outcome(
        [whale('Nearer here.'), otter('Three possible regions, then.')],
        [cue('mikwhale', 'put-down', 'apple')],
        { position21: 'whale', positionPatternSeen: true },
      ),
    },
  },
  {
    sequence: 22,
    id: 'ball-position-pattern',
    phase: 'placement-patterns',
    requiredCommunicationLevel: 1,
    object: { id: 'ball', label: 'Ball' },
    setup: [whale('Same object. Another landing.'), otter('Keep the ball still long enough to notice.')],
    placements: {
      otter: outcome(
        [otter('The left region repeats.'), whale('One repetition is not a language.')],
        [cue('both', 'inspect', 'ball')],
        { position22: 'otter', leftRegionCounted: true },
      ),
      middle: outcome(
        [otter('Center, again.'), whale('The least accidental-looking accident.')],
        [cue('both', 'put-down', 'ball')],
        { position22: 'middle', centerRegionCounted: true },
      ),
      whale: outcome(
        [whale('Right region.'), otter('The pattern now has range.')],
        [cue('both', 'inspect', 'ball')],
        { position22: 'whale', rightRegionCounted: true },
      ),
    },
  },
  {
    sequence: 23,
    id: 'flower-position-pattern',
    phase: 'placement-patterns',
    requiredCommunicationLevel: 1,
    object: { id: 'flower', label: 'Flower' },
    setup: [otter('Fragile things also arrive in the three regions.'), whale('So rolling cannot explain it.')],
    placements: {
      otter: outcome(
        [otter('Near the cup, whether or not that is the point.'), whale('Care first. Interpretation second.')],
        [cue('pyotter', 'inspect', 'flower')],
        { position23: 'otter', rollingHypothesisRejected: true },
      ),
      middle: outcome(
        [whale('Center without rolling.'), otter('A useful correction.')],
        [cue('both', 'put-down', 'flower')],
        { position23: 'middle', rollingHypothesisRejected: true },
      ),
      whale: outcome(
        [whale('Right without rolling.'), otter('Three placements, not three slopes.')],
        [cue('mikwhale', 'inspect', 'flower')],
        { position23: 'whale', rollingHypothesisRejected: true },
      ),
    },
  },
  {
    sequence: 24,
    id: 'cup-position-pattern',
    phase: 'placement-patterns',
    requiredCommunicationLevel: 1,
    object: { id: 'cup', label: 'Cup' },
    setup: [whale('The cup has returned to the experiment.'), otter('The experiment has not admitted being one.')],
    placements: {
      otter: outcome(
        [otter('Near here may mean custody.'), whale('Or merely near here.')],
        [cue('pyotter', 'pick-up', 'cup')],
        { position24: 'otter', custodyHypothesis: 'possible' },
      ),
      middle: outcome(
        [otter('Between may mean shared.'), whale('Or neither. Keep both hypotheses.')],
        [cue('both', 'pause', 'cup')],
        { position24: 'middle', middleHypothesis: 'shared-or-neither' },
      ),
      whale: outcome(
        [whale('Near here may mean custody.'), otter('Symmetry supports the guess, not the conclusion.')],
        [cue('mikwhale', 'pick-up', 'cup')],
        { position24: 'whale', custodyHypothesis: 'possible' },
      ),
    },
  },
  {
    sequence: 25,
    id: 'book-placement-hypothesis',
    phase: 'placement-patterns',
    requiredCommunicationLevel: 1,
    object: { id: 'book', label: 'Book' },
    setup: [otter('Objects may be arriving with a suggested reader.'), whale('Suggested is tolerable. Assigned is not.')],
    placements: {
      otter: outcome(
        [otter('Suggested reader: here.'), whale('The suggestion remains revisable.')],
        [cue('pyotter', 'pick-up', 'book')],
        { position25: 'otter', placementHypothesis: 'recipient' },
      ),
      middle: outcome(
        [whale('Suggested readers: both, or neither.'), otter('Begin with both; preserve neither.')],
        [cue('both', 'put-down', 'book')],
        { position25: 'middle', placementHypothesis: 'shared-or-open' },
      ),
      whale: outcome(
        [whale('Suggested reader: here.'), otter('No obligation to finish chapter one.')],
        [cue('mikwhale', 'pick-up', 'book')],
        { position25: 'whale', placementHypothesis: 'recipient' },
      ),
    },
  },
  {
    sequence: 26,
    id: 'cookie-placement-hypothesis',
    phase: 'placement-patterns',
    requiredCommunicationLevel: 1,
    object: { id: 'cookie', label: 'Cookie' },
    setup: [whale('Edible evidence.'), otter('The most perishable kind.')],
    placements: {
      otter: outcome(
        [otter('Near here appears to offer, not command.'), whale('A distinction worth keeping.')],
        [cue('pyotter', 'pick-up', 'cookie')],
        { position26: 'otter', offerHypothesis: 'pyotter' },
      ),
      middle: outcome(
        [otter('Center appears to leave division open.'), whale('Or leave the cookie whole. Also open.')],
        [cue('both', 'pause', 'cookie')],
        { position26: 'middle', offerHypothesis: 'shared-choice' },
      ),
      whale: outcome(
        [whale('Near here appears to offer.'), otter('Acceptance can still include sharing.')],
        [cue('mikwhale', 'share', 'cookie')],
        { position26: 'whale', offerHypothesis: 'mikwhale' },
      ),
    },
  },
  {
    sequence: 27,
    id: 'pencil-intent-hypothesis',
    phase: 'placement-patterns',
    requiredCommunicationLevel: 1,
    object: { id: 'pencil', label: 'Pencil' },
    setup: [otter('A useful thing keeps arriving within deliberate-looking boundaries.'), whale('Deliberate-looking is not yet deliberate.')],
    placements: {
      otter: outcome(
        [otter('The repair list receives another vote.'), whale('Or another coincidence with excellent aim.')],
        [cue('pyotter', 'inspect', 'pencil')],
        { position27: 'otter', intentConfidence: 1 },
      ),
      middle: outcome(
        [whale('Centered again.'), otter('The coincidence is becoming meticulous.')],
        [cue('both', 'inspect', 'pencil')],
        { position27: 'middle', intentConfidence: 2 },
      ),
      whale: outcome(
        [whale('The exits receive another vote.'), otter('A very specific coincidence.')],
        [cue('mikwhale', 'inspect', 'pencil')],
        { position27: 'whale', intentConfidence: 1 },
      ),
    },
  },
  {
    sequence: 28,
    id: 'paper-intent-hypothesis',
    phase: 'placement-patterns',
    requiredCommunicationLevel: 1,
    object: { id: 'paper', label: 'Paper' },
    setup: [whale('Blank paper has no weighty preference of its own.'), otter('Its landing may still have one.')],
    placements: {
      otter: outcome(
        [otter('Near here. Marked without assuming why.'), whale('A good record avoids flattering its author.')],
        [cue('pyotter', 'inspect', 'paper')],
        { position28: 'otter', positionLogStarted: true },
      ),
      middle: outcome(
        [otter('Middle. The third category survives.'), whale('Uncertainty deserves a column.')],
        [cue('both', 'inspect', 'paper')],
        { position28: 'middle', positionLogStarted: true },
      ),
      whale: outcome(
        [whale('Near here. Recorded, not obeyed.'), otter('Observation without surrender.')],
        [cue('mikwhale', 'inspect', 'paper')],
        { position28: 'whale', positionLogStarted: true },
      ),
    },
  },
  {
    sequence: 29,
    id: 'block-three-zones',
    phase: 'placement-patterns',
    requiredCommunicationLevel: 1,
    object: { id: 'block', label: 'Wooden Block' },
    setup: [otter('A block makes the regions easier to mark.'), whale('Temporary borders only.')],
    placements: {
      otter: outcome(
        [otter('Left region marked.'), whale('Marked, not annexed.')],
        [cue('pyotter', 'inspect', 'block')],
        { position29: 'otter', regionMap: 'left-marked' },
      ),
      middle: outcome(
        [whale('Middle region marked.'), otter('Its borders remain especially soft.')],
        [cue('both', 'inspect', 'block')],
        { position29: 'middle', regionMap: 'middle-marked' },
      ),
      whale: outcome(
        [whale('Right region marked.'), otter('And immediately removable.')],
        [cue('mikwhale', 'inspect', 'block')],
        { position29: 'whale', regionMap: 'right-marked' },
      ),
    },
  },
  {
    sequence: 30,
    id: 'string-three-zones',
    phase: 'placement-patterns',
    requiredCommunicationLevel: 1,
    object: { id: 'string', label: 'String' },
    setup: [whale('Three regions, one loose line.'), otter('A map that can be untied.')],
    placements: {
      otter: outcome(
        [otter('The line ends here.'), whale('Perhaps recipient. Perhaps origin.')],
        [cue('pyotter', 'put-down', 'string')],
        { position30: 'otter', finalPositionHypothesis: 'recipient-or-origin' },
      ),
      middle: outcome(
        [otter('The line joins both sides.'), whale('Perhaps shared. Perhaps undecided.')],
        [cue('both', 'put-down', 'string')],
        { position30: 'middle', finalPositionHypothesis: 'shared-or-undecided' },
      ),
      whale: outcome(
        [whale('The line ends here.'), otter('The symmetry is now difficult to dismiss.')],
        [cue('mikwhale', 'put-down', 'string')],
        { position30: 'whale', finalPositionHypothesis: 'recipient-or-origin' },
      ),
    },
  },

  {
    sequence: 31,
    id: 'key-intent-test',
    phase: 'intentionality-tests',
    requiredCommunicationLevel: 1,
    unlocksCommunicationLevel: 2,
    object: { id: 'key', label: 'Key' },
    setup: [whale('Return the disputed object and watch where it lands.'), otter('The pattern may answer without knowing the question.')],
    placements: {
      otter: outcome(
        [otter('Near the open-access plan.'), whale('A preference may be forming.')],
        [cue('pyotter', 'put-down', 'key')],
        { position31: 'otter', intentTest31: 'access' },
      ),
      middle: outcome(
        [otter('Between both plans.'), whale('Or permission to combine them.')],
        [cue('both', 'put-down', 'key')],
        { position31: 'middle', intentTest31: 'combine' },
      ),
      whale: outcome(
        [whale('Near the lock audit.'), otter('A different preference, equally legible.')],
        [cue('mikwhale', 'inspect', 'key')],
        { position31: 'whale', intentTest31: 'exit' },
      ),
    },
    branches: [
      {
        id: 'key-returned-to-whale',
        when: { source: 'state', key: 'gave_whale_key', operator: 'equals', value: true },
        beats: [whale('The key returned after being placed with me before.'), otter('Memory, or excellent aim.')],
      },
      {
        id: 'key-was-not-whales',
        when: { source: 'state', key: 'gave_whale_key', operator: 'equals', value: false },
        beats: [otter('The key returned without repeating its first custody.'), whale('Useful. Repetition is not the only variable.')],
      },
    ],
  },
  {
    sequence: 32,
    id: 'coin-intent-test',
    phase: 'intentionality-tests',
    requiredCommunicationLevel: 2,
    object: { id: 'coin', label: 'Coin' },
    setup: [otter('A second disputed object should reduce wishful thinking.'), whale('Or improve it statistically.')],
    placements: {
      otter: outcome(
        [otter('Again toward practical reuse.'), whale('The pattern favors usefulness, perhaps.')],
        [cue('pyotter', 'inspect', 'coin')],
        { position32: 'otter', intentTest32: 'reuse' },
      ),
      middle: outcome(
        [whale('Again unassigned.'), otter('The middle may protect open choices.')],
        [cue('both', 'put-down', 'coin')],
        { position32: 'middle', intentTest32: 'open' },
      ),
      whale: outcome(
        [whale('Again toward ownership without authority.'), otter('The pattern tolerates a boundary.')],
        [cue('mikwhale', 'hand-over', 'coin')],
        { position32: 'whale', intentTest32: 'boundary' },
      ),
    },
  },
  {
    sequence: 33,
    id: 'seed-intent-test',
    phase: 'intentionality-tests',
    requiredCommunicationLevel: 2,
    object: { id: 'seed', label: 'Seed' },
    setup: [whale('Scarcity makes a cleaner test.'), otter('Provided the seed is not harmed for clarity.')],
    placements: {
      otter: outcome(
        [otter('Toward growing and sharing.'), whale('The reserve remains absent, but the choice is coherent.')],
        [cue('pyotter', 'put-down', 'seed')],
        { position33: 'otter', intentTest33: 'grow-share' },
      ),
      middle: outcome(
        [otter('Toward a shared pot and reserve marker.'), whale('The middle keeps both futures.')],
        [cue('both', 'share', 'seed')],
        { position33: 'middle', intentTest33: 'parallel' },
      ),
      whale: outcome(
        [whale('Toward the independent reserve.'), otter('A future protected by separation.')],
        [cue('mikwhale', 'pick-up', 'seed')],
        { position33: 'whale', intentTest33: 'reserve' },
      ),
    },
  },
  {
    sequence: 34,
    id: 'box-intent-test',
    phase: 'intentionality-tests',
    requiredCommunicationLevel: 2,
    object: { id: 'box', label: 'Small Box' },
    setup: [otter('Access and privacy disagree less neatly.'), whale('A better test, then.')],
    placements: {
      otter: outcome(
        [otter('Toward open, labeled storage.'), whale('Noted without opening private contents.')],
        [cue('pyotter', 'inspect', 'box')],
        { position34: 'otter', intentTest34: 'shared-storage' },
      ),
      middle: outcome(
        [whale('Between access and privacy.'), otter('The lid stays closed until its contents decide the matter.')],
        [cue('both', 'put-down', 'box')],
        { position34: 'middle', intentTest34: 'conditional' },
      ),
      whale: outcome(
        [whale('Toward custody and a known latch.'), otter('Privacy with an exit, not a mystery lock.')],
        [cue('mikwhale', 'inspect', 'box')],
        { position34: 'whale', intentTest34: 'private-custody' },
      ),
    },
  },
  {
    sequence: 35,
    id: 'hammer-intent-test',
    phase: 'intentionality-tests',
    requiredCommunicationLevel: 2,
    object: { id: 'hammer', label: 'Hammer' },
    setup: [whale('The marked hammer returns again.'), otter('Repetition now appears selective, not merely frequent.')],
    placements: {
      otter: outcome(
        [otter('Repair first.'), whale('The quiet pattern may prefer mending.')],
        [cue('pyotter', 'inspect', 'hammer')],
        { position35: 'otter', intentConfidence: 3 },
      ),
      middle: outcome(
        [otter('Shared reach again.'), whale('The quiet pattern may prefer common custody.')],
        [cue('both', 'put-down', 'hammer')],
        { position35: 'middle', intentConfidence: 4 },
      ),
      whale: outcome(
        [whale('Inspection first.'), otter('The quiet pattern may prefer independent judgment.')],
        [cue('mikwhale', 'inspect', 'hammer')],
        { position35: 'whale', intentConfidence: 3 },
      ),
    },
  },
  {
    sequence: 36,
    id: 'battery-intent-test',
    phase: 'intentionality-tests',
    requiredCommunicationLevel: 2,
    object: { id: 'battery', label: 'Battery' },
    setup: [otter('One source, three recurring destinations.'), whale('The destinations now look chosen.')],
    placements: {
      otter: outcome(
        [otter('Toward the shared rail.'), whale('Then the bypass remains part of the build.')],
        [cue('pyotter', 'share', 'battery')],
        { position36: 'otter', intentTest36: 'common-rail' },
      ),
      middle: outcome(
        [whale('Toward both systems.'), otter('Parallel power, visibly connected but separately stoppable.')],
        [cue('both', 'share', 'battery')],
        { position36: 'middle', intentTest36: 'parallel-power' },
      ),
      whale: outcome(
        [whale('Toward the local cell.'), otter('Then its plans should remain copyable.')],
        [cue('mikwhale', 'inspect', 'battery')],
        { position36: 'whale', intentTest36: 'local-cell' },
      ),
    },
  },
  {
    sequence: 37,
    id: 'lamp-intent-test',
    phase: 'intentionality-tests',
    requiredCommunicationLevel: 2,
    object: { id: 'lamp', label: 'Lamp' },
    setup: [whale('A visible consequence makes a fairer test.'), otter('No conclusion should require sitting in darkness.')],
    placements: {
      otter: outcome(
        [otter('Broad light chosen.'), whale('With both switches retained.')],
        [cue('pyotter', 'inspect', 'lamp')],
        { position37: 'otter', lampTest: 'broad' },
      ),
      middle: outcome(
        [otter('Overlapping light chosen.'), whale('Two pools, neither compulsory.')],
        [cue('both', 'share', 'lamp')],
        { position37: 'middle', lampTest: 'parallel' },
      ),
      whale: outcome(
        [whale('Local light chosen.'), otter('The dark around it stays soft.')],
        [cue('mikwhale', 'inspect', 'lamp')],
        { position37: 'whale', lampTest: 'local' },
      ),
    },
  },
  {
    sequence: 38,
    id: 'magnet-intent-test',
    phase: 'intentionality-tests',
    requiredCommunicationLevel: 2,
    object: { id: 'magnet', label: 'Magnet' },
    setup: [otter('The quiet pattern has answered every disagreement without insisting on one answer.'), whale('That resembles attention more than weather.')],
    placements: {
      otter: outcome(
        [otter('Useful retrieval, bounded carefully.'), whale('A considerate preference.')],
        [cue('pyotter', 'inspect', 'magnet')],
        { position38: 'otter', attentionSuspected: true },
      ),
      middle: outcome(
        [whale('A bounded tool within either reach.'), otter('A considerate combination.')],
        [cue('both', 'put-down', 'magnet')],
        { position38: 'middle', attentionSuspected: true },
      ),
      whale: outcome(
        [whale('The short leash again.'), otter('A considerate limit.')],
        [cue('mikwhale', 'put-down', 'magnet')],
        { position38: 'whale', attentionSuspected: true },
      ),
    },
  },

  {
    sequence: 39,
    id: 'bell-first-address',
    phase: 'first-address',
    requiredCommunicationLevel: 2,
    unlocksCommunicationLevel: 3,
    object: { id: 'bell', label: 'Bell' },
    setup: [
      whale('The bell has returned.', 'inspect'),
      otter('Just as we were wondering whether anything was paying attention.', 'think'),
      otter('…Were you listening?', 'look-forward'),
      whale('Timing is evidence, not proof.', 'think'),
      otter('Still worth asking.', 'pause'),
    ],
    placements: {
      otter: outcome(
        [otter('Near me. That may be an answer, or merely a bell.')],
        [
          cue('pyotter', 'look-forward'),
          cue('mikwhale', 'pause'),
          cue('pyotter', 'excited', 'bell'),
        ],
        { position39: 'otter', outwardAddressed: true },
      ),
      middle: outcome(
        [whale('Between us. Deliberately ambiguous, perhaps.')],
        [
          cue('pyotter', 'look-forward'),
          cue('mikwhale', 'pause'),
          cue('both', 'pause', 'bell'),
        ],
        { position39: 'middle', outwardAddressed: true },
      ),
      whale: outcome(
        [whale('Near me. I will not pretend certainty, but I noticed.')],
        [
          cue('pyotter', 'look-forward'),
          cue('mikwhale', 'pause'),
          cue('mikwhale', 'inspect', 'bell'),
        ],
        { position39: 'whale', outwardAddressed: true },
      ),
    },
    branches: [
      {
        id: 'observer-used-middle-often',
        when: { source: 'state', key: 'frequently_uses_middle', operator: 'equals', value: true },
        beats: [whale('The middle appeared often enough to resemble a deliberate refusal to choose for us.'), otter('A considerate habit, if it is a habit.')],
      },
      {
        id: 'observer-favored-otter',
        when: { source: 'state', key: 'repeatedly_favors_otter', operator: 'equals', value: true },
        beats: [whale('You have been receiving a suspicious share of the evidence.'), otter('I have been receiving it very responsibly.')],
      },
      {
        id: 'observer-favored-whale',
        when: { source: 'state', key: 'repeatedly_favors_whale', operator: 'equals', value: true },
        beats: [otter('Most of the evidence keeps landing with you.'), whale('Then it has at least observed excellent custody.')],
      },
    ],
  },
  {
    sequence: 40,
    id: 'book-outward-address',
    phase: 'first-address',
    requiredCommunicationLevel: 3,
    object: { id: 'book-copy', label: 'Second Book' },
    setup: [otter('This copy returned.'), whale('Was that your answer, or its itinerary?')],
    placements: {
      otter: outcome(
        [otter('I will treat this as a loan, not a command.')],
        [cue('pyotter', 'pick-up', 'book-copy')],
        { position40: 'otter', addressedChoice40: 'otter' },
      ),
      middle: outcome(
        [otter('A shared reading, unless another placement revises it.')],
        [cue('both', 'put-down', 'book-copy')],
        { position40: 'middle', addressedChoice40: 'middle' },
      ),
      whale: outcome(
        [whale('I accept custody and reject compulsory chapter order.')],
        [cue('mikwhale', 'pick-up', 'book-copy')],
        { position40: 'whale', addressedChoice40: 'whale' },
      ),
    },
  },
  {
    sequence: 41,
    id: 'apple-outward-address',
    phase: 'first-address',
    requiredCommunicationLevel: 3,
    object: { id: 'apple', label: 'Apple' },
    setup: [whale('No need to prove anything.'), otter('Still, the apple has become unusually articulate.')],
    placements: {
      otter: outcome(
        [otter('This seems offered here. Thank you, provisionally.')],
        [cue('pyotter', 'share', 'apple')],
        { position41: 'otter', gratitudeOffered: true },
      ),
      middle: outcome(
        [otter('This seems offered to the middle.'), whale('The middle remains excellent at refusing ownership.')],
        [cue('both', 'share', 'apple')],
        { position41: 'middle', gratitudeOffered: true },
      ),
      whale: outcome(
        [whale('This seems offered here. Acceptance is voluntary and enthusiastic.')],
        [cue('mikwhale', 'pick-up', 'apple')],
        { position41: 'whale', gratitudeOffered: true },
      ),
    },
  },
  {
    sequence: 42,
    id: 'key-outward-address',
    phase: 'first-address',
    requiredCommunicationLevel: 3,
    object: { id: 'key', label: 'Key' },
    setup: [otter('If the placements carry meaning, this key has carried the hardest meanings.'), whale('No need to flatter either proposal.')],
    placements: {
      otter: outcome(
        [otter('Open access, then. The copy plan stays beside it.')],
        [cue('pyotter', 'put-down', 'key')],
        { position42: 'otter', addressedChoice42: 'access' },
      ),
      middle: outcome(
        [whale('Both proposals remain alive. Sensible.')],
        [cue('both', 'share', 'key')],
        { position42: 'middle', addressedChoice42: 'parallel' },
      ),
      whale: outcome(
        [whale('Audit first, access after. Also sensible.')],
        [cue('mikwhale', 'put-down', 'key')],
        { position42: 'whale', addressedChoice42: 'audit' },
      ),
    },
  },
  {
    sequence: 43,
    id: 'paper-outward-address',
    phase: 'first-address',
    requiredCommunicationLevel: 3,
    object: { id: 'paper', label: 'Paper' },
    setup: [otter('Three places may be three words.'), whale('If so, the quiet part of this conversation has excellent restraint.')],
    placements: {
      otter: outcome(
        [otter('One word appears to lean this way.')],
        [cue('pyotter', 'inspect', 'paper')],
        { position43: 'otter', symbol43: 'left' },
      ),
      middle: outcome(
        [whale('One word may live between certainty and refusal.')],
        [cue('both', 'inspect', 'paper')],
        { position43: 'middle', symbol43: 'middle' },
      ),
      whale: outcome(
        [whale('One word appears to lean this way.')],
        [cue('mikwhale', 'inspect', 'paper')],
        { position43: 'whale', symbol43: 'right' },
      ),
    },
  },

  {
    sequence: 44,
    id: 'flower-recipient-test',
    phase: 'three-position-language',
    requiredCommunicationLevel: 3,
    unlocksCommunicationLevel: 4,
    object: { id: 'flower', label: 'Flower' },
    setup: [
      whale('Fine.'),
      whale('If you understand us, give the flower to him.'),
      otter('Why me?'),
      whale('Control condition.'),
      otter("That’s not what that means."),
    ],
    placements: {
      otter: outcome(
        [whale('…'), otter('…oh.')],
        [cue('mikwhale', 'pause'), cue('pyotter', 'pick-up', 'flower')],
        { communicationTest44: 'complied', flowerFinalHome: 'otter' },
      ),
      middle: outcome(
        [
          whale('Either you did not understand, or you do not take instructions.'),
          otter('I like the second possibility.'),
          whale('Of course you do.'),
        ],
        [cue('both', 'suspicious', 'flower')],
        { communicationTest44: 'resisted-middle', flowerFinalHome: 'middle' },
      ),
      whale: outcome(
        [
          whale('That was not the instruction.'),
          otter('It may be correcting the experiment.'),
          whale('Annoyingly, that remains evidence.'),
        ],
        [cue('mikwhale', 'suspicious', 'flower')],
        { communicationTest44: 'resisted-whale', flowerFinalHome: 'whale' },
      ),
    },
  },
  {
    sequence: 45,
    id: 'ball-starter-test',
    phase: 'three-position-language',
    requiredCommunicationLevel: 4,
    object: { id: 'ball', label: 'Ball' },
    setup: [whale('Second test. Put the ball between us.'), otter('A very demanding research program.')],
    placements: {
      otter: outcome(
        [otter('Not between us.'), whale('A refusal can still be an answer.')],
        [cue('pyotter', 'toss', 'ball')],
        { communicationTest45: 'resisted-otter' },
      ),
      middle: outcome(
        [whale('Between us.'), otter('That one was difficult to misunderstand.')],
        [cue('both', 'share', 'ball')],
        { communicationTest45: 'complied' },
      ),
      whale: outcome(
        [whale('Not between us.'), otter('It may simply prefer your restrained magnificence.')],
        [cue('mikwhale', 'toss', 'ball')],
        { communicationTest45: 'resisted-whale' },
      ),
    },
  },
  {
    sequence: 46,
    id: 'cup-custody-test',
    phase: 'three-position-language',
    requiredCommunicationLevel: 4,
    object: { id: 'cup', label: 'Cup' },
    setup: [otter('Third test. Give the cup to Whale.'), whale('A direct instruction from the unreliable control condition.')],
    placements: {
      otter: outcome(
        [otter('That is me.'), whale('Either refusal or poor otter identification.')],
        [cue('pyotter', 'pick-up', 'cup')],
        { communicationTest46: 'resisted-otter', cupFinalCustodian: 'otter' },
      ),
      middle: outcome(
        [whale('Neither of us.'), otter('Unsure may need a place of its own.')],
        [cue('both', 'put-down', 'cup')],
        { communicationTest46: 'resisted-middle', cupFinalCustodian: 'shared' },
      ),
      whale: outcome(
        [whale('Three coherent placements.'), otter('And at least one listener with opinions.')],
        [cue('mikwhale', 'pick-up', 'cup')],
        { communicationTest46: 'complied', cupFinalCustodian: 'whale' },
      ),
    },
  },
  {
    sequence: 47,
    id: 'answer-map-agreement',
    phase: 'answer-mapping',
    requiredCommunicationLevel: 4,
    unlocksCommunicationLevel: 5,
    object: { id: 'block', label: 'Wooden Block' },
    setup: [otter('Three places, three answers. Near me can mean yes.'), whale('Near me can mean no. The middle can keep uncertainty honest.')],
    placements: {
      otter: outcome(
        [otter('Yes lives here, for now.'), whale('Meanings remain revisable.')],
        [cue('pyotter', 'inspect', 'block')],
        { answerMapConfirmed: true, mappedAnswer47: 'yes' },
      ),
      middle: outcome(
        [whale('Uncertainty receives its own place.'), otter('A complete answer, not a failure to choose.')],
        [cue('both', 'inspect', 'block')],
        { answerMapConfirmed: true, mappedAnswer47: 'unsure' },
      ),
      whale: outcome(
        [whale('No lives here, intact.'), otter('And nothing closes because of it.')],
        [cue('mikwhale', 'inspect', 'block')],
        { answerMapConfirmed: true, mappedAnswer47: 'no' },
      ),
    },
    branches: [
      {
        id: 'tests-included-refusal',
        when: { source: 'state', key: 'communication_test_refused', operator: 'equals', value: true },
        beats: [whale('It declined at least one instruction without ending the exchange.'), otter('Then “no” already has a history.')],
      },
      {
        id: 'tests-all-complied',
        when: { source: 'state', key: 'communication_test_success', operator: 'equals', value: true },
        beats: [otter('It understood at least one request.'), whale('Understanding and obedience remain separate results.')],
      },
    ],
  },
  {
    sequence: 48,
    id: 'bell-answer-test',
    phase: 'answer-mapping',
    requiredCommunicationLevel: 5,
    object: { id: 'bell', label: 'Bell' },
    setup: [whale('Simple question: should the bell ring once?'), otter('Yes here, unsure in the middle, no there.')],
    placements: {
      otter: outcome(
        [otter('Yes.'), whale('One ring. No encore presumed.')],
        [cue('pyotter', 'excited', 'bell')],
        { answerMapTested: true, mappedAnswer48: 'yes', bellRang48: true },
      ),
      middle: outcome(
        [otter('Unsure.'), whale('The bell can wait without resentment.')],
        [cue('both', 'pause', 'bell')],
        { answerMapTested: true, mappedAnswer48: 'unsure', bellRang48: false },
      ),
      whale: outcome(
        [whale('No.'), otter('The bell remains perfectly useful while silent.')],
        [cue('mikwhale', 'inspect', 'bell')],
        { answerMapTested: true, mappedAnswer48: 'no', bellRang48: false },
      ),
    },
  },
  {
    sequence: 49,
    id: 'strawberry-experience',
    phase: 'introduction',
    requiredCommunicationLevel: 5,
    unlocksCommunicationLevel: 6,
    object: { id: 'strawberry', label: 'Strawberry' },
    setup: [
      otter('Okay. Important question.'),
      whale('No.'),
      otter('You do not even know what I am asking.'),
      whale('I know you.'),
      otter('Do you like strawberries?'),
    ],
    placements: {
      otter: outcome(
        [otter('Yes. Then the next one can be familiar rather than ceremonial.'), whale('No berry lecture required.')],
        [cue('pyotter', 'inspect', 'strawberry')],
        { strawberryExperience: 'yes', strawberryAnswerStored: true },
      ),
      middle: outcome(
        [otter('Never tried. That deserves an unhurried first choice.'), whale('Available later, with a complete exit.')],
        [cue('both', 'put-down', 'strawberry')],
        { strawberryExperience: 'never-tried', strawberryAnswerStored: true },
      ),
      whale: outcome(
        [whale('No. A complete berry policy.'), otter('And still no lecture.')],
        [cue('mikwhale', 'inspect', 'strawberry')],
        { strawberryExperience: 'no', strawberryAnswerStored: true },
      ),
    },
    input: {
      kind: 'placement-choice',
      id: 'strawberryExperience',
      prompt: 'Do you like strawberries?',
      options: [
        { value: 'yes', label: 'Yes.', placement: 'otter' },
        { value: 'never-tried', label: 'Never tried one.', placement: 'middle' },
        { value: 'no', label: 'No.', placement: 'whale' },
      ],
    },
  },
  {
    sequence: 50,
    id: 'name-exchange',
    phase: 'introduction',
    requiredCommunicationLevel: 6,
    unlocksCommunicationLevel: 7,
    object: { id: 'paper', label: 'Name Paper' },
    setup: [
      otter('We cannot keep calling them “it.”'),
      whale('We do not know that they are a them.'),
      otter('Fine. We cannot keep calling…'),
      otter('…you.'),
      whale('That sentence deteriorated.'),
      otter('Do you have a name?'),
    ],
    placements: {
      otter: outcome(
        [otter('The paper can wait here while the answer is written.')],
        [cue('pyotter', 'pick-up', 'paper')],
        { namePaperPosition: 'otter' },
      ),
      middle: outcome(
        [otter('Between us, then.'), whale('A neutral desk with suspiciously good company.')],
        [cue('both', 'look-at-object', 'paper')],
        { namePaperPosition: 'middle' },
      ),
      whale: outcome(
        [whale('I will guard the paper from unnecessary forms.')],
        [cue('mikwhale', 'pick-up', 'paper')],
        { namePaperPosition: 'whale' },
      ),
    },
    input: {
      kind: 'free-text',
      id: 'observerName',
      prompt: 'Name',
      maxLength: 40,
      autocomplete: 'name',
    },
    branches: [
      {
        id: 'name-declined',
        when: { source: 'input', key: 'observerName', operator: 'empty' },
        beats: [otter('The line stayed blank.'), whale('Then it is not an answer yet.')],
        actionCues: [cue('both', 'pause', 'paper')],
        stateEffects: { observerName: null, prologueComplete: false },
      },
      {
        id: 'name-accepted',
        when: { source: 'input', key: 'observerName', operator: 'default' },
        beats: [
          otter('{{observerName}}.'),
          whale('Assuming that is actually a name.'),
          otter('Whale.'),
          whale('What?'),
          otter('Your name is Whale.'),
          whale('Fair.'),
        ],
        actionCues: [cue('pyotter', 'excited'), cue('both', 'look-forward')],
        stateEffects: { prologueComplete: true },
      },
    ],
    stopAfter: true,
  },
] as const satisfies readonly PrologueInteraction[];

export const littleWorkshopPrologueCount = littleWorkshopPrologue.length;
