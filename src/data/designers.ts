export interface Designer {
  slug: string;
  name: string;
  firstName: string;
  location: string;
  style: string;
  bioShort: string;
  bioLong?: string;
  avatar: string;
  projectImages: string[];
  projectCount: number;
  expertise: string[];
}

export interface DesignerProject {
  id: string;
  title: string;
  coverImage: string;
  images: string[];
  year?: number;
  location?: string;
  address: string;
  cost: string;
  description: string;
  tags?: string[];
}

interface DesignerSeed extends Designer {
  projects: DesignerProject[];
}

function coverPath(index: number) {
  const logicalIndex = index - 1;
  const sourceIndex = (logicalIndex % 25) + 1;
  const variantIndex = Math.floor(logicalIndex / 25) + 1;
  const physicalIndex = (sourceIndex - 1) * 3 + variantIndex;

  return `/images/designers/projects/covers/cover-${String(physicalIndex).padStart(3, '0')}.jpg`;
}

function detailPath(index: number, variant: number) {
  const logicalIndex = index - 1;
  const sourceIndex = (logicalIndex % 25) + 1;
  const variantIndex = Math.floor(logicalIndex / 25) + 1;
  const physicalIndex = (sourceIndex - 1) * 3 + variantIndex;

  return `/images/designers/projects/details-v2/cover-${String(physicalIndex).padStart(3, '0')}-${variant}.jpg`;
}

function designerImageSet(designerIndex: number, count = 5) {
  const start = designerIndex * 5 + 1;
  return Array.from({ length: count }, (_, index) => coverPath(start + index));
}

const DESIGNER_INDEX: Record<string, number> = {
  'salma-nasser': 0,
  'omar-farouk': 1,
  'hana-idris': 2,
  'daniel-rana': 3,
  'mariam-kassem': 4,
  'layla-haddad': 5,
  'yousef-karim': 6,
  'noor-rahman': 7,
  'tariq-mansour': 8,
  'amira-safwan': 9,
  'karim-dawoud': 10,
  'sara-elias': 11,
  'adam-hakim': 12,
  'leena-aziz': 13,
  'zayn-abbas': 14,
};

function projectDetailSet(designerIndex: number, order: number) {
  const base = designerIndex * 5 + 1;
  const coverIndices = Array.from({ length: 5 }, (_, index) => base + index);
  const distribution = [
    [
      [coverIndices[0], 1],
      [coverIndices[1], 1],
      [coverIndices[2], 1],
    ],
    [
      [coverIndices[3], 1],
      [coverIndices[4], 1],
      [coverIndices[0], 2],
    ],
    [
      [coverIndices[1], 2],
      [coverIndices[2], 2],
      [coverIndices[3], 2],
    ],
    [
      [coverIndices[4], 2],
      [coverIndices[0], 3],
      [coverIndices[1], 3],
    ],
    [
      [coverIndices[2], 3],
      [coverIndices[3], 3],
      [coverIndices[4], 3],
    ],
  ] as const;

  return distribution[order - 1].map(([coverIndex, variant]) => detailPath(coverIndex, variant));
}

function createProject(...args: any[]): DesignerProject {
  const slug = String(args[0]);
  const usesExplicitDesignerIndex = Array.isArray(args[8]);

  const designerIndex = usesExplicitDesignerIndex
    ? Number(args[1])
    : DESIGNER_INDEX[slug];
  const order = usesExplicitDesignerIndex ? Number(args[2]) : Number(args[1]);
  const title = String(usesExplicitDesignerIndex ? args[3] : args[2]);
  const location = String(usesExplicitDesignerIndex ? args[4] : args[3]);
  const address = String(usesExplicitDesignerIndex ? args[5] : args[4]);
  const cost = String(usesExplicitDesignerIndex ? args[6] : args[5]);
  const description = String(usesExplicitDesignerIndex ? args[7] : args[6]);
  const tags = (usesExplicitDesignerIndex ? args[8] : args[7]) as string[];

  const coverIndex = designerIndex * 5 + order;
  const images = projectDetailSet(designerIndex, order);

  return {
    id: `${slug}-project-${order}`,
    title,
    coverImage: coverPath(coverIndex),
    images,
    year: 2024 + (order % 2),
    location,
    address,
    cost,
    description,
    tags,
  };
}

const designerSeeds: DesignerSeed[] = [
  {
    slug: 'salma-nasser',
    name: 'Salma Nasser',
    firstName: 'Salma',
    location: 'Dubai, UAE',
    style: 'Warm Minimal, Luxury Residential',
    bioShort: 'Specializes in premium family villas with warm neutral palettes, custom joinery, and hospitality-first living spaces.',
    bioLong: 'Salma works on complete villa interiors across Dubai, combining refined finishes with layouts that support hosting, daily family life, and long-term durability.',
    avatar: '/images/designers/avatars/salma-nasser.jpg',
    projectImages: designerImageSet(0),
    projectCount: 5,
    expertise: ['Villa Renovation', 'Custom Joinery', 'Lighting Design', 'Material Selection'],
    projects: [
      createProject('salma-nasser', 0, 1, 'Palm Villa Reception', 'Dubai, UAE', 'Palm Jumeirah, Dubai', 'AED 82,000 - 126,000', 'A reception and family entertaining suite with layered lighting, soft stone textures, and concealed storage for formal hosting.', ['Luxury', 'Majlis', 'Lighting']),
      createProject('salma-nasser', 0, 2, 'Marina Open Kitchen', 'Dubai, UAE', 'Dubai Marina, Dubai', 'AED 54,000 - 88,000', 'A warm kitchen redesign centered on a social island, hidden appliance wall, and durable premium finishes.', ['Kitchen', 'Full renovation', 'Family living']),
      createProject('salma-nasser', 0, 3, 'Stone Ensuite Retreat', 'Dubai, UAE', 'Al Barari, Dubai', 'AED 38,000 - 67,000', 'A spa-like ensuite with fluted cabinetry, backlit mirrors, and quieter material transitions.', ['Bathroom', 'Luxury', 'Materials']),
      createProject('salma-nasser', 0, 4, 'Terrace Hosting Lounge', 'Dubai, UAE', 'Tilal Al Ghaf, Dubai', 'AED 41,000 - 72,000', 'An outdoor entertaining lounge designed for evening gatherings with layered seating and weather-ready finishes.', ['Outdoor', 'Soft decoration', 'Hosting']),
      createProject('salma-nasser', 0, 5, 'Private Majlis Suite', 'Dubai, UAE', 'Meydan, Dubai', 'AED 63,000 - 101,000', 'A formal majlis suite balancing contemporary silhouettes with hospitality details and acoustic comfort.', ['Majlis', 'Custom joinery', 'Luxury']),
    ],
  },
  {
    slug: 'omar-farouk',
    name: 'Omar Farouk',
    firstName: 'Omar',
    location: 'Abu Dhabi, UAE',
    style: 'Contemporary, Natural Modern',
    bioShort: 'Builds clean, high-finish homes around better planning, oak textures, and durable materials for busy households.',
    bioLong: 'Omar focuses on end-to-end apartment and villa upgrades where zoning, family flow, and material performance matter as much as the visual result.',
    avatar: '/images/designers/avatars/omar-farouk.jpg',
    projectImages: designerImageSet(1),
    projectCount: 5,
    expertise: ['Space Planning', 'Kitchen Design', 'Family Homes', 'Procurement'],
    projects: [
      createProject('omar-farouk', 1, 1, 'Creek Loft Reset', 'Abu Dhabi, UAE', 'Al Raha Beach, Abu Dhabi', 'AED 46,000 - 79,000', 'A compact loft reorganized with clearer sightlines, concealed utility storage, and restrained timber detailing.', ['Apartment', 'Minimal', 'Storage']),
      createProject('omar-farouk', 1, 2, 'Oak Kitchen Upgrade', 'Abu Dhabi, UAE', 'Saadiyat Grove, Abu Dhabi', 'AED 57,000 - 92,000', 'A kitchen scheme with vertical-grain cabinetry, integrated refrigeration, and a practical breakfast zone.', ['Kitchen', 'Custom Cabinets', 'Family living']),
      createProject('omar-farouk', 1, 3, 'Family Salon Layout', 'Abu Dhabi, UAE', 'Yas Acres, Abu Dhabi', 'AED 35,000 - 58,000', 'The salon was rebuilt for larger gatherings with modular seating, better TV sightlines, and softer acoustics.', ['Living', 'Layout', 'Furniture']),
      createProject('omar-farouk', 1, 4, 'Quiet Bedroom Suite', 'Abu Dhabi, UAE', 'Al Reef, Abu Dhabi', 'AED 24,000 - 44,000', 'A calm bedroom package using integrated wardrobes, warm lighting, and low-contrast finishes.', ['Bedroom', 'Lighting', 'Joinery']),
      createProject('omar-farouk', 1, 5, 'Roof Garden Seating', 'Abu Dhabi, UAE', 'Al Jubail Island, Abu Dhabi', 'AED 39,000 - 70,000', 'An exterior seating deck for sunset use with weather-resistant upholstery and low-maintenance detailing.', ['Outdoor', 'Lifestyle', 'Soft decoration']),
    ],
  },
  {
    slug: 'hana-idris',
    name: 'Hana Idris',
    firstName: 'Hana',
    location: 'Sharjah, UAE',
    style: 'Boutique Luxury, Feminine Modern',
    bioShort: 'Creates polished apartment interiors with soft color, boutique-hotel layering, and detail-focused dressing spaces.',
    bioLong: 'Hana is often hired for city apartments and private suites where visual refinement matters and storage still needs to work hard.',
    avatar: '/images/designers/avatars/hana-idris.jpg',
    projectImages: designerImageSet(2),
    projectCount: 5,
    expertise: ['Apartment Styling', 'Color & Materials', 'Bathroom Design', 'Soft Decoration'],
    projects: [
      createProject('hana-idris', 2, 1, 'Pearl Entry Lounge', 'Sharjah, UAE', 'Aljada Residence, Sharjah', 'AED 26,000 - 47,000', 'A small but high-impact entry lounge using curving furniture, bronze accents, and layered lighting.', ['Entrance', 'Styling', 'Lighting']),
      createProject('hana-idris', 2, 'Skyline Dining Room', 'Sharjah, UAE', 'Maryam Island, Sharjah', 'AED 31,000 - 55,000', 'A dining room arranged around a tailored banquette, quiet color, and mirrored depth for evening entertaining.', ['Dining', 'Soft decoration', 'Luxury'], 3),
      createProject('hana-idris', 3, 'Spa Bath Composition', 'Sharjah, UAE', 'Al Khan, Sharjah', 'AED 33,000 - 61,000', 'A compact bath transformed with warm stone graphics, soft brass, and layered mirror lighting.', ['Bathroom', 'Materials', 'Lighting'], 4),
      createProject('hana-idris', 4, 'Dressing Room Edit', 'Sharjah, UAE', 'Muwaileh, Sharjah', 'AED 37,000 - 64,000', 'A wardrobe and vanity room that improves storage clarity while keeping a softer editorial visual language.', ['Wardrobe', 'Custom Joinery', 'Luxury'], 0),
      createProject('hana-idris', 5, 'Reading Corner Studio', 'Sharjah, UAE', 'Al Mamzar, Sharjah', 'AED 18,000 - 32,000', 'An underused corner turned into a reading nook with sculpted shelving and layered upholstery.', ['Reading Corner', 'Furniture', 'Styling'], 1),
    ],
  },
  {
    slug: 'daniel-rana',
    name: 'Daniel Rana',
    firstName: 'Daniel',
    location: 'Dubai, UAE',
    style: 'Architectural Minimal, European Modern',
    bioShort: 'Delivers crisp layouts, quiet luxury finishes, and architectural detailing for full-home transformations.',
    bioLong: 'Daniel approaches interiors with an architectural lens, emphasizing clear geometry, disciplined material transitions, and flexible spaces that still feel premium.',
    avatar: '/images/designers/avatars/daniel-rana.jpg',
    projectImages: designerImageSet(3),
    projectCount: 5,
    expertise: ['Full Home Renovation', 'Interior Architecture', 'Custom Millwork', 'Project Management'],
    projects: [
      createProject('daniel-rana', 1, 'Minimal Living Frame', 'Dubai, UAE', 'Dubai Hills Estate, Dubai', 'AED 61,000 - 108,000', 'A double-height living room with clean built-ins, concealed climate grilles, and a palette tuned for architectural clarity.', ['Living', 'Minimal', 'Architecture'], 3),
      createProject('daniel-rana', 2, 'Walnut Kitchen Axis', 'Dubai, UAE', 'City Walk, Dubai', 'AED 58,000 - 96,000', 'A kitchen composition built around walnut joinery, stone slab continuity, and flush detailing.', ['Kitchen', 'Joinery', 'Luxury'], 4),
      createProject('daniel-rana', 3, 'Atrium Stair Feature', 'Dubai, UAE', 'Sobha Hartland, Dubai', 'AED 42,000 - 77,000', 'The stair atrium was redesigned as a sculptural centerpiece with slim metalwork and wall washing.', ['Staircase', 'Lighting', 'Feature wall'], 0),
      createProject('daniel-rana', 4, 'Cinema Room Layering', 'Dubai, UAE', 'Emirates Hills, Dubai', 'AED 47,000 - 83,000', 'A media room tuned for acoustic comfort, concealed technology, and darker finishes that still feel refined.', ['Cinema', 'Acoustics', 'Technology'], 1),
      createProject('daniel-rana', 5, 'Guest Suite Upgrade', 'Dubai, UAE', 'Jumeirah Golf Estates, Dubai', 'AED 27,000 - 48,000', 'A guest suite update using integrated wardrobes, custom headboard geometry, and warm low-level lighting.', ['Bedroom', 'Guest suite', 'Joinery'], 2),
    ],
  },
  {
    slug: 'mariam-kassem',
    name: 'Mariam Kassem',
    firstName: 'Mariam',
    location: 'Ajman, UAE',
    style: 'Soft Contemporary, Desert Warmth',
    bioShort: 'Designs approachable luxury with earthy tones, comfortable seating plans, and strong attention to hospitality.',
    bioLong: 'Mariam works across Northern Emirates homes where clients want warmth, practicality, and visual polish without anything feeling cold or overdesigned.',
    avatar: '/images/designers/avatars/mariam-kassem.jpg',
    projectImages: designerImageSet(4),
    projectCount: 5,
    expertise: ['Residential Interiors', 'Soft Furnishing', 'Outdoor Living', 'Turnkey Styling'],
    projects: [
      createProject('mariam-kassem', 1, 'Desert Villa Welcome', 'Ajman, UAE', 'Al Zorah, Ajman', 'AED 34,000 - 59,000', 'A welcoming front salon with earthy color transitions, patterned textiles, and subtle brass details.', ['Entrance', 'Hospitality', 'Styling'], 4),
      createProject('mariam-kassem', 2, 'Warm Dining Gatherings', 'Ajman, UAE', 'Al Helio, Ajman', 'AED 29,000 - 53,000', 'A dining setting designed around longer family meals with softer acoustics and layered ambient light.', ['Dining', 'Family living', 'Lighting'], 0),
      createProject('mariam-kassem', 3, 'Studio Office Nook', 'Ajman, UAE', 'Corniche Tower, Ajman', 'AED 17,000 - 30,000', 'A compact office nook inserted into an open plan without fragmenting the shared room.', ['Workspace', 'Storage', 'Compact living'], 1),
      createProject('mariam-kassem', 4, 'Powder Room Glow', 'Ajman, UAE', 'Al Mowaihat, Ajman', 'AED 19,000 - 35,000', 'A powder room refresh using warmer wall tones, a sculpted mirror, and compact joinery.', ['Bathroom', 'Powder room', 'Luxury'], 2),
      createProject('mariam-kassem', 5, 'Courtyard Tea Space', 'Ajman, UAE', 'Masfout, Ajman', 'AED 23,000 - 42,000', 'A tea courtyard styled for dusk gatherings with layered lantern lighting and movable seating.', ['Courtyard', 'Outdoor', 'Hosting'], 3),
    ],
  },
  {
    slug: 'layla-haddad',
    name: 'Layla Haddad',
    firstName: 'Layla',
    location: 'Dubai, UAE',
    style: 'Modern Classic, Hospitality Led',
    bioShort: 'Builds elegant city homes with tailored seating, calm symmetry, and a strong focus on guest-ready living rooms.',
    bioLong: 'Layla is known for polished urban interiors that feel formal enough for hosting yet relaxed enough for daily use.',
    avatar: '/images/designers/avatars/layla-haddad.jpg',
    projectImages: designerImageSet(5),
    projectCount: 5,
    expertise: ['Living Rooms', 'Furniture Curation', 'Lighting Design', 'Turnkey Styling'],
    projects: [
      createProject('layla-haddad', 1, 'Creek Reception Lounge', 'Dubai, UAE', 'Dubai Creek Harbour, Dubai', 'AED 36,000 - 62,000', 'A reception lounge composed around refined seating, balanced lighting, and layered neutrals for evening hosting.', ['Living', 'Styling', 'Lighting'], 0),
      createProject('layla-haddad', 2, 'Formal Dining Edit', 'Dubai, UAE', 'Mirdif Hills, Dubai', 'AED 28,000 - 51,000', 'A dining room reworked with calmer proportions, softer textiles, and a more polished hospitality feel.', ['Dining', 'Luxury', 'Furniture'], 1),
      createProject('layla-haddad', 3, 'Guest Suite Refresh', 'Dubai, UAE', 'Jumeirah Village Circle, Dubai', 'AED 21,000 - 39,000', 'A guest suite refreshed with quieter colors, layered drapery, and concealed storage.', ['Bedroom', 'Guest suite', 'Styling'], 2),
      createProject('layla-haddad', 4, 'Apartment Entry Moment', 'Dubai, UAE', 'Business Bay, Dubai', 'AED 17,000 - 29,000', 'A compact entry sequence turned into a memorable welcome point with integrated mirrors and lighting.', ['Entrance', 'Lighting', 'Compact living'], 3),
      createProject('layla-haddad', 5, 'Family Tea Corner', 'Dubai, UAE', 'Nad Al Sheba, Dubai', 'AED 18,000 - 33,000', 'A tea corner styled for frequent use with flexible seating and durable finish choices.', ['Family living', 'Soft decoration', 'Hosting'], 4),
    ],
  },
  {
    slug: 'yousef-karim',
    name: 'Yousef Karim',
    firstName: 'Yousef',
    location: 'Abu Dhabi, UAE',
    style: 'Minimal Warmth, Functional Modern',
    bioShort: 'Focuses on cleaner layouts, practical kitchens, and low-maintenance materials that still read premium.',
    bioLong: 'Yousef typically works with busy households who want better organization, easier circulation, and a calmer visual language.',
    avatar: '/images/designers/avatars/yousef-karim.jpg',
    projectImages: designerImageSet(6),
    projectCount: 5,
    expertise: ['Kitchen Planning', 'Storage Design', 'Apartment Renovation', 'Procurement'],
    projects: [
      createProject('yousef-karim', 1, 'Harbour Kitchen Plan', 'Abu Dhabi, UAE', 'Al Reem Island, Abu Dhabi', 'AED 43,000 - 71,000', 'A kitchen rebuilt around improved prep flow, hidden storage, and clean detailing.', ['Kitchen', 'Storage', 'Minimal'], 1),
      createProject('yousef-karim', 2, 'Open Lounge Reset', 'Abu Dhabi, UAE', 'Al Maryah Island, Abu Dhabi', 'AED 31,000 - 55,000', 'An open living room reorganized for better seating logic and clearer daily circulation.', ['Living', 'Layout', 'Apartment'], 2),
      createProject('yousef-karim', 3, 'Bedroom Storage Wall', 'Abu Dhabi, UAE', 'Saadiyat Island, Abu Dhabi', 'AED 24,000 - 41,000', 'A full-height storage wall designed to reduce clutter without overwhelming the room.', ['Bedroom', 'Joinery', 'Storage'], 3),
      createProject('yousef-karim', 4, 'Compact Work Niche', 'Abu Dhabi, UAE', 'Yas Bay, Abu Dhabi', 'AED 13,000 - 24,000', 'A small work niche integrated into the main living zone with hidden cable management.', ['Workspace', 'Compact living', 'Joinery'], 4),
      createProject('yousef-karim', 5, 'Breakfast Dining Zone', 'Abu Dhabi, UAE', 'Khalifa City, Abu Dhabi', 'AED 20,000 - 37,000', 'A casual dining zone built for daily family use with easier maintenance and warmer materials.', ['Dining', 'Family living', 'Materials'], 0),
    ],
  },
  {
    slug: 'noor-rahman',
    name: 'Noor Rahman',
    firstName: 'Noor',
    location: 'Sharjah, UAE',
    style: 'Soft Luxury, Boutique Residential',
    bioShort: 'Designs refined apartments with layered textures, gentle contrast, and carefully edited dressing and bath spaces.',
    bioLong: 'Noor often works on compact but high-finish interiors where every element needs to feel considered and visually calm.',
    avatar: '/images/designers/avatars/noor-rahman.jpg',
    projectImages: designerImageSet(7),
    projectCount: 5,
    expertise: ['Soft Decoration', 'Bathroom Design', 'Apartment Styling', 'Color & Materials'],
    projects: [
      createProject('noor-rahman', 1, 'Skyline Dressing Suite', 'Sharjah, UAE', 'Maryam Island, Sharjah', 'AED 26,000 - 46,000', 'A dressing space with layered mirrors, integrated vanity lighting, and warmer material transitions.', ['Wardrobe', 'Luxury', 'Lighting'], 2),
      createProject('noor-rahman', 2, 'Powder Room Update', 'Sharjah, UAE', 'Aljada, Sharjah', 'AED 14,000 - 26,000', 'A powder room refreshed with quieter stone, refined hardware, and better storage planning.', ['Bathroom', 'Materials', 'Luxury'], 3),
      createProject('noor-rahman', 3, 'Evening Dining Corner', 'Sharjah, UAE', 'Al Khan Lagoon, Sharjah', 'AED 18,000 - 31,000', 'A dining corner designed for intimate hosting with softer light and more tailored upholstery.', ['Dining', 'Styling', 'Hosting'], 4),
      createProject('noor-rahman', 4, 'Reading Lounge Edit', 'Sharjah, UAE', 'Muwaileh, Sharjah', 'AED 16,000 - 28,000', 'A reading lounge built around lower visual noise and a more boutique-hotel atmosphere.', ['Reading Corner', 'Soft decoration', 'Furniture'], 0),
      createProject('noor-rahman', 5, 'Bedroom Calm Layers', 'Sharjah, UAE', 'Tilal City, Sharjah', 'AED 23,000 - 40,000', 'A bedroom scheme with better zoning, richer drapery, and softer contrast throughout.', ['Bedroom', 'Styling', 'Lighting'], 1),
    ],
  },
  {
    slug: 'tariq-mansour',
    name: 'Tariq Mansour',
    firstName: 'Tariq',
    location: 'Dubai, UAE',
    style: 'Architectural Modern, Dark Accents',
    bioShort: 'Handles clean-lined renovations with stronger geometry, integrated technology, and more architectural detailing.',
    bioLong: 'Tariq works across villas and premium apartments where clients want sharper forms, disciplined palettes, and hidden tech integration.',
    avatar: '/images/designers/avatars/tariq-mansour.jpg',
    projectImages: designerImageSet(8),
    projectCount: 5,
    expertise: ['Interior Architecture', 'Technology Integration', 'Custom Millwork', 'Renovation'],
    projects: [
      createProject('tariq-mansour', 1, 'Atrium Living Axis', 'Dubai, UAE', 'Dubai Hills, Dubai', 'AED 59,000 - 97,000', 'A living room built around a stronger central axis, concealed tech, and tighter material alignment.', ['Living', 'Architecture', 'Technology'], 3),
      createProject('tariq-mansour', 2, 'Linear Kitchen Wall', 'Dubai, UAE', 'City Walk, Dubai', 'AED 49,000 - 83,000', 'A linear kitchen concept with flush storage, integrated appliances, and simplified detailing.', ['Kitchen', 'Minimal', 'Joinery'], 4),
      createProject('tariq-mansour', 3, 'Media Room Contrast', 'Dubai, UAE', 'The Springs, Dubai', 'AED 33,000 - 57,000', 'A media room tuned for contrast, acoustic comfort, and more controlled lighting scenes.', ['Cinema', 'Lighting', 'Acoustics'], 0),
      createProject('tariq-mansour', 4, 'Study Wall Composition', 'Dubai, UAE', 'Arabian Ranches, Dubai', 'AED 19,000 - 35,000', 'A study wall built from custom millwork and concealed cable routes for a cleaner workspace.', ['Workspace', 'Millwork', 'Technology'], 1),
      createProject('tariq-mansour', 5, 'Guest Room Upgrade', 'Dubai, UAE', 'Meydan, Dubai', 'AED 22,000 - 38,000', 'A guest bedroom reshaped with darker accents and a more architectural storage plan.', ['Bedroom', 'Guest suite', 'Joinery'], 2),
    ],
  },
  {
    slug: 'amira-safwan',
    name: 'Amira Safwan',
    firstName: 'Amira',
    location: 'Ajman, UAE',
    style: 'Warm Contemporary, Family Comfort',
    bioShort: 'Creates comfortable homes with welcoming seating plans, earthy color palettes, and family-focused layouts.',
    bioLong: 'Amira is strongest on homes that need to feel warm and polished without sacrificing ease of maintenance or everyday use.',
    avatar: '/images/designers/avatars/amira-safwan.jpg',
    projectImages: designerImageSet(9),
    projectCount: 5,
    expertise: ['Family Interiors', 'Soft Furnishing', 'Dining Spaces', 'Outdoor Living'],
    projects: [
      createProject('amira-safwan', 1, 'Family Salon Welcome', 'Ajman, UAE', 'Al Rawda, Ajman', 'AED 27,000 - 47,000', 'A family salon designed for long visits, softer acoustics, and more relaxed circulation.', ['Living', 'Family living', 'Hosting'], 4),
      createProject('amira-safwan', 2, 'Warm Dining Layers', 'Ajman, UAE', 'Al Mowaihat, Ajman', 'AED 21,000 - 36,000', 'A dining room layered with easy-care materials, better ambient light, and a softer palette.', ['Dining', 'Lighting', 'Materials'], 0),
      createProject('amira-safwan', 3, 'Outdoor Tea Terrace', 'Ajman, UAE', 'Al Zorah, Ajman', 'AED 19,000 - 33,000', 'An outdoor terrace arranged for tea gatherings and daily family downtime.', ['Outdoor', 'Hosting', 'Lifestyle'], 1),
      createProject('amira-safwan', 4, 'Primary Bedroom Comfort', 'Ajman, UAE', 'Masfout, Ajman', 'AED 24,000 - 42,000', 'A primary bedroom scheme centered on comfort, storage clarity, and warmer finishes.', ['Bedroom', 'Storage', 'Soft decoration'], 2),
      createProject('amira-safwan', 5, 'Entry Sitting Nook', 'Ajman, UAE', 'Al Helio, Ajman', 'AED 12,000 - 21,000', 'A small sitting nook positioned near the entry to create a more welcoming arrival sequence.', ['Entrance', 'Furniture', 'Compact living'], 3),
    ],
  },
  {
    slug: 'karim-dawoud',
    name: 'Karim Dawoud',
    firstName: 'Karim',
    location: 'Abu Dhabi, UAE',
    style: 'Clean Contemporary, Builder Friendly',
    bioShort: 'Works on practical renovation packages that balance visual quality, buildability, and straightforward material choices.',
    bioLong: 'Karim is often hired when clients want a premium result but also need decisions to stay grounded in site realities and timelines.',
    avatar: '/images/designers/avatars/karim-dawoud.jpg',
    projectImages: designerImageSet(10),
    projectCount: 5,
    expertise: ['Renovation Planning', 'Materials', 'Site Coordination', 'Kitchen & Bath'],
    projects: [
      createProject('karim-dawoud', 1, 'Builder-Smart Kitchen', 'Abu Dhabi, UAE', 'Khalifa City, Abu Dhabi', 'AED 39,000 - 65,000', 'A kitchen redesign that simplifies fabrication while lifting the visual finish and storage quality.', ['Kitchen', 'Renovation', 'Materials'], 0),
      createProject('karim-dawoud', 2, 'Bath Finish Upgrade', 'Abu Dhabi, UAE', 'Al Raha Gardens, Abu Dhabi', 'AED 17,000 - 31,000', 'A bathroom upgrade focused on durable specifications, easier maintenance, and cleaner detailing.', ['Bathroom', 'Materials', 'Renovation'], 1),
      createProject('karim-dawoud', 3, 'Open Dining Merge', 'Abu Dhabi, UAE', 'Al Reef Villas, Abu Dhabi', 'AED 22,000 - 39,000', 'A dining zone merged into the living area with better circulation and more coherent lighting.', ['Dining', 'Layout', 'Lighting'], 2),
      createProject('karim-dawoud', 4, 'Apartment Storage Edit', 'Abu Dhabi, UAE', 'Al Reem Island, Abu Dhabi', 'AED 16,000 - 28,000', 'An apartment storage package designed to remove clutter from high-use zones.', ['Storage', 'Apartment', 'Joinery'], 3),
      createProject('karim-dawoud', 5, 'Guest Bathroom Reset', 'Abu Dhabi, UAE', 'Yas Island, Abu Dhabi', 'AED 14,000 - 25,000', 'A guest bathroom reset with improved fixtures, stronger lighting, and quieter finishes.', ['Bathroom', 'Guest suite', 'Lighting'], 4),
    ],
  },
  {
    slug: 'sara-elias',
    name: 'Sara Elias',
    firstName: 'Sara',
    location: 'Sharjah, UAE',
    style: 'Soft Minimal, Female-Focused Spaces',
    bioShort: 'Designs calm, polished homes with a lighter touch, better storage, and detail-focused vanity and dressing zones.',
    bioLong: 'Sara often works with young families and professionals who want a cleaner interior language without sacrificing softness.',
    avatar: '/images/designers/avatars/sara-elias.jpg',
    projectImages: designerImageSet(11),
    projectCount: 5,
    expertise: ['Bedroom Styling', 'Wardrobes', 'Vanity Areas', 'Soft Decoration'],
    projects: [
      createProject('sara-elias', 1, 'Vanity Room Refresh', 'Sharjah, UAE', 'Aljada, Sharjah', 'AED 19,000 - 34,000', 'A vanity room with layered mirrors, lower glare, and a clearer storage hierarchy.', ['Wardrobe', 'Lighting', 'Storage'], 1),
      createProject('sara-elias', 2, 'Primary Bedroom Soft Reset', 'Sharjah, UAE', 'Muwaileh, Sharjah', 'AED 22,000 - 38,000', 'A primary bedroom redesigned for softness, comfort, and simpler maintenance.', ['Bedroom', 'Soft decoration', 'Styling'], 2),
      createProject('sara-elias', 3, 'Reading Nook Detail', 'Sharjah, UAE', 'Tilal City, Sharjah', 'AED 11,000 - 20,000', 'A quiet reading nook with better task lighting and more tactile materials.', ['Reading Corner', 'Lighting', 'Furniture'], 3),
      createProject('sara-elias', 4, 'Dining Alcove Calm', 'Sharjah, UAE', 'Al Mamzar, Sharjah', 'AED 15,000 - 26,000', 'A dining alcove tuned for calmer evenings and a more boutique-hotel mood.', ['Dining', 'Styling', 'Apartment'], 4),
      createProject('sara-elias', 5, 'Guest Bedroom Finish', 'Sharjah, UAE', 'Maryam Island, Sharjah', 'AED 18,000 - 31,000', 'A guest bedroom package with better drapery, storage, and low-level lighting.', ['Bedroom', 'Guest suite', 'Lighting'], 0),
    ],
  },
  {
    slug: 'adam-hakim',
    name: 'Adam Hakim',
    firstName: 'Adam',
    location: 'Dubai, UAE',
    style: 'Urban Modern, Compact Luxury',
    bioShort: 'Specializes in premium apartment upgrades with strong storage logic and clean, modern detailing.',
    bioLong: 'Adam is strongest on city apartments where every square meter needs to work harder without losing a premium tone.',
    avatar: '/images/designers/avatars/adam-hakim.jpg',
    projectImages: designerImageSet(12),
    projectCount: 5,
    expertise: ['Apartment Upgrades', 'Storage Planning', 'Compact Kitchens', 'Lighting'],
    projects: [
      createProject('adam-hakim', 1, 'Downtown Living Edit', 'Dubai, UAE', 'Downtown Dubai, Dubai', 'AED 34,000 - 58,000', 'A downtown apartment living room refined through stronger storage and cleaner visual zoning.', ['Apartment', 'Living', 'Storage'], 2),
      createProject('adam-hakim', 2, 'Compact Kitchen Lift', 'Dubai, UAE', 'Dubai Marina, Dubai', 'AED 27,000 - 47,000', 'A compact kitchen lifted with integrated appliances, better prep flow, and more refined materials.', ['Kitchen', 'Apartment', 'Materials'], 3),
      createProject('adam-hakim', 3, 'Entry Storage Spine', 'Dubai, UAE', 'Business Bay, Dubai', 'AED 15,000 - 26,000', 'A full-height entry storage spine designed to clear visual clutter at the point of arrival.', ['Entrance', 'Storage', 'Joinery'], 4),
      createProject('adam-hakim', 4, 'Bedroom Lighting Reset', 'Dubai, UAE', 'JLT, Dubai', 'AED 18,000 - 30,000', 'A bedroom lighting reset that improves comfort without overcomplicating the space.', ['Bedroom', 'Lighting', 'Compact living'], 0),
      createProject('adam-hakim', 5, 'Home Office Insert', 'Dubai, UAE', 'Creek Harbour, Dubai', 'AED 14,000 - 24,000', 'A compact home office insert added to the living plan with cleaner cable control and storage.', ['Workspace', 'Apartment', 'Technology'], 1),
    ],
  },
  {
    slug: 'leena-aziz',
    name: 'Leena Aziz',
    firstName: 'Leena',
    location: 'Ras Al Khaimah, UAE',
    style: 'Relaxed Luxury, Resort Residential',
    bioShort: 'Designs resort-inspired homes with softer textures, easier outdoor transitions, and a more restful visual tempo.',
    bioLong: 'Leena works on homes that lean into light, openness, and a more relaxed hospitality mood, especially near waterfront communities.',
    avatar: '/images/designers/avatars/leena-aziz.jpg',
    projectImages: designerImageSet(13),
    projectCount: 5,
    expertise: ['Resort Style', 'Outdoor Living', 'Bedroom Suites', 'Dining Spaces'],
    projects: [
      createProject('leena-aziz', 1, 'Coastal Lounge Layers', 'Ras Al Khaimah, UAE', 'Al Hamra Village, RAK', 'AED 29,000 - 50,000', 'A coastal lounge with lighter textures, more relaxed seating, and improved daylight response.', ['Living', 'Resort style', 'Furniture'], 3),
      createProject('leena-aziz', 2, 'Outdoor Dining Terrace', 'Ras Al Khaimah, UAE', 'Mina Al Arab, RAK', 'AED 24,000 - 41,000', 'An outdoor dining terrace designed for easier entertaining and stronger indoor-outdoor continuity.', ['Outdoor', 'Dining', 'Hosting'], 4),
      createProject('leena-aziz', 3, 'Primary Suite Retreat', 'Ras Al Khaimah, UAE', 'Julphar Towers, RAK', 'AED 26,000 - 45,000', 'A primary suite reshaped with softer materials, lighter drapery, and calmer zoning.', ['Bedroom', 'Luxury', 'Soft decoration'], 0),
      createProject('leena-aziz', 4, 'Breakfast Nook Glow', 'Ras Al Khaimah, UAE', 'Al Dhait, RAK', 'AED 13,000 - 22,000', 'A breakfast nook brightened through better seating, warmer finishes, and gentler lighting.', ['Dining', 'Lighting', 'Family living'], 1),
      createProject('leena-aziz', 5, 'Guest Lounge Comfort', 'Ras Al Khaimah, UAE', 'Marjan Island, RAK', 'AED 18,000 - 32,000', 'A guest lounge composed to feel lighter, calmer, and more welcoming for short stays.', ['Guest suite', 'Living', 'Styling'], 2),
    ],
  },
  {
    slug: 'zayn-abbas',
    name: 'Zayn Abbas',
    firstName: 'Zayn',
    location: 'Dubai, UAE',
    style: 'Masculine Modern, Structured Calm',
    bioShort: 'Builds structured interiors with restrained palettes, integrated joinery, and low-clutter living zones.',
    bioLong: 'Zayn is strongest on homes that need visual order, cleaner lines, and a more disciplined furniture composition.',
    avatar: '/images/designers/avatars/zayn-abbas.jpg',
    projectImages: designerImageSet(14),
    projectCount: 5,
    expertise: ['Custom Joinery', 'Living Rooms', 'Workspace Design', 'Project Management'],
    projects: [
      createProject('zayn-abbas', 1, 'Structured Living Room', 'Dubai, UAE', 'Jumeirah Park, Dubai', 'AED 38,000 - 64,000', 'A living room structured around integrated shelving, lower visual clutter, and stronger furniture alignment.', ['Living', 'Joinery', 'Minimal'], 4),
      createProject('zayn-abbas', 2, 'Study Console Wall', 'Dubai, UAE', 'Motor City, Dubai', 'AED 16,000 - 28,000', 'A study console wall designed to contain equipment, books, and display without visual overload.', ['Workspace', 'Millwork', 'Storage'], 0),
      createProject('zayn-abbas', 3, 'Dining Geometry Reset', 'Dubai, UAE', 'Dubai South, Dubai', 'AED 19,000 - 33,000', 'A dining room reset with cleaner proportions, sharper lighting, and stronger focal alignment.', ['Dining', 'Lighting', 'Layout'], 1),
      createProject('zayn-abbas', 4, 'Bedroom Storage Grid', 'Dubai, UAE', 'Al Furjan, Dubai', 'AED 21,000 - 36,000', 'A bedroom storage grid built to streamline daily routines and reduce clutter.', ['Bedroom', 'Storage', 'Joinery'], 2),
      createProject('zayn-abbas', 5, 'Compact Lounge Office', 'Dubai, UAE', 'Dubai Silicon Oasis, Dubai', 'AED 14,000 - 25,000', 'A lounge-office hybrid that keeps work functions hidden when not in use.', ['Workspace', 'Compact living', 'Furniture'], 3),
    ],
  },
];

export const EXPERTISE_OPTIONS = Array.from(
  new Set(designerSeeds.flatMap((designer) => designer.expertise))
).sort();

export const designersList: Designer[] = designerSeeds.map(({ projects, ...designer }) => designer);

const projectMap = Object.fromEntries(
  designerSeeds.map((designer) => [designer.slug, designer.projects])
) as Record<string, DesignerProject[]>;

export function getDesignerBySlug(slug: string): Designer | undefined {
  return designersList.find((designer) => designer.slug === slug);
}

export function getDesignerProjects(slug: string): DesignerProject[] {
  return projectMap[slug] ?? [];
}

export function getProject(slug: string, projectId: string): DesignerProject | undefined {
  return getDesignerProjects(slug).find((project) => project.id === projectId);
}
