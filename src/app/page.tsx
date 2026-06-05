import type { Metadata } from 'next';
import { headers } from 'next/headers';
import Banner from '@/components/home/Banner';
import HomeDesignSection from '@/components/home/HomeDesignSection';
import HomeSpaceSection from '@/components/home/HomeSpaceSection';
import HomeSupplierSection from '@/components/home/HomeSupplierSection';
import { fetchPublicCompanies } from '@/lib/publicApi';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Tarmeer - Find Interior Design & Renovation Companies in UAE',
  description:
    'Connect with top interior designers, renovation companies, and fit-out professionals across Dubai, Abu Dhabi, and UAE. Browse portfolios, compare services, get personalized quotes.',
  openGraph: {
    title: 'Tarmeer - Find Interior Design & Renovation Companies in UAE',
    description: 'Connect with top interior designers and renovation companies in UAE.',
    url: 'https://www.tarmeer.com/',
    images: [{ url: 'https://www.tarmeer.com/images/hero/hero-living-1.jpg', width: 1200, height: 630 }],
  },
  alternates: { canonical: 'https://www.tarmeer.com/' },
  keywords:
    'interior design UAE, renovation companies Dubai, fit-out Abu Dhabi, interior designer, home renovation, Tarmeer, villa design, apartment renovation',
};

const websiteJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: 'Tarmeer',
  url: 'https://www.tarmeer.com',
  description: 'Find and compare interior design and renovation companies across the UAE.',
  potentialAction: {
    '@type': 'SearchAction',
    target: 'https://www.tarmeer.com/companies?q={search_term_string}',
    'query-input': 'required name=search_term_string',
  },
};

const orgJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'Tarmeer',
  url: 'https://www.tarmeer.com',
  logo: 'https://www.tarmeer.com/logo.png',
  description:
    'UAE interior design platform connecting homeowners with verified design companies. Serving 50+ companies across Dubai, Abu Dhabi, Sharjah, and other emirates.',
  address: {
    '@type': 'PostalAddress',
    streetAddress: 'Industrial Area 2',
    addressLocality: 'Sharjah',
    addressCountry: 'AE',
  },
  contactPoint: {
    '@type': 'ContactPoint',
    telephone: '+971-58-838-8922',
    contactType: 'customer service',
    availableLanguage: ['English', 'Arabic'],
  },
  sameAs: ['https://www.instagram.com/tarmeer.ae/'],
  areaServed: { '@type': 'Country', name: 'United Arab Emirates' },
};

interface Supplier {
  id: number;
  company_name: string;
  slug: string;
  description: string;
  cover_image_url: string | null;
  logo_url: string | null;
  origin: 'china' | 'dubai';
}

async function fetchSuppliers(): Promise<Supplier[]> {
  const API_BASE = process.env.NEXT_PUBLIC_API_URL?.trim() || '/api';
  try {
    const res = await fetch(`${API_BASE}/suppliers?limit=4&order=home`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { suppliers?: Supplier[] } | Supplier[];
    return (Array.isArray(data) ? data : ((data as { suppliers?: Supplier[] }).suppliers ?? [])).slice(0, 4);
  } catch {
    return [];
  }
}

export default async function HomePage() {
  const headersList = await headers();
  const country = headersList.get('x-country') ?? 'ae';

  const isAe = !country || country === 'ae';
  const [companiesResult, suppliersResult] = await Promise.allSettled([
    fetchPublicCompanies(30, 'home', country),
    isAe ? fetchSuppliers() : Promise.resolve([]),
  ]);

  const companies = companiesResult.status === 'fulfilled' ? companiesResult.value : [];
  const suppliers = suppliersResult.status === 'fulfilled' ? suppliersResult.value : [];

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(orgJsonLd) }} />
      <Banner />
      <HomeDesignSection initialCompanies={companies} />
      <HomeSpaceSection />
      <HomeSupplierSection suppliers={suppliers} />
    </>
  );
}
