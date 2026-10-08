import type { CommunityQuestion } from './community'

// PROTOTYPE DATA — the /community preview renders this client-side until the
// real questions/answers tables exist. Never ship this to production pages.
export const MOCK_VIEWER = { id: 'u-alex', displayName: 'Alex T.' }

export const MOCK_QUESTIONS: CommunityQuestion[] = [
  {
    slug: 'convert-driving-license-shanghai',
    title: 'Can I convert my home driving license in Shanghai, or do I have to retake the test?',
    body: [
      'I have a valid UAE driving license and 4 years of driving behind me. Someone told me China does not accept foreign licenses at all and I would have to do the whole driving school thing from zero, which sounds brutal.',
      'Has anyone actually converted a license in Shanghai? What did it involve and how long did it take?',
    ],
    category: 'driving',
    city: 'Shanghai',
    university: { name: 'Fudan University', slug: 'fudan-university' },
    author: { id: 'u-omar', displayName: 'Omar H.' },
    upvotes: 12,
    ago: '2d ago',
    postedHoursAgo: 50,
    acceptedAnswerId: 'a-drive-1',
    answers: [
      {
        id: 'a-drive-1',
        author: { id: 'u-priya', displayName: 'Priya K.' },
        body: [
          'You can convert it, no driving school needed. Take your license, passport, residence permit and a certified Chinese translation of your license to the vehicle management office (车管所).',
          'You sit the Subject 1 theory exam, 100 questions, need 90 to pass. There are English question banks in apps like Laowai Drive Test. I did mine at the office on Huaxia Road in Pudong, cost about 80 RMB plus the translation. Two visits total.',
        ],
        upvotes: 9,
        ago: '1d ago',
      },
      {
        id: 'a-drive-2',
        author: { id: 'u-diego', displayName: 'Diego M.' },
        body: [
          'Small heads up: the translation has to come from an approved agency, they will not take a Google Translate printout. Ask the office for their list first, or use the translation desk inside the 车管所 itself, some locations have one.',
        ],
        upvotes: 4,
        ago: '22h ago',
      },
      {
        id: 'a-drive-3',
        author: { id: 'u-amara', displayName: 'Amara O.' },
        body: [
          'Did the same in Beijing. The theory test was the only real hurdle, study the question bank for a week and you will be fine.',
        ],
        upvotes: 1,
        ago: '18h ago',
      },
    ],
  },
  {
    slug: 'bank-account-before-residence-permit',
    title: 'Which bank will actually let me open an account before my residence permit arrives?',
    body: [
      'Just landed in Shanghai. My passport has the X1 entry visa but the residence permit is still processing, which I hear takes about a month. I need a bank account now for Alipay and to receive my stipend.',
      'Which banks accept just the entry visa plus admission documents?',
    ],
    category: 'money',
    city: 'Shanghai',
    author: { id: 'u-fatima', displayName: 'Fatima S.' },
    upvotes: 9,
    ago: '3d ago',
    postedHoursAgo: 74,
    acceptedAnswerId: 'a-bank-1',
    answers: [
      {
        id: 'a-bank-1',
        author: { id: 'u-rahul', displayName: 'Rahul D.' },
        body: [
          'Bank of China did it for me with just passport, admission letter and the JW202. Not every branch knows the process, so go to a bigger branch near a university campus, they deal with students all the time.',
          'The card worked with Alipay the same day.',
        ],
        upvotes: 8,
        ago: '2d ago',
      },
      {
        id: 'a-bank-2',
        author: { id: 'u-tom', displayName: 'Tom N.' },
        body: [
          'ICBC refused me twice without the residence permit, Bank of China said yes on the first try. Your mileage may vary by branch but BOC is your best bet.',
        ],
        upvotes: 3,
        ago: '2d ago',
      },
      {
        id: 'a-bank-3',
        author: { id: 'u-chen', displayName: 'Chen R.' },
        body: [
          'Bring a phone number registered under your own passport too, they checked that the number belongs to me.',
        ],
        upvotes: 1,
        ago: '1d ago',
      },
    ],
  },
  {
    slug: 'jw202-six-weeks-late',
    title: 'JW202 still not here 6 weeks after admission, normal or should I chase it?',
    body: [
      'Got my admission notice in mid August and the university said the JW202 would follow in two to three weeks. It has been six. Replies from the admissions office are slow and vague.',
      'Is this just how it goes, or is something wrong?',
    ],
    category: 'visas',
    author: { id: 'u-youssef', displayName: 'Youssef B.' },
    upvotes: 8,
    ago: '5h ago',
    postedHoursAgo: 5,
    acceptedAnswerId: null,
    relatedGuide: {
      title: 'JW201, JW202 and the student visa, explained',
      slug: 'jw202-visa-forms',
    },
    answers: [],
  },
  {
    slug: 'overstayed-three-days',
    title: 'Overstayed 3 days by accident, how bad is this really?',
    body: [
      'I misread the entry stamp and thought my stay was valid until the 30th. It was the 27th. I leave in 4 days.',
      'I am honestly panicking a bit. What happens at the airport, is this a fine, a record, or worse? Please only answer if you actually know.',
    ],
    category: 'visas',
    author: null,
    upvotes: 15,
    ago: '1d ago',
    postedHoursAgo: 30,
    acceptedAnswerId: null,
    answers: [
      {
        id: 'a-over-1',
        author: { id: 'u-ming', displayName: 'Ming Z.' },
        body: [
          'Go to the local exit-entry bureau before your flight, not the airport. For a short overstay it is usually a warning or a fine, up to 500 RMB per day.',
          'Three days is minor and officers see this all the time. Self-reporting looks far better than getting caught at the gate. It goes on record but it is not the end of your visa history.',
        ],
        upvotes: 11,
        ago: '22h ago',
      },
      {
        id: 'a-over-2',
        author: null,
        body: [
          'Same thing happened to me, 2 days over. Paid 1000 RMB at the exit-entry office in Chengdu, got a stamp, flew out fine. Do not wait for the airport to sort it, that is where it can actually escalate.',
        ],
        upvotes: 6,
        ago: '15h ago',
      },
    ],
  },
  {
    slug: 'gym-no-chinese-id-wudaokou',
    title: 'Cheap gyms near Wudaokou that do not require a Chinese ID?',
    body: [
      'Every gym app I try wants a 身份证号 I obviously do not have. Are there any gyms around Wudaokou or the uni area where a passport works, ideally without a crazy foreigner markup?',
    ],
    category: 'life',
    city: 'Beijing',
    university: { name: 'Tsinghua University', slug: 'tsinghua-university' },
    author: { id: 'u-jonas', displayName: 'Jonas P.' },
    upvotes: 6,
    ago: '4d ago',
    postedHoursAgo: 90,
    acceptedAnswerId: 'a-gym-1',
    answers: [
      {
        id: 'a-gym-1',
        author: { id: 'u-sara', displayName: 'Sara W.' },
        body: [
          "Tsinghua's own gym takes your student card, about 15 RMB a visit. For outside gyms, Le Fit (乐刻) branches take passports at the door. Their app needs a Chinese number but not an ID, and it is pay per month with no contract.",
        ],
        upvotes: 5,
        ago: '3d ago',
      },
      {
        id: 'a-gym-2',
        author: { id: 'u-kim', displayName: 'Kim J.' },
        body: [
          'Supermonkey studios let you book through the WeChat mini program with just a phone number. Not cheap per class but zero commitment.',
        ],
        upvotes: 3,
        ago: '3d ago',
      },
      {
        id: 'a-gym-3',
        author: { id: 'u-dmitri', displayName: 'Dmitri V.' },
        body: [
          'Avoid the annual-card sales-pitch places. They will happily take your passport, then vanish with your money. Seen it happen twice.',
        ],
        upvotes: 1,
        ago: '2d ago',
      },
    ],
  },
  {
    slug: 'csc-stipend-late',
    title: 'CSC stipend is 3 weeks late, who do I even contact?',
    body: [
      "The university keeps saying 'it is processing' but rent is due and three of us in my dorm have the same issue.",
      'Is there an actual office or email that handles stipend delays, or do we just wait it out?',
    ],
    category: 'money',
    author: { id: 'u-amara', displayName: 'Amara O.' },
    upvotes: 14,
    ago: '8h ago',
    postedHoursAgo: 8,
    acceptedAnswerId: null,
    answers: [],
  },
  {
    slug: 'police-registration-moving-apartments',
    title: 'How does the 24h police registration work when you move apartments?',
    body: [
      'Moving from the campus dorm to an apartment off campus next week. I know I have to register the new address with the police but nobody explained the actual process.',
      'What do I bring, where do I go, and does the landlord need to come with me?',
    ],
    category: 'housing',
    city: 'Hangzhou',
    author: { id: 'u-luca', displayName: 'Luca B.' },
    upvotes: 4,
    ago: '2d ago',
    postedHoursAgo: 44,
    acceptedAnswerId: 'a-reg-1',
    answers: [
      {
        id: 'a-reg-1',
        author: { id: 'u-wei', displayName: 'Wei C.' },
        body: [
          'You go to the police station (派出所) that covers your new address, within 24 hours of moving in. Bring your passport, the lease, and copies of the landlord’s ID and property certificate.',
          'Most landlords know the drill and will hand over copies, some even come with you. You get a temporary registration form. Keep it safe, you will need it for every visa thing after.',
        ],
        upvotes: 4,
        ago: '1d ago',
      },
      {
        id: 'a-reg-2',
        author: { id: 'u-nina', displayName: 'Nina F.' },
        body: [
          'Some cities let you do it online through the local police WeChat account now. Ask your landlord first, mine did the whole thing on his phone in five minutes.',
        ],
        upvotes: 2,
        ago: '1d ago',
      },
    ],
  },
  {
    slug: 'campus-clinic-free',
    title: 'Is the campus clinic actually free for international students?',
    body: [
      'I have the Ping An insurance the university signed us all up for. The campus clinic keeps asking me to pay small fees up front and I have no idea if I should be paying or claiming it back later.',
      'How does it work at your uni?',
    ],
    category: 'health',
    author: { id: 'u-alex', displayName: 'Alex T.' },
    upvotes: 3,
    ago: '1d ago',
    postedHoursAgo: 26,
    acceptedAnswerId: null,
    mine: true,
    answers: [
      {
        id: 'a-clinic-1',
        author: { id: 'u-priya', displayName: 'Priya K.' },
        body: [
          'Pay up front at the campus clinic, then claim it back on the Ping An app with the fapiao and the diagnosis slip. Keep every receipt, the app wants photos of everything. Reimbursement took about two weeks for me.',
        ],
        upvotes: 2,
        ago: '20h ago',
      },
      {
        id: 'a-clinic-2',
        author: { id: 'u-tom', displayName: 'Tom N.' },
        body: [
          'Depends which insurance you got. Ours only covers visits over 400 RMB, so the clinic ends up out of pocket anyway. Check your policy booklet for the deductible.',
        ],
        upvotes: 1,
        ago: '10h ago',
      },
    ],
  },
]
