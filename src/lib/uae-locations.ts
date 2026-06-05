export type LocationGroup = { label: string; districts: string[] };
export type EmirateData = {
  value: string;
  label: string;
  groups?: LocationGroup[]; // only Dubai has groups
  districts?: string[];     // flat list for other emirates
};

export const UAE_EMIRATES: EmirateData[] = [
  {
    value: 'AUH',
    label: 'Abu Dhabi',
    districts: [
      'Abu Dhabi City', 'Al Ain', 'Al Dhafra', 'Al Reem Island', 'Al Maryah Island',
      'Saadiyat Island', 'Yas Island', 'Al Raha Beach', 'Khalifa City A', 'Khalifa City B',
      'Khalifa City C', 'Mohammed Bin Zayed City', 'Al Reef', 'Al Ghadeer', 'Al Rahba',
      'Shahama', 'Mussafah', 'Baniyas', 'Al Wathba', 'Madinat Zayed', 'Habshan', 'Um Laylah',
      'Khalifa Port Free Trade Zone', 'Abu Dhabi Airport Free Zone',
      'Khalifa Industrial Zone (KIZAD)', 'Abu Dhabi Global Market (ADGM)',
      'Masdar City Free Zone', 'twofour54', 'Tawazun Industrial Park',
    ],
  },
  {
    value: 'DXB',
    label: 'Dubai',
    groups: [
      {
        label: 'Sector 1 — Deira & Old Town',
        districts: ['Al Mamzar', 'Port Saeed', 'Hor Al Anz', 'Other areas in Sector 1'],
      },
      {
        label: 'Sector 2 — Airport & Surrounding',
        districts: ['Mirdif', 'Al Qusais', 'Al Nahda', 'Al Garhoud', 'Other areas in Sector 2'],
      },
      {
        label: 'Sector 3 — Jumeirah & Western Core',
        districts: [
          'Palm Jumeirah', 'Jumeirah Lakes Towers (JLT)', 'Dubai Marina',
          'Jumeirah Beach Residence (JBR)', 'The Meadows', 'The Springs', 'The Greens',
          'Emirates Hills', 'Al Barsha', 'Al Quoz', 'Barsha Heights (TECOM)',
          'Other areas in Sector 3',
        ],
      },
      {
        label: 'Sector 4 — Jebel Ali & Southern',
        districts: [
          'Jebel Ali Industrial', 'Dubai Investments Park (DIP)', 'Al Warqaa',
          'Other areas in Sector 4',
        ],
      },
      {
        label: 'Core Business Districts',
        districts: [
          'Downtown Dubai', 'Business Bay', 'DIFC', 'Dubai Design District (D3)',
          'Dubai Internet City', 'Dubai Media City', 'Dubai Silicon Oasis',
          'Dubai Creek Harbour', 'Bluewaters Island',
        ],
      },
      {
        label: 'Emerging Residential Communities',
        districts: [
          'Arabian Ranches', 'Dubai Hills Estate', 'Jumeirah Village Circle (JVC)',
          'Jumeirah Village Triangle (JVT)', 'Damac Hills', 'Motor City', 'Dubai Sports City',
          'Town Square', 'Tilal Al Gharb', 'Serena', 'Remraam', 'IMPZ', 'Dubai South',
          'Jumeirah Golf Estates', 'Victory Heights', 'Al Furjan', 'Discovery Gardens',
          'International City', 'Culture Village', 'Meydan', 'MBR City', 'Al Barari', 'The Valley',
        ],
      },
      {
        label: 'Free Zones',
        districts: [
          'Jebel Ali Free Zone (JAFZA)', 'Dubai Airport Free Zone (DAFZA)',
          'Dubai Cars and Automotive Zone (DUCAMZ)', 'Dubai Textile City',
          'Free Zone Area in Al Quoz', 'Free Zone Area in Al Qusais',
          'Dubai Aviation City', 'DMCC (JLT)', 'Dubai CommerCity', 'Expo City Dubai',
        ],
      },
    ],
  },
  {
    value: 'SHJ',
    label: 'Sharjah',
    districts: [
      'Sharjah City', 'Al Nahda', 'Al Qasimia', 'Al Khan', 'Al Majaz', 'Al Mamzar',
      'Al Qasba', 'Al Rolla', 'Al Fisht', 'Al Heerah', 'Al Yarmouk', 'Al Butina',
      'Al Gulaya', 'Halwan', 'Abushagara', 'Industrial Areas 1-18', 'Dibba', 'Khor Fakkan',
      'Hamriyah Free Zone', 'Sharjah Airport International Free Zone (SAIF Zone)',
      'Sharjah Media City (Shams Free Zone)', 'Sharjah Publishing City Free Zone',
      'Sharjah Research, Technology and Innovation Park (SRTIP)', 'Sharjah Healthcare City',
    ],
  },
  {
    value: 'AJM',
    label: 'Ajman',
    districts: [
      'Ajman City Center', 'Al Jurf', 'Al Naimiya', 'Al Rawda', 'Al Zahra',
      'Industrial Area', 'Al Ameera Village', 'Al Bustan', 'Al Butain', 'Al Hamidiyah',
      'Al Humaid City', 'Al Nakhil', 'Al Owan', 'Al Rumailah', 'Corniche', 'Downtown',
      'Emirates City', 'Green City', 'Marina', 'Masfut', 'Musheirif', 'Muwayhat',
      'Rashidiya', 'Sawan', 'Tala', 'Uptown', 'Zawra', 'Ajman Free Zone',
    ],
  },
  {
    value: 'RAK',
    label: 'Ras Al Khaimah',
    districts: [
      'RAK City Center', 'Al Hamra Village', 'Al Marjan Island', 'Mina Al Arab',
      'Al Nakheel', 'Al Jazeera Al Hamra', 'RAK Industrial Area',
      'RAK Free Trade Zone', 'RAK Maritime City Free Zone', 'RAK Airport Free Zone',
      'Ras Al Khaimah Economic Zones (RAKEZ)',
    ],
  },
  {
    value: 'FUJ',
    label: 'Fujairah',
    districts: [
      'Fujairah City', 'Al Aqah', 'Dibba Al Fujairah', 'Kalba', 'Al Fujairah',
      'Al Dhaid', 'Masafi', 'Abadilah', 'Afarah', 'Akamiyah', 'Al Awdah',
      'Al Ayn al Ghumur', 'Al Fuqait', 'Fujairah Free Zone', 'Fujairah Oil Industry Zone (FOIZ)',
    ],
  },
  {
    value: 'UAQ',
    label: 'Umm Al Quwain',
    districts: [
      'UAQ City', 'Al Salam', 'Al Rafaa', 'Al Raas', 'Dreamland Area',
      'Umm Al Quwain Free Trade Zone',
      'Umm Al Quwain Free Trade Zone — Ahmed Bin Rashid Port',
      'Umm Al Quwain Free Trade Zone — Shaikh Mohammad Bin Zayed Road',
    ],
  },
];
