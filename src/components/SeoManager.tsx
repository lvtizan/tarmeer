import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

type SeoMeta = {
  title: string;
  description: string;
  canonicalPath: string;
  image?: string;
};

const SITE_NAME = 'Tarmeer';
const SITE_URL = 'https://www.tarmeer.com';
const DEFAULT_IMAGE = `${SITE_URL}/tarmeer_logo.svg`;

function upsertMeta(selector: string, attr: 'name' | 'property', key: string, content: string) {
  let tag = document.head.querySelector<HTMLMetaElement>(selector);
  if (!tag) {
    tag = document.createElement('meta');
    tag.setAttribute(attr, key);
    document.head.appendChild(tag);
  }
  tag.setAttribute('content', content);
}

function upsertCanonical(url: string) {
  let link = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!link) {
    link = document.createElement('link');
    link.setAttribute('rel', 'canonical');
    document.head.appendChild(link);
  }
  link.setAttribute('href', url);
}

function getSeoForPath(pathname: string): SeoMeta {
  if (pathname === '/') {
    return {
      title: 'Tarmeer | Interior Design & Renovation in UAE',
      description: 'Find top renovation companies and design studios in Dubai, Sharjah and across the UAE. Compare portfolios and start your project with Tarmeer.',
      canonicalPath: '/',
    };
  }

  if (pathname.startsWith('/companies/')) {
    return {
      title: 'Company Portfolio | Tarmeer UAE',
      description: 'Browse company portfolios, project cases, and services on Tarmeer. Connect with verified renovation companies in the UAE.',
      canonicalPath: pathname,
    };
  }

  if (pathname === '/companies') {
    return {
      title: 'Find Renovation Companies in UAE | Tarmeer',
      description: 'Explore verified renovation companies and design studios in Dubai, Sharjah, and Abu Dhabi. Filter by service and city.',
      canonicalPath: '/companies',
    };
  }

  // Legacy /designers paths redirect to /companies, but handle SEO gracefully
  if (pathname.startsWith('/designers')) {
    return {
      title: 'Find Renovation Companies in UAE | Tarmeer',
      description: 'Explore verified renovation companies and design studios in the UAE.',
      canonicalPath: '/companies',
    };
  }

  if (pathname === '/materials') {
    return {
      title: 'Materials & Showrooms | Tarmeer',
      description: 'Discover showroom materials, furniture, lighting, and finishing brands for your home project in the UAE.',
      canonicalPath: '/materials',
    };
  }

  if (pathname === '/contact') {
    return {
      title: 'Contact Tarmeer',
      description: 'Contact Tarmeer for interior design, renovation, and project consultations in the UAE.',
      canonicalPath: '/contact',
    };
  }

  if (pathname === '/services/new-home-design') {
    return {
      title: 'New Home Full Case Design | Tarmeer',
      description: 'Explore Tarmeer new home full case design packages with floor plans, visuals, and construction drawings.',
      canonicalPath: '/services/new-home-design',
    };
  }

  if (pathname === '/services/soft-decoration') {
    return {
      title: 'Soft Decoration Design | Tarmeer',
      description: 'Explore soft decoration and interior styling packages for villas, apartments, and family homes.',
      canonicalPath: '/services/soft-decoration',
    };
  }

  if (pathname === '/services/house-exterior') {
    return {
      title: 'House Exterior Design | Tarmeer',
      description: 'Explore exterior design packages for villas and standalone homes with facade direction and construction-ready documentation.',
      canonicalPath: '/services/house-exterior',
    };
  }

  return {
    title: 'Tarmeer | Interior Design & Renovation Platform UAE',
    description: 'Tarmeer connects homeowners with renovation companies, design studios, and trusted renovation services in the UAE.',
    canonicalPath: pathname,
  };
}

export default function SeoManager() {
  const location = useLocation();

  useEffect(() => {
    const seo = getSeoForPath(location.pathname);
    const canonicalUrl = `${SITE_URL}${seo.canonicalPath}`;
    const image = seo.image || DEFAULT_IMAGE;

    document.title = seo.title;
    upsertMeta('meta[name="description"]', 'name', 'description', seo.description);
    upsertMeta('meta[name="robots"]', 'name', 'robots', 'index,follow,max-image-preview:large');

    upsertMeta('meta[property="og:type"]', 'property', 'og:type', 'website');
    upsertMeta('meta[property="og:site_name"]', 'property', 'og:site_name', SITE_NAME);
    upsertMeta('meta[property="og:title"]', 'property', 'og:title', seo.title);
    upsertMeta('meta[property="og:description"]', 'property', 'og:description', seo.description);
    upsertMeta('meta[property="og:url"]', 'property', 'og:url', canonicalUrl);
    upsertMeta('meta[property="og:image"]', 'property', 'og:image', image);

    upsertMeta('meta[name="twitter:card"]', 'name', 'twitter:card', 'summary_large_image');
    upsertMeta('meta[name="twitter:title"]', 'name', 'twitter:title', seo.title);
    upsertMeta('meta[name="twitter:description"]', 'name', 'twitter:description', seo.description);
    upsertMeta('meta[name="twitter:image"]', 'name', 'twitter:image', image);

    upsertCanonical(canonicalUrl);
  }, [location.pathname]);

  return null;
}
