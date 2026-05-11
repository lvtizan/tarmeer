import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL?.trim() || '/api';

interface Supplier {
  id: number;
  company_name: string;
  slug: string;
  description: string;
  cover_image_url: string | null;
  logo_url: string | null;
  origin: 'china' | 'dubai';
}

export default function HomeSupplierSection() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);

  useEffect(() => {
    let active = true;
    fetch(`${API_BASE}/suppliers?limit=4&order=home`)
      .then((r) => r.json())
      .then((data) => {
        if (!active) return;
        const list: Supplier[] = Array.isArray(data?.suppliers) ? data.suppliers : Array.isArray(data) ? data : [];
        setSuppliers(list.slice(0, 4));
      })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  if (suppliers.length === 0) return null;

  return (
    <section className="bg-[#faf9f7] py-10 sm:py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-end justify-between mb-6">
          <div>
            <p className="text-[10px] uppercase tracking-[0.22em] text-stone-400 mb-1.5">
              Materials &amp; Products
            </p>
            <h2 className="font-serif text-[24px] leading-tight tracking-[-0.01em] text-[#1c1917] sm:text-[28px]">
              Premium Chinese Suppliers
            </h2>
          </div>
          <Link
            to="/materials"
            className="hidden sm:inline-flex items-center gap-2 text-sm font-medium text-[#b8864a] hover:text-[#9a7040] transition"
          >
            View All
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
          {suppliers.map((s) => (
            <Link
              key={s.id}
              to={`/materials/suppliers/${s.slug}`}
              className="group flex flex-col overflow-hidden rounded-2xl border border-stone-200 bg-white transition hover:border-stone-300 hover:shadow-[0_12px_32px_rgba(28,25,23,0.08)]"
            >
              <div className="relative aspect-[4/3] overflow-hidden bg-stone-100">
                {s.cover_image_url ? (
                  <img
                    src={s.cover_image_url}
                    alt={s.company_name}
                    loading="lazy"
                    className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-stone-100 to-stone-200">
                    <span className="font-serif text-3xl text-stone-300">{s.company_name.charAt(0)}</span>
                  </div>
                )}
                {s.origin === 'china' && (
                  <span className="absolute top-2.5 left-2.5 rounded-full bg-black/50 px-2 py-0.5 text-[10px] text-white/90 backdrop-blur-sm">
                    🇨🇳 China
                  </span>
                )}
              </div>
              <div className="flex flex-col flex-1 p-3.5 sm:p-4">
                <h3 className="font-medium text-[14px] leading-snug text-[#1c1917] group-hover:text-[#b8864a] transition sm:text-[15px]">
                  {s.company_name}
                </h3>
                {s.description && (
                  <p className="mt-1 line-clamp-2 text-[12px] leading-5 text-stone-500 sm:text-[13px]">
                    {s.description}
                  </p>
                )}
              </div>
            </Link>
          ))}
        </div>

        <div className="mt-5 flex justify-center sm:hidden">
          <Link
            to="/materials"
            className="inline-flex items-center gap-2 rounded-full border border-stone-300 px-5 py-2.5 text-sm font-medium text-[#1c1917] transition hover:border-[#b8864a] hover:text-[#b8864a]"
          >
            View All Suppliers
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}
