import { Link } from 'react-router-dom';
import { getCurrentConfig } from '../../config/site-config';

export default function Banner() {
  const config = getCurrentConfig();

  return (
    <section className="relative min-h-[60vh] sm:min-h-[70vh] flex items-center justify-center overflow-hidden">
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage: `url(https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?w=1920&q=85)`,
        }}
      />
      <div className="absolute inset-0 bg-black/40" />

      <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 text-center text-white">
        <h1 className="font-serif text-4xl sm:text-5xl md:text-6xl font-semibold tracking-tight mb-4">
          {config.bannerTitle}
        </h1>
        <p className="text-lg sm:text-xl text-white/90 mb-8 max-w-2xl mx-auto">
          {config.bannerSubtitle}
        </p>
        <Link to="/#designers" className="btn-primary text-white">
          {config.bannerCta}
        </Link>
      </div>
    </section>
  );
}
