export const regionCopy = {
  all: {label:'All regions', note:'Browse the 42 selected universities. This is a selected comparison group, not a survey of every university in the country.'},
  West: {label:'West', note:'The western group includes the University of California campuses, San Diego State and other selected universities. Documented housing populations are available only for the California public universities in this release.'},
  Midwest: {label:'Midwest', note:'These schools are grouped by their home location in the Midwest. Several report additional campuses. Housing counts can be read here, but verified resident populations are unavailable for this group.'},
  Northeast: {label:'Northeast', note:'This group includes the Ivy League and other selected northeastern universities. Their reports can cover satellite locations, including overseas properties. Verified resident populations are unavailable for this group.'},
  South: {label:'South', note:'This group includes selected universities in the South and the District of Columbia. Some institutions report many separate locations. Verified resident populations are unavailable for this group.'},
};
export const topicCopy = {
  criminal_total:{label:'Listed offenses combined',text:'Adds the eleven criminal-offense categories listed in these reports. It excludes domestic violence, dating violence and stalking classifications, arrests and disciplinary referrals. It is not a count of distinct people or incidents.'},
  rape:{label:'Rape',text:'Reports classified as rape. A report count is not a count of convictions or necessarily a count of distinct victims. The reporting year can differ from the year an offense occurred.'},
  fondling:{label:'Fondling',text:'Reports classified as fondling, a sexual-offense category. Several offenses can be reported together, so a large count need not mean the same number of separate reports or people.'},
  incest:{label:'Incest',text:'Reports classified as incest. A zero means no offenses were recorded in this category and location in the source; it does not establish that none occurred.'},
  statutory_rape:{label:'Statutory rape',text:'Reports classified as statutory rape. This is a separate category in the reporting system; it is not included in the separate rape selection.'},
  murder:{label:'Murder / nonnegligent manslaughter',text:'Reports classified as murder or nonnegligent manslaughter. Small counts can make population-adjusted comparisons change sharply from year to year.'},
  negligent_manslaughter:{label:'Negligent manslaughter',text:'Reports classified as negligent manslaughter. This category is separate from murder and nonnegligent manslaughter.'},
  robbery:{label:'Robbery',text:'Reports classified as robbery. Read this separately from burglary and motor vehicle theft; the reporting system treats them as different offenses.'},
  aggravated_assault:{label:'Aggravated assault',text:'Reports classified as aggravated assault. The combined-offense view includes this category; it is not a measure of every form of assault or conflict.'},
  burglary:{label:'Burglary',text:'Reports classified as burglary. This is a specific reporting category, not a count of every theft. Different location choices cover different university properties.'},
  motor_vehicle_theft:{label:'Motor vehicle theft',text:'Reports classified as motor vehicle theft. Housing-only counts omit offenses recorded elsewhere on campus, so location matters especially when reading these figures.'},
  arson:{label:'Arson',text:'Reports classified as arson. The number counts reported offenses, not the number of people involved or the value of property damaged.'},
  domestic_violence:{label:'Domestic violence',text:'Domestic-violence classifications may overlap a criminal-offense category. Do not add them to the combined-offense count. Where a source combines domestic and dating violence, a separate figure is withheld.'},
  dating_violence:{label:'Dating violence',text:'Dating-violence classifications may overlap criminal offenses. Do not add them to the combined-offense count. Some sources combine dating and domestic violence; those separate figures remain unavailable.'},
  stalking:{label:'Stalking',text:'Stalking classifications may overlap other reported offenses. They are displayed separately and should not be added to the combined-offense count.'},
};
export const placeCopy = {
  housing:{label:'Student housing',text:'Reports in campus residential facilities. When a verified population exists, the rate uses documented fall housing occupancy. It does not estimate an individual resident’s chance of experiencing crime.'},
  campus:{label:'All on-campus areas',text:'Reports on campus, including student housing. The optional rate uses all enrolled students, including those living elsewhere. It answers a different question from the housing comparison.'},
  combined:{label:'All reporting areas',text:'Adds on-campus areas, qualifying off-campus properties and public property within or next to campus. Off-campus properties can include recognized student-organization houses. Housing is already included in on-campus reports. No matched population is available for this combined area, so only counts are shown.'},
};
export const periodCopy = {
  '2022':'Reports recorded for calendar year 2022. Some newer editions no longer include this year; missing counts are not filled from the archived federal data.',
  '2023':'Reports recorded for calendar year 2023. Newer report editions can revise these earlier figures; the current-source view uses the verified revisions.',
  '2024':'Reports recorded for calendar year 2024. This is the latest year with population data used in this study; count coverage still varies by school and category.',
  '2025':'Reports recorded for calendar year 2025, where a verified report supplies them. Same-year housing and enrollment populations have not been established, so no 2025 rates are shown.',
  pooled:'Combines 2022–2024 counts and divides by the sum of those three fall populations. This is a population-weighted annual comparison, not a three-year probability or a count of unique students.',
};
