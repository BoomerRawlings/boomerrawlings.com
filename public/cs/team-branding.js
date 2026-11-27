/**
 * Display-only organization palettes, reviewed 2026-11-27.
 * These lookups never merge team identities or infer roster transfers.
 * Source-art colors are exact where stated. Secondary dark tones and named-color
 * approximations are editorial UI choices, not certified historical brand hexes.
 * Marks/palettes need not be contemporaneous with the displayed match.
 *
 * Raster inspection (read only): Fnatic, G2, VP, MOUZ and Titan have real alpha;
 * Dignitas JPEG is opaque white. No bitmap was edited or background removed.
 * Official marks must retain complete shape, original colors and full opacity.
 * CSS alpha masks apply only to the explicitly approved reusable Commons assets.
 */

const normalize = value => String(value ?? '').normalize('NFKC').trim().toLowerCase().replace(/\s+/g, ' ');
const common = (label, primary, secondary, accent, aliases, mode, basis, source) => ({
  label, primary, secondary, accent, text: '#FFFFFF', aliases, mode,
  palette_basis: basis, source_url: source || null
});

export const TEAM_BRANDS = Object.freeze({
  'natus vincere': common('NAVI', '#FDF135', '#000105', '#FDF135', ['navi'], 'original',
    'Acquired NAVI SVG exact fills #FDF135 and #000105; retain interior lettering, so do not alpha-mask its outer shield.'),
  spirit: common('SPIRIT', '#EDEDED', '#111111', '#FFFFFF', ['team spirit'], 'mask',
    'Acquired Spirit SVG is a black monochrome dragon; white/black display palette with an editorial light-gray bar.'),
  faze: common('FAZE', '#E43D30', '#170C0B', '#E43D30', ['faze clan'], 'mask',
    'Acquired FaZe SVG exact red fill #E43D30; dark secondary is editorial.'),
  astralis: common('ASTRALIS', '#E60000', '#180707', '#E60000', [], 'mask',
    'Acquired Astralis SVG exact red fill #E60000; dark secondary is editorial.'),
  sk: common('SK', '#DDE1E4', '#111111', '#FFFFFF', ['sk gaming'], 'mask',
    'Acquired 2022 SK mark is monochrome black; neutral white/black treatment, not a claim about earlier SK jersey colors.'),
  envy: common('ENVY', '#D5DDE1', '#111111', '#FFFFFF', ['envyus', 'team envy', 'team envyus'], 'mask',
    'Acquired Envy SVG is monochrome black; light-gray/black treatment derives from that mark, not an invented blue brand specification.'),
  mouz: common('MOUZ', '#FF0000', '#180808', '#FF0000', ['mousesports'], 'mask',
    'Acquired transparent MOUZ PNG has exact opaque red pixels #FF0000; full horizontal lockup preserved.'),
  cloud9: common('CLOUD9', '#00AAEC', '#0076D0', '#00AAEC', ['cloud 9'], 'mask',
    'Acquired Cloud9 SVG gradient uses exact #00AAEC and #0076D0.'),
  gambit: common('GAMBIT', '#FE0200', '#160707', '#FE0200', ['gambit gaming', 'gambit esports'], 'mask',
    'Acquired Gambit SVG exact red fill #FE0200; dark secondary is editorial.'),
  dignitas: common('DIGNITAS', '#D9A700', '#4C626D', '#F1C735', ['team dignitas'], 'typography',
    'Legacy licensed alien mark has gold eyes and a dominant exact slate #4C626D; gold approximates its gradient. Opaque white JPEG omitted from bars.'),
  titan: common('TITAN', '#C5CDD3', '#101419', '#FFFFFF', [], 'mask',
    'Acquired Titan PNG is black with verified alpha; monochrome display palette, not an asserted historic blue brand hex.'),
  g2: common('G2', '#ED2025', '#0F0F0F', '#FFFFFF', ['g2 esports'], 'original',
    'Exact red #ED2025 appears in the official mark and brand page; black/white are its other source colors.',
    'https://g2esports.com/pages/brand-guidelines'),
  fnatic: common('FNATIC', '#FF5900', '#000000', '#FF5900', [], 'original',
    'Fnatic Brand Resources 2020 page 4 explicitly specifies primary orange #FF5900, black and white. Preserve downloaded white mark.',
    'https://fnatic.com/brand'),
  liquid: common('LIQUID', '#001538', '#000F29', '#EEEEEE', ['team liquid'], 'original',
    'Official crest-on-dark SVG exact navy #001538 and off-white #EEEEEE; #000F29 occurs in official brand resource page.',
    'https://teamliquid.com/brand-kit'),
  nip: common('NIP', '#D8FF00', '#000000', '#D8FF00', ['ninjas in pyjamas'], 'original',
    'Official external style guide page 7 specifies neon yellow #D8FF00 and black; downloaded white symbol remains white on dark with one-third clear space.',
    'https://nip.gl/pages/brand'),
  'virtus.pro': common('VIRTUS.PRO', '#F68920', '#171311', '#FFB000', ['virtus pro', 'vp'], 'original',
    'Orange/gold approximations of the official original bear/V mark; secondary uses its dark outline. These hexes are UI choices, not published VP color codes.',
    'https://virtus.pro/'),
  ldlc: common('LDLC', '#0097C9', '#312B7B', '#0097C9', ['team ldlc', 'ldlc.com', 'ldlc ol'], 'mask',
    'Exact cyan #0097C9 and indigo #312B7B in acquired transparent LDLC source PNG.'),
  'london conspiracy': common('LONDON CONSPIRACY', '#895199', '#271A35', '#AC72BE', [], 'original',
    'Dominant purple #895199 in acquired transparent source PNG; dark secondary is editorial.'),
  mtw: common('MTW', '#DB3210', '#1B100D', '#FFFFFF', [], 'mask',
    'Red #DB3210 and white in acquired transparent mTw wordmark; dark secondary is editorial.'),
  complexity: common('COMPLEXITY', '#DB1F2C', '#181717', '#D0D2D2', ['complexity gaming', 'col'], 'original',
    'Exact red #DB1F2C, gray #D0D2D2 and dark #181717 in acquired legacy Complexity mark.'),
  flipsid3: common('FLIPSID3', '#8EFE33', '#232323', '#5BD920', ['flipside', 'flipsid3 tactics', 'flipside tactics'], 'original',
    'Exact bright green #8EFE33, green #5BD920 and charcoal #232323 in acquired transparent source PNG.'),
  mibr: common('MIBR', '#B6C2CC', '#101820', '#FFFFFF', ['made in brazil'], 'mask',
    'Acquired transparent wordmark is #101820; pale slate display tone is editorial, not an official brand hex.'),
  ghost: common('GHOST', '#DADADA', '#000000', '#FFFFFF', ['ghost gaming'], 'original',
    'Source PNG is a white glyph on black; screen blending removes black visually without modifying source bytes.'),
  optic: common('OPTIC', '#9DC83E', '#040707', '#9DC83E', ['optic gaming'], 'mask',
    'Exact green #9DC83E and near-black #040707 in acquired transparent source PNG.'),
  tsm: common('TSM', '#D9D9D9', '#000000', '#FFFFFF', ['team solomid', 'team solo mid'], 'mask',
    'Source SVG is monochrome black; pale gray is an editorial monochrome display tone.'),
  hellraisers: common('HELLRAISERS', '#DB2C27', '#1B0A09', '#DB2C27', ['hell raisers'], 'mask',
    'Exact red #DB2C27 in acquired transparent source PNG; dark secondary is editorial.'),
  immortals: common('IMMORTALS', '#03B1A9', '#05211F', '#03B1A9', [], 'mask',
    'Exact turquoise #03B1A9 in acquired source SVG; dark secondary is editorial.'),
  nrg: common('NRG', '#DBDBDB', '#111111', '#FFFFFF', ['nrg esports'], 'mask',
    'Acquired source SVG is monochrome; pale gray/black display tones are editorial.'),
  '100 thieves': common('100 THIEVES', '#EA3031', '#1D0A0A', '#EA3031', ['100thieves'], 'mask',
    'Exact red #EA3031 in acquired source SVG; dark secondary is editorial.'),
  '9z': common('9Z', '#D9D9D9', '#111111', '#FFFFFF', ['9z team'], 'mask',
    'Acquired source SVG is black; this monochrome palette makes no unsupported claim about a historic purple brand hex.'),
  imperial: common('IMPERIAL', '#0CD664', '#062B17', '#0CD664', ['imperial esports'], 'mask',
    'Exact green #0CD664 in acquired transparent source PNG; dark secondary is editorial.'),
  betboom: common('BETBOOM', '#FF0025', '#21070B', '#F8E800', ['betboom team', 'betboom team cs2'], 'original',
    'Exact red #FF0025 and yellow #F8E800 in acquired transparent organization wordmark.'),
  endpoint: common('ENDPOINT', '#7386A8', '#1C263B', '#FFFFFF', ['endpoint esports'], 'typography',
    'Exact navy #1C263B from opaque white-backed source PNG; light blue-gray is editorial. Boxed source remains in credits.'),
  clg: common('CLG', '#00B5E2', '#152530', '#FFFFFF', ['counter logic gaming'], 'original',
    'Exact cyan #00B5E2, white and gray #666666 in acquired source SVG; dark secondary is editorial.'),
  heroic: common('HEROIC', '#FF0000', '#101010', '#FFFFFF', [], 'original',
    'Exact red #FF0000, black and white in acquired transparent 2023 mark; retain interior colored shapes.'),
  'gen.g': common('GEN.G', '#AA8B30', '#201A09', '#AA8B30', ['geng', 'gen.g esports'], 'mask',
    'Exact gold #AA8B30 in acquired source SVG; dark secondary is editorial.'),
  pain: common('PAIN', '#EF2940', '#20090C', '#EF2940', ['pain gaming'], 'mask',
    'Exact red #EF2940 in acquired source SVG; dark secondary is editorial.'),
  big: common('BIG', '#D8D8DD', '#0F0C1D', '#FFFFFF', ['big clan', 'berlin international gaming'], 'original',
    'Licensed source is a white paw on dark navy #0F0C1D. Screen blending suppresses the dark photographic background; no source-byte modification.'),
  eclot: common('ECLOT', '#E73939', '#230909', '#FFFFFF', ['dynamo eclot', 'eclot gaming'], 'typography',
    'Exact dominant red #E73939 in opaque source PNG; dark secondary is editorial. White-backed artwork remains in credits.'),
  'bad news eagles': common('BAD NEWS EAGLES', '#E80F2D', '#21070C', '#E80F2D', [], 'mask',
    'Exact red #E80F2D in acquired transparent source PNG; dark secondary is editorial.'),
  'funplus phoenix': common('FPX', '#FA0F00', '#210602', '#FA0F00', ['fpx'], 'mask',
    'Exact red #FA0F00 in acquired transparent source PNG; dark secondary is editorial.'),
  invictus: common('INVICTUS', '#DADADA', '#000000', '#FFFFFF', ['invictus gaming', 'ig'], 'mask',
    'Acquired transparent source mark is black; pale gray is an editorial monochrome display tone.'),
  giants: common('GIANTS', '#DADADA', '#000000', '#FFFFFF', ['giants gaming'], 'mask',
    'Acquired transparent source mark is black; pale gray is an editorial monochrome display tone.'),
  sinners: common('SINNERS', '#DADADA', '#111111', '#FFFFFF', ['sinners esports', 'sinners academy'], 'original',
    'Official press-kit white symbol on transparent background; neutral white/black display palette preserves source colors.',
    'https://www.sinners.gg/en/presskit'),
  vitality: common('VITALITY', '#F7DC00', '#111111', '#F7DC00', ['team vitality'], 'typography',
    'Official 2027 jersey announcement identifies yellow and black as club colors; yellow hex is an editorial approximation. No licensed logo acquired.',
    'https://vitality.gg/en/blogs/presse/team-vitality-et-son-equipementier-fulllife-revelent-le-nouveau-maillot-pro-2027'),
  falcons: common('FALCONS', '#2E8B57', '#0C2116', '#68B585', ['team falcons'], 'typography',
    'Official Falcons store identifies green, black and silver logo pins. Green hex and darker shades are editorial approximations. No licensed logo acquired.',
    'https://store.falcons.sa/en/category/zAdeVP'),
  furia: common('FURIA', '#B7B7B7', '#101010', '#FFFFFF', ['furia esports'], 'typography',
    'Monochrome editorial treatment consistent with official black apparel; no certified brand hex or licensed logo asserted.',
    'https://shop.furia.gg/products/jaqueta-furia-fc-preta')
});

const aliases = new Map();
for (const [key, brand] of Object.entries(TEAM_BRANDS)) {
  for (const alias of [key, brand.label, ...brand.aliases]) aliases.set(normalize(alias), key);
}

/** Pass the already resolved config/media.json team record as mediaRecord.
 * logo.path remains relative to the app; use the app's existing mediaPath helper.
 * No acquired asset means typography even when the palette is known.
 */
export function getTeamBrand(teamName, mediaRecord = null) {
  const key = aliases.get(normalize(teamName)) || aliases.get(normalize(mediaRecord?.name));
  const known = Boolean(key);
  const brand = known ? TEAM_BRANDS[key] : common(
    String(teamName || 'Team unavailable').toUpperCase(), '#71808A', '#222B32', '#AAB4BB', [], 'typography',
    'Unknown organization palette; neutral slate fallback, never generated from a player identifier.'
  );
  const path = mediaRecord?.path || mediaRecord?.src || null;
  const protectedMark = Boolean(mediaRecord?.unaltered_display);
  // No inferred transparency or inferred permission for unknown assets.
  const mode = !path ? 'typography' : protectedMark ? 'original' : brand.mode;
  const clearSpace = protectedMark ? Math.max(Number(mediaRecord.clear_space_fraction) || 0.25, 0.25) : 0;
  return {
    ...brand, key: key || normalize(teamName) || 'unknown', known,
    source_url: brand.source_url || mediaRecord?.source_url || null,
    logo: {
      mode, path: mode === 'typography' ? null : path,
      available: Boolean(path), unaltered: protectedMark,
      clear_space_fraction: clearSpace,
      preserve_aspect_ratio: true,
      fit: 'contain',
      mask_type: mode === 'mask' ? 'alpha' : null,
      blend_mode: !protectedMark && ['big', 'ghost'].includes(key) ? 'screen' : null,
      opacity: mode === 'original' ? 1 : 0.24,
      text: brand.label,
      reason: !path ? 'No licensed logo acquired; text fallback.' : mode === 'typography'
        ? 'Opaque boxed source mark omitted from bar; original remains in Media credits.'
        : protectedMark ? 'Official original must remain full color, full opacity and unmodified.'
        : mode === 'mask' ? 'Licensed transparent mark rendered as CSS alpha-mask watermark.'
        : 'Original mark retained to preserve its interior colored detail.'
    }
  };
}
