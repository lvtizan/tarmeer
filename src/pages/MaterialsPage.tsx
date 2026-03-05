import { Link } from 'react-router-dom';
import PageContainer from '../components/PageContainer';
import { materialCategories } from '../data/materials';
import { WHATSAPP_LINK } from '../lib/constants';

export default function MaterialsPage() {
  return (
    <div className="min-h-screen bg-[#faf9f7]">
      {/* Materials banner */}
      <section className="w-full aspect-[21/9] sm:aspect-[3/1] max-h-[320px] bg-stone-200 overflow-hidden">
        <img
          src="/images/materials-banner.png"
          alt="Tarmeer building materials"
          className="w-full h-full object-cover"
        />
      </section>
      <PageContainer className="py-8 sm:py-16">
        <Link to="/" className="text-[#c6a065] hover:underline text-sm mb-8 inline-block">
          ← Back to Home
        </Link>
      <div className="text-center mb-12">
        <p className="text-xs sm:text-sm uppercase tracking-widest text-[#6b6b6b] mb-2">
          Materials & build
        </p>
        <h1 className="font-serif text-3xl sm:text-4xl font-semibold text-[#2c2c2c] mb-4">
          Building materials and solutions
        </h1>
        <p className="text-[#6b6b6b] max-w-2xl mx-auto mb-6">
          From core customization to smart tech — we source and deliver premium materials and systems for residential and commercial projects across the UAE. Explore each category for case studies and get in touch for quotes or showroom visits.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
        {materialCategories.map((cat) => (
          <Link
            key={cat.slug}
            to={`/materials/${cat.slug}`}
            className="group block bg-white rounded-xl overflow-hidden border border-stone-100 hover:border-[#c6a065]/30 hover:shadow-lg transition-all duration-200 hover:-translate-y-1"
          >
            <div className="aspect-[4/3] bg-stone-200 overflow-hidden">
              <img
                src={cat.image}
                alt={`${cat.titleEn} category`}
                className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                onError={(e) => {
                  e.currentTarget.onerror = null;
                  e.currentTarget.src = 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&q=85';
                }}
              />
            </div>
            <div className="p-5 sm:p-6">
              <h2 className="font-serif text-xl font-semibold text-[#2c2c2c] group-hover:text-[#c6a065] transition mb-2">
                {cat.titleEn}
              </h2>
              <p className="text-sm text-[#6b6b6b] leading-relaxed">
                {cat.description}
              </p>
              <span className="inline-block mt-3 text-sm font-medium text-[#c6a065]">
                View category →
              </span>
            </div>
          </Link>
        ))}
      </div>

      <section className="mt-14 pt-10 border-t border-stone-200 text-center">
        <p className="text-[#6b6b6b] mb-2">
          Need a quote, product info, or want to visit our showroom?
        </p>
        <p className="text-sm text-[#6b6b6b] mb-6 max-w-xl mx-auto">
          We offer direct factory integration and premium materials. Contact us for consultations and project support.
        </p>
        <a href={WHATSAPP_LINK} target="_blank" rel="noopener noreferrer" className="btn-primary">
          Contact us
        </a>
      </section>
    </PageContainer>
    </div>
  );
}
