// 巴博罗艺术地板 PARBRO —— 产品目录数据（从厂家 PDF 画册用 pdf-catalog-extract 技能扒出）。
// 静态数据 + 图片在 public/images/flooring/<series>/<code>-{board,room,detail}.webp（细节图保原尺不糊）。
// 后续加系列/产品只需往 SERIES / PRODUCTS 追加。

export type FloorProduct = {
  code: string;
  series: string; // 系列 slug
  wood: string; // 表面材种
  size: string; // 产品尺寸
  finish: string; // 表面工艺
};

export type FloorSeries = {
  slug: string;
  nameEn: string;
  nameZh: string;
  blurb: string;
  cover: string; // 用某款产品的 board 图做封面
};

export const BRAND = {
  nameEn: 'PARBRO',
  nameZh: '巴博罗艺术地板',
  tagline: 'Art parquet & engineered wood flooring',
};

export const SERIES: FloorSeries[] = [
  {
    slug: 'parquet',
    nameEn: 'Floral',
    nameZh: '拼花系列',
    blurb: 'Geometric oak, walnut and teak parquet panels — brushed, grooved and metal-finish artistry.',
    cover: '/images/flooring/parquet/5101-board.webp',
  },
];

// 拼花系列 38 款（PDF 第 5-42 页，规格完整）
export const PRODUCTS: FloorProduct[] = [
  { code: '5101', series: 'parquet', wood: '橡木拼花', size: '600*600*15/1.2mm', finish: '拉丝勾线' },
  { code: '5103', series: 'parquet', wood: '橡木拼花', size: '600*600*15/1.2mm', finish: '拉丝勾线' },
  { code: '5105', series: 'parquet', wood: '橡木拼花', size: '600*600*15/1.2mm', finish: '拉丝勾线' },
  { code: '5106', series: 'parquet', wood: '橡木拼花', size: '600*600*15/1.2mm', finish: '拉丝勾线' },
  { code: '5973', series: 'parquet', wood: '柚木多层拼花', size: '600*600*15/1.2mm', finish: '平面勾线' },
  { code: '5975', series: 'parquet', wood: '橡木拼花', size: '600*600*15/1.2mm', finish: '本色拉丝' },
  { code: '5976', series: 'parquet', wood: '橡木拼花', size: '600*600*15/1.2mm', finish: '奶白色拉丝' },
  { code: '5977', series: 'parquet', wood: '橡木拼花', size: '600*600*15/1.2mm', finish: '黑色拉丝' },
  { code: '5978', series: 'parquet', wood: '黑胡桃拼花', size: '600*600*15/1.2mm', finish: '平面勾线' },
  { code: '5979', series: 'parquet', wood: '橡木拼花', size: '600*600*15/1.2mm', finish: '拉丝勾线' },
  { code: '5982', series: 'parquet', wood: '红橡三层拼花', size: '600*600*15/1.2mm', finish: '拉丝' },
  { code: '5983', series: 'parquet', wood: '水曲柳三层拼花', size: '600*600*15/1.2mm', finish: '拉丝' },
  { code: '5985', series: 'parquet', wood: '白橡三层拼花', size: '600*600*15/1.2mm', finish: '拉丝' },
  { code: '5986', series: 'parquet', wood: '黑胡桃双色三层拼花', size: '600*600*15/1.2mm', finish: '拉丝' },
  { code: '5988', series: 'parquet', wood: '橡木多层拼花', size: '600*600*15/1.2mm', finish: '拉丝勾线' },
  { code: '5989', series: 'parquet', wood: '黑胡桃拼花', size: '600*600*15/1.2mm', finish: '平面勾线' },
  { code: '5991', series: 'parquet', wood: '橡木+酸枝+贝壳', size: '600*600*15mm', finish: '金属漆' },
  { code: '5999', series: 'parquet', wood: '欧橡多层拼花', size: '600*600*15/3.0mm', finish: '拉丝勾线' },
  { code: '5966', series: 'parquet', wood: '黑胡桃', size: '600*600*15mm', finish: '平面拉丝' },
  { code: '5950', series: 'parquet', wood: '黑胡桃拼花', size: '600*600*15mm', finish: '平面勾线' },
  { code: '5970', series: 'parquet', wood: '橡木', size: '600*600*15mm', finish: '拉丝' },
  { code: 'HP10', series: 'parquet', wood: '橡木拼花', size: '600*600*15/1.2mm', finish: '全桦基材' },
  { code: 'HP11', series: 'parquet', wood: '橡木拼花', size: '600*600*15/1.2mm', finish: '全桦基材' },
  { code: 'HP12', series: 'parquet', wood: '黑胡桃拼花', size: '600*600*15/1.2mm', finish: '全桦基材' },
  { code: 'HP13', series: 'parquet', wood: '黑胡桃拼花', size: '600*600*15/1.2mm', finish: '全桦基材' },
  { code: 'HP15', series: 'parquet', wood: '柚木拼花', size: '600*600*15/1.2mm', finish: '全桦基材' },
  { code: 'HP16', series: 'parquet', wood: '大叶花梨拼花', size: '600*600*15/1.2mm', finish: '全桦基材' },
  { code: 'HP17', series: 'parquet', wood: '红橡拼花', size: '600*600*15/1.2mm', finish: '全桦基材' },
  { code: 'HP18', series: 'parquet', wood: '水曲柳拼花', size: '600*600*15/1.2mm', finish: '全桦基材' },
  { code: 'HP20', series: 'parquet', wood: '鸡翅木拼花', size: '600*600*15/1.2mm', finish: '全桦基材' },
  { code: 'HP19', series: 'parquet', wood: '水曲柳拼花', size: '600*600*15/1.2mm', finish: '全桦基材' },
  { code: 'HP21', series: 'parquet', wood: '橡木拼花', size: '600*600*15/1.2mm', finish: '全桦基材' },
  { code: 'HP22', series: 'parquet', wood: '黑胡桃拼花', size: '600*600*15/1.2mm', finish: '全桦基材' },
  { code: 'QHP61', series: 'parquet', wood: '橡木钻石拼花(进口全桦)', size: '600*600*14.5/1.2mm', finish: '本色进口全桦基材' },
  { code: 'QHP62', series: 'parquet', wood: '橡木钻石拼花(进口全桦)', size: '600*600*14.5/1.2mm', finish: '进口全桦基材' },
  { code: 'QHP63', series: 'parquet', wood: '橡木钻石拼花(进口全桦)', size: '600*600*14.5/1.2mm', finish: '进口全桦基材' },
  { code: 'QHP65', series: 'parquet', wood: '黑胡桃钻石拼花(进口全桦)', size: '600*600*14.5/1.2mm', finish: '进口全桦基材' },
  { code: 'QHP66', series: 'parquet', wood: '柚木拼花(进口全桦)', size: '600*600*14.5/1.2mm', finish: '进口全桦基材' },
];

export const getSeries = (slug: string) => SERIES.find((s) => s.slug === slug);
export const productsOf = (slug: string) => PRODUCTS.filter((p) => p.series === slug);
export const getProduct = (series: string, code: string) =>
  PRODUCTS.find((p) => p.series === series && p.code.toLowerCase() === code.toLowerCase());
export const imgOf = (p: FloorProduct, kind: 'board' | 'room' | 'detail') =>
  `/images/flooring/${p.series}/${p.code}-${kind}.webp`;
