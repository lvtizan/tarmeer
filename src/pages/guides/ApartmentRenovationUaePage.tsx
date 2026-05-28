import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { ChevronRight, Home, CheckCircle2 } from 'lucide-react';

const SLUG = 'apartment-renovation-uae';
const TITLE = 'Apartment Renovation in UAE: The Complete 2026 Checklist';
const DESCRIPTION = 'Step-by-step checklist for apartment renovation in UAE 2026. Covers permits, contractor selection, stage-by-stage planning, common mistakes, and costs in Dubai and Abu Dhabi.';
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
    q: 'Do I need a permit for apartment renovation in Dubai?',
    a: 'Structural alterations, changes to MEP systems (moving plumbing, electrical panels, or HVAC), and modifications to external facades require a permit from Dubai Municipality. Cosmetic work — painting, flooring replacement, kitchen cabinet changes that do not involve plumbing relocation — does not typically require a permit.',
  },
  {
    q: 'How long does an apartment renovation take in UAE?',
    a: 'A full renovation of a 1-bedroom apartment in Dubai typically takes 6 to 10 weeks; a 2-bedroom takes 8 to 14 weeks. Projects involving MEP works, custom joinery, or imported materials with long lead times can take up to 20 weeks.',
  },
  {
    q: 'How much does apartment renovation cost in UAE?',
    a: 'Budget renovations (mid-quality local materials) for a 1-bedroom apartment start at AED 40,000–80,000. Premium renovations can exceed AED 220,000. Kitchen and bathroom renovations are the most expensive per square metre due to plumbing and tiling work.',
  },
  {
    q: 'Can a tenant renovate an apartment in UAE?',
    a: 'Tenants in the UAE require written permission from the landlord before undertaking any renovation work. Most standard tenancy agreements prohibit structural changes. Even cosmetic changes (painting walls a non-neutral colour) should be agreed in writing to avoid deductions from the security deposit.',
  },
  {
    q: 'Are there restrictions on floor changes in UAE apartments?',
    a: 'Yes. Many Dubai buildings and master-developed communities restrict the removal of original floor finishes (especially in older buildings where floor structures are not designed for additional tile weight). Always check with building management and your renovation company before specifying heavy stone tiles on upper floors.',
  },
  {
    q: 'Do I need to inform my building management before renovating?',
    a: 'Yes — almost all residential buildings in Dubai and Abu Dhabi require you to notify building management before works begin. You will typically need to submit a method statement, working hours plan, and contractor insurance details. Some buildings also charge a refundable deposit to cover potential damage to common areas during works.',
  },
  {
    q: 'What is the biggest mistake people make when renovating apartments in UAE?',
    a: 'The most common — and costly — mistake is failing to plan the sequence of trades. Painting before tiling, or tiling before MEP rough-ins, forces expensive rework. The second most common mistake is choosing a contractor purely on price without verifying their sub-contractor quality — especially for tiling and joinery.',
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

const CHECKLIST = [
  { phase: 'Planning', items: [
    'Define your renovation scope and wishlist in writing',
    'Set a realistic budget including a 15% contingency',
    'Confirm ownership or get written landlord approval (if tenant)',
    'Check community/building rules for renovation restrictions',
  ]},
  { phase: 'Permits & Approvals', items: [
    'Identify whether your works require a Dubai Municipality or Abu Dhabi DM permit',
    'Notify building management and submit contractor details',
    'Obtain any required NOC from the master developer',
    'Confirm working hours allowed by building management',
  ]},
  { phase: 'Contractor Selection', items: [
    'Get at least three detailed, itemised quotes',
    'Verify each contractor\'s UAE trade licence and insurance',
    'Check portfolio photos of completed UAE projects',
    'Confirm sub-contractor quality (tilers, carpenters, painters)',
    'Review payment schedule — avoid paying more than 30% upfront',
  ]},
  { phase: 'During Renovation', items: [
    'Walk the site weekly and document progress with photos',
    'Confirm all rough-in (MEP) work is complete before closing walls',
    'Approve tile and material samples before bulk orders are placed',
    'Monitor waste disposal — contractor should remove debris daily',
  ]},
  { phase: 'Handover', items: [
    'Conduct a detailed snagging inspection before final payment',
    'Test all electrical outlets, plumbing fixtures, and HVAC',
    'Request warranties for all installed equipment and joinery',
    'Get copies of all permit sign-offs and inspection certificates',
  ]},
];

export default function ApartmentRenovationUaePage() {
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
        <meta name="keywords" content="apartment renovation uae checklist, apartment renovation dubai, flat renovation uae, renovate apartment dubai permit, apartment renovation cost uae" />
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
          <span className="text-[#2c2c2c]">Apartment Renovation UAE</span>
        </nav>

        {/* H1 */}
        <h1 className="text-3xl font-bold text-[#2c2c2c] mb-4 leading-tight">
          Apartment Renovation in UAE: The Complete 2026 Checklist
        </h1>

        {/* Intro */}
        <p className="text-[15px] text-[#6b6b6b] mb-8 leading-relaxed">
          Renovating an apartment in the UAE involves more than choosing tiles and paint colours. From navigating municipality permits to managing a multi-trade workforce in a high-rise building with strict working-hours rules, a successful renovation requires systematic planning. This guide walks you through every stage — from the first budget estimate to the final snagging inspection — with a practical checklist you can use regardless of whether you are in Dubai, Abu Dhabi, or any other emirate.
        </p>

        {/* Section 1 */}
        <h2 className="text-xl font-bold text-[#2c2c2c] mb-3">Planning Your Apartment Renovation</h2>
        <p className="text-[15px] text-[#6b6b6b] mb-6 leading-relaxed">
          The most important thing you can do before a single tile is lifted is to define your scope in writing. A vague brief — "modernise the kitchen" — will produce vague quotes that are impossible to compare and prone to scope creep. A specific brief — "replace all kitchen cabinets with lacquered MDF in white, replace worktop with 20mm Calacatta quartz, retain existing plumbing layout, replace sink and tap, install new overhead LED strip lighting" — produces accurate quotes and holds contractors accountable. At the same time, build in a contingency budget of at least 15%. UAE apartments frequently reveal concealed problems once demolition begins: outdated wiring, incorrectly installed drainage, water damage behind tiles, or structural cracks that a diligent contractor will flag and must be remediated.
        </p>

        {/* Section 2 */}
        <h2 className="text-xl font-bold text-[#2c2c2c] mb-3">Key Permits Required in Dubai and Abu Dhabi</h2>
        <p className="text-[15px] text-[#6b6b6b] mb-6 leading-relaxed">
          In Dubai, the Dubai Municipality (DM) and the relevant master developer (EMAAR, Nakheel, Meraas, etc.) have separate approval tracks. DM approval is required for structural changes, MEP system modifications, and facade alterations; it involves submitting engineering drawings stamped by a licensed consultant. Master developer NOCs are required when works could affect shared infrastructure or the appearance of the community. In Abu Dhabi, the Department of Municipalities and Transport (DMT) handles permits through the Tawtheeq and Baladiya portals. A reputable renovation company will manage all permit applications on your behalf — if a company tells you that no permits are needed for works that clearly require them, treat this as a red flag.
        </p>

        {/* Section 3 */}
        <h2 className="text-xl font-bold text-[#2c2c2c] mb-3">Choosing the Right Renovation Contractor</h2>
        <p className="text-[15px] text-[#6b6b6b] mb-6 leading-relaxed">
          The UAE renovation market is fragmented — there are large full-service fit-out companies, mid-size renovation specialists, and individual tradespeople who aggregate work informally. For a full apartment renovation, a company with an in-house project manager, direct-hire trades (rather than 100% sub-contracted), and a UAE trade licence is strongly preferable. Check that the company can provide a fixed-price contract with a clear payment milestone schedule — typically 30% upfront, 40% at structural completion, 20% at fit-out completion, and 10% upon final snagging sign-off. Never pay more than 30% before works begin.
        </p>

        {/* Checklist */}
        <h2 className="text-xl font-bold text-[#2c2c2c] mb-4">Stage-by-Stage Renovation Checklist</h2>
        <div className="space-y-6 mb-8">
          {CHECKLIST.map((section) => (
            <div key={section.phase} className="bg-white border border-stone-200 rounded-2xl p-5">
              <h3 className="font-semibold text-[#2c2c2c] mb-3 text-[15px]">{section.phase}</h3>
              <ul className="space-y-2">
                {section.items.map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-[15px] text-[#6b6b6b]">
                    <CheckCircle2 size={16} className="text-[#b8864a] shrink-0 mt-0.5" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Section 4 */}
        <h2 className="text-xl font-bold text-[#2c2c2c] mb-3">Common Mistakes to Avoid</h2>
        <p className="text-[15px] text-[#6b6b6b] mb-6 leading-relaxed">
          The three most expensive mistakes in UAE apartment renovations are: (1) incorrect trade sequencing — for example, having painters finish walls before tilers have completed wet areas, then needing to repaint after tiling splashes; (2) ordering materials in bulk before approving physical samples — especially tiles, where colour and texture on a screen almost never match the physical product; and (3) underestimating lead times for imported materials — Italian marble, German hardware, and custom joinery pieces regularly take 8 to 12 weeks to arrive, and a contractor who does not plan for this will create costly delays. Build your material procurement schedule into the project plan from day one.
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
          <h3 className="text-lg font-bold text-[#2c2c2c] mb-2">Find Apartment Renovation Companies in UAE</h3>
          <p className="text-[15px] text-[#6b6b6b] mb-4">Compare verified renovation firms with real portfolios and get quotes for your apartment project.</p>
          <Link to="/services/renovation/dubai" className="btn-primary">
            Browse Renovation Companies
          </Link>
        </div>
      </div>
    </>
  );
}
