import courseOptions from './roomie-course-options.json';

export type SelectedBookingCourse = {
  kind: 'selected';
  code: string;
  category: string;
  categoryStyle: string;
  title: string;
  sections: string[];
  bookingUrl: string;
};

export type CourseMeeting = {
  kind: string;
  day: string | null;
  date: string | null;
  startTime: string | null;
  endTime: string | null;
  location: string | null;
  startDate: string | null;
  endDate: string | null;
};

export type CourseSection = {
  id: string;
  code: string;
  type: string;
  instructors: string[];
  meetings: CourseMeeting[];
  seatsAvailable: number | null;
};

export type CourseOption = {
  packageId: string;
  label: string;
  bookingUrl: string | null;
  sections: CourseSection[];
};

export type CatalogCourse = {
  kind: 'options';
  code: string;
  title: string;
  category: string;
  categoryStyle: string;
  sectionCount: number;
  options: CourseOption[];
  unassignedSections: CourseSection[];
  courseUrl: string | null;
};

export type BookingCourse = SelectedBookingCourse | CatalogCourse;

export type Roomie = {
  room: number;
  name: string;
  major: string | null;
  courseCodes: string[];
  courses: BookingCourse[];
};

// These routes are scoped to Winter 2027. Package IDs come from the public
// Class Planner catalog; the saved TSS app confirms the Detail route structure.
// Opening a route loads TSS and does not submit a booking.
const winterBooking = (moduleId: string, packageId: string) =>
  `https://tss.ucsd.edu/fiori#ZUSModule-display?TileType=MYMOD&/Detail/EventPackage/SM/${moduleId}/00000000/0/0/0/00000000-0000-0000-0000-000000000000/${packageId}/2026/3/?`;

const boomerCourses: SelectedBookingCourse[] = [
  {
    kind: 'selected',
    code: 'PHIL-010',
    category: 'Philosophy',
    categoryStyle: 'philosophy',
    title: 'Introduction to Logic',
    sections: ['001-000-LE', '001-002-DI'],
    bookingUrl: winterBooking('13043', '166528'),
  },
  {
    kind: 'selected',
    code: 'PSYC-106',
    category: 'Psychology',
    categoryStyle: 'psychology',
    title: 'Behavioral Neuroscience',
    sections: ['001-000-LE'],
    bookingUrl: winterBooking('5379', '164082'),
  },
  {
    kind: 'selected',
    code: 'PSYC-110',
    category: 'Psychology',
    categoryStyle: 'psychology',
    title: 'Junior Honors Research Seminar',
    sections: ['001-000-LE'],
    bookingUrl: winterBooking('5417', '164087'),
  },
  {
    kind: 'selected',
    code: 'PSYC-111A',
    category: 'Psychology',
    categoryStyle: 'psychology',
    title: 'Research Methods I',
    sections: ['001-000-LE', '001-001-LA', '001-001-OT'],
    bookingUrl: winterBooking('5441', '164089'),
  },
  {
    kind: 'selected',
    code: 'PSYC-125',
    category: 'Psychology',
    categoryStyle: 'psychology',
    title: 'Clinical Neuropsychology',
    sections: ['001-000-LE'],
    bookingUrl: winterBooking('5647', '164113'),
  },
];

const catalog = courseOptions as unknown as {
  term: string;
  updatedAt: string;
  courses: Record<string, Omit<CatalogCourse, 'kind'>>;
};

export const catalogUpdatedAt = catalog.updatedAt;

// Add a roommate's requested codes here after refreshing the catalog data.
// Selected courses preserve exact choices; catalog courses expose every option.
const roomieProfiles = [
  { room: 1, name: 'Boomer Rawlings', major: 'Experimental Psychology', courseCodes: ['PHIL-010', 'PSYC-106', 'PSYC-110', 'PSYC-111A', 'PSYC-125'] },
  { room: 2, name: 'Edgar Villasenor', major: 'Electrical Engineering', courseCodes: [] },
  { room: 3, name: 'Jack Xiang', major: 'Computer Science', courseCodes: [] },
  { room: 4, name: 'Mikial Syed', major: 'Business Economics', courseCodes: ['ECON-100A', 'ECON-120A', 'MGT-162'] },
  { room: 5, name: 'Colin Lou', major: 'Computer Science', courseCodes: [] },
  { room: 6, name: 'Fayez Elayoubi', major: 'Biochemistry', courseCodes: [] },
  { room: 7, name: 'Rayhan Khera', major: 'Business Economics', courseCodes: [] },
  { room: 8, name: 'Fredgyg Rosales Escobar', major: 'Business Economics', courseCodes: [] },
];

export const roomies: Roomie[] = roomieProfiles.map(profile => ({
  ...profile,
  courses: profile.courseCodes.map(code => {
    const selected = profile.room === 1 && boomerCourses.find(course => course.code === code);
    if (selected) return selected;
    const course = catalog.courses[code];
    if (!course) throw new Error(`Missing catalog data for ${code}`);
    return { ...course, kind: 'options' as const };
  }),
}));
