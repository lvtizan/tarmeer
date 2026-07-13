export const dynamic = 'force-dynamic';

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { headers } from 'next/headers';
import Link from 'next/link';
import { MapPin, ChevronRight, Building2 } from 'lucide-react';
import { resolveImageUrl } from '@/lib/imageUrl';
import { getCountry, type CountryConfig } from '@/lib/country';
import { jsonLdHtml } from '@/lib/schema/jsonLdScript';

const API_BASE = process.env.NEXT_PUBLIC_API_URL?.trim() ?? process.env.API_INTERNAL_URL?.trim() ?? 'http://localhost:3002/api';

// ─── Static data ──────────────────────────────────────────────────────────────

const SERVICE_LABELS: Record<string, string> = {
  'interior-design': 'Interior Design',
  'renovation': 'Renovation',
  'kitchen-renovation': 'Kitchen Renovation',
  'bathroom-renovation': 'Bathroom Renovation',
  'villa-renovation': 'Villa Renovation',
  'apartment-design': 'Apartment Design',
  'office-design': 'Office Design',
  'fit-out': 'Fit-Out',
};

const CITY_LABELS: Record<string, string> = {
  'dubai': 'Dubai',
  'abu-dhabi': 'Abu Dhabi',
  'sharjah': 'Sharjah',
  'ajman': 'Ajman',
  'ras-al-khaimah': 'Ras Al Khaimah',
  'fujairah': 'Fujairah',
};

const SERVICE_FAQS: Record<string, Array<{ q: string; a: string }>> = {
  'interior-design': [
    { q: 'How much does interior design cost in UAE?', a: 'Interior design costs in the UAE typically range from AED 150 to AED 500+ per square metre, depending on the scope, materials, and the studio you hire. A full-villa design project can range from AED 80,000 to AED 500,000 or more for luxury finishes.' },
    { q: 'How long does an interior design project take?', a: 'Most residential interior design projects in the UAE take between 8 and 20 weeks from the design concept phase through to final installation. Larger villas or complex commercial projects may take longer.' },
    { q: 'Do interior design companies handle procurement and installation?', a: 'Yes — most full-service interior design companies in the UAE manage the entire process: space planning, 3D rendering, material procurement, contractor coordination, and final styling. Always confirm the scope when requesting a quote.' },
    { q: 'What should I look for when choosing an interior design company?', a: 'Look for a verified portfolio with projects similar to your space, clear pricing transparency, client reviews, and evidence of on-site project management experience in the UAE. Tarmeer profiles include portfolios and verified business details.' },
    { q: 'Is it possible to get an interior design consultation before committing?', a: 'Yes — many UAE interior design studios offer a free initial consultation or a paid concept session before you sign a full contract. This is a good way to assess their understanding of your vision and budget.' },
  ],
  'renovation': [
    { q: 'How much does a home renovation cost in UAE?', a: 'Home renovation costs in the UAE vary widely. Minor refurbishments start at AED 30,000, while full gut renovations of a large villa can exceed AED 500,000. Labour, material quality, and the emirate you are in all affect the final price.' },
    { q: 'Do I need a permit for renovation work in Dubai or Abu Dhabi?', a: 'Structural changes, additions, or work on building facades typically require a permit from the relevant municipality (DM in Dubai, DCT in Abu Dhabi). A reputable renovation company will handle permit applications on your behalf.' },
    { q: 'How long does a full apartment renovation take in UAE?', a: 'A complete apartment renovation in the UAE typically takes 6 to 14 weeks depending on the unit size, scope of work, and material lead times. Unforeseen structural issues can add time, so factor in a contingency buffer.' },
    { q: 'What is included in a turnkey renovation package?', a: 'A turnkey renovation typically includes design, demolition, MEP (mechanical, electrical, plumbing) works, tiling, carpentry, painting, and final cleaning. Some companies also include furniture procurement and styling.' },
    { q: 'Can I stay in my home during a renovation?', a: 'For large-scale renovations involving MEP work, dust, and noise, it is usually advisable to vacate the property. For cosmetic upgrades — painting, flooring, furniture — it is often possible to remain, though inconvenient.' },
  ],
  'kitchen-renovation': [
    { q: 'How much does a kitchen renovation cost in UAE?', a: 'Kitchen renovations in the UAE range from AED 15,000 for a basic refresh (new cabinets and countertops) to AED 120,000+ for a full high-end kitchen overhaul with custom cabinetry and premium appliances.' },
    { q: 'How long does a kitchen renovation take?', a: 'A standard kitchen renovation in the UAE takes 3 to 6 weeks. Custom cabinetry fabrication can add 2 to 4 weeks of lead time, so plan your timeline accordingly.' },
    { q: 'What materials are popular for kitchens in the UAE?', a: 'Quartz and marble countertops are very popular in UAE kitchens due to their heat resistance and durability. For cabinetry, lacquered MDF and natural wood veneers are common. Porcelain and large-format tiles dominate kitchen floors.' },
    { q: 'Should I hire a kitchen specialist or a general renovation company?', a: 'For a full kitchen renovation including plumbing and electrical relocation, a company with in-house MEP capacity is preferable. Kitchen specialists are ideal when the layout stays the same and only surfaces and fittings change.' },
    { q: 'Can the kitchen layout be changed during a renovation?', a: 'Yes, but changing the kitchen layout involves moving plumbing, drainage, and electrical points, which requires additional time and cost. A feasibility check from your renovation company is recommended before committing to a new layout.' },
  ],
  'bathroom-renovation': [
    { q: 'How much does a bathroom renovation cost in UAE?', a: 'Bathroom renovation costs in the UAE typically start at AED 8,000 for a basic update and can reach AED 60,000+ for a luxury master-bathroom transformation with premium tiles, fixtures, and custom vanities.' },
    { q: 'How long does a bathroom renovation take?', a: 'A bathroom renovation in the UAE usually takes 2 to 4 weeks for a standard-sized bathroom. Lead times for custom tiles or imported fixtures can extend this by 1 to 3 weeks.' },
    { q: 'What are the most popular bathroom styles in UAE right now?', a: 'Minimalist and spa-inspired bathrooms are very popular across Dubai, Abu Dhabi, and Sharjah. Freestanding tubs, walk-in showers with large-format tiles, and backlit mirrors are among the most requested features.' },
    { q: 'Is waterproofing included in a bathroom renovation?', a: 'It should be — waterproofing the shower area and wet zones is a code requirement in the UAE. Always confirm that your contractor uses approved waterproofing membranes and that the work is inspected before tiling begins.' },
    { q: 'Do renovation companies supply the bathroom fixtures, or do I need to source them?', a: 'Both models exist. Many renovation companies have supplier relationships and can procure fixtures at a discount. You can also supply your own fixtures — just ensure you share specs early so the contractor can plan the plumbing accordingly.' },
  ],
  'villa-renovation': [
    { q: 'How much does a villa renovation cost in UAE?', a: 'Villa renovation costs in the UAE depend heavily on the villa size, scope, and finishes. A mid-range full renovation of a 4-bedroom villa typically costs between AED 300,000 and AED 800,000. Luxury projects can exceed AED 2 million.' },
    { q: 'Do I need to move out during a villa renovation?', a: 'For a full villa renovation involving structural changes, MEP work, or significant demolition, vacating the property is strongly recommended for safety and to allow the work to proceed faster.' },
    { q: 'How long does a full villa renovation take in UAE?', a: 'A complete villa renovation in the UAE typically takes 4 to 9 months, depending on the size of the villa and the scope of changes. Phased renovations room by room can take longer but allow you to stay in part of the property.' },
    { q: 'What permits are required for a villa renovation in UAE?', a: 'Structural modifications and external facade changes require permits from the relevant municipal authority. In Dubai, approvals go through Dubai Municipality (DM) or the master developer (e.g. Nakheel, Emaar). A qualified contractor will manage this process.' },
    { q: 'How do I choose a reliable villa renovation company in UAE?', a: 'Look for companies with a proven track record of completed villa projects, verifiable client references, and in-house MEP capability. Tarmeer lists verified villa renovation companies with portfolio images and contact details.' },
  ],
  'apartment-design': [
    { q: 'How much does apartment design cost in UAE?', a: 'Apartment interior design in the UAE typically costs between AED 120 and AED 450 per square metre for design fees alone. Full fit-out and furnishing can bring the total to AED 60,000 to AED 350,000 depending on apartment size and finish level.' },
    { q: 'What is the difference between interior design and fit-out for an apartment?', a: 'Interior design covers space planning, material selection, and visual concept development. Fit-out is the physical execution — building partitions, installing flooring, ceilings, joinery, and finishing surfaces. Most companies in the UAE offer both as a combined service.' },
    { q: 'Can a designer help with a small apartment in UAE?', a: 'Absolutely. Many interior designers in Dubai, Abu Dhabi, and Sharjah specialise in small-space solutions — maximising storage, using light-enhancing materials, and creating open-plan layouts that make compact apartments feel larger.' },
    { q: 'How long does apartment design and fit-out take?', a: 'From initial concept to completed handover, a full apartment design and fit-out project in the UAE takes approximately 10 to 20 weeks. Smaller studios may be completed faster; larger three- or four-bedroom units take longer.' },
    { q: 'Do apartment design companies handle moving and furniture installation?', a: 'Many full-service design and fit-out companies in the UAE include furniture procurement, delivery, and final styling. Confirm whether this is included in the quote or available as an add-on service.' },
  ],
  'office-design': [
    { q: 'How much does office design and fit-out cost in UAE?', a: 'Office fit-out costs in the UAE typically range from AED 250 to AED 1,200+ per square metre depending on specification level. A Category B (shell and core to turnkey) office fit-out in Dubai can cost AED 400 to AED 800 per sq.m. on average.' },
    { q: 'What is Category A vs Category B office fit-out?', a: 'Category A fit-out covers the basic building services — raised floors, suspended ceilings, basic MEP. Category B is the full tenant fit-out including partitions, joinery, branding, and furnishing. Most occupants in the UAE require a Category B fit-out.' },
    { q: 'How long does an office fit-out take in UAE?', a: 'A standard office fit-out of 500 to 2,000 sq.m. in Dubai or Abu Dhabi typically takes 8 to 16 weeks. Complex projects with bespoke joinery and AV integration can take longer.' },
    { q: 'Do I need a design consultant and a fit-out contractor, or can one company handle both?', a: 'Many UAE companies offer integrated design-and-build services covering both the design and physical execution. This is generally more efficient and reduces coordination risk compared to hiring a designer and contractor separately.' },
    { q: "What approvals are needed for an office fit-out in UAE free zones?", a: "Each free zone has its own approval process. For example, DIFC requires DIFC Authority approval, and ADGM requires its own NOC. Your fit-out contractor should be familiar with the specific zone's requirements and handle submissions on your behalf." },
  ],
  'fit-out': [
    { q: 'What does a fit-out company do in UAE?', a: 'A fit-out company transforms a bare shell or existing space into a finished, functional environment. This includes partitioning, flooring, ceiling systems, joinery, MEP installations, painting, and final decoration for residential, commercial, or retail spaces.' },
    { q: 'How much does a fit-out cost in UAE?', a: 'Fit-out costs in the UAE range from AED 200 per sq.m. for basic finishes to AED 1,500+ per sq.m. for high-end commercial or luxury residential spaces. The type of space, materials, and MEP complexity all influence the price.' },
    { q: 'How long does a fit-out project take?', a: 'A typical residential fit-out in the UAE takes 6 to 12 weeks. Commercial fit-outs depend on the size and complexity — small retail units may take 4 weeks, while large corporate offices or hotels can take 6 to 12 months.' },
    { q: 'Do I need a NOC or permit for a fit-out in UAE?', a: 'Yes — fit-out works in Dubai typically require a Fit-Out Permit from Dubai Municipality or the relevant master developer. In Abu Dhabi, approvals go through DCT or Abu Dhabi Municipality. Your contractor should manage this as part of the project.' },
    { q: 'What should I check before hiring a fit-out contractor in UAE?', a: 'Verify the contractor holds a valid UAE trade licence, has a portfolio of completed projects in your property type, and provides a detailed BOQ (bill of quantities). Tarmeer lists verified fit-out companies with portfolio images you can review before making contact.' },
  ],
};

// ─── Types ────────────────────────────────────────────────────────────────────

interface ServiceCityCompany {
  slug: string;
  name: string;
  city: string;
  description: string | null;
  portfolio_images: string | null;
  logo_url: string | null;
  is_claimed: boolean;
  is_signed: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** 把 FAQ 文案里的国家名/货币换成当前站点的值（AE 站为 no-op） */
function localizeText(text: string, country: CountryConfig): string {
  if (country.code === 'ae') return text;
  return text
    .replace(/\bUAE\b/g, country.name)
    .replace(/\bAED\b/g, country.currency);
}

/** 解析 portfolio_images JSON → resolve 后的非空图 URL 数组（单一可信解析入口） */
function parsePortfolioImages(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw) as unknown[];
    if (!Array.isArray(arr)) return [];
    return arr.map((x) => (x ? resolveImageUrl(String(x)) : '')).filter(Boolean);
  } catch {
    return [];
  }
}

function getCompanyThumb(c: ServiceCityCompany): string | null {
  if (c.logo_url) return resolveImageUrl(c.logo_url);
  return parsePortfolioImages(c.portfolio_images)[0] ?? null;
}

// ─── Cover image（Hero + og:image + schema 共用）─────────────────────────────────

/** 按服务的封面兜底图（缺真实项目图时用；均在 public/images/hero/，与首页 hero 共用资产） */
const SERVICE_COVER_FALLBACK: Record<string, string> = {
  'interior-design': '/images/hero/hero-living-1.webp',
  'renovation': '/images/hero/hero-villa-1.webp',
  'kitchen-renovation': '/images/hero/hero-kitchen-1.webp',
  'bathroom-renovation': '/images/hero/hero-living-2.webp',
  'villa-renovation': '/images/hero/hero-villa-1.webp',
  'apartment-design': '/images/hero/hero-living-2.webp',
  'office-design': '/images/hero/hero-living-1.webp',
  'fit-out': '/images/hero/hero-renovation-lg.webp',
};
// SERVICE_COVER_FALLBACK 未来漏配某 service 时的最终兜底（当前 service 恒在 SERVICE_LABELS 内，属防御）
const DEFAULT_COVER = '/images/hero/hero-living-1.webp';

/** 首家有项目图的公司的第一张真实项目图（Hero 封面优先用项目图，而非 logo） */
function firstProjectImage(companies: ServiceCityCompany[]): string | null {
  for (const co of companies) {
    const first = parsePortfolioImages(co.portfolio_images)[0];
    if (first) return first;
  }
  return null;
}

/** 该 service×city 的封面（站内路径）：真实项目图优先，回退按服务兜底图。 */
function resolveCoverPath(companies: ServiceCityCompany[], service: string): string {
  return firstProjectImage(companies) ?? SERVICE_COVER_FALLBACK[service] ?? DEFAULT_COVER;
}

/** 转成绝对 URL（og:image / schema 需要）；已是 http(s) 则原样返回。 */
function toAbsolute(url: string, baseUrl: string): string {
  if (/^https?:\/\//i.test(url)) return url;
  return `${baseUrl}${url.startsWith('/') ? '' : '/'}${url}`;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function CompanyCard({ company }: { company: ServiceCityCompany }) {
  const thumb = getCompanyThumb(company);
  return (
    <Link
      href={`/@${company.slug}`}
      className="group bg-white rounded-2xl border border-stone-200 shadow-sm hover:shadow-md hover:border-[#b8864a]/40 transition-all duration-200 flex flex-col overflow-hidden"
    >
      <div className="relative w-full aspect-video bg-stone-100 overflow-hidden">
        {thumb ? (
          <img src={thumb} alt={company.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy" />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#b8864a]/10 to-[#b8864a]/20">
            <Building2 className="w-10 h-10 text-[#b8864a]/40" />
          </div>
        )}
        {company.is_signed && (
          <span className="absolute top-2 left-2 px-2 py-0.5 bg-[#b8864a] text-white text-xs font-medium rounded-full">Verified</span>
        )}
      </div>
      <div className="p-4 flex flex-col gap-1.5 flex-1">
        <h3 className="font-semibold text-[15px] text-[#2c2c2c] group-hover:text-[#b8864a] transition-colors line-clamp-1">{company.name}</h3>
        <div className="flex items-center gap-1 text-xs text-[#6b6b6b]">
          <MapPin className="w-3.5 h-3.5 text-[#b8864a] flex-shrink-0" />
          <span>{company.city}</span>
        </div>
        {company.description && (
          <p className="text-xs text-[#6b6b6b] line-clamp-2 leading-relaxed mt-0.5">{company.description}</p>
        )}
        <div className="mt-auto pt-2 flex items-center gap-1 text-xs font-medium text-[#b8864a]">
          View Profile
          <ChevronRight className="w-3.5 h-3.5" />
        </div>
      </div>
    </Link>
  );
}

function FaqAccordion({ faqs }: { faqs: Array<{ q: string; a: string }> }) {
  return (
    <div className="space-y-3">
      {faqs.map((faq, idx) => (
        <details key={idx} className="group bg-white border border-stone-200 rounded-2xl overflow-hidden">
          <summary className="flex items-center justify-between gap-3 px-5 py-4 cursor-pointer list-none select-none text-[15px] font-medium text-[#2c2c2c] hover:text-[#b8864a] transition-colors">
            <span>{faq.q}</span>
            <ChevronRight className="w-4 h-4 text-[#b8864a] flex-shrink-0 group-open:rotate-90 transition-transform duration-200" />
          </summary>
          <div className="px-5 pb-4 text-sm text-[#6b6b6b] leading-relaxed border-t border-stone-100 pt-3">{faq.a}</div>
        </details>
      ))}
    </div>
  );
}

// ─── Data fetch (shared by metadata + page) ────────────────────────────────────

/** 拉某 service×city 的公司列表（generateMetadata 与页面共用；同 URL+revalidate 会被 Next 去重，只发一次） */
async function getServiceCityCompanies(service: string, cityLabel: string): Promise<ServiceCityCompany[]> {
  try {
    const qs = new URLSearchParams({ service, city: cityLabel });
    const res = await fetch(`${API_BASE}/companies/by-service-city?${qs}`, { next: { revalidate: 3600 } });
    if (!res.ok) return [];
    const data = (await res.json()) as { companies?: ServiceCityCompany[] };
    return Array.isArray(data.companies) ? data.companies : [];
  } catch {
    return [];
  }
}

// ─── Next.js exports ──────────────────────────────────────────────────────────

interface Props {
  params: Promise<{ service: string; city: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { service, city } = await params;
  const c = getCountry((await headers()).get('x-country'));
  // AE 专属路由：非 AE 站页面会 notFound，metadata 也早退为 noindex，
  // 避免非 AE 侧多打一次后端并把 UAE 封面/文案注入 404 页 head（与页面单一口径）。
  if (c.code !== 'ae') return { robots: { index: false, follow: false } };
  const serviceLabel = SERVICE_LABELS[service] ?? service;
  const cityLabel = CITY_LABELS[city] ?? city;
  const pageTitle = `${serviceLabel} Companies in ${cityLabel}, ${c.name}`;
  const pageDescription = `Find the best ${serviceLabel.toLowerCase()} companies in ${cityLabel}, ${c.name}. Browse verified profiles, portfolios & reviews on Tarmeer.`;
  const canonical = `${c.baseUrl}/services/${service}/${city}`;
  // 该 service×city 暂无公司 → noindex（仍 follow 传权重），避免薄/近重复页污染索引；有公司后自动恢复收录
  const isValid = service in SERVICE_LABELS && city in CITY_LABELS;
  // 与页面共用同一请求（同 URL+revalidate，Next 去重只发一次）：既判 noindex，又取封面
  const companies = isValid ? await getServiceCityCompanies(service, cityLabel) : [];
  const hasCompanies = companies.length > 0;
  const cover = toAbsolute(resolveCoverPath(companies, service), c.baseUrl);
  return {
    title: pageTitle,
    description: pageDescription,
    keywords: `${serviceLabel} ${cityLabel}, ${serviceLabel} companies ${c.name}, ${serviceLabel.toLowerCase()} ${cityLabel.toLowerCase()}, interior design ${c.name}, renovation ${c.name}`,
    alternates: { canonical },
    robots: hasCompanies ? undefined : { index: false, follow: true },
    openGraph: {
      type: 'website',
      title: `${pageTitle} | Tarmeer`,
      description: pageDescription,
      url: canonical,
      images: [{ url: cover, width: 1200, height: 630, alt: pageTitle }],
    },
    twitter: { card: 'summary_large_image', images: [cover] },
  };
}

export default async function ServiceCityPage({ params }: Props) {
  const { service, city } = await params;
  const c = getCountry((await headers()).get('x-country'));

  if (!(service in SERVICE_LABELS) || !(city in CITY_LABELS)) notFound();
  // service×city 落地页为 AE 专属（sitemap 仅收录 AE，CITY_LABELS 均为 UAE 城市）。
  // 非 AE 站命中此路由一律 notFound，杜绝 VN 页拿 UAE 公司图当 Hero/og:image（国家隔离铁律）。
  if (c.code !== 'ae') notFound();

  const serviceLabel = SERVICE_LABELS[service];
  const cityLabel = CITY_LABELS[city];
  const canonical = `${c.baseUrl}/services/${service}/${city}`;

  // Fetch companies server-side（与 generateMetadata 共用同一请求，Next 去重）
  const companies = await getServiceCityCompanies(service, cityLabel);

  // 封面：真实项目图优先，回退按服务兜底图（Hero + schema 共用）
  const coverPath = resolveCoverPath(companies, service);
  const coverAbs = toAbsolute(coverPath, c.baseUrl);

  const faqs = (SERVICE_FAQS[service] ?? []).map((f) => ({
    q: localizeText(f.q, c),
    a: localizeText(f.a, c),
  }));
  const relatedCities = Object.entries(CITY_LABELS).filter(([slug]) => slug !== city);

  // JSON-LD
  const breadcrumbSchema = {
    '@context': 'https://schema.org', '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: c.baseUrl },
      { '@type': 'ListItem', position: 2, name: serviceLabel, item: `${c.baseUrl}/services/${service}` },
      { '@type': 'ListItem', position: 3, name: cityLabel, item: canonical },
    ],
  };
  const itemListSchema = {
    '@context': 'https://schema.org', '@type': 'ItemList',
    '@id': `${canonical}#itemlist`,
    name: `${serviceLabel} Companies in ${cityLabel}, ${c.name}`,
    image: coverAbs,
    numberOfItems: companies.length,
    itemListElement: companies.map((co, idx) => ({ '@type': 'ListItem', position: idx + 1, url: `${c.baseUrl}/@${co.slug}` })),
  };
  const faqSchema = faqs.length > 0 ? {
    '@context': 'https://schema.org', '@type': 'FAQPage',
    mainEntity: faqs.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
  } : null;

  return (
    <div className="min-h-screen bg-[var(--color-tarmeer-bg)]">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdHtml(breadcrumbSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdHtml(itemListSchema) }} />
      {faqSchema && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdHtml(faqSchema) }} />}

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-1.5 text-xs text-[#6b6b6b] mb-6" aria-label="Breadcrumb">
          <Link href="/" className="hover:text-[#b8864a] transition-colors">Home</Link>
          <ChevronRight className="w-3.5 h-3.5" />
          <Link href="/companies" className="hover:text-[#b8864a] transition-colors">Companies</Link>
          <ChevronRight className="w-3.5 h-3.5" />
          <span className="text-[#2c2c2c] font-medium">{serviceLabel} in {cityLabel}</span>
        </nav>

        {/* Hero cover banner */}
        <div className="relative mb-6 rounded-2xl overflow-hidden bg-stone-200 isolate" style={{ aspectRatio: '16 / 7' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={coverPath}
            alt={`${serviceLabel} companies in ${cityLabel}, ${c.name}`}
            className="absolute inset-0 w-full h-full object-cover"
            loading="eager"
            fetchPriority="high"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/35 to-black/10" />
          <div className="absolute inset-x-0 bottom-0 p-5 sm:p-8">
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white mb-1.5 drop-shadow-sm">
              {serviceLabel} Companies in {cityLabel}, {c.name}
            </h1>
            <p className="text-sm sm:text-[15px] text-white/90 max-w-2xl drop-shadow-sm">
              {companies.length > 0
                ? `${companies.length} verified ${serviceLabel.toLowerCase()} ${companies.length === 1 ? 'company' : 'companies'} in ${cityLabel} — browse portfolios & get free quotes.`
                : `Verified ${serviceLabel.toLowerCase()} companies across ${c.name} — browse portfolios & get free quotes.`}
            </p>
          </div>
        </div>

        {/* Intro */}
        <div className="mb-8">
          <p className="text-[15px] text-[#6b6b6b] leading-relaxed max-w-3xl">
            Looking for trusted {serviceLabel.toLowerCase()} professionals in {cityLabel}?
            Tarmeer connects homeowners and businesses across {c.name} with verified{' '}
            {serviceLabel.toLowerCase()} companies that have a proven track record.
            Browse portfolios, compare services, and contact the right team for your project
            in {cityLabel} — whether you need a full transformation or a targeted upgrade.
            Every company on Tarmeer is reviewed against quality standards so you can
            make a confident decision without the guesswork. Explore the listings below
            and send a free inquiry directly from their profile.
          </p>
        </div>

        {/* Company grid */}
        <section aria-label={`${serviceLabel} companies in ${cityLabel}`} className="mb-12">
          {companies.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-2xl border border-stone-200">
              <Building2 className="w-12 h-12 text-stone-300 mx-auto mb-3" />
              <p className="text-lg font-semibold text-[#2c2c2c] mb-1">No companies listed yet</p>
              <p className="text-[#6b6b6b] mb-6 max-w-xs mx-auto">
                We are still adding {serviceLabel.toLowerCase()} companies in {cityLabel}. Try browsing all companies instead.
              </p>
              <Link href="/companies" className="btn-primary">Browse All Companies</Link>
            </div>
          ) : (
            <>
              <p className="text-sm text-[#6b6b6b] mb-4">
                {companies.length} {serviceLabel.toLowerCase()} {companies.length === 1 ? 'company' : 'companies'} found in {cityLabel}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {companies.map((c) => <CompanyCard key={c.slug} company={c} />)}
              </div>
            </>
          )}
        </section>

        {/* FAQ */}
        {faqs.length > 0 && (
          <section className="mb-12" aria-label="Frequently asked questions">
            <h2 className="text-xl font-bold text-[#2c2c2c] mb-5">
              Frequently Asked Questions About {serviceLabel} in {cityLabel}
            </h2>
            <FaqAccordion faqs={faqs} />
          </section>
        )}

        {/* CTA */}
        <section className="mb-12 bg-white rounded-2xl border border-stone-200 shadow-sm p-6 sm:p-8 text-center">
          <h2 className="text-xl font-bold text-[#2c2c2c] mb-2">Find the Right {serviceLabel} Company</h2>
          <p className="text-[15px] text-[#6b6b6b] mb-6 max-w-md mx-auto">
            Browse our full directory of verified interior design and renovation companies across {c.name}.
          </p>
          <Link href="/companies" className="btn-primary">Browse All Companies</Link>
        </section>

        {/* Related cities */}
        <section aria-label="Explore other cities">
          <h2 className="text-base font-semibold text-[#2c2c2c] mb-3">
            {serviceLabel} Companies in Other {c.name} Cities
          </h2>
          <div className="flex flex-wrap gap-2">
            {relatedCities.map(([slug, label]) => (
              <Link
                key={slug}
                href={`/services/${service}/${slug}`}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-2xl border border-stone-200 text-sm text-[#6b6b6b] hover:border-[#b8864a]/50 hover:text-[#b8864a] transition-colors"
              >
                <MapPin className="w-3.5 h-3.5" />
                {serviceLabel} in {label}
              </Link>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
