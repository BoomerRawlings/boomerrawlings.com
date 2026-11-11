const packages = [
  ['PHIL-010', '13043', '166528'],
  ['PSYC-106', '5379', '164082'],
  ['PSYC-110', '5417', '164087'],
  ['PSYC-111A', '5441', '164089'],
  ['PSYC-125', '5647', '164113'],
  ['ECON-100A', '14499', '167237'],
  ['ECON-100A', '14499', '167238'],
  ['ECON-100A', '14499', '167239'],
  ['ECON-100A', '14499', '167240'],
  ['ECON-120A', '14794', '167365'],
  ['ECON-120A', '14794', '167366'],
  ['ECON-120A', '14794', '167367'],
  ['ECON-120A', '14794', '167368'],
  ['ECON-120A', '14794', '167369'],
  ['ECON-120A', '14794', '167370'],
  ['ECON-120A', '14794', '167371'],
  ['ECON-120A', '14794', '167372'],
  ['MGT-162', '6359', '164325'],
  ['MGT-162', '6359', '164326'],
  ['MGT-162', '6359', '164327'],
];

// Exact observed Winter 2027 packages. Never derive a route from user input.
export const BOOKING_ROUTES = new Map(packages.map(([courseCode, moduleId, packageId]) => [
  `https://tss.ucsd.edu/fiori#ZUSModule-display?TileType=MYMOD&/Detail/EventPackage/SM/${moduleId}/00000000/0/0/0/00000000-0000-0000-0000-000000000000/${packageId}/2026/3/?`,
  Object.freeze({ courseCode, moduleId, packageId }),
]));

export const DEFAULT_ROUTE = BOOKING_ROUTES.keys().next().value;

// Release gate, separate from catalog identity. Populate only after a live
// exact-package comparison proves equivalent=true and nativeBookingPath=standard.
// Discovery and browser comparison results never modify this server-owned set.
export const VERIFIED_STANDARD_ROUTES = new Set([]);

