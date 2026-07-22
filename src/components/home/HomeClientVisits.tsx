// AE 首页「Real client visits」照片墙（2026-07-20 重设计新增）— 社会证明主打图，文案只留标题+一行。
// 全部为真实到访照片（客户面部已脱敏）；合影 team-clients 占双格领衔。AE 专用，不进 i18n；纯 server component。

// 等高均匀网格（9 张 3×3，无跨格），全部为中方接待 + 海湾客户到访场景（不与 Hero 轮播重复）。
// 图片走 webp 变体（thumb 600 / medium 1200）。
const PHOTOS: { src: string; alt: string }[] = [
  { src: 'cv-1', alt: 'Our Chinese team hosting Gulf clients at a sanitaryware showroom in China' },
  { src: 'cv-2', alt: 'Our Chinese team hosting Gulf clients at a materials showroom in China' },
  { src: 'cv-3', alt: 'Our Chinese team hosting Gulf clients at a materials showroom in China' },
  { src: 'cv-4', alt: 'Our Chinese team hosting Gulf clients at a materials showroom in China' },
  { src: 'cv-5', alt: 'Our Chinese team hosting Gulf clients at a materials showroom in China' },
  { src: 'cv-6', alt: 'Our Chinese team hosting Gulf clients at a materials showroom in China' },
  { src: 'cv-7', alt: 'Our Chinese team hosting Gulf clients at a materials showroom in China' },
  { src: 'cv-8', alt: 'Our Chinese team hosting Gulf clients at a materials showroom in China' },
  { src: 'cv-9', alt: 'Our Chinese team hosting Gulf clients at a materials showroom in China' },
];

export default function HomeClientVisits() {
  return (
    <section className="bg-[#faf8f5] py-14 sm:py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-[10px] uppercase tracking-[0.22em] text-[#b8864a]">Real Client Visits</p>
          <h2 className="mt-2 font-serif text-[26px] leading-tight tracking-[-0.01em] text-[#1c1917] sm:text-[34px]">
            Clients we&apos;ve hosted in China
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-stone-500 sm:text-base">
            Every photo is from a real factory and showroom tour.
          </p>
        </div>

        {/* 照片墙：等高均匀网格，2 列(移动) / 3 列(桌面)，全部 4:3 防 CLS */}
        <div className="mt-10 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
          {PHOTOS.map((p) => (
            <div
              key={p.src}
              className="relative overflow-hidden rounded-2xl bg-stone-200 aspect-[16/9]"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/images/sourcing/${p.src}-medium.webp`}
                srcSet={`/images/sourcing/${p.src}-thumb.webp 600w, /images/sourcing/${p.src}-medium.webp 1200w`}
                sizes="(min-width: 1024px) 33vw, 50vw"
                alt={p.alt}
                loading="lazy"
                className="absolute inset-0 h-full w-full object-cover transition duration-500 hover:scale-105"
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
