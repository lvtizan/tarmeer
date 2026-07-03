import type { Metadata } from 'next';
import { headers } from 'next/headers';
import Banner from '@/components/home/Banner';
import HomeDesignSection from '@/components/home/HomeDesignSection';
import HomeSpaceSection from '@/components/home/HomeSpaceSection';
import HomeSupplierSection from '@/components/home/HomeSupplierSection';
import HomeInsightsSection from '@/components/home/HomeInsightsSection';
import { fetchPublicCompanies, fetchGuides } from '@/lib/publicApi';
import { getCountry } from '@/lib/country';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const c = getCountry((await headers()).get('x-country'));
  const cityList = c.cities.slice(0, 2).join(', ');
  return {
    title: `Tarmeer - Find Interior Design & Renovation Companies in ${c.name}`,
    description:
      `Connect with top interior designers, renovation companies, and fit-out professionals across ${cityList}, and ${c.name}. Browse portfolios, compare services, get personalized quotes.`,
    openGraph: {
      title: `Tarmeer - Find Interior Design & Renovation Companies in ${c.name}`,
      description: `Connect with top interior designers and renovation companies in ${c.name}.`,
      url: `${c.baseUrl}/`,
      images: [{ url: `${c.baseUrl}/images/hero/hero-living-1.jpg`, width: 1200, height: 630 }],
    },
    alternates: { canonical: `${c.baseUrl}/` },
    keywords:
      `interior design ${c.name}, renovation companies ${c.cities[0]}, fit-out ${c.cities[1] ?? c.defaultCity}, interior designer, home renovation, Tarmeer, villa design, apartment renovation`,
  };
}

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
  const API_BASE = process.env.NEXT_PUBLIC_API_URL?.trim() || process.env.API_INTERNAL_URL?.trim() || 'http://localhost:3002/api';
  try {
    const res = await fetch(`${API_BASE}/suppliers?limit=4&order=home`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { suppliers?: Supplier[] } | Supplier[];
    return (Array.isArray(data) ? data : ((data as { suppliers?: Supplier[] }).suppliers ?? [])).slice(0, 4);
  } catch (e) {
    console.error('[home] fetchSuppliers failed:', e);
    return [];
  }
}

export default async function HomePage() {
  const headersList = await headers();
  const country = headersList.get('x-country') ?? 'ae';
  const c = getCountry(country);

  const cityList = c.cities.slice(0, 3).join(', ');
  const websiteJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'Tarmeer',
    url: c.baseUrl,
    description: `Find and compare interior design and renovation companies across ${c.name}.`,
    potentialAction: {
      '@type': 'SearchAction',
      target: `${c.baseUrl}/companies?q={search_term_string}`,
      'query-input': 'required name=search_term_string',
    },
  };

  const orgJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Tarmeer',
    url: c.baseUrl,
    logo: `${c.baseUrl}/logo.png`,
    description:
      `${c.name} interior design platform connecting homeowners with verified design companies. Serving 50+ companies across ${cityList}, and other cities.`,
    address: {
      '@type': 'PostalAddress',
      streetAddress: 'Industrial Area 2',
      addressLocality: c.addressLocality,
      addressCountry: c.isoCode,
    },
    contactPoint: {
      '@type': 'ContactPoint',
      telephone: c.telephone,
      contactType: 'customer service',
      availableLanguage: c.code === 'vn' ? ['Vietnamese', 'English'] : ['English', 'Arabic'],
    },
    sameAs: ['https://www.instagram.com/tarmeer.ae/'],
    areaServed: { '@type': 'Country', name: c.fullName },
  };

  const isAe = !country || country === 'ae';
  const [companiesResult, suppliersResult, guidesResult] = await Promise.allSettled([
    fetchPublicCompanies(30, 'home', country),
    isAe ? fetchSuppliers() : Promise.resolve([]),
    fetchGuides(country),
  ]);

  const companies = companiesResult.status === 'fulfilled' ? companiesResult.value : [];
  const suppliers = suppliersResult.status === 'fulfilled' ? suppliersResult.value : [];
  const guides = guidesResult.status === 'fulfilled' ? guidesResult.value : [];

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(orgJsonLd) }} />
      <Banner />
      <HomeDesignSection initialCompanies={companies} />
      <HomeSpaceSection />
      <HomeSupplierSection suppliers={suppliers} />
      <HomeInsightsSection guides={guides} />
    </>
  );
}
