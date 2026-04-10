import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { SCROLL_TIMEOUT_MS } from '../lib/constants';
import Banner from '../components/home/Banner';
import PricingSection from '../components/home/PricingSection';
import HomeDesignSection from '../components/home/HomeDesignSection';

export default function HomePage() {
  const location = useLocation();

  useEffect(() => {
    if (location.pathname !== '/') return;
    const hash = location.hash;
    const id = hash === '#pricing' ? 'pricing' : hash === '#companies' ? 'companies' : null;
    if (!id) return;
    const el = document.getElementById(id);
    if (el) {
      const t = setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'start' }), SCROLL_TIMEOUT_MS);
      return () => clearTimeout(t);
    }
  }, [location.pathname, location.hash]);

  return (
    <>
      <Helmet>
        <title>Tarmeer - Find Interior Design & Renovation Companies in UAE</title>
        <meta name="description" content="Connect with top interior designers, renovation companies, and fit-out professionals across Dubai, Abu Dhabi, and UAE. Browse portfolios, compare services, get free quotes." />
        <meta property="og:title" content="Tarmeer - Find Interior Design & Renovation Companies in UAE" />
        <meta property="og:description" content="Connect with top interior designers and renovation companies in UAE." />
        <meta property="og:image" content="https://www.tarmeer.com/images/tarmeer_logo.svg" />
        <meta property="og:url" content="https://www.tarmeer.com/" />
        <meta property="og:type" content="website" />
        <link rel="canonical" href="https://www.tarmeer.com/" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Tarmeer - Find Interior Design & Renovation Companies in UAE" />
        <meta name="twitter:description" content="Find trusted interior design, renovation and fit-out companies in UAE." />
        <meta name="twitter:image" content="https://www.tarmeer.com/images/tarmeer_logo.svg" />
        <meta name="keywords" content="interior design UAE, renovation companies Dubai, fit-out Abu Dhabi, interior designer, home renovation, Tarmeer, villa design, apartment renovation" />
        <meta name="robots" content="index, follow, max-image-preview:large" />
      </Helmet>
      <Banner />
      <PricingSection />
      <HomeDesignSection />
    </>
  );
}
