export const LITTLE_WORKSHOP_STATE_VERSION = 1 as const;
export const LITTLE_WORKSHOP_STORAGE_KEY = 'little-workshop-state';
export const COMMUNICATION_LEVELS = [0, 1, 2, 3, 4, 5, 6, 7] as const;

export type CommunicationLevel = (typeof COMMUNICATION_LEVELS)[number];
export type PlacementTarget = 'otter' | 'whale' | 'middle';
export type ChoiceKind =
  | 'sharing'
  | 'autonomy'
  | 'experimentation'
  | 'automation'
  | 'centralized_solution'
  | 'distributed_solution';
export type TestResponse = 'complied' | 'resisted';
export type NotableEventValue = string | number | boolean | null;
type ChoiceCounterKey =
  | 'sharing_choices'
  | 'autonomy_choices'
  | 'experimentation_choices'
  | 'automation_choices'
  | 'centralized_solution_choices'
  | 'distributed_solution_choices';

export interface PLAYER_STATE {
  name: string | null;
  player_name: string | null;
  known_to_characters: boolean;
  communication_level: CommunicationLevel;
  interaction_count: number;
  otter_gifts: number;
  whale_gifts: number;
  middle_placements: number;
  sharing_choices: number;
  autonomy_choices: number;
  experimentation_choices: number;
  automation_choices: number;
  centralized_solution_choices: number;
  distributed_solution_choices: number;
  player_complied_with_tests: number;
  player_resisted_tests: number;
  strawberry_answer: string | null;
  gave_otter_first_apple: boolean;
  gave_whale_key: boolean;
  repeatedly_favors_otter: boolean;
  repeatedly_favors_whale: boolean;
  frequently_uses_middle: boolean;
  communication_test_success: boolean;
  communication_test_refused: boolean;
}

export interface PREFERENCES {
  strawberries: string | null;
  observed_sharing_tendency: number;
  observed_autonomy_tendency: number;
  observed_experimentation_tendency: number;
}

export interface RELATIONSHIP {
  otter_attention: number;
  whale_attention: number;
  otter_trust: number;
  whale_trust: number;
}

export interface HISTORY {
  important_choices: string[];
  important_events: string[];
  notable_event_flags: Record<string, NotableEventValue>;
  character_predictions: string[];
  resolved_disagreements: string[];
}

export interface CommunicationProtocol {
  current_level: CommunicationLevel;
  completed_levels: CommunicationLevel[];
}

export interface WORLD {
  current_object: string | null;
  previous_objects: string[];
  communication_protocol: CommunicationProtocol;
}

export interface LittleWorkshopState {
  PLAYER_STATE: PLAYER_STATE;
  PREFERENCES: PREFERENCES;
  RELATIONSHIP: RELATIONSHIP;
  HISTORY: HISTORY;
  WORLD: WORLD;
}

export interface PlacementInput {
  target: PlacementTarget;
  object_id?: string | null;
  choices?: readonly ChoiceKind[];
  test_response?: TestResponse | null;
  state_effects?: Readonly<Record<string, NotableEventValue>>;
}

export interface ObjectReuseInput {
  target: PlacementTarget;
  object_id: string;
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

interface StoredState {
  version: typeof LITTLE_WORKSHOP_STATE_VERSION;
  state: LittleWorkshopState;
}

type UnknownRecord = Record<string, unknown>;

const HISTORY_LIMIT = 200;
const SHORT_TEXT_LIMIT = 120;
const volatileStates = new WeakMap<object, LittleWorkshopState>();
let noStorageState: LittleWorkshopState | null = null;

const isRecord = (value: unknown): value is UnknownRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const nonNegativeInteger = (value: unknown, fallback = 0): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.max(0, Math.min(Number.MAX_SAFE_INTEGER, Math.floor(value)));
};

const booleanValue = (value: unknown, fallback = false): boolean =>
  typeof value === 'boolean' ? value : fallback;

const textValue = (value: unknown, limit = SHORT_TEXT_LIMIT): string | null => {
  if (typeof value !== 'string') return null;
  const text = value.trim();
  return text ? text.slice(0, limit) : null;
};

const nameValue = (value: unknown, limit = 40): string | null => {
  if (typeof value !== 'string') return null;
  const normalized = value.normalize('NFC').trim();
  if (!normalized) return null;
  try {
    const segments = Array.from(
      new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(normalized),
      ({ segment }) => segment,
    );
    return segments.slice(0, limit).join('');
  } catch {
    return Array.from(normalized).slice(0, limit).join('');
  }
};

export const normalizePlayerName = (value: unknown): string | null => nameValue(value);

const textList = (value: unknown, limit = HISTORY_LIMIT): string[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => textValue(entry, 240))
    .filter((entry): entry is string => entry !== null)
    .slice(-limit);
};

const notableEventFlags = (value: unknown): Record<string, NotableEventValue> => {
  if (!isRecord(value)) return {};
  const entries = Object.entries(value).slice(-HISTORY_LIMIT);
  return Object.fromEntries(
    entries.flatMap(([rawKey, rawValue]) => {
      const key = rawKey.trim().slice(0, 80);
      if (!key) return [];
      if (
        rawValue === null ||
        typeof rawValue === 'string' ||
        typeof rawValue === 'number' ||
        typeof rawValue === 'boolean'
      ) {
        return [[key, typeof rawValue === 'string' ? rawValue.slice(0, 240) : rawValue]];
      }
      return [];
    }),
  );
};

const isCommunicationLevel = (value: unknown): value is CommunicationLevel =>
  typeof value === 'number' &&
  Number.isInteger(value) &&
  COMMUNICATION_LEVELS.includes(value as CommunicationLevel);

const communicationLevelList = (value: unknown): CommunicationLevel[] => {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(value.filter(isCommunicationLevel)));
};

export const communicationLevelForInteractionCount = (
  interactionCount: number,
): CommunicationLevel => {
  if (interactionCount >= 50) return 7;
  if (interactionCount >= 49) return 6;
  if (interactionCount >= 47) return 5;
  if (interactionCount >= 44) return 4;
  if (interactionCount >= 39) return 3;
  if (interactionCount >= 31) return 2;
  if (interactionCount >= 21) return 1;
  return 0;
};

const storageOrNull = (storage?: StorageLike | null): StorageLike | null => {
  if (storage !== undefined) return storage;
  try {
    return typeof globalThis.localStorage === 'undefined' ? null : globalThis.localStorage;
  } catch {
    return null;
  }
};

export const createInitialState = (): LittleWorkshopState => ({
  PLAYER_STATE: {
    name: null,
    player_name: null,
    known_to_characters: false,
    communication_level: 0,
    interaction_count: 0,
    otter_gifts: 0,
    whale_gifts: 0,
    middle_placements: 0,
    sharing_choices: 0,
    autonomy_choices: 0,
    experimentation_choices: 0,
    automation_choices: 0,
    centralized_solution_choices: 0,
    distributed_solution_choices: 0,
    player_complied_with_tests: 0,
    player_resisted_tests: 0,
    strawberry_answer: null,
    gave_otter_first_apple: false,
    gave_whale_key: false,
    repeatedly_favors_otter: false,
    repeatedly_favors_whale: false,
    frequently_uses_middle: false,
    communication_test_success: false,
    communication_test_refused: false,
  },
  PREFERENCES: {
    strawberries: null,
    observed_sharing_tendency: 0,
    observed_autonomy_tendency: 0,
    observed_experimentation_tendency: 0,
  },
  RELATIONSHIP: {
    otter_attention: 0,
    whale_attention: 0,
    otter_trust: 0,
    whale_trust: 0,
  },
  HISTORY: {
    important_choices: [],
    important_events: [],
    notable_event_flags: {},
    character_predictions: [],
    resolved_disagreements: [],
  },
  WORLD: {
    current_object: null,
    previous_objects: [],
    communication_protocol: {
      current_level: 0,
      completed_levels: [],
    },
  },
});

const applyDerivedState = (state: LittleWorkshopState): LittleWorkshopState => {
  const player = state.PLAYER_STATE;
  const directedPlacements = player.otter_gifts + player.whale_gifts;
  const allPlacements = directedPlacements + player.middle_placements;

  player.repeatedly_favors_otter = player.otter_gifts >= 3 && player.otter_gifts >= player.whale_gifts + 2;
  player.repeatedly_favors_whale = player.whale_gifts >= 3 && player.whale_gifts >= player.otter_gifts + 2;
  player.frequently_uses_middle =
    player.middle_placements >= 3 && player.middle_placements * 2 >= allPlacements;
  player.communication_test_success =
    player.communication_test_success || player.player_complied_with_tests > 0;
  player.communication_test_refused =
    player.communication_test_refused || player.player_resisted_tests > 0;

  state.PREFERENCES.observed_sharing_tendency = player.sharing_choices;
  state.PREFERENCES.observed_autonomy_tendency = player.autonomy_choices;
  state.PREFERENCES.observed_experimentation_tendency = player.experimentation_choices;
  state.WORLD.communication_protocol.current_level = player.communication_level;

  return state;
};

const normalizeState = (value: unknown): LittleWorkshopState => {
  const initial = createInitialState();
  if (!isRecord(value)) return initial;

  const rawPlayer = isRecord(value.PLAYER_STATE) ? value.PLAYER_STATE : {};
  const rawPreferences = isRecord(value.PREFERENCES) ? value.PREFERENCES : {};
  const rawRelationship = isRecord(value.RELATIONSHIP) ? value.RELATIONSHIP : {};
  const rawHistory = isRecord(value.HISTORY) ? value.HISTORY : {};
  const rawWorld = isRecord(value.WORLD) ? value.WORLD : {};
  const rawProtocol = isRecord(rawWorld.communication_protocol) ? rawWorld.communication_protocol : {};

  const name = nameValue(rawPlayer.name) ?? nameValue(rawPlayer.player_name);
  const strawberryAnswer =
    textValue(rawPlayer.strawberry_answer) ?? textValue(rawPreferences.strawberries);
  const interactionCount = nonNegativeInteger(rawPlayer.interaction_count);
  const level = communicationLevelForInteractionCount(interactionCount);

  const state: LittleWorkshopState = {
    PLAYER_STATE: {
      name,
      player_name: name,
      known_to_characters: booleanValue(rawPlayer.known_to_characters, name !== null) && name !== null,
      communication_level: level,
      interaction_count: interactionCount,
      otter_gifts: nonNegativeInteger(rawPlayer.otter_gifts),
      whale_gifts: nonNegativeInteger(rawPlayer.whale_gifts),
      middle_placements: nonNegativeInteger(rawPlayer.middle_placements),
      sharing_choices: nonNegativeInteger(rawPlayer.sharing_choices),
      autonomy_choices: nonNegativeInteger(rawPlayer.autonomy_choices),
      experimentation_choices: nonNegativeInteger(rawPlayer.experimentation_choices),
      automation_choices: nonNegativeInteger(rawPlayer.automation_choices),
      centralized_solution_choices: nonNegativeInteger(rawPlayer.centralized_solution_choices),
      distributed_solution_choices: nonNegativeInteger(rawPlayer.distributed_solution_choices),
      player_complied_with_tests: nonNegativeInteger(rawPlayer.player_complied_with_tests),
      player_resisted_tests: nonNegativeInteger(rawPlayer.player_resisted_tests),
      strawberry_answer: strawberryAnswer,
      gave_otter_first_apple: booleanValue(rawPlayer.gave_otter_first_apple),
      gave_whale_key: booleanValue(rawPlayer.gave_whale_key),
      repeatedly_favors_otter: false,
      repeatedly_favors_whale: false,
      frequently_uses_middle: false,
      communication_test_success: booleanValue(rawPlayer.communication_test_success),
      communication_test_refused: booleanValue(rawPlayer.communication_test_refused),
    },
    PREFERENCES: {
      strawberries: strawberryAnswer,
      observed_sharing_tendency: nonNegativeInteger(rawPreferences.observed_sharing_tendency),
      observed_autonomy_tendency: nonNegativeInteger(rawPreferences.observed_autonomy_tendency),
      observed_experimentation_tendency: nonNegativeInteger(rawPreferences.observed_experimentation_tendency),
    },
    RELATIONSHIP: {
      otter_attention: nonNegativeInteger(rawRelationship.otter_attention),
      whale_attention: nonNegativeInteger(rawRelationship.whale_attention),
      otter_trust: nonNegativeInteger(rawRelationship.otter_trust),
      whale_trust: nonNegativeInteger(rawRelationship.whale_trust),
    },
    HISTORY: {
      important_choices: textList(rawHistory.important_choices),
      important_events: textList(rawHistory.important_events),
      notable_event_flags: notableEventFlags(rawHistory.notable_event_flags),
      character_predictions: textList(rawHistory.character_predictions),
      resolved_disagreements: textList(rawHistory.resolved_disagreements),
    },
    WORLD: {
      current_object: textValue(rawWorld.current_object, 80),
      previous_objects: textList(rawWorld.previous_objects, 100),
      communication_protocol: {
        current_level: level,
        completed_levels: communicationLevelList(rawProtocol.completed_levels),
      },
    },
  };

  return applyDerivedState(state);
};

const readVolatileState = (storage: StorageLike | null): LittleWorkshopState => {
  const state = storage ? volatileStates.get(storage) : noStorageState;
  return state ? normalizeState(state) : createInitialState();
};

const writeVolatileState = (
  storage: StorageLike | null,
  state: LittleWorkshopState,
): LittleWorkshopState => {
  const normalized = normalizeState(state);
  if (storage) volatileStates.set(storage, normalized);
  else noStorageState = normalized;
  return normalized;
};

export const loadState = (storage?: StorageLike | null): LittleWorkshopState => {
  const resolvedStorage = storageOrNull(storage);
  if (!resolvedStorage) return readVolatileState(null);

  try {
    const serialized = resolvedStorage.getItem(LITTLE_WORKSHOP_STORAGE_KEY);
    if (!serialized) return readVolatileState(resolvedStorage);
    const stored: unknown = JSON.parse(serialized);
    if (!isRecord(stored) || stored.version !== LITTLE_WORKSHOP_STATE_VERSION) {
      return createInitialState();
    }
    const persisted = normalizeState(stored.state);
    const volatile = volatileStates.get(resolvedStorage);
    if (
      volatile &&
      volatile.PLAYER_STATE.interaction_count >= persisted.PLAYER_STATE.interaction_count
    ) {
      return normalizeState(volatile);
    }
    return writeVolatileState(resolvedStorage, persisted);
  } catch {
    return readVolatileState(resolvedStorage);
  }
};

export const saveState = (state: LittleWorkshopState, storage?: StorageLike | null): boolean => {
  const resolvedStorage = storageOrNull(storage);
  if (!resolvedStorage) {
    writeVolatileState(null, state);
    return false;
  }

  const normalized = writeVolatileState(resolvedStorage, state);
  const stored: StoredState = {
    version: LITTLE_WORKSHOP_STATE_VERSION,
    state: normalized,
  };

  try {
    resolvedStorage.setItem(LITTLE_WORKSHOP_STORAGE_KEY, JSON.stringify(stored));
    return true;
  } catch {
    return false;
  }
};

export const resetState = (storage?: StorageLike | null): LittleWorkshopState => {
  const resolvedStorage = storageOrNull(storage);
  if (resolvedStorage) {
    try {
      resolvedStorage.removeItem(LITTLE_WORKSHOP_STORAGE_KEY);
    } catch {
      // A reset still returns a clean in-memory state when storage is unavailable.
    }
  }
  return writeVolatileState(resolvedStorage, createInitialState());
};

const appendHistory = (entries: string[], entry: string): void => {
  entries.push(entry.slice(0, 240));
  if (entries.length > HISTORY_LIMIT) entries.splice(0, entries.length - HISTORY_LIMIT);
};

const choiceCounter: Record<ChoiceKind, ChoiceCounterKey> = {
  sharing: 'sharing_choices',
  autonomy: 'autonomy_choices',
  experimentation: 'experimentation_choices',
  automation: 'automation_choices',
  centralized_solution: 'centralized_solution_choices',
  distributed_solution: 'distributed_solution_choices',
};

export const recordPlacement = (
  input: PlacementInput,
  storage?: StorageLike | null,
): LittleWorkshopState => {
  const state = loadState(storage);
  const player = state.PLAYER_STATE;
  const priorPlacementCount = player.otter_gifts + player.whale_gifts + player.middle_placements;
  const objectId = textValue(input.object_id, 80);

  if (input.target === 'otter') {
    player.otter_gifts += 1;
    state.RELATIONSHIP.otter_attention += 1;
  } else if (input.target === 'whale') {
    player.whale_gifts += 1;
    state.RELATIONSHIP.whale_attention += 1;
  } else {
    player.middle_placements += 1;
  }

  if (objectId?.toLowerCase() === 'apple' && priorPlacementCount === 0 && input.target === 'otter') {
    player.gave_otter_first_apple = true;
  }
  if (objectId?.toLowerCase() === 'key' && input.target === 'whale') {
    player.gave_whale_key = true;
  }

  for (const choice of new Set(input.choices ?? [])) {
    player[choiceCounter[choice]] += 1;
  }

  for (const [key, value] of Object.entries(input.state_effects ?? {})) {
    state.HISTORY.notable_event_flags[key] = value;
    appendHistory(state.HISTORY.important_events, `${key}:${String(value)}`);
  }

  if (input.test_response === 'complied') {
    player.player_complied_with_tests += 1;
    player.communication_test_success = true;
    const level = player.communication_level;
    if (!state.WORLD.communication_protocol.completed_levels.includes(level)) {
      state.WORLD.communication_protocol.completed_levels.push(level);
    }
  } else if (input.test_response === 'resisted') {
    player.player_resisted_tests += 1;
    player.communication_test_refused = true;
  }

  if (objectId) {
    if (state.WORLD.current_object && state.WORLD.current_object !== objectId) {
      state.WORLD.previous_objects.push(state.WORLD.current_object);
      state.WORLD.previous_objects = state.WORLD.previous_objects.slice(-100);
    }
    state.WORLD.current_object = objectId;
  }

  player.interaction_count += 1;
  player.communication_level = communicationLevelForInteractionCount(player.interaction_count);
  const choiceLabel = input.choices?.length ? ` [${Array.from(new Set(input.choices)).join(',')}]` : '';
  appendHistory(
    state.HISTORY.important_choices,
    `${objectId ?? 'object'}:${input.target}${choiceLabel}`,
  );

  applyDerivedState(state);
  saveState(state, storage);
  return state;
};

export const recordObjectReuse = (
  input: ObjectReuseInput,
  storage?: StorageLike | null,
): LittleWorkshopState => {
  const state = loadState(storage);
  const objectId = textValue(input.object_id, 80);
  if (!objectId) return state;

  const previousCount = state.HISTORY.notable_event_flags.drawerObjectReuses;
  const reuseCount =
    typeof previousCount === 'number' && Number.isFinite(previousCount)
      ? nonNegativeInteger(previousCount) + 1
      : 1;
  state.HISTORY.notable_event_flags.drawerObjectReuses = reuseCount;
  state.HISTORY.notable_event_flags.lastReusedObject = objectId;
  state.HISTORY.notable_event_flags.lastReusePlacement = input.target;
  appendHistory(state.HISTORY.important_choices, `reuse:${objectId}:${input.target}`);

  saveState(state, storage);
  return state;
};

export const recordStrawberry = (
  answer: string | boolean | null,
  storage?: StorageLike | null,
  stateEffects?: Readonly<Record<string, NotableEventValue>>,
): LittleWorkshopState => {
  const state = loadState(storage);
  const rawAnswer = typeof answer === 'boolean' ? (answer ? 'yes' : 'no') : textValue(answer);
  const normalizedAnswer =
    rawAnswer === 'yes' || rawAnswer === 'no' || rawAnswer === 'never-tried' ? rawAnswer : null;

  if (!normalizedAnswer) return state;

  state.PLAYER_STATE.strawberry_answer = normalizedAnswer;
  state.PREFERENCES.strawberries = normalizedAnswer;
  for (const [key, value] of Object.entries(stateEffects ?? {})) {
    state.HISTORY.notable_event_flags[key] = value;
    appendHistory(state.HISTORY.important_events, `${key}:${String(value)}`);
  }
  state.PLAYER_STATE.interaction_count += 1;
  state.PLAYER_STATE.communication_level = communicationLevelForInteractionCount(
    state.PLAYER_STATE.interaction_count,
  );
  appendHistory(state.HISTORY.important_events, `strawberries:${normalizedAnswer ?? 'unanswered'}`);

  saveState(state, storage);
  return state;
};

export const recordName = (
  name: string | null,
  storage?: StorageLike | null,
  stateEffects?: Readonly<Record<string, NotableEventValue>>,
): LittleWorkshopState => {
  const state = loadState(storage);
  const normalizedName = nameValue(name);

  if (!normalizedName) return state;

  state.PLAYER_STATE.name = normalizedName;
  state.PLAYER_STATE.player_name = normalizedName;
  state.PLAYER_STATE.known_to_characters = normalizedName !== null;
  for (const [key, value] of Object.entries(stateEffects ?? {})) {
    state.HISTORY.notable_event_flags[key] = value;
    appendHistory(state.HISTORY.important_events, `${key}:${String(value)}`);
  }
  state.PLAYER_STATE.interaction_count += 1;
  state.PLAYER_STATE.communication_level = communicationLevelForInteractionCount(
    state.PLAYER_STATE.interaction_count,
  );
  appendHistory(state.HISTORY.important_events, `name:${normalizedName ?? 'cleared'}`);

  saveState(state, storage);
  return state;
};
