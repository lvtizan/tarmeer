import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { ChevronRight, Home } from 'lucide-react';

const SLUG = 'renovation-cost-dubai';
const TITLE = 'Renovation Cost in Dubai 2026: Complete Guide';
const DESCRIPTION = 'A complete breakdown of renovation costs in Dubai 2026 — by room type, finish level, and project scope. Budget ranges in AED with tips to avoid hidden costs.';
const CANONICAL = `https://www.tarmeer.com/guide/${SLUG}`;
const OG_IMAGE = 'https://www.tarmeer.com/og-default.jpg';

const articleSchema = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  '@id': CANONICAL,
  headline: TITLE,
  description: DESCRIPTION,
  author: { '@type': 'Organization', name: 'Tarmeer', url: 'https://www.tarmeer.com' },
  publisher: { '@type': 'Organization', name: 'Tarmeer', url: 'https://www.tarmeer.com' },
  datePublished: '2026-05-28',
  dateModified: '2026-05-28',
  url: CANONICAL,
};

const faqs = [
  {
    q: 'How much does a full apartment renovation cost in Dubai?',
    a: 'A full apartment renovation in Dubai typically costs between AED 80,000 and AED 250,000 for a standard 2-bedroom unit, depending on finish quality, layout changes, and MEP (mechanical, electrical, plumbing) scope. Premium finishes can push costs above AED 400,000.',
  },
  {
    q: 'How long does a renovation project take in Dubai?',
    a: 'Most apartment renovations take 6 to 14 weeks. Villa renovations range from 12 to 30 weeks depending on scope. Structural changes, custom joinery, and imported materials can extend the timeline significantly.',
  },
  {
    q: 'Why do renovation costs vary so much in Dubai?',
    a: 'Key variables include the quality of materials (local vs. imported), labour rates (some nationalities charge a premium), project complexity, whether MEP systems need replacing, and the community rules that may require additional approvals.',
  },
  {
    q: 'How do I find reliable renovation contractors in Dubai?',
    a: 'Use a verified directory like Tarmeer to compare companies with portfolio photos, business credentials, and real client reviews. Always get at least three quotes and confirm the company holds a valid Dubai municipality trade licence.',
  },
  {
    q: 'Do I need a permit to renovate in Dubai?',
    a: 'Structural changes, facade alterations, and work affecting shared walls or MEP systems require a permit from Dubai Municipality (DM). Cosmetic renovations (painting, flooring, cabinet replacement) generally do not need a permit. A reputable contractor will advise you on what is required.',
  },
  {
    q: 'Are renovation costs cheaper in newer buildings?',
    a: 'Not necessarily. Newer buildings often have stricter community rules and require NOCs (No Objection Certificates) from developers. Older buildings may need more MEP remediation, but they typically have fewer community restrictions.',
  },
  {
    q: 'What are the most common hidden costs in Dubai renovations?',
    a: 'Watch out for permit fees (AED 2,000–15,000+), waste disposal charges, material delivery surcharges, community NOC fees, and the cost of temporary accommodation if you vacate during works.',
  },
];

const faqSchema = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: faqs.map((f) => ({
    '@type': 'Question',
    name: f.q,
    acceptedAnswer: { '@type': 'Answer', text: f.a },
  })),
};

const breadcrumbSchema = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://www.tarmeer.com' },
    { '@type': 'ListItem', position: 2, name: 'Guides', item: 'https://www.tarmeer.com/guide' },
    { '@type': 'ListItem', position: 3, name: TITLE, item: CANONICAL },
  ],
};

const COST_TABLE = [
  { type: 'Full apartment (1BR)', budget: '40,000 – 80,000', premium: '120,000 – 220,000' },
  { type: 'Full apartment (2BR)', budget: '80,000 – 150,000', premium: '200,000 – 400,000' },
  { type: 'Full villa (3BR)', budget: '150,000 – 300,000', premium: '400,000 – 800,000+' },
  { type: 'Kitchen only', budget: '25,000 – 60,000', premium: '80,000 – 200,000+' },
  { type: 'Bathroom only', budget: '12,000 – 30,000', premium: '45,000 – 100,000+' },
  { type: 'Living & dining rooms', budget: '20,000 – 50,000', premium: '70,000 – 180,000' },
  { type: 'Master bedroom', budget: '15,000 – 35,000', premium: '50,000 – 120,000' },
  { type: 'Flooring only (per sqm)', budget: '80 – 150', premium: '200 – 600+' },
  { type: 'Painting only (per sqm)', budget: '15 – 30', premium: '40 – 80' },
];

export default function RenovationCostDubaiPage() {
  return (
    <>
      <Helmet>
        <title>{TITLE} | Tarmeer</title>
        <meta name="description" content={DESCRIPTION} />
        <link rel="canonical" href={CANONICAL} />
        <meta property="og:type" content="article" />
        <meta property="og:title" content={`${TITLE} | Tarmeer`} />
        <meta property="og:description" content={DESCRIPTION} />
        <meta property="og:url" content={CANONICAL} />
        <meta property="og:image" content={OG_IMAGE} />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="keywords" content="renovation cost dubai 2026, dubai renovation prices, renovation budget uae, apartment renovation cost dubai, villa renovation cost dubai" />
        <script type="application/ld+json">{JSON.stringify(articleSchema)}</script>
        <script type="application/ld+json">{JSON.stringify(faqSchema)}</script>
        <script type="application/ld+json">{JSON.stringify(breadcrumbSchema)}</script>
      </Helmet>

      <div className="max-w-3xl mx-auto px-4 py-10">
        {/* Breadcrumb */}
        <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-sm text-[#6b6b6b] mb-6">
          <Link to="/" className="flex items-center gap-1 hover:text-[#b8864a]">
            <Home size={14} />
            Home
          </Link>
          <ChevronRight size={14} />
          <span>Guides</span>
          <ChevronRight size={14} />
          <span className="text-[#2c2c2c]">Renovation Cost Dubai</span>
        </nav>

        {/* H1 */}
        <h1 className="text-3xl font-bold text-[#2c2c2c] mb-4 leading-tight">
          Renovation Cost in Dubai 2026: Complete Guide
        </h1>

        {/* Intro */}
        <p className="text-[15px] text-[#6b6b6b] mb-8 leading-relaxed">
          Planning a renovation in Dubai but not sure what to budget? Costs vary enormously depending on the size of your property, the quality of finishes you choose, and whether structural or MEP (mechanical, electrical, plumbing) work is involved. This guide breaks down renovation costs across all project types — from a single bathroom refresh to a full villa overhaul — with realistic AED price ranges drawn from projects completed across Dubai in 2025 and 2026.
        </p>

        {/* Section 1 */}
        <h2 className="text-xl font-bold text-[#2c2c2c] mb-3">Dubai's Renovation Market in 2026</h2>
        <p className="text-[15px] text-[#6b6b6b] mb-6 leading-relaxed">
          Dubai's renovation sector has expanded rapidly, driven by a surge in secondary market property transactions and a growing appetite for personalised interiors among both residents and investors. Labour and material costs have stabilised after post-pandemic spikes, though imported materials — particularly European tiles, custom joinery hardware, and branded sanitaryware — remain subject to freight surcharges. The market is split between budget operators (often individual tradespeople or small outfits), mid-range full-service renovation companies, and premium firms that combine interior design with project management. Choosing the wrong tier for your project scope is one of the most common — and expensive — mistakes homeowners make.
        </p>

        {/* Section 2: Cost table */}
        <h2 className="text-xl font-bold text-[#2c2c2c] mb-3">Renovation Costs by Project Type (AED)</h2>
        <p className="text-[15px] text-[#6b6b6b] mb-4 leading-relaxed">
          The table below shows typical budget and premium ranges for common renovation types in Dubai. "Budget" indicates mid-quality local materials and standard labour; "Premium" reflects imported or luxury materials, bespoke joinery, and a full-service project management fee.
        </p>
        <div className="overflow-x-auto mb-8">
          <table className="w-full text-[15px] border-collapse">
            <thead>
              <tr className="bg-stone-100">
                <th className="text-left px-4 py-3 font-semibold text-[#2c2c2c] border-b border-stone-200">Renovation Type</th>
                <th className="text-right px-4 py-3 font-semibold text-[#2c2c2c] border-b border-stone-200">Budget Range (AED)</th>
                <th className="text-right px-4 py-3 font-semibold text-[#2c2c2c] border-b border-stone-200">Premium Range (AED)</th>
              </tr>
            </thead>
            <tbody>
              {COST_TABLE.map((row, i) => (
                <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-stone-50'}>
                  <td className="px-4 py-3 text-[#2c2c2c] border-b border-stone-100">{row.type}</td>
                  <td className="px-4 py-3 text-right text-[#6b6b6b] border-b border-stone-100">{row.budget}</td>
                  <td className="px-4 py-3 text-right text-[#6b6b6b] border-b border-stone-100">{row.premium}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Section 3 */}
        <h2 className="text-xl font-bold text-[#2c2c2c] mb-3">Key Factors That Affect Renovation Prices</h2>
        <p className="text-[15px] text-[#6b6b6b] mb-6 leading-relaxed">
          Several variables drive the final number beyond the base room size. <strong className="text-[#2c2c2c]">Material origin</strong> is the biggest lever — a kitchen fitted with Italian tiles and German hardware can cost three times more than one done with locally sourced equivalents. <strong className="text-[#2c2c2c]">Layout changes</strong> that require moving plumbing or electrical points add disproportionately to the budget because they involve licensed tradespeople and, often, permit applications. <strong className="text-[#2c2c2c]">Community rules</strong> in gated developments (Arabian Ranches, Emirates Hills, Jumeirah Golf Estates) can mandate specific finishes for visible areas and require NOCs from the master developer, adding both cost and time. Finally, <strong className="text-[#2c2c2c]">timing</strong> matters — companies are busiest from October to March; booking in the summer months can sometimes yield a 10–15% discount.
        </p>

        {/* Section 4 */}
        <h2 className="text-xl font-bold text-[#2c2c2c] mb-3">How to Get Accurate Renovation Quotes</h2>
        <p className="text-[15px] text-[#6b6b6b] mb-6 leading-relaxed">
          The most important rule is to get a minimum of three quotes — and to make sure each company is quoting on an identical scope of work. Provide a written brief that covers: the rooms in scope, the materials you have in mind (or a finish level — basic, mid, or premium), any structural changes, and your target completion date. Reputable companies will send a quantity surveyor or project manager for a site visit before issuing a quote; be wary of firms that quote by phone without visiting your property. Ask for a line-item breakdown (labour, materials, waste disposal, project management fee) rather than a single lump-sum figure — this makes it far easier to compare bids and negotiate.
        </p>

        {/* Section 5 */}
        <h2 className="text-xl font-bold text-[#2c2c2c] mb-3">Hidden Costs to Watch For</h2>
        <p className="text-[15px] text-[#6b6b6b] mb-6 leading-relaxed">
          Beyond the quote, several costs routinely catch homeowners off guard. <strong className="text-[#2c2c2c]">Permit fees</strong> for structural works can range from AED 2,000 to AED 15,000+ depending on the scope. <strong className="text-[#2c2c2c]">Community NOC fees</strong> charged by master developers vary from AED 500 to AED 5,000. <strong className="text-[#2c2c2c]">Temporary accommodation</strong> — if you vacate during major works — is rarely included in quotes. <strong className="text-[#2c2c2c]">Material substitution</strong> mid-project (when a specified item is out of stock or delayed) can inflate costs if you have not agreed a substitution policy upfront. Build a contingency of at least 10–15% into your budget, and 20% for older properties where concealed defects (outdated wiring, hidden water damage) are more likely.
        </p>

        {/* FAQ */}
        <h2 className="text-xl font-bold text-[#2c2c2c] mb-4">Frequently Asked Questions</h2>
        <div className="space-y-3 mb-10">
          {faqs.map((faq, i) => (
            <details key={i} className="bg-white border border-stone-200 rounded-2xl overflow-hidden">
              <summary className="cursor-pointer px-5 py-4 font-medium text-[#2c2c2c] text-[15px] select-none hover:bg-stone-50 list-none flex items-center justify-between">
                {faq.q}
                <ChevronRight size={16} className="text-[#6b6b6b] shrink-0 transition-transform [details[open]_&]:rotate-90" />
              </summary>
              <p className="px-5 pb-4 text-[15px] text-[#6b6b6b] leading-relaxed">{faq.a}</p>
            </details>
          ))}
        </div>

        {/* CTA */}
        <div className="bg-stone-50 border border-stone-200 rounded-2xl p-6 text-center">
          <h3 className="text-lg font-bold text-[#2c2c2c] mb-2">Find Verified Renovation Companies in Dubai</h3>
          <p className="text-[15px] text-[#6b6b6b] mb-4">Browse portfolios, compare companies, and get quotes from top-rated renovation firms in Dubai.</p>
          <Link to="/services/renovation/dubai" className="btn-primary">
            Browse Renovation Companies
          </Link>
        </div>
      </div>
    </>
  );
}
