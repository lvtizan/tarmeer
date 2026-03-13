export interface MaterialCategory {
  slug: string;
  title: string;
  titleEn: string;
  description: string;
  heroSubtitle: string;
  image: string;
}

export interface MaterialCaseStudy {
  id: number;
  title: string;
  location: string;
  category: string;
  image: string;
  description: string;
  features: string[];
}

export const materialCategories: MaterialCategory[] = [
  {
    slug: 'core-customization',
    title: '核心定制',
    titleEn: 'Core Customization',
    description: 'Cabinets, wardrobes, wooden doors, staircases — direct from factory, crafted with precision. Custom joinery for every space.',
    heroSubtitle: 'Cabinets, Wardrobes, Wooden Doors, Staircases — Direct from factory, crafted with precision.',
    image: 'https://images.unsplash.com/photo-1556911220-bff31c812dba?w=800&q=85',
  },
  {
    slug: 'building-facade',
    title: '建筑外立面',
    titleEn: 'Building Facade',
    description: 'Aluminum windows & doors, curtain wall systems. Professional installation and quality guarantee for residential and commercial.',
    heroSubtitle: 'Aluminum Windows & Doors, Curtain Wall Systems — Professional installation, guaranteed quality.',
    image: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&q=85',
  },
  {
    slug: 'hard-materials',
    title: '硬装材料',
    titleEn: 'Hard Materials',
    description: 'Tiles, stone, wood flooring, coatings — premium finishes for every surface. Sourced for durability and aesthetics.',
    heroSubtitle: 'Tiles, Premium Stone, Wood Flooring, Coatings — Premium finishes for every surface.',
    image: 'https://images.unsplash.com/photo-1600566752355-35792bedcfea?w=800&q=85',
  },
  {
    slug: 'furniture-soft',
    title: '全屋家具与软装',
    titleEn: 'Furniture & Soft Decoration',
    description: 'High-end furniture, sanitary ware, curtains, art decor. Complete FF&E packages from living room to outdoor spaces.',
    heroSubtitle: 'High-end Furniture, Sanitary Ware, Curtains, Art Decor — Complete FF&E for your space.',
    image: 'https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?w=800&q=85',
  },
  {
    slug: 'smart-tech',
    title: '智能科技',
    titleEn: 'Smart Tech',
    description: 'Professional lighting, building automation, smart home integration. Lighting control and construction technology solutions.',
    heroSubtitle: 'Lighting Control, Smart Home, Building Automation — Technology for modern living.',
    image: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&q=85',
  },
];

const caseStudiesByCategory: Record<string, MaterialCaseStudy[]> = {
  'core-customization': [
    { id: 1, title: 'Marina Luxury Villa', location: 'Dubai Marina', category: 'Custom Wardrobes', image: 'https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=800&q=85', description: 'Full-height custom wardrobes with integrated lighting and premium finishes.', features: ['Italian walnut finish', 'Soft-close mechanisms', 'LED interior lighting', 'Custom organizers'] },
    { id: 2, title: 'Downtown Penthouse Kitchen', location: 'Downtown Dubai', category: 'Custom Cabinets', image: 'https://images.unsplash.com/photo-1556911220-bff31c812dba?w=800&q=85', description: 'Floor-to-ceiling cabinetry with handleless design and smart storage solutions.', features: ['Handleless design', 'Pull-out pantries', 'Integrated appliances', 'Quartz countertops'] },
    { id: 3, title: 'Palm Jumeirah Mansion', location: 'Palm Jumeirah', category: 'Wooden Doors & Staircase', image: 'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=800&q=85', description: 'Grand entrance with solid wood doors and sweeping curved staircase.', features: ['Solid oak doors', 'Curved staircase', 'Custom handrails', 'Inlay details'] },
    { id: 4, title: 'JVC Apartment Renovation', location: 'JVC', category: 'Full Customization', image: 'https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?w=800&q=85', description: 'Complete joinery package including wardrobes, kitchen, and storage solutions.', features: ['Unified design', 'Space optimization', 'Premium hardware', '5-year warranty'] },
  ],
  'building-facade': [
    { id: 1, title: 'Business Bay Commercial Tower', location: 'Business Bay', category: 'Curtain Wall System', image: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=800&q=85', description: 'Full glass curtain wall with thermal insulation and solar control coating.', features: ['Double glazing units', 'Low-E coating', 'Aluminum framing', 'Thermal break technology'] },
    { id: 2, title: 'Downtown Dubai Residential Facade', location: 'Downtown Dubai', category: 'Aluminum Windows & Doors', image: 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=800&q=85', description: 'Modern aluminum window systems with sound insulation for urban living.', features: ['Sound insulation', 'Powder coated finish', 'Multi-point locking', 'Weather resistant'] },
    { id: 3, title: 'Marina Villa Renovation', location: 'Dubai Marina', category: 'Floor-to-Ceiling Windows', image: 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=800&q=85', description: 'Seamless glass installation maximizing waterfront views.', features: ['Tempered glass', 'Slim profiles', 'Panoramic views', 'UV protection'] },
    { id: 4, title: 'Palm Jumeirah Hotel Exterior', location: 'Palm Jumeirah', category: 'Complete Facade System', image: 'https://images.unsplash.com/photo-1582268611958-ebfd161ef9cf?w=800&q=85', description: 'Comprehensive facade upgrade with integrated shading systems.', features: ['Motorized shading', 'Automated controls', 'Energy efficient', 'Weather sensors'] },
  ],
  'hard-materials': [
    { id: 1, title: 'Palm Jumeirah Villa Flooring', location: 'Palm Jumeirah', category: 'Premium Stone', image: 'https://images.unsplash.com/photo-1600566752355-35792bedcfea?w=800&q=85', description: 'Imported Italian marble with custom patterns and inlay work.', features: ['Italian marble', 'Custom patterns', 'Honed finish', 'Sealing treatment'] },
    { id: 2, title: 'Downtown Apartment Tiling', location: 'Downtown Dubai', category: 'Premium Tiles', image: 'https://images.unsplash.com/photo-1615873968403-89e068629265?w=800&q=85', description: 'Large format porcelain tiles with minimal grout lines for seamless look.', features: ['Large format tiles', 'Minimal grout', 'Polished finish', 'Anti-slip treatment'] },
    { id: 3, title: 'Marina Townhouse Wood Flooring', location: 'Dubai Marina', category: 'Wood Flooring', image: 'https://images.unsplash.com/photo-1615971677499-5467cbab01c0?w=800&q=85', description: 'Engineered oak wood flooring with underfloor heating compatibility.', features: ['Engineered oak', 'Underfloor heating', 'Matte lacquer', 'Click installation'] },
    { id: 4, title: 'JVC Villa Wall Coatings', location: 'JVC', category: 'Premium Coatings', image: 'https://images.unsplash.com/photo-1562663474-6cbb3eaa4d14?w=800&q=85', description: 'Mineral-based coatings with texture and natural finish.', features: ['Mineral based', 'Breathable', 'Texture finish', 'Anti-mold'] },
    { id: 5, title: 'Business Bay Office Stone Cladding', location: 'Business Bay', category: 'Stone Cladding', image: 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=800&q=85', description: 'Travertine stone cladding for feature walls and reception areas.', features: ['Travertine stone', 'Honed finish', 'Feature walls', 'Premium quality'] },
    { id: 6, title: 'Palm Jumeirah Outdoor Stone', location: 'Palm Jumeirah', category: 'Outdoor Paving', image: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&q=85', description: 'Weather-resistant natural stone for outdoor terraces and pool areas.', features: ['Natural stone', 'Weather resistant', 'Anti-slip', 'Salt water resistant'] },
  ],
  'furniture-soft': [
    { id: 1, title: 'Palm Jumeirah Villa Furnishing', location: 'Palm Jumeirah', category: 'Complete FF&E', image: 'https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?w=800&q=85', description: 'Complete furnishing package from living room to outdoor spaces.', features: ['Italian sofas', 'Custom dining', 'Outdoor furniture', 'Art curation'] },
    { id: 2, title: 'Downtown Penthouse Interior', location: 'Downtown Dubai', category: 'High-end Furniture', image: 'https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?w=800&q=85', description: 'Luxury furniture selection with custom pieces from European manufacturers.', features: ['European design', 'Custom pieces', 'Premium fabrics', 'Limited editions'] },
    { id: 3, title: 'Marina Apartment Sanitary Ware', location: 'Dubai Marina', category: 'Sanitary Ware', image: 'https://images.unsplash.com/photo-1552321554-5fefe8c9ef14?w=800&q=85', description: 'Premium bathroom fixtures and sanitary ware from top brands.', features: ['German brands', 'Smart fixtures', 'Rainfall showers', 'Freestanding tubs'] },
    { id: 4, title: 'Business Bay Executive Office', location: 'Business Bay', category: 'Office Decor', image: 'https://images.unsplash.com/photo-1497366754035-f200968a6e72?w=800&q=85', description: 'Premium office furniture and decor for executive suites.', features: ['Executive desks', 'Ergonomic chairs', 'Meeting tables', 'Reception furniture'] },
    { id: 5, title: 'JVC Villa Kids Rooms', location: 'JVC', category: 'Thematic Furnishing', image: 'https://images.unsplash.com/photo-1595526114035-0d45ed16cfbf?w=800&q=85', description: 'Custom designed children rooms with themed furniture and decor.', features: ['Custom themes', 'Safety features', 'Growing designs', 'Play areas'] },
    { id: 6, title: 'Jumeirah Golf Estate Villa', location: 'Jumeirah Golf Estate', category: 'Luxury Living Room', image: 'https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?w=800&q=85', description: 'Premium living room set with centerpiece furniture and ambient lighting.', features: ['Statement pieces', 'Layered lighting', 'Premium textiles', 'Custom layouts'] },
  ],
  'smart-tech': [
    { id: 1, title: 'Palm Jumeirah Smart Villa', location: 'Palm Jumeirah', category: 'Professional Lighting', image: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&q=85', description: 'Complete intelligent lighting system with scene control and automation.', features: ['Scene control', 'Color temperature', 'Motion sensors', 'App integration'] },
    { id: 2, title: 'Downtown Dubai Smart Office', location: 'Downtown Dubai', category: 'Automated Systems', image: 'https://images.unsplash.com/photo-1497366754035-f200968a6e72?w=800&q=85', description: 'Building automation with climate control, lighting, and security integration.', features: ['HVAC control', 'Smart access', 'Energy monitoring', 'Voice control'] },
    { id: 3, title: 'Marina Apartment Lighting', location: 'Dubai Marina', category: 'Ambient Lighting', image: 'https://images.unsplash.com/photo-1565814329452-e1efa11c5b89?w=800&q=85', description: 'Layered lighting design with cove lights, accent lights, and smart controls.', features: ['Cove lighting', 'Accent lights', 'Dimmable', 'Circadian rhythm'] },
    { id: 4, title: 'Business Bay Construction Tech', location: 'Business Bay', category: 'Construction Robotics', image: 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=800&q=85', description: 'Advanced construction technology with precision tools and automation.', features: ['Precision tools', '3D scanning', 'Automated cutting', 'Quality assurance'] },
    { id: 5, title: 'JVC Villa Outdoor Lighting', location: 'JVC', category: 'Landscape Lighting', image: 'https://images.unsplash.com/photo-1519681393784-d120267933ba?w=800&q=85', description: 'Professional outdoor lighting system highlighting architecture and landscaping.', features: ['LED spots', 'Path lights', 'Waterproof', 'Solar options'] },
    { id: 6, title: 'Jumeirah Smart Home Integration', location: 'Jumeirah', category: 'Full Home Automation', image: 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=800&q=85', description: 'Comprehensive smart home system with centralized control of all functions.', features: ['Central hub', 'Multi-room audio', 'Security cameras', 'Energy management'] },
  ],
};

export function getCategoryBySlug(slug: string): MaterialCategory | undefined {
  return materialCategories.find((c) => c.slug === slug);
}

export function getCaseStudiesForCategory(slug: string): MaterialCaseStudy[] {
  return caseStudiesByCategory[slug] ?? [];
}
