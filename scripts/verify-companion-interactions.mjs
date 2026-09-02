export const expectedMarkers = ['approach', 'ready', 'contact', 'accent', 'release', 'complete'];
export const expectedCapabilities = ['greet', 'limbTap', 'nuzzle', 'hug', 'travelTogether'];

const expectedMarkerTimes = {
  approach: 0,
  ready: 0.2,
  contact: 0.4,
  accent: 0.52,
  release: 0.78,
  complete: 1
};
const expectedOcclusion = {
  mode: 'auto-by-y',
  tieBreak: 'stable-character-id',
  backToFrontOrder: ['mikwhale', 'pyotter']
};
const expectedInterruptPolicy = {
  stopLatencyMs: 0,
  beforeContact: 'return-to-cancel-pose',
  afterContact: 'safe-separation-transition',
  safeSeparationDurationMs: 200,
  affectionPenalty: false
};
const expectedSharedStage = {
  unit: 'designPx',
  width: 1024,
  height: 1024,
  scaleSource: 'rig.sharedStageScale'
};
const expectedProductionGates = [
  'requiresRuntimeLayers',
  'requiresPerViewPivotCoordinates',
  'requiresPerViewAttachmentCoordinates',
  'requiresHitPolygons',
  'requiresAuthoredKeyframes',
  'requiresPairedClipIds',
  'requiresContactDistanceVerification'
];
const offset = (axis, pyotter, mikwhale) => ({
  unit: 'designPx',
  basis: 'shared-stage',
  axis,
  pyotter,
  mikwhale
});
const expectedContracts = {
  greet: {
    durationMs: 900,
    loop: false,
    selfRole: 'face',
    partnerRole: 'face',
    headingRule: 'face-partner',
    offset: offset('contact-normal', 0, 0),
    occlusion: 'inherit',
    interruptibleAtAnyPhase: true,
    gracefulReleaseMarker: 'release',
    reducedMotionPose: 'static-contact'
  },
  limbTap: {
    durationMs: 800,
    loop: false,
    selfRole: 'limbNear',
    partnerRole: 'limbNear',
    headingRule: 'face-partner',
    offset: offset('contact-normal', 0, 0),
    occlusion: 'inherit',
    interruptibleAtAnyPhase: true,
    gracefulReleaseMarker: 'release',
    reducedMotionPose: 'static-contact'
  },
  nuzzle: {
    durationMs: 1200,
    loop: false,
    selfRole: 'face',
    partnerRole: 'face',
    headingRule: 'face-partner',
    offset: offset('contact-normal', 0, 0),
    occlusion: 'inherit',
    interruptibleAtAnyPhase: true,
    gracefulReleaseMarker: 'release',
    reducedMotionPose: 'static-contact'
  },
  hug: {
    durationMs: 1600,
    loop: false,
    selfRole: 'center',
    partnerRole: 'center',
    headingRule: 'face-partner',
    offset: offset('contact-normal', -48, 48),
    occlusion: 'inherit',
    interruptibleAtAnyPhase: true,
    gracefulReleaseMarker: 'release',
    reducedMotionPose: 'static-contact'
  },
  travelTogether: {
    durationMs: 1000,
    loop: true,
    selfRole: 'center',
    partnerRole: 'center',
    headingRule: 'parallel',
    offset: offset('perpendicular-to-heading', -96, 96),
    occlusion: 'inherit',
    interruptibleAtAnyPhase: true,
    gracefulReleaseMarker: 'release',
    reducedMotionPose: 'static-parallel'
  }
};

const exact = (actual, expected, label) => {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`Invalid shared interaction ${label}`);
  }
};

export function verifyInteractionContract(contract) {
  if (
    contract.id !== 'pyotter-mikwhale-interactions' ||
    contract.version !== 1 ||
    contract.stage !== 'pre-animation-contract' ||
    contract.phaseUnit !== 'normalized' ||
    contract.contactToleranceDesignPx !== 4 ||
    contract.rootMotion !== 'external'
  ) {
    throw new Error('Shared interaction contract header is invalid');
  }
  exact(contract.actorOrder, ['pyotter', 'mikwhale'], 'actor order');
  exact(contract.markerOrder, expectedMarkers, 'marker order');
  exact(contract.markerTimes, expectedMarkerTimes, 'marker times');
  exact(contract.pairOcclusionDefault, expectedOcclusion, 'occlusion policy');
  exact(contract.interruptPolicy, expectedInterruptPolicy, 'interrupt policy');
  exact(contract.sharedStage, expectedSharedStage, 'shared stage');
  exact(Object.keys(contract.capabilities ?? {}), expectedCapabilities, 'capability order');
  for (const capability of expectedCapabilities) {
    exact(contract.capabilities[capability], expectedContracts[capability], `${capability} timeline`);
  }
  exact(Object.keys(contract.productionGate ?? {}), expectedProductionGates, 'production gates');
  if (expectedProductionGates.some((gate) => contract.productionGate[gate] !== true)) {
    throw new Error('Shared interaction production gate is disabled');
  }
}
