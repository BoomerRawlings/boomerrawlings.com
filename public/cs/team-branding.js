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
