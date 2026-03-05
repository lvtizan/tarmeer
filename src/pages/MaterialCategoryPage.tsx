import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2 } from 'lucide-react';
import PageContainer from '../components/PageContainer';
import { getCategoryBySlug, getCaseStudiesForCategory } from '../data/materials';
import { WHATSAPP_LINK } from '../lib/constants';

export default function MaterialCategoryPage() {
  const { category } = useParams<{ category: string }>();
  const cat = category ? getCategoryBySlug(category) : undefined;
  const caseStudies = category ? getCaseStudiesForCategory(category) : [];

  if (!cat) {
    return (
      <PageContainer className="py-12 text-center">
        <p className="text-[#6b6b6b]">Category not found.</p>
        <Link to="/materials" className="text-[#c6a065] hover:underline mt-4 inline-block">
          ← Materials
        </Link>
      </PageContainer>
    );
  }

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
      {/* Hero – Havenly-style */}
      <section className="bg-white border-b border-stone-200 py-12 sm:py-16">
        <PageContainer>
          <Link
            to="/materials"
            className="inline-flex items-center gap-2 text-[#c6a065] hover:underline text-sm mb-8"
            aria-label="Back to Materials"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Materials
          </Link>
          <h1 className="font-serif text-3xl sm:text-4xl md:text-5xl font-semibold text-[#2c2c2c] mb-4">
            {cat.titleEn}
          </h1>
          <p className="text-lg text-[#6b6b6b] max-w-2xl mb-4">
            {cat.heroSubtitle}
          </p>
          <p className="text-[#6b6b6b] max-w-2xl">
            {cat.description}
          </p>
        </PageContainer>
      </section>

      {/* Case studies */}
      <section className="py-12 sm:py-16" aria-labelledby="projects-heading">
        <PageContainer>
          <h2 id="projects-heading" className="font-serif text-xl sm:text-2xl font-semibold text-[#2c2c2c] mb-8">
            Selected projects
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {caseStudies.map((project) => (
              <article
                key={project.id}
                className="bg-white rounded-xl overflow-hidden border border-stone-100 shadow-sm hover:shadow-md transition-all duration-200 hover:-translate-y-1"
              >
                <div className="aspect-[4/3] overflow-hidden bg-stone-200">
                  <img
                    src={project.image}
                    alt={`${project.title}, ${project.location}`}
                    className="w-full h-full object-cover hover:scale-105 transition duration-300"
                    onError={(e) => {
                      e.currentTarget.onerror = null;
                      e.currentTarget.src = 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&q=85';
                    }}
                  />
                </div>
                <div className="p-6">
                  <div className="flex flex-wrap items-center gap-2 text-sm text-[#6b6b6b] mb-2">
                    <span className="font-medium text-[#c6a065]">{project.category}</span>
                    <span aria-hidden>·</span>
                    <span>{project.location}</span>
                  </div>
                  <h3 className="font-serif text-xl font-semibold text-[#2c2c2c] mb-3">
                    {project.title}
                  </h3>
                  <p className="text-[#6b6b6b] leading-relaxed mb-4">
                    {project.description}
                  </p>
                  <ul className="space-y-2" aria-label="Project features">
                    {project.features.map((f) => (
                      <li key={f} className="flex items-center gap-2 text-sm text-[#2c2c2c]">
                        <CheckCircle2 className="w-4 h-4 text-[#c6a065] flex-shrink-0" aria-hidden />
                        {f}
                      </li>
                    ))}
                  </ul>
                </div>
              </article>
            ))}
          </div>
        </PageContainer>
      </section>

      {/* CTA */}
      <section className="py-12 sm:py-16 border-t border-stone-200 bg-white" aria-label="Contact">
        <PageContainer className="text-center">
          <p className="text-[#6b6b6b] mb-2">
            Get a quote or discuss your project for {cat.titleEn}.
          </p>
          <p className="text-sm text-[#6b6b6b] mb-6 max-w-md mx-auto">
            Visit our showroom to experience materials firsthand, or contact us via WhatsApp for consultations.
          </p>
          <a href={WHATSAPP_LINK} target="_blank" rel="noopener noreferrer" className="btn-primary">
            Contact us
          </a>
        </PageContainer>
      </section>
    </div>
  );
}
