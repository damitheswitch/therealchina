import { Autocomplete } from './Autocomplete'

// Common programs (geared toward international students in China).
// Purely suggestions — the user can always type anything else.
const COMMON_PROGRAMS = [
  'Accounting',
  'Actuarial Science',
  'Aerospace Engineering',
  'Agriculture',
  'Applied Mathematics',
  'Architecture',
  'Artificial Intelligence',
  'Automation',
  'Bioengineering',
  'Biology',
  'Biotechnology',
  'Business Administration',
  'Chemical Engineering',
  'Chemistry',
  'Chinese Language (Mandarin)',
  'Civil Engineering',
  'Clinical Medicine (MBBS)',
  'Communication',
  'Computer Engineering',
  'Computer Science',
  'Cybersecurity',
  'Data Science',
  'Dentistry',
  'Design',
  'Economics',
  'Education',
  'Electrical Engineering',
  'Electronics and Information Engineering',
  'Energy and Power Engineering',
  'Environmental Engineering',
  'Environmental Science',
  'Finance',
  'Food Science and Engineering',
  'History',
  'International Business',
  'International Economics and Trade',
  'International Relations',
  'Journalism',
  'Law',
  'Linguistics',
  'Materials Science',
  'Mathematics',
  'MBA',
  'Mechanical Engineering',
  'Music',
  'Nursing',
  'Pharmacy',
  'Philosophy',
  'Physics',
  'Political Science',
  'Psychology',
  'Public Administration',
  'Robotics',
  'Software Engineering',
  'Sociology',
  'Sports Science',
  'Statistics',
  'Supply Chain Management',
  'Teaching Chinese as a Foreign Language (TCSOL)',
  'Traditional Chinese Medicine',
  'Tourism Management',
  'Translation and Interpreting',
  'Urban Planning',
]

// Every word of the query must be the prefix of some word of the program name,
// so "comp" matches "Computer Science" and "computer en" matches "Computer Engineering".
const matchesQuery = (program, query) => {
  const queryWords = query
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
  if (!queryWords.length) return false
  const nameWords = program.toLowerCase().split(/\s+/)
  return queryWords.every((qw) => nameWords.some((nw) => nw.startsWith(qw)))
}

const loadPrograms = async (query) => {
  const q = query.trim().toLowerCase()
  const matches = COMMON_PROGRAMS.filter((p) => matchesQuery(p, query))

  return matches
    .sort((a, b) => {
      const aStarts = a.toLowerCase().startsWith(q) ? 0 : 1
      const bStarts = b.toLowerCase().startsWith(q) ? 0 : 1
      return aStarts - bStarts || a.localeCompare(b)
    })
    .map((p) => ({ value: p, label: p, key: p }))
}

export const ProgramAutocomplete = (props) => (
  <Autocomplete {...props} loadOptions={loadPrograms} />
)
