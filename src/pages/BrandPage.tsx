import { useParams, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import PageContainer from '../components/PageContainer';
import { getBrandBySlug } from '../data/brands';
import { dedupeImageEntries } from '../lib/imageCleanup';
import { WHATSAPP_LINK } from '../lib/constants';

export default function BrandPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const handleBack = () => {
    if (window.history.length > 1) navigate(-1);
    else navigate('/materials');
  };
  const brand = slug ? getBrandBySlug(slug) : undefined;
  const works = brand ? dedupeImageEntries(brand.works) : [];

  if (!brand) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-xl font-semibold text-[#2c2c2c] mb-4">Brand not found</h1>
          <button onClick={handleBack} className="text-[#b8864a] hover:underline">Back</button>
        </div>
      </div>
    );
  }

  const canonicalUrl = `https://www.tarmeer.com/materials/brands/${slug}`;
  const ogImage = brand.bannerImage?.startsWith('http')
    ? brand.bannerImage
    : `https://www.tarmeer.com${brand.bannerImage}`;
  const rawDescription = `${brand.tagline ?? ''} ${brand.intro ?? ''}`.trim();
  const metaDescription = rawDescription.slice(0, 320);

  return (
    <div className="min-h-screen bg-[#faf9f7]">
      <Helmet>
        <title>{brand.nameEn} - Building Materials &amp; Products - Tarmeer UAE</title>
        <meta name="description" content={metaDescription} />
        <meta property="og:title" content={`${brand.nameEn} - Building Materials & Products - Tarmeer UAE`} />
        <meta property="og:description" content={metaDescription} />
        <meta property="og:image" content={ogImage} />
        <meta property="og:url" content={canonicalUrl} />
        <meta property="og:type" content="product" />
        <meta property="og:site_name" content="Tarmeer" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={`${brand.nameEn} - Building Materials & Products - Tarmeer UAE`} />
        <meta name="twitter:description" content={metaDescription} />
        <meta name="twitter:image" content={ogImage} />
        <meta name="keywords" content={`${brand.nameEn}, building materials, UAE, Tarmeer, interior design`} />
        <meta name="robots" content="index, follow" />
        <link rel="canonical" href={canonicalUrl} />
        <script type="application/ld+json">{JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Brand",
          "name": brand.nameEn,
          "description": brand.tagline,
          "url": canonicalUrl,
          "image": ogImage,
        })}</script>
      </Helmet>
      {/* Banner */}
      <section className="relative h-[320px] sm:h-[400px] overflow-hidden">
        <img
          src={brand.bannerImage}
          alt=""
          className="w-full h-full object-cover"
          onError={(e) => {
            (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?w=1600&q=80';
          }}
        />
        <div className="absolute inset-0 bg-black/40" />
        <div className="absolute inset-0 flex flex-col justify-end p-6 sm:p-10">
          <h1 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-2">
            {brand.nameEn}
          </h1>
          <p className="text-white/90 text-sm sm:text-base max-w-xl">{brand.tagline}</p>
        </div>
      </section>

      <PageContainer className="py-10 sm:py-16">
        <button onClick={handleBack} className="text-[#c6a065] hover:underline text-sm mb-8 inline-block">
          ← Back
        </button>

        {/* Intro */}
        <section className="mb-14">
          <p className="text-[#2c2c2c] text-base sm:text-lg leading-relaxed max-w-3xl">
            {brand.intro}
          </p>
        </section>

        {/* Works */}
        <section>
          <h2 className="font-serif text-2xl sm:text-3xl font-semibold text-[#2c2c2c] mb-8">
            Works & Projects
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
            {works.map((work) => (
              <div
                key={work.id}
                className="bg-white rounded-lg overflow-hidden border border-stone-100 shadow-sm hover:shadow-lg transition"
              >
                <div className="aspect-[4/3] bg-stone-200 overflow-hidden">
                  <img
                    src={work.image}
                    alt={work.title}
                    className="w-full h-full object-cover hover:scale-105 transition duration-300"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?w=800&q=80';
                    }}
                  />
                </div>
                <div className="p-5">
                  <h3 className="font-semibold text-[#2c2c2c] mb-1">{work.title}</h3>
                  {work.description && (
                    <p className="text-sm text-[#6b6b6b]">{work.description}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
          {works.length === 0 && (
            <p className="text-sm text-[#6b6b6b]">No valid project images are available right now.</p>
          )}
        </section>

        <section className="mt-14 pt-10 border-t border-stone-200 text-center">
          <p className="text-[#6b6b6b] mb-4">Interested in this brand? Contact us for quotes or showroom visits.</p>
          <a
            href={WHATSAPP_LINK}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-primary text-white"
          >
            Contact us
          </a>
        </section>
      </PageContainer>
    </div>
  );
}
