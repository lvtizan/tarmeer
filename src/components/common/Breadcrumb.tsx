// 统一面包屑组件（内容页通用）：可见导航 + BreadcrumbList JSON-LD（SEO）。
// 规则：Home 起头，最后一项为当前页（不可点）。明暗两版（dark 用于深色 hero）。
// 用法：<Breadcrumb baseUrl={c.baseUrl} items={[{name:'Home',href:'/'},{name:'Materials',href:'/materials'},{name:'Flooring'}]} />
import Link from 'next/link';
import { jsonLdHtml } from '@/lib/schema/jsonLdScript';

export type Crumb = { name: string; href?: string };

export default function Breadcrumb({
  items,
  baseUrl,
  variant = 'light',
}: {
  items: Crumb[];
  baseUrl: string;
  variant?: 'light' | 'dark';
}) {
  const dark = variant === 'dark';
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((c, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: c.name,
      ...(c.href ? { item: `${baseUrl}${c.href}` } : {}),
    })),
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdHtml(jsonLd) }} />
      <nav
        aria-label="Breadcrumb"
        className={`flex flex-wrap items-center gap-1.5 text-[13px] ${dark ? 'text-white/50' : 'text-stone-400'}`}
      >
        {items.map((c, i) => {
          const isLast = i === items.length - 1;
          return (
            <span key={`${c.name}-${i}`} className="flex items-center gap-1.5">
              {i > 0 && <span className={dark ? 'text-white/30' : 'text-stone-300'}>/</span>}
              {c.href && !isLast ? (
                <Link href={c.href} className={dark ? 'hover:text-white/80' : 'hover:text-[#b8864a]'}>
                  {c.name}
                </Link>
              ) : (
                <span className={dark ? 'text-white/80' : 'font-medium text-stone-600'}>{c.name}</span>
              )}
            </span>
          );
        })}
      </nav>
    </>
  );
}
