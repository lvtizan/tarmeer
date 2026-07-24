'use client';

// Hero 电子书阅读器的客户端包装。
// Next 16：next/dynamic(..., { ssr: false }) 不能在 Server Component 里用，
// 故用本 'use client' 组件包一层，Server 端只引用它。
import dynamic from 'next/dynamic';
import type { SupplierCatalog } from '@/lib/materialsApi';

const CatalogReader = dynamic(() => import('@/components/materials/CatalogReader'), {
  ssr: false,
  loading: () => (
    <div className="flex w-full aspect-video items-center justify-center rounded-2xl bg-[#1c1917]">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/25 border-t-[#e6c88f]" />
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
