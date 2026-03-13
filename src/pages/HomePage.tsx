import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import Banner from '../components/home/Banner';
import PricingSection from '../components/home/PricingSection';
import DesignersSection from '../components/home/DesignersSection';

export default function HomePage() {
  const location = useLocation();

  useEffect(() => {
    if (location.pathname !== '/') return;
    const hash = location.hash;
    const id = hash === '#pricing' ? 'pricing' : hash === '#designers' ? 'designers' : null;
    if (!id) return;
    const el = document.getElementById(id);
    if (el) {
      const t = setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
      return () => clearTimeout(t);
    }
  }, [location.pathname, location.hash]);

  return (
    <>
      <Banner />
      <PricingSection />
      <DesignersSection />
    </>
  );
}
