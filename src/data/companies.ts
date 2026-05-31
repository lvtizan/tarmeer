export interface Company {
  id: string;
  name: string;
  description: string;
  shortDescription: string;
  city: string;
  address: string;
  foundedYear: number;
  website?: string;
  instagram?: string;
  phone?: string;
  email?: string;
  styles: string[];
  projectCount: number;
  services: string[];
  featured: boolean;
  coverImage: string;
  projectImages: string[];
  portfolioCategories: Record<string, { url: string; title: string }[]>;
  isClaimed: boolean;
}

export const STYLE_OPTIONS = [
  'Modern',
  'Contemporary',
  'Luxury',
  'Minimalist',
  'Arabic',
  'Mediterranean',
  'Industrial',
  'Classic',
  'Scandinavian',
  'Bohemian',
];

export const CITY_OPTIONS = [
  'Dubai',
  'Abu Dhabi',
  'Sharjah',
  'Ajman',
  'Ras Al Khaimah',
  'Fujairah',
  'Umm Al Quwain',
];

export const SERVICE_OPTIONS = [
  'Interior Design',
  'Architecture',
  'Fit-out',
  'Furniture Design',
  'Landscape Design',
  '3D Visualization',
  'Project Management',
];

// Helper function for image paths
function coverPath(index: number): string {
  const totalAvailableCovers = 75;
  const safeIndex = ((index - 1) % totalAvailableCovers) + 1;
  return `/images/designers/projects/covers/cover-${String(safeIndex).padStart(3, '0')}.jpg`;
}

function imageSet(startIndex: number, count = 3): string[] {
  return Array.from({ length: count }, (_, i) => coverPath(startIndex + i));
}

const HBA_PORTFOLIO_IMAGES = Array.from(
  { length: 20 },
  (_, index) => `/images/uae-companies/portfolio/hba-hirsch-bedner/general/${index + 1}.jpg`
);

const BISHOP_DESIGN_IMAGES = Array.from(
  { length: 20 },
  (_, index) => `/images/uae-companies/portfolio/bishop-design/work/${index + 1}.jpg`
);

const AL_HABTOOR_DESIGN_IMAGES = [
  '/images/uae-companies/portfolio/algedra/villas-design/11.jpg',
  '/images/uae-companies/portfolio/algedra/villas-design/12.jpg',
  '/images/uae-companies/portfolio/algedra/villas-design/13.jpg',
  '/images/uae-companies/portfolio/algedra/villas-design/14.jpg',
  '/images/uae-companies/portfolio/algedra/villas-design/15.jpg',
];

const LW_DESIGN_IMAGES = [
  '/images/uae-companies/portfolio/accouter-design/interior/10.png',
  '/images/uae-companies/portfolio/accouter-design/interior/13.jpg',
  '/images/uae-companies/portfolio/accouter-design/interior/15.png',
  '/images/uae-companies/portfolio/accouter-design/interior/17.png',
  '/images/uae-companies/portfolio/accouter-design/interior/19.jpg',
];

const ROCHE_BOBOIS_DUBAI_IMAGES = [
  '/images/uae-companies/portfolio/livspace-dubai/interior/10.jpg',
  '/images/uae-companies/portfolio/livspace-dubai/interior/16.jpg',
  '/images/uae-companies/portfolio/livspace-dubai/interior/17.jpg',
  '/images/uae-companies/portfolio/livspace-dubai/interior/18.jpg',
  '/images/uae-companies/portfolio/livspace-dubai/interior/19.jpg',
];

// UAE design companies data - featuring companies from across all emirates
export const companies: Company[] = [
  {
    id: 'bishop-design',
    name: 'Bishop Design',
    description: 'Award-winning interior design studio specializing in hospitality, residential, and commercial projects across the Middle East. Led by Paul Bishop, the studio creates bold, immersive spaces that tell stories through design.',
    shortDescription: 'Award-winning hospitality and residential design studio creating bold, immersive spaces across the Middle East.',
    city: 'Dubai',
    address: 'Office 201, The Column, Dubai Media City, Dubai, UAE',
    foundedYear: 2007,
    website: 'https://bishopdesign.com',
    instagram: 'bishopdesignuae',
    phone: '+971 4 427 6000',
    email: 'info@bishopdesign.com',
    styles: ['Modern', 'Contemporary', 'Luxury'],
    projectCount: 150,
    services: ['Interior Design', 'Architecture', 'Fit-out', 'Project Management'],
    featured: true,
    coverImage: BISHOP_DESIGN_IMAGES[10],
    projectImages: BISHOP_DESIGN_IMAGES,
    isClaimed: false,
    portfolioCategories: { Work: BISHOP_DESIGN_IMAGES.map(url => ({ url, title: '' })) },
  },
  {
    id: 'al-habtoor-design',
    name: 'Al Habtoor Design',
    description: 'Leading Abu Dhabi-based design firm specializing in luxury residential and commercial interiors. Known for integrating Arabic heritage with contemporary design principles.',
    shortDescription: 'Abu Dhabi-based firm specializing in luxury interiors blending Arabic heritage with contemporary design.',
    city: 'Abu Dhabi',
    address: 'Corniche Road, Abu Dhabi, UAE',
    foundedYear: 2008,
    website: 'https://alhabtoordesign.ae',
    instagram: 'alhabtoordesign',
    phone: '+971 2 666 8888',
    email: 'info@alhabtoordesign.ae',
    styles: ['Arabic', 'Luxury', 'Contemporary'],
    projectCount: 110,
    services: ['Interior Design', 'Architecture', 'Fit-out', 'Project Management'],
    featured: true,
    coverImage: AL_HABTOOR_DESIGN_IMAGES[0],
    projectImages: AL_HABTOOR_DESIGN_IMAGES,
    isClaimed: false,
    portfolioCategories: { Projects: AL_HABTOOR_DESIGN_IMAGES.map(url => ({ url, title: '' })) },
  },
  {
    id: 'lw-design',
    name: 'LW Design',
    description: 'Leading interior design studio in Dubai specializing in residential, commercial, and hospitality projects. Known for creating sophisticated, functional spaces that reflect client personalities and lifestyles.',
    shortDescription: 'Leading Dubai studio creating sophisticated residential, commercial and hospitality interiors.',
    city: 'Dubai',
    address: 'Al Quoz 3, Dubai, UAE',
    foundedYear: 2009,
    website: 'https://lw-design.com',
    instagram: 'lwdesigndubai',
    phone: '+971 4 340 8800',
    email: 'info@lw-design.com',
    styles: ['Modern', 'Minimalist', 'Contemporary'],
    projectCount: 95,
    services: ['Interior Design', 'Fit-out', 'Project Management'],
    featured: true,
    coverImage: LW_DESIGN_IMAGES[0],
    projectImages: LW_DESIGN_IMAGES,
    isClaimed: false,
    portfolioCategories: { Projects: LW_DESIGN_IMAGES.map(url => ({ url, title: '' })) },
  },
  {
    id: 'sharjah-creative',
    name: 'Sharjah Creative Studio',
    description: 'Award-winning design studio in the heart of Sharjah. Specializes in cultural and educational spaces, blending traditional Islamic design with modern functionality.',
    shortDescription: 'Sharjah-based studio specializing in cultural and educational space design with Islamic influences.',
    city: 'Sharjah',
    address: 'Al Majaz, Sharjah, UAE',
    foundedYear: 2011,
    website: 'https://sharjahcreative.ae',
    instagram: 'sharjahcreative',
    phone: '+971 6 555 1234',
    email: 'info@sharjahcreative.ae',
    styles: ['Arabic', 'Classic', 'Contemporary'],
    projectCount: 65,
    services: ['Interior Design', 'Architecture', '3D Visualization'],
    featured: true,
    coverImage: coverPath(16),
    projectImages: imageSet(16, 5),
    isClaimed: false,
    portfolioCategories: { Projects: imageSet(16, 5).map(url => ({ url, title: '' })) },
  },
  {
    id: 'roche-bobois',
    name: 'Roche Bobois Dubai',
    description: 'Premium French furniture brand offering exclusive interior design services alongside their luxury furniture collections. Specializes in creating sophisticated, contemporary living spaces with European elegance.',
    shortDescription: 'Premium French furniture brand with exclusive interior design services for sophisticated living spaces.',
    city: 'Dubai',
    address: 'Unit 1, Umm Suqeim Road, Al Manara, Dubai, UAE',
    foundedYear: 2010,
    website: 'https://roche-bobois.com',
    instagram: 'rochebobois_dubai',
    phone: '+971 4 394 5355',
    email: 'dubai@roche-bobois.com',
    styles: ['Luxury', 'Contemporary', 'Classic'],
    projectCount: 80,
    services: ['Interior Design', 'Furniture Design', 'Project Management'],
    featured: false,
    coverImage: ROCHE_BOBOIS_DUBAI_IMAGES[0],
    projectImages: ROCHE_BOBOIS_DUBAI_IMAGES,
    isClaimed: false,
    portfolioCategories: { Projects: ROCHE_BOBOIS_DUBAI_IMAGES.map(url => ({ url, title: '' })) },
  },
  {
    id: 'hba',
    name: 'Hirsch Bedner Associates (HBA)',
    description: 'Global hospitality design leader with Dubai office creating world-class hotel interiors. Part of the world\'s leading hospitality design firm with decades of experience in luxury hotel and resort design.',
    shortDescription: 'Global hospitality design leader creating world-class hotel interiors and luxury resorts.',
    city: 'Dubai',
    address: 'The Gate, Dubai International Financial Centre, Dubai, UAE',
    foundedYear: 2012,
    website: 'https://hba.com',
    instagram: 'hbirginadubai',
    phone: '+971 4 362 8400',
    email: 'dubai@hba.com',
    styles: ['Luxury', 'Modern', 'Contemporary'],
    projectCount: HBA_PORTFOLIO_IMAGES.length,
    services: ['Interior Design', 'Architecture', 'Project Management'],
    featured: false,
    coverImage: HBA_PORTFOLIO_IMAGES[0],
    projectImages: HBA_PORTFOLIO_IMAGES,
    isClaimed: false,
    portfolioCategories: { General: HBA_PORTFOLIO_IMAGES.map(url => ({ url, title: '' })) },
  },
  {
    id: 'zen-interiors',
    name: 'Zen Interior',
    description: 'Full-service interior design company specializing in residential and commercial projects. Offers complete turnkey solutions from concept to completion with focus on minimalist and Zen-inspired aesthetics.',
    shortDescription: 'Full-service design company offering turnkey residential and commercial interiors with Zen-inspired aesthetics.',
    city: 'Dubai',
    address: 'Jumeirah Lake Towers, Dubai, UAE',
    foundedYear: 2014,
    website: 'https://zeninterior.ae',
    instagram: 'zeninterior',
    phone: '+971 4 450 7500',
    email: 'info@zeninterior.ae',
    styles: ['Minimalist', 'Modern', 'Contemporary'],
    projectCount: 60,
    services: ['Interior Design', 'Fit-out', 'Furniture Design'],
    featured: false,
    coverImage: coverPath(31),
    projectImages: imageSet(31, 5),
    isClaimed: false,
    portfolioCategories: { Projects: imageSet(31, 5).map(url => ({ url, title: '' })) },
  },
  {
    id: 'eclectic-interiors',
    name: 'Eclectic Interiors',
    description: 'Boutique design studio known for creating unique, personalized spaces that blend various design styles. Specializes in high-end residential interiors with attention to detail and craftsmanship.',
    shortDescription: 'Boutique studio creating unique, personalized high-end residential spaces with exceptional craftsmanship.',
    city: 'Dubai',
    address: 'Alserkal Avenue, Al Quoz, Dubai, UAE',
    foundedYear: 2016,
    website: 'https://eclecticinteriors.ae',
    instagram: 'eclecticinteriorsdubai',
    phone: '+971 4 380 9900',
    email: 'hello@eclecticinteriors.ae',
    styles: ['Contemporary', 'Bohemian', 'Modern'],
    projectCount: 40,
    services: ['Interior Design', 'Furniture Design', 'Soft Decoration'],
    featured: false,
    coverImage: coverPath(36),
    projectImages: imageSet(36, 5),
    isClaimed: false,
    portfolioCategories: { Projects: imageSet(36, 5).map(url => ({ url, title: '' })) },
  },
  {
    id: 'nx-architecture',
    name: 'NX Architecture',
    description: 'Architecture and design studio focusing on innovative residential and commercial projects. Known for modern, sustainable designs that respond to local climate and culture.',
    shortDescription: 'Architecture studio creating innovative, sustainable residential and commercial designs.',
    city: 'Dubai',
    address: 'Dubai Design District (d3), Dubai, UAE',
    foundedYear: 2013,
    website: 'https://nxarch.ae',
    instagram: 'nxarch',
    phone: '+971 4 555 1234',
    email: 'info@nxarch.ae',
    styles: ['Modern', 'Contemporary', 'Industrial'],
    projectCount: 55,
    services: ['Architecture', 'Interior Design', '3D Visualization'],
    featured: false,
    coverImage: coverPath(41),
    projectImages: imageSet(41, 5),
    isClaimed: false,
    portfolioCategories: { Projects: imageSet(41, 5).map(url => ({ url, title: '' })) },
  },
  {
    id: 'artesian-interiors',
    name: 'Artesian Interiors',
    description: 'Luxury interior design firm specializing in high-end residential and commercial projects. Known for Arabic-inspired contemporary designs with opulent materials and finishes.',
    shortDescription: 'Luxury firm specializing in Arabic-inspired contemporary designs with opulent materials and finishes.',
    city: 'Dubai',
    address: 'Sheikh Zayed Road, Dubai, UAE',
    foundedYear: 2011,
    website: 'https://artesianinteriors.com',
    instagram: 'artesianinteriors',
    phone: '+971 4 331 5600',
    email: 'info@artesianinteriors.com',
    styles: ['Arabic', 'Luxury', 'Contemporary'],
    projectCount: 70,
    services: ['Interior Design', 'Fit-out', 'Furniture Design'],
    featured: false,
    coverImage: coverPath(46),
    projectImages: imageSet(46, 5),
    isClaimed: false,
    portfolioCategories: { Projects: imageSet(46, 5).map(url => ({ url, title: '' })) },
  },
  {
    id: 'punch-consultants',
    name: 'PUNCH Consultants',
    description: 'Multi-disciplinary design firm offering architecture, interior design, and landscape architecture services. Known for sustainable, context-sensitive designs across the UAE.',
    shortDescription: 'Multi-disciplinary firm offering architecture, interior and landscape design with sustainable focus.',
    city: 'Dubai',
    address: 'Business Bay, Dubai, UAE',
    foundedYear: 2010,
    website: 'https://punchconsultants.com',
    instagram: 'punchconsultants',
    phone: '+971 4 454 2400',
    email: 'info@punchconsultants.com',
    styles: ['Modern', 'Contemporary', 'Mediterranean'],
    projectCount: 75,
    services: ['Interior Design', 'Architecture', 'Landscape Design', 'Project Management'],
    featured: false,
    coverImage: coverPath(51),
    projectImages: imageSet(51, 5),
    isClaimed: false,
    portfolioCategories: { Projects: imageSet(51, 5).map(url => ({ url, title: '' })) },
  },
  {
    id: 'marcel-wanders',
    name: 'Marcel Wanders Studio',
    description: 'Internationally acclaimed design studio founded by Marcel Wanders. Known for creating iconic furniture and interior designs that blend art, design, and craftsmanship in unique ways.',
    shortDescription: 'Internationally acclaimed design studio creating iconic furniture and interiors that blend art and craftsmanship.',
    city: 'Dubai',
    address: 'Downtown Dubai, Boulevard Plaza, Dubai, UAE',
    foundedYear: 2015,
    website: 'https://marcelwanders.com',
    instagram: 'marcelwanders',
    phone: '+971 4 450 5500',
    email: 'info@marcelwanders.com',
    styles: ['Contemporary', 'Luxury', 'Modern'],
    projectCount: 45,
    services: ['Interior Design', 'Furniture Design', '3D Visualization'],
    featured: false,
    coverImage: coverPath(56),
    projectImages: imageSet(56, 5),
    isClaimed: false,
    portfolioCategories: { Projects: imageSet(56, 5).map(url => ({ url, title: '' })) },
  },
  {
    id: 'capital-design',
    name: 'Capital Design Studio',
    description: 'Abu Dhabi\'s premier design studio focusing on government and commercial projects. Expert in creating functional yet impressive spaces for corporate clients.',
    shortDescription: 'Premier Abu Dhabi studio focusing on government and commercial design projects.',
    city: 'Abu Dhabi',
    address: 'Al Maryah Island, Abu Dhabi, UAE',
    foundedYear: 2012,
    website: 'https://capitaldesign.ae',
    instagram: 'capitaldesignstudio',
    phone: '+971 2 612 3456',
    email: 'info@capitaldesign.ae',
    styles: ['Modern', 'Contemporary', 'Industrial'],
    projectCount: 85,
    services: ['Interior Design', 'Architecture', 'Project Management'],
    featured: false,
    coverImage: coverPath(61),
    projectImages: imageSet(61, 5),
    isClaimed: false,
    portfolioCategories: { Projects: imageSet(61, 5).map(url => ({ url, title: '' })) },
  },
  {
    id: 'saadiyat-interiors',
    name: 'Saadiyat Interiors',
    description: 'Boutique design firm on Saadiyat Island specializing in high-end residential projects. Known for sophisticated, minimalist designs with natural materials.',
    shortDescription: 'Boutique Saadiyat Island firm specializing in high-end residential minimalist design.',
    city: 'Abu Dhabi',
    address: 'Saadiyat Island, Abu Dhabi, UAE',
    foundedYear: 2016,
    website: 'https://saadiyatinteriors.ae',
    instagram: 'saadiyatinteriors',
    phone: '+971 2 555 6789',
    email: 'hello@saadiyatinteriors.ae',
    styles: ['Minimalist', 'Luxury', 'Modern'],
    projectCount: 35,
    services: ['Interior Design', 'Furniture Design', 'Soft Decoration'],
    featured: false,
    coverImage: coverPath(66),
    projectImages: imageSet(66, 5),
    isClaimed: false,
    portfolioCategories: { Projects: imageSet(66, 5).map(url => ({ url, title: '' })) },
  },
  {
    id: 'al-noor-design',
    name: 'Al Noor Design',
    description: 'Family-run design firm serving Sharjah and Northern Emirates. Known for affordable yet stylish residential interiors with Arabic influences.',
    shortDescription: 'Family-run Sharjah firm offering affordable stylish residential interiors with Arabic influences.',
    city: 'Sharjah',
    address: 'Al Taawun, Sharjah, UAE',
    foundedYear: 2013,
    website: 'https://alnoordesign.ae',
    instagram: 'alnoordesign',
    phone: '+971 6 544 5678',
    email: 'info@alnoordesign.ae',
    styles: ['Arabic', 'Modern', 'Contemporary'],
    projectCount: 78,
    services: ['Interior Design', 'Fit-out', 'Furniture Design'],
    featured: false,
    coverImage: coverPath(71),
    projectImages: imageSet(71, 5),
    isClaimed: false,
    portfolioCategories: { Projects: imageSet(71, 5).map(url => ({ url, title: '' })) },
  },
  {
    id: 'ajman-modern',
    name: 'Ajman Modern Interiors',
    description: 'Leading design firm in Ajman specializing in villa and apartment renovations. Known for modern practical designs that suit local lifestyle.',
    shortDescription: 'Ajman\'s leading firm specializing in villa and apartment renovations with modern practical designs.',
    city: 'Ajman',
    address: 'Al Rashidiya, Ajman, UAE',
    foundedYear: 2014,
    website: 'https://ajmanmodern.ae',
    instagram: 'ajmanmodern',
    phone: '+971 6 744 2345',
    email: 'info@ajmanmodern.ae',
    styles: ['Modern', 'Contemporary', 'Minimalist'],
    projectCount: 55,
    services: ['Interior Design', 'Fit-out', 'Project Management'],
    featured: false,
    coverImage: coverPath(1),
    projectImages: imageSet(1, 5),
    isClaimed: false,
    portfolioCategories: { Projects: imageSet(1, 5).map(url => ({ url, title: '' })) },
  },
  {
    id: 'rak-coastal',
    name: 'RAK Coastal Design',
    description: 'Design studio in Ras Al Khaimah specializing in waterfront properties and resorts. Creates breezy, coastal-inspired interiors perfect for beach living.',
    shortDescription: 'RAK-based studio specializing in waterfront properties and coastal-inspired resort designs.',
    city: 'Ras Al Khaimah',
    address: 'Al Hamra Village, Ras Al Khaimah, UAE',
    foundedYear: 2015,
    website: 'https://rakcoastal.ae',
    instagram: 'rakcoastaldesign',
    phone: '+971 7 233 4567',
    email: 'info@rakcoastal.ae',
    styles: ['Mediterranean', 'Contemporary', 'Minimalist'],
    projectCount: 42,
    services: ['Interior Design', 'Architecture', 'Landscape Design'],
    featured: false,
    coverImage: coverPath(11),
    projectImages: imageSet(11, 5),
    isClaimed: false,
    portfolioCategories: { Projects: imageSet(11, 5).map(url => ({ url, title: '' })) },
  },
  {
    id: 'fujairah-hills',
    name: 'Fujairah Hills Design',
    description: 'Mountain and villa design specialists in Fujairah. Known for creating spaces that connect with the natural landscape and mountain views.',
    shortDescription: 'Fujairah-based specialists in mountain villas that connect with natural landscapes.',
    city: 'Fujairah',
    address: 'Fujairah City, Fujairah, UAE',
    foundedYear: 2017,
    website: 'https://fujairahhills.ae',
    instagram: 'fujairahhills',
    phone: '+971 9 222 8901',
    email: 'info@fujairahhills.ae',
    styles: ['Modern', 'Mediterranean', 'Contemporary'],
    projectCount: 28,
    services: ['Interior Design', 'Architecture', 'Landscape Design'],
    featured: false,
    coverImage: coverPath(21),
    projectImages: imageSet(21, 5),
    isClaimed: false,
    portfolioCategories: { Projects: imageSet(21, 5).map(url => ({ url, title: '' })) },
  },
];

export function getCompanyById(id: string): Company | undefined {
  return companies.find((c) => c.id === id);
}

export function getFeaturedCompanies(limit = 4): Company[] {
  // Get featured companies, ensuring diverse representation from different emirates
  const featured = companies.filter((c) => c.featured);
  // If we have fewer featured than requested, fill with other companies
  if (featured.length < limit) {
    const others = companies.filter((c) => !c.featured);
    return [...featured, ...others.slice(0, limit - featured.length)];
  }
  return featured.slice(0, limit);
}

export function getCompaniesByFilter(filters: {
  city?: string;
  styles?: string[];
  services?: string[];
  foundedRange?: string;
  searchQuery?: string;
}): Company[] {
  return companies.filter((company) => {
    if (filters.searchQuery) {
      const query = filters.searchQuery.toLowerCase();
      if (!company.name.toLowerCase().includes(query) &&
          !company.description.toLowerCase().includes(query)) {
        return false;
      }
    }

    if (filters.city && company.city !== filters.city) {
      return false;
    }

    if (filters.styles && filters.styles.length > 0) {
      if (!filters.styles.some(s => company.styles.includes(s))) {
        return false;
      }
    }

    if (filters.services && filters.services.length > 0) {
      if (!filters.services.some(s => company.services.includes(s))) {
        return false;
      }
    }

    if (filters.foundedRange) {
      const [min, max] = filters.foundedRange.split('-').map(Number);
      if (max) {
        if (company.foundedYear < min || company.foundedYear > max) {
          return false;
        }
      } else {
        if (company.foundedYear < min) {
          return false;
        }
      }
    }

    return true;
  });
}
