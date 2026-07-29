// PARBRO art flooring — product catalogue data (extracted from the manufacturer's PDF
// via the pdf-catalog-extract skill). Images live at
// public/images/flooring/<series>/<code>-{board,room,detail}.webp (FSRCNN 2x, detail kept sharp).
// All display text is English (no Chinese on the site). Add series/products by appending below.

export type FloorProduct = {
  code: string;
  series: string; // series slug
  wood: string; // surface wood species (English)
  size: string; // panel size(s), mm
  finish: string; // surface / edge finish (English)
};

export type FloorSeries = {
  slug: string;
  nameEn: string;
  blurb: string;
  cover: string; // a product board image used as the collection cover
};

export const BRAND = {
  nameEn: 'PARBRO',
  displayName: 'PARBRO Art Flooring',
  tagline: 'Art parquet & engineered wood flooring',
};

export const SERIES: FloorSeries[] = [
  {
    slug: 'parquet',
    nameEn: 'Floral',
    blurb: 'Geometric oak, walnut and teak parquet panels — brushed, grooved and metal-finish artistry.',
    cover: '/images/flooring/parquet/5101-board.webp',
  },
  {
    slug: 'alien',
    nameEn: 'Alien Puzzle',
    blurb: 'Irregular geometric parquet — oak and walnut puzzle panels, several inlaid with solid brass.',
    cover: '/images/flooring/alien/MY001-1-board.webp',
  },
];

// Floral parquet — 38 designs (PDF pages 5-42)
export const PRODUCTS: FloorProduct[] = [
  { code: '5101', series: 'parquet', wood: 'Oak parquet', size: '600×600×15 / 1.2mm', finish: 'Brushed & grooved' },
  { code: '5103', series: 'parquet', wood: 'Oak parquet', size: '600×600×15 / 1.2mm', finish: 'Brushed & grooved' },
  { code: '5105', series: 'parquet', wood: 'Oak parquet', size: '600×600×15 / 1.2mm', finish: 'Brushed & grooved' },
  { code: '5106', series: 'parquet', wood: 'Oak parquet', size: '600×600×15 / 1.2mm', finish: 'Brushed & grooved' },
  { code: '5973', series: 'parquet', wood: 'Teak multi-layer parquet', size: '600×600×15 / 1.2mm', finish: 'Grooved' },
  { code: '5975', series: 'parquet', wood: 'Oak parquet', size: '600×600×15 / 1.2mm', finish: 'Natural brushed' },
  { code: '5976', series: 'parquet', wood: 'Oak parquet', size: '600×600×15 / 1.2mm', finish: 'Cream brushed' },
  { code: '5977', series: 'parquet', wood: 'Oak parquet', size: '600×600×15 / 1.2mm', finish: 'Black brushed' },
  { code: '5978', series: 'parquet', wood: 'Walnut parquet', size: '600×600×15 / 1.2mm', finish: 'Grooved' },
  { code: '5979', series: 'parquet', wood: 'Oak parquet', size: '600×600×15 / 1.2mm', finish: 'Brushed & grooved' },
  { code: '5982', series: 'parquet', wood: 'Red oak 3-layer parquet', size: '600×600×15 / 1.2mm', finish: 'Brushed' },
  { code: '5983', series: 'parquet', wood: 'Ash 3-layer parquet', size: '600×600×15 / 1.2mm', finish: 'Brushed' },
  { code: '5985', series: 'parquet', wood: 'White oak 3-layer parquet', size: '600×600×15 / 1.2mm', finish: 'Brushed' },
  { code: '5986', series: 'parquet', wood: 'Two-tone walnut 3-layer parquet', size: '600×600×15 / 1.2mm', finish: 'Brushed' },
  { code: '5988', series: 'parquet', wood: 'Oak multi-layer parquet', size: '600×600×15 / 1.2mm', finish: 'Brushed & grooved' },
  { code: '5989', series: 'parquet', wood: 'Walnut parquet', size: '600×600×15 / 1.2mm', finish: 'Grooved' },
  { code: '5991', series: 'parquet', wood: 'Oak + rosewood + shell', size: '600×600×15mm', finish: 'Metallic lacquer' },
  { code: '5999', series: 'parquet', wood: 'European oak multi-layer parquet', size: '600×600×15 / 3.0mm', finish: 'Brushed & grooved' },
  { code: '5966', series: 'parquet', wood: 'Walnut', size: '600×600×15mm', finish: 'Flat brushed' },
  { code: '5950', series: 'parquet', wood: 'Walnut parquet', size: '600×600×15mm', finish: 'Grooved' },
  { code: '5970', series: 'parquet', wood: 'Oak', size: '600×600×15mm', finish: 'Brushed' },
  { code: 'HP10', series: 'parquet', wood: 'Oak parquet', size: '600×600×15 / 1.2mm', finish: 'Birch core' },
  { code: 'HP11', series: 'parquet', wood: 'Oak parquet', size: '600×600×15 / 1.2mm', finish: 'Birch core' },
  { code: 'HP12', series: 'parquet', wood: 'Walnut parquet', size: '600×600×15 / 1.2mm', finish: 'Birch core' },
  { code: 'HP13', series: 'parquet', wood: 'Walnut parquet', size: '600×600×15 / 1.2mm', finish: 'Birch core' },
  { code: 'HP15', series: 'parquet', wood: 'Teak parquet', size: '600×600×15 / 1.2mm', finish: 'Birch core' },
  { code: 'HP16', series: 'parquet', wood: 'Padauk parquet', size: '600×600×15 / 1.2mm', finish: 'Birch core' },
  { code: 'HP17', series: 'parquet', wood: 'Red oak parquet', size: '600×600×15 / 1.2mm', finish: 'Birch core' },
  { code: 'HP18', series: 'parquet', wood: 'Ash parquet', size: '600×600×15 / 1.2mm', finish: 'Birch core' },
  { code: 'HP20', series: 'parquet', wood: 'Wenge parquet', size: '600×600×15 / 1.2mm', finish: 'Birch core' },
  { code: 'HP19', series: 'parquet', wood: 'Ash parquet', size: '600×600×15 / 1.2mm', finish: 'Birch core' },
  { code: 'HP21', series: 'parquet', wood: 'Oak parquet', size: '600×600×15 / 1.2mm', finish: 'Birch core' },
  { code: 'HP22', series: 'parquet', wood: 'Walnut parquet', size: '600×600×15 / 1.2mm', finish: 'Birch core' },
  { code: 'QHP61', series: 'parquet', wood: 'Oak diamond parquet (imported birch core)', size: '600×600×14.5 / 1.2mm', finish: 'Natural, imported birch core' },
  { code: 'QHP62', series: 'parquet', wood: 'Oak diamond parquet (imported birch core)', size: '600×600×14.5 / 1.2mm', finish: 'Imported birch core' },
  { code: 'QHP63', series: 'parquet', wood: 'Oak diamond parquet (imported birch core)', size: '600×600×14.5 / 1.2mm', finish: 'Imported birch core' },
  { code: 'QHP65', series: 'parquet', wood: 'Walnut diamond parquet (imported birch core)', size: '600×600×14.5 / 1.2mm', finish: 'Imported birch core' },
  { code: 'QHP66', series: 'parquet', wood: 'Teak parquet (imported birch core)', size: '600×600×14.5 / 1.2mm', finish: 'Imported birch core' },

  // Alien Puzzle — 55 designs (PDF pages 4-58), all flat-lock joint
  { code: 'MY001-1', series: 'alien', wood: 'Walnut', size: '181×181×14 / 256×128×14 / 362×181×14', finish: 'Flat-lock joint' },
  { code: 'MY001-2', series: 'alien', wood: 'Walnut', size: '181×181×14 / 256×128×14 / 362×181×14', finish: 'Flat-lock joint' },
  { code: 'MY001-3', series: 'alien', wood: 'Oak', size: '181×181×14 / 256×128×14 / 362×181×14', finish: 'Flat-lock joint' },
  { code: 'MY001-4', series: 'alien', wood: 'Oak', size: '181×181×14 / 256×128×14 / 362×181×14', finish: 'Flat-lock joint' },
  { code: 'MY001-5', series: 'alien', wood: 'Oak', size: '190×190×15/4 / 269×134.5×15/4 / 380×190×15/4', finish: 'Flat-lock joint' },
  { code: 'MY002-1', series: 'alien', wood: 'Walnut', size: '439×190×14', finish: 'Flat-lock joint' },
  { code: 'MY002-2', series: 'alien', wood: 'Walnut', size: '439×190×14', finish: 'Flat-lock joint' },
  { code: 'MY002-4', series: 'alien', wood: 'Oak', size: '439×190×14', finish: 'Flat-lock joint' },
  { code: 'MY003-4', series: 'alien', wood: 'Oak', size: '291×252×14', finish: 'Flat-lock joint' },
  { code: 'MY004-1', series: 'alien', wood: 'Walnut', size: '333×192×14', finish: 'Flat-lock joint' },
  { code: 'MY004-3', series: 'alien', wood: 'Oak', size: '333×192×14', finish: 'Flat-lock joint' },
  { code: 'MY004-4', series: 'alien', wood: 'Oak', size: '333×192×14', finish: 'Flat-lock joint' },
  { code: 'MY004-6', series: 'alien', wood: 'Walnut', size: '369×213×14/2', finish: 'Flat-lock joint' },
  { code: 'MY004-9', series: 'alien', wood: 'Walnut', size: '369×213', finish: 'Flat-lock joint' },
  { code: 'MY005-3', series: 'alien', wood: 'Walnut', size: '190×190×14', finish: 'Flat-lock joint' },
  { code: 'MY006-3', series: 'alien', wood: 'Oak', size: '200×173×14', finish: 'Flat-lock joint' },
  { code: 'MY006-4', series: 'alien', wood: 'Oak', size: '200×173×14', finish: 'Flat-lock joint' },
  { code: 'MY007-1', series: 'alien', wood: 'Walnut', size: '366×160×14', finish: 'Flat-lock joint' },
  { code: 'MY007-2', series: 'alien', wood: 'Walnut', size: '366×160×14', finish: 'Flat-lock joint' },
  { code: 'MY007-3', series: 'alien', wood: 'Oak', size: '366×160×14', finish: 'Flat-lock joint' },
  { code: 'MY007-4', series: 'alien', wood: 'Oak', size: '366×160×14', finish: 'Flat-lock joint' },
  { code: 'MY008-1', series: 'alien', wood: 'Walnut', size: '398×273×14', finish: 'Flat-lock joint' },
  { code: 'MY008-2', series: 'alien', wood: 'Walnut', size: '398×273×14', finish: 'Flat-lock joint' },
  { code: 'MY009-1', series: 'alien', wood: 'Walnut', size: '750×750×14', finish: 'Flat-lock joint' },
  { code: 'MY009-2', series: 'alien', wood: 'Walnut', size: '750×750×14', finish: 'Flat-lock joint' },
  { code: 'MY009-3', series: 'alien', wood: 'Oak', size: '750×750×14', finish: 'Flat-lock joint' },
  { code: 'MY009-4', series: 'alien', wood: 'Oak', size: '750×750×14', finish: 'Flat-lock joint' },
  { code: 'MY010-1', series: 'alien', wood: 'Walnut', size: '600×92×14', finish: 'Flat-lock joint' },
  { code: 'MY010-2', series: 'alien', wood: 'Walnut', size: '600×92×14', finish: 'Flat-lock joint' },
  { code: 'MY011-1', series: 'alien', wood: 'Walnut', size: '550×75×14', finish: 'Flat-lock joint' },
  { code: 'MY011-2', series: 'alien', wood: 'Walnut', size: '550×75×14', finish: 'Flat-lock joint' },
  { code: 'MY011-3', series: 'alien', wood: 'Oak', size: '550×75×14', finish: 'Flat-lock joint' },
  { code: 'MY011-4', series: 'alien', wood: 'Oak', size: '550×75×14', finish: 'Flat-lock joint' },
  { code: 'MY012-1', series: 'alien', wood: 'Walnut', size: '291×252×14 / 430×254×14', finish: 'Flat-lock joint' },
  { code: 'MY012-2', series: 'alien', wood: 'Walnut', size: '291×252×14 / 430×254×14', finish: 'Flat-lock joint' },
  { code: 'MY012-4', series: 'alien', wood: 'Oak', size: '291×252×14 / 430×254×14', finish: 'Flat-lock joint' },
  { code: 'MY013-3', series: 'alien', wood: 'Oak', size: '181×181×14', finish: 'Flat-lock joint' },
  { code: 'MY013-4', series: 'alien', wood: 'Oak', size: '181×181×14', finish: 'Flat-lock joint' },
  { code: 'MY015-3', series: 'alien', wood: 'Oak', size: '210×182×14', finish: 'Flat-lock joint' },
  { code: 'MY015-4', series: 'alien', wood: 'Oak', size: '210×182×14', finish: 'Flat-lock joint' },
  { code: 'MY016-1', series: 'alien', wood: 'Walnut', size: '800×120×14', finish: 'Flat-lock joint' },
  { code: 'MY016-2', series: 'alien', wood: 'Walnut', size: '800×120×14', finish: 'Flat-lock joint' },
  { code: 'MY016-3', series: 'alien', wood: 'Oak', size: '800×120×14', finish: 'Flat-lock joint' },
  { code: 'MY016-4', series: 'alien', wood: 'Oak', size: '800×120×14', finish: 'Flat-lock joint' },
  { code: 'MY018-1', series: 'alien', wood: 'Walnut', size: '385×255×14 / 364×92×14', finish: 'Flat-lock joint' },
  { code: 'MY018-2', series: 'alien', wood: 'Walnut', size: '385×255×14 / 364×92×14', finish: 'Flat-lock joint' },
  { code: 'MY018-3', series: 'alien', wood: 'Oak', size: '385×255×14 / 364×92×14', finish: 'Flat-lock joint' },
  { code: 'MY018-4', series: 'alien', wood: 'Oak', size: '385×255×14 / 364×92×14', finish: 'Flat-lock joint' },
  { code: 'MY019-1', series: 'alien', wood: 'Walnut', size: '300×300×14', finish: 'Flat-lock joint' },
  { code: 'MY019-2', series: 'alien', wood: 'Walnut', size: '300×300×14', finish: 'Flat-lock joint' },
  { code: 'MY021-1', series: 'alien', wood: 'Oak', size: '559×395×15/4', finish: 'Flat-lock joint' },
  { code: 'MY-7501', series: 'alien', wood: 'Walnut + solid brass inlay', size: '750×750×15/3', finish: 'Flat-lock joint' },
  { code: 'MY-7502', series: 'alien', wood: 'Walnut + solid brass inlay', size: '750×750×15/3', finish: 'Flat-lock joint' },
  { code: 'MY-7506', series: 'alien', wood: 'Oak + solid brass inlay', size: '750×750×15/4', finish: 'Flat-lock joint' },
  { code: 'MY-7508', series: 'alien', wood: 'Walnut', size: '750×750×15/1.2', finish: 'Flat-lock joint' },
];

export const getSeries = (slug: string) => SERIES.find((s) => s.slug === slug);
export const productsOf = (slug: string) => PRODUCTS.filter((p) => p.series === slug);
export const getProduct = (series: string, code: string) =>
  PRODUCTS.find((p) => p.series === series && p.code.toLowerCase() === code.toLowerCase());
export const imgOf = (p: FloorProduct, kind: 'board' | 'room' | 'detail') =>
  `/images/flooring/${p.series}/${p.code}-${kind}.webp`;

// ─────────────────────────────────────────────────────────────────────────
// SEO 中枢（内容页/图片关键词最大化，面向 UAE/中东市场，全英文）
// 主题词：中东&中国建材 / 新材料 / 瓷砖 / 上门·到店选材 / 木地板拼花
// ─────────────────────────────────────────────────────────────────────────

/** 全站通用目标关键词（keywords meta + 内容锚点） */
export const FLOOR_KEYWORDS = [
  'building materials UAE',
  'China building materials',
  'Middle East building materials',
  'new materials Dubai',
  'parquet flooring UAE',
  'wood flooring Dubai',
  'engineered wood flooring',
  'floor tiles UAE',
  'tiles Dubai',
  'art parquet',
  'herringbone flooring',
  'oak flooring',
  'walnut flooring',
  'teak flooring',
  'material selection center Dubai',
  'on-site material selection',
  'sourcing materials from China',
  'PARBRO flooring',
  'Tarmeer materials',
];

/** 每张产品图的 SEO alt（描述性 + 关键词，禁止用通用 alt） */
export const altOf = (p: FloorProduct, kind: 'board' | 'room' | 'detail') => {
  const phrase = {
    board: 'floor panel',
    room: 'floor in a room setting',
    detail: 'wood grain close-up detail',
  }[kind];
  return `${BRAND.nameEn} ${p.code} — ${p.wood} ${phrase}. Art wood flooring from China, sourced through Tarmeer's Dubai material selection center.`;
};

/** 系列封面图的 SEO alt */
export const coverAltOf = (s: FloorSeries) =>
  `${BRAND.nameEn} ${s.nameEn} collection — art wood flooring from China at Tarmeer's Dubai material selection center.`;

/** 产品的一句话 SEO 描述（meta description / JSON-LD 复用） */
export const seoDescOf = (p: FloorProduct) =>
  `${BRAND.nameEn} ${p.code} ${p.wood.toLowerCase()} art flooring — size ${p.size}, ${p.finish.toLowerCase()} finish. New building material from China, see and specify it at Tarmeer's Dubai material selection center with delivery across the UAE.`;

export type FloorShot = { kind: 'board' | 'room' | 'detail'; src: string; label: string; alt: string };
export const shotsOf = (p: FloorProduct): FloorShot[] => [
  { kind: 'board', src: imgOf(p, 'board'), label: 'Panel', alt: altOf(p, 'board') },
  { kind: 'room', src: imgOf(p, 'room'), label: 'In situ', alt: altOf(p, 'room') },
  { kind: 'detail', src: imgOf(p, 'detail'), label: 'Grain detail', alt: altOf(p, 'detail') },
];
