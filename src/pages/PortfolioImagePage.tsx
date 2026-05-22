import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { ArrowLeft } from 'lucide-react';
import { resolveImageUrl } from '../lib/imageUrl';

interface SiblingImage {
  url: string;
  tags: string[];
  imageIndex: number;
}

interface PortfolioImageData {
  image: {
    url: string;
    tags: string[];
    imageIndex: number;
  };
  project: {
    id: number;
    title: string;
    slug: string;
    style: string;
    description: string;
    location: string;
  };
  company: {
    id: number;
    name: string;
    slug: string;
    logo: string;
    city: string;
  };
  siblings: SiblingImage[];
}

export default function PortfolioImagePage() {
  const { primaryTag, companySlug, projectSlug, imageIndex } = useParams<{
    primaryTag: string;
    companySlug: string;
    projectSlug: string;
    imageIndex: string;
  }>();

  const [data, setData] = useState<PortfolioImageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!companySlug || !projectSlug || imageIndex === undefined) {
      setError('Image not found.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');

    fetch(`/api/companies/portfolio/image/${companySlug}/${projectSlug}/${imageIndex}`)
      .then(res => {
        if (!res.ok) throw new Error('Not found');
        return res.json();
      })
      .then((json: PortfolioImageData) => {
        setData(json);
        setLoading(false);
      })
      .catch(() => {
        setError('Image not found.');
        setLoading(false);
      });
  }, [companySlug, projectSlug, imageIndex]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <span className="text-[15px] text-[#6b6b6b]">Loading...</span>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <p className="text-[15px] text-[#2c2c2c]">Image not found.</p>
        <Link to="/portfolio" className="text-[#b8864a] underline text-[15px]">
          Back to portfolio
        </Link>
      </div>
    );
  }

  const { image, project, company, siblings } = data;

  const heroUrl = resolveImageUrl(image.url);
  const logoUrl = company.logo ? resolveImageUrl(company.logo) : '';

  // Build absolute og:image URL — /uploads/ paths need full domain prefix
  const ogImage = image.url.startsWith('http')
    ? image.url
    : `https://www.tarmeer.com${image.url.startsWith('/') ? '' : '/'}${image.url}`;

  const pageTitle = `${project.title} — ${company.name} | Tarmeer`;
  const pageDescription = project.description
    ? `${project.description.slice(0, 155)}${project.description.length > 155 ? '...' : ''}`
    : `Interior design project by ${company.name} in ${company.city || project.location || 'UAE'}.`;

  const canonicalUrl = `https://www.tarmeer.com/portfolio/${primaryTag}/${companySlug}/${projectSlug}/${imageIndex}`;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ImageObject',
    contentUrl: ogImage,
    name: `${project.title} — ${company.name}`,
    description: pageDescription,
    url: canonicalUrl,
    author: {
      '@type': 'Organization',
      name: company.name,
      url: `https://www.tarmeer.com/companies/${company.slug}`,
    },
    keywords: image.tags.join(', '),
  };

  // Pick the best sibling tag for its SEO URL
  const sibPrimaryTag = (sib: SiblingImage) =>
    encodeURIComponent(sib.tags[0] || primaryTag || 'portfolio');

  return (
    <>
      <Helmet>
        <title>{pageTitle}</title>
        <meta name="description" content={pageDescription} />
        <meta property="og:title" content={pageTitle} />
        <meta property="og:description" content={pageDescription} />
        <meta property="og:image" content={ogImage} />
        <meta property="og:type" content="article" />
        <link rel="canonical" href={canonicalUrl} />
        <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
      </Helmet>

      <div className="max-w-5xl mx-auto px-4 py-6">
        {/* Back link */}
        <Link
          to={`/portfolio?tag=${encodeURIComponent(primaryTag ?? '')}`}
          className="inline-flex items-center gap-1.5 text-[15px] text-[#b8864a] hover:underline mb-6"
        >
          <ArrowLeft size={16} />
          {primaryTag} Portfolio
        </Link>

        {/* Hero image */}
        <div className="mb-6">
          <img
            src={heroUrl}
            alt={`${project.title} by ${company.name}`}
            className="w-full max-h-[70vh] object-contain rounded-2xl bg-stone-100"
            {...({ fetchpriority: 'high' } as any)}
            loading="eager"
          />
        </div>

        {/* Tag chips */}
        {image.tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-5">
            {image.tags.map(tag => (
              <Link
                key={tag}
                to={`/portfolio?tag=${encodeURIComponent(tag)}`}
                className="px-3 py-1 rounded-2xl border border-stone-200 text-stone-600 text-sm hover:bg-[#b8864a] hover:text-white hover:border-[#b8864a] transition-colors"
              >
                {tag}
              </Link>
            ))}
          </div>
        )}

        {/* Company + project info */}
        <div className="flex flex-col sm:flex-row sm:items-start gap-4 mb-6">
          {logoUrl && (
            <img
              src={logoUrl}
              alt={company.name}
              className="w-14 h-14 rounded-2xl object-cover border border-stone-200 shrink-0"
            />
          )}
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-[#2c2c2c] mb-1">{project.title}</h1>
            <p className="text-[15px] text-[#6b6b6b] mb-1">
              by{' '}
              <Link
                to={`/companies/${company.slug}`}
                className="text-[#b8864a] hover:underline"
              >
                {company.name}
              </Link>
              {(company.city || project.location) && (
                <span> · {company.city || project.location}</span>
              )}
            </p>
            {project.description && (
              <p className="text-[15px] text-[#2c2c2c] line-clamp-3">{project.description}</p>
            )}
          </div>
        </div>

        {/* CTA button */}
        <div className="mb-8">
          <Link
            to={`/companies/${companySlug}/${projectSlug}`}
            className="btn-primary"
          >
            View Full Project
          </Link>
        </div>

        {/* Siblings grid */}
        {siblings.length > 0 && (
          <div>
            <h2 className="text-sm font-medium text-stone-500 mb-3">More from this project</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {siblings.map(sib => {
                const sibUrl = resolveImageUrl(sib.url);
                const sibTag = sibPrimaryTag(sib);
                return (
                  <Link
                    key={sib.imageIndex}
                    to={`/portfolio/${sibTag}/${companySlug}/${projectSlug}/${sib.imageIndex}`}
                    className="block aspect-square overflow-hidden rounded-2xl bg-stone-100 hover:opacity-90 transition-opacity"
                  >
                    <img
                      src={sibUrl}
                      alt={`${project.title} image ${sib.imageIndex + 1}`}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
