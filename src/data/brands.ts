export interface BrandWork {
  id: string;
  image: string;
  title: string;
  description?: string;
}

export interface Brand {
  slug: string;
  name: string;
  nameEn: string;
  tagline: string;
  intro: string;
  bannerImage: string;
  logo: string;
  works: BrandWork[];
}

export const brandsList: Brand[] = [
  {
    slug: 'huasheng-home',
    name: '华盛家居',
    nameEn: 'Huasheng Home',
    tagline: 'Premium furniture & home solutions',
    intro: 'Huasheng Home specializes in high-end furniture and whole-house customization, providing one-stop service from design to delivery for UAE residential and commercial spaces. Products include living room, bedroom, kitchen, bathroom and office furniture with reliable quality and custom options.',
    bannerImage: 'https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?w=1600&q=80',
    logo: '/images/华盛家居logo.png',
    works: [
      { id: '1', image: 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=800&q=80', title: 'Living room set', description: 'Modern sofa & coffee table' },
      { id: '2', image: 'https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?w=800&q=80', title: 'Bedroom suite', description: 'Master bedroom design' },
      { id: '3', image: 'https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?w=800&q=80', title: 'Dining collection', description: 'Dining table & chairs' },
      { id: '4', image: 'https://images.unsplash.com/photo-1617325247661-675ab4b64ae2?w=800&q=80', title: 'Office furniture', description: 'Commercial fit-out' },
      { id: '5', image: 'https://images.unsplash.com/photo-1616046229478-9901c5536a45?w=800&q=80', title: 'Custom cabinetry', description: 'Bespoke storage solutions' },
    ],
  },
  {
    slug: 'chunlei-plants',
    name: '春蕾绿植',
    nameEn: 'Chunlei Plants',
    tagline: 'Indoor & landscape greenery',
    intro: 'Chunlei Plants provides indoor and outdoor plants, landscape design and maintenance services. We offer high-quality plants and horticultural solutions for villas, hotels and office buildings, creating natural and comfortable green spaces.',
    bannerImage: 'https://images.unsplash.com/photo-1585320806297-9794b3e4eeae?w=1600&q=80',
    logo: '/images/春蕾logo.png',
    works: [
      { id: '1', image: 'https://images.unsplash.com/photo-1585320806297-9794b3e4eeae?w=800&q=80', title: 'Lobby greenery', description: 'Hotel entrance landscape' },
      { id: '2', image: 'https://images.unsplash.com/photo-1598902108854-10e335adac99?w=800&q=80', title: 'Indoor plant wall', description: 'Vertical garden installation' },
      { id: '3', image: 'https://images.unsplash.com/photo-1563241527-3004b7be0ffd?w=800&q=80', title: 'Terrace garden', description: 'Residential outdoor' },
      { id: '4', image: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&q=80', title: 'Office plants', description: 'Workspace wellness' },
      { id: '5', image: 'https://images.unsplash.com/photo-1587836374828-4dbafa94cf0e?w=800&q=80', title: 'Potted arrangements', description: 'Custom plant styling' },
    ],
  },
  {
    slug: 'yifa-doors-windows',
    name: '怡发门窗',
    nameEn: 'Yifa Doors & Windows',
    tagline: 'Doors, windows & facades',
    intro: 'Yifa Doors & Windows specializes in system doors, windows, curtain walls and building facade products. We provide energy-efficient, safe and beautiful door and window solutions for UAE residential and commercial projects, with custom sizes and configurations.',
    bannerImage: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1600&q=80',
    logo: '/images/怡发门窗logo.png',
    works: [
      { id: '1', image: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&q=80', title: 'Villa entrance', description: 'Main door & sidelights' },
      { id: '2', image: 'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=800&q=80', title: 'Sliding glass walls', description: 'Indoor-outdoor living' },
      { id: '3', image: 'https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?w=800&q=80', title: 'Commercial facade', description: 'Office building curtain wall' },
      { id: '4', image: 'https://images.unsplash.com/photo-1600573472592-401b489a3cdc?w=800&q=80', title: 'Balcony windows', description: 'High-rise installation' },
      { id: '5', image: 'https://images.unsplash.com/photo-1600566752355-35792bedcfea?w=800&q=80', title: 'Aluminium systems', description: 'Energy-efficient range' },
    ],
  },
  {
    slug: 'suofeiya-furniture',
    name: '索菲亚家具',
    nameEn: 'Suofeiya Furniture',
    tagline: 'Whole-house custom furniture',
    intro: 'Suofeiya Furniture provides whole-house custom furniture services, including wardrobes, kitchen cabinets, bookshelves and storage systems. Using eco-friendly materials and smart design to meet storage and style needs for different floor plans.',
    bannerImage: 'https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?w=1600&q=80',
    logo: '/images/索菲亚logo.png',
    works: [
      { id: '1', image: 'https://images.unsplash.com/photo-1567538096630-e0c55bd6374c?w=800&q=80', title: 'Walk-in wardrobe', description: 'Master closet design' },
      { id: '2', image: 'https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?w=800&q=80', title: 'Kitchen cabinets', description: 'Custom kitchen' },
      { id: '3', image: 'https://images.unsplash.com/photo-1616046229478-9901c5536a45?w=800&q=80', title: 'Study room', description: 'Built-in desk & shelves' },
      { id: '4', image: 'https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?w=800&q=80', title: 'TV wall unit', description: 'Living room storage' },
      { id: '5', image: 'https://images.unsplash.com/photo-1617325247661-675ab4b64ae2?w=800&q=80', title: 'Kids room', description: 'Bunk & study combo' },
    ],
  },
  {
    slug: 'mingxuan-materials',
    name: '明轩新材',
    nameEn: 'Mingxuan New Materials',
    tagline: 'Decorative & building materials',
    intro: 'Mingxuan New Materials specializes in high-end decorative and building materials, including sintered stone, tiles, natural stone, wood veneer and wall systems. We provide integrated material solutions and construction support for indoor and outdoor spaces.',
    bannerImage: 'https://images.unsplash.com/photo-1615873968403-89e068629265?w=1600&q=80',
    logo: '/images/明轩新材logo.png',
    works: [
      { id: '1', image: 'https://images.unsplash.com/photo-1615873968403-89e068629265?w=800&q=80', title: 'Marble feature wall', description: 'Living room accent' },
      { id: '2', image: 'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=800&q=80', title: 'Floor tiles', description: 'Large-format porcelain' },
      { id: '3', image: 'https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?w=800&q=80', title: 'Wood-look panels', description: 'Wall cladding' },
      { id: '4', image: 'https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?w=800&q=80', title: 'Bathroom finish', description: 'Stone & tile combo' },
      { id: '5', image: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&q=80', title: 'Facade materials', description: 'Exterior application' },
    ],
  },
];

export function getBrandBySlug(slug: string): Brand | undefined {
  return brandsList.find((b) => b.slug === slug);
}
