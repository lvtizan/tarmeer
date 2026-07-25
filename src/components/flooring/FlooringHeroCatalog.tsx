'use client';

// Hero 电子书阅读器的客户端包装。
// Next 16：next/dynamic(..., { ssr: false }) 不能在 Server Component 里用，
// 故用本 'use client' 组件包一层，Server 端只引用它。
import dynamic from 'next/dynamic';
import type { SupplierCatalog } from '@/lib/materialsApi';

const CatalogReader = dynamic(() => import('@/components/materials/CatalogReader'), {
  ssr: false,
  loading: () => (
    <div className="flex w-full aspect-video flex-col items-center justify-center gap-3 rounded-2xl bg-[#1c1917] px-10">
      <span className="text-sm text-white/70">Loading…</span>
      <div className="h-1.5 w-52 max-w-[75%] overflow-hidden rounded-full bg-white/15">
        <div className="h-full w-1/3 animate-pulse rounded-full bg-[#e6c88f]" />
      </div>
    </div>
  ),
});

const CATALOGS: SupplierCatalog[] = [
  {
    id: 9000001,
    title: 'Art Flooring Collection',
    file_url: '/uploads/flooring/catalogs/parbro-art.pdf',
    file_size: null,
  },
  {
    id: 9000002,
    title: 'Parquet Series',
    file_url: '/uploads/flooring/catalogs/parbro-parquet.pdf',
    file_size: null,
  },
];

export default function FlooringHeroCatalog() {
  return <CatalogReader catalogs={CATALOGS} />;
}
