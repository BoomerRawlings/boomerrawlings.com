// Transcribed from the two supplied 2026–2027 sheets, not a reconciled live directory.
export const councilChairs = [
  ['Allie Jordan', 'Library', 'ajordan@swccd.edu'],
  ['Art Guaracha', 'Counseling & Student Support Programs', 'aguaracha2@swccd.edu'],
  ['Carolina Soto (WESA)', 'Exercise Science & Athletics', 'csoto2@swccd.edu'],
  ['Chris Hayashi', 'Behavioral Sciences', 'chayashi@swccd.edu'],
  ['Courtney Bussell', 'ESL', 'cbussell@swccd.edu'],
  ['Cynthia McGregor', 'Performing Arts', 'cmcgregor@swccd.edu'],
  ['Diane Palmer', 'Humanities', 'dpalmer@swccd.edu'],
  ['Donald Gould', 'Arts, Communication, Design & Media', 'dgould@swccd.edu'],
  ['Elisabeth Shapiro', 'Accounting & Business', 'eshapiro@swccd.edu'],
  ['Grant Miller', 'Physical Sciences (excluding Chemistry)', 'gmiller@swccd.edu'],
  ["Jamie O'Connor Florez", 'Nursing (HEC at Otay Mesa)', 'jflorez@swccd.edu'],
  ['Jessica Posey', 'Languages & Literature', 'jposey@swccd.edu'],
  ['Jonathan Feliciano', 'Public Safety (HEC at Otay Mesa)', 'jfeliciano@swccd.edu'],
  ['Kimberly Puen Elcar', 'Mathematics', 'keclar@swccd.edu'],
  ['Laura Gershuni', 'Applied Technology', 'lgershuni@swccd.edu'],
  ['Maria Constein', 'Disability Support Services', 'mconstein@swccd.edu'],
  ['Mark-Kell Law', 'Communication', 'mlaw@swccd.edu'],
  ['Michael Speyrer', 'Criminal Justice, Political Science & Public Administration', 'mspeyrer@swccd.edu'],
  ['Randy Beach (interim)', 'Non-credit', 'rbeach@swccd.edu'],
  ['Shaunte Griffith-Jackson', 'Life Science', 'sgriffith@swccd.edu'],
  ['Surian Figueroa', 'World Languages', 'sfigueroa2@swccd.edu'],
  ['Sylvia Garcia-Navarrete', 'Reading', 'sgarcia@swccd.edu'],
  ['Tinh-Alfredo Khuong*', 'Physical Science (Chemistry)', 'tkhuong@swccd.edu'],
  ['Tom Luibel', 'Computer Information Systems, Computer Literature, & Electronics', 'tluibel@swccd.edu'],
  ['Toni Pfister', 'Wellness (Health)', 'tpfister@swccd.edu'],
  ['Victor Chavez', 'History and Ethnic Studies', 'vchavez@swccd.edu'],
] as const;

type DepartmentChairGroup = {
  name: string;
  area: 'Instructional areas' | 'Non-instructional areas';
  dean: string;
  listedNames: string;
  director?: string;
  rows: [department: string, chair: string, email: string, extension: string, note?: string][];
};

export const departmentChairGroups: DepartmentChairGroup[] = [
  {
    name: 'School of Arts, Communication, Design, & Media', area: 'Instructional areas',
    dean: 'Donald Carlson', listedNames: 'Eileen Zwierski & Marisa Curiel',
    rows: [
      ['Visual Arts and Design (VAD)', 'Donald Gould', 'dgould@swccd.edu', '5589'],
      ['Performing Arts (PA)', 'Cynthia McGregor', 'cmcgregor@swccd.edu', '5613'],
      ['Communication (COM)', 'Mar-Kell Law', 'mlaw@swccd.edu', '5484'],
    ],
  },
  {
    name: 'School of Applied Technology & Hospitality Management', area: 'Instructional areas',
    dean: 'Jennifer Lewis', listedNames: 'Jennifer Trinidad',
    rows: [['Applied Technology (ATECH)', 'Laura Gershuni', 'lgershuni@swccd.edu', '5711']],
  },
  {
    name: 'School of Business', area: 'Instructional areas',
    dean: 'Mink Stavenga', listedNames: 'Abner Luna',
    rows: [
      ['Business Admin and Accounting (BA)', 'Elisabeth Shapiro', 'eshapiro@swccd.edu', '5944'],
      ['CIS, Computer Literature, & Electronics (CIE)', 'Tom Luibel', 'tluibel@swccd.edu', '5712'],
    ],
  },
  {
    name: 'School of Education, Humanities, Social & Behavioral Sciences', area: 'Instructional areas',
    dean: 'Joachim Latzer', listedNames: 'Leah Garcia-Carey',
    rows: [
      ['Behavioral Sciences (BSC)', 'Chris Hayashi', 'chayashi@swccd.edu', '5683'],
      ['Child, Family and Education Studies (CES)', 'Leslynn Gallo (retired)', 'lgallo@swccd.edu', '5726'],
      ['Criminal Justice, Poli Sci & Public Admin (CJPS)', 'Michael Speyrer', 'mspeyrer@swccd.edu', '5694'],
      ['History and Ethnic Studies (HES)', 'Victor Chavez', 'vchavez@swccd.edu', '5438'],
      ['Philosophy and Humanities (PH)', 'Diane Palmer', 'pbolland@swccd.edu', '5586', 'Email as printed; differs from the Council of Chairs sheet.'],
    ],
  },
  {
    name: 'School of Languages & Literature', area: 'Instructional areas',
    dean: 'Antonio Alarcon', listedNames: 'Ninfa Hernandez',
    rows: [
      ['English (ENGL)', 'John Rieder', 'jrieder@swccd.edu', '5558', 'Handwritten note: “Posey”.'],
      ['ESL (ESL)', 'Courtney Leckey Bussell', 'cbussell@swccd.edu', '5822'],
      ['World Languages (FL)', 'Surian Figueroa', 'sfigueroa@swccd.edu', '5511'],
      ['Reading (RDG)', 'Sylvia Garcia-Navarrete', 'sgarcia@swccd.edu', '5923'],
    ],
  },
  {
    name: 'School of Mathematics, Science & Engineering', area: 'Instructional areas',
    dean: 'Silvia Nadalet', listedNames: 'Maria Martinez-Lozano',
    rows: [
      ['Life Sciences – Biology (LIF)', 'Andrea Schnitz', 'aschnitz@swccd.edu', '5528', 'Interim FY 26–27. S. Griffith-Jackson on sabbatical.'],
      ['Mathematics (MAEN)', 'Kimberly Eclar', 'keclar@swccd.edu', '5954'],
      ['Physical Sciences (Astr, Engr, Geog, Geol) (PSD)', 'Grant Miller', 'gmiller@swccd.edu', '5535'],
      ['Chemistry (PSD)', 'Tinh-Alfredo Khuong*', 'tkhuong@swccd.edu', '5731'],
    ],
  },
  {
    name: 'School of Wellness, Exercise Science & Athletics', area: 'Instructional areas',
    dean: 'Tom Gang', listedNames: 'Vilma Ortega',
    rows: [
      ['Wellness-Health (HEA)', 'Toni Pfister', 'tpfister@swccd.edu', '5662'],
      ['Exercise Science & Athletics (PHED)', 'Carolina Soto', 'csoto2@swccd.edu', '5353'],
    ],
  },
  {
    name: 'Higher Education Center at Otay Mesa', area: 'Instructional areas',
    dean: 'Kenya Johnson', listedNames: 'Stephanie Gonzaga',
    rows: [
      ['Nursing', "Jamie O'Connor-Florez", 'jflorez@swccd.edu', '4476'],
      ['Public Safety', 'Jonathan Feliciano', 'jfeliciano@swccd.edu', '4444'],
    ],
  },
  {
    name: 'Instructional Support Services', area: 'Non-instructional areas',
    dean: 'Mia McClellan', listedNames: 'Norma Lloyd',
    rows: [['Library', 'Allie Jordan', 'ajordan@swccd.edu', '5858']],
  },
  {
    name: 'School of Counseling & Student Support Programs', area: 'Non-instructional areas',
    dean: 'Steven Baissa', listedNames: 'Irene Castañeda',
    rows: [['Counseling & Personal Development', 'Art Guaracha', 'aguaracha@swccd.edu', '6552']],
  },
  {
    name: 'Student Engagement & Completion', area: 'Non-instructional areas',
    dean: 'Ronnie Hands', listedNames: 'Sonia Galaviz',
    rows: [['Disability Support Services', 'Maria Constein', 'mconstein@swccd.edu', '5218']],
  },
  {
    name: 'Continuing Education', area: 'Non-instructional areas',
    dean: 'Kenya Johnson', listedNames: 'Stephanie Gonzaga',
    director: 'Director: Crystal Robinson. Also listed: Carmen Ibarra & Yesenia Marquez.',
    rows: [['Non-Credit (NC)', 'Randy Beach-Interim', 'rbeach@swccd.edu', '5545']],
  },
];
