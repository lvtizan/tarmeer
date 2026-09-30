 'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { adminApi } from '@/lib/adminApi';
import { useAdminCountry } from '@/contexts/AdminCountryContext';
import { useAdmin } from '@/contexts/AdminContext';

type Product = { id: number; supplier_id: number; title: string | null; title_translated: string | null; category: string | null; flags: string[] };
const issues: Record<string, string> = { translation: '待翻译 / Translation', incomplete: '资料不全 / Incomplete', duplicate: '疑似重复 / Possible duplicate' };
export default function ProductReviewPage() {
  const { country } = useAdminCountry();
  const { hasPermission } = useAdmin();
  const [issue, setIssue] = useState('');
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<{ products: Product[]; total: number; country: string }>({ products: [], total: 0, country });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const version = useRef(0);
  useEffect(() => { setPage(1); setResult({ products: [], total: 0, country }); }, [country]);
  useEffect(() => {
    const current = ++version.current;
    setLoading(true); setError('');
    adminApi.request(`/suppliers/product-review?country=${country}&page=${page}&limit=30${issue ? `&issue=${issue}` : ''}`).then(data => { if (current === version.current) setResult({ ...data, country }); }).catch(() => { if (current === version.current) setError('审核队列加载失败，请重试。'); }).finally(() => { if (current === version.current) setLoading(false); });
    return () => { version.current += 1; };
  }, [country, page, issue, retry]);
  if (!hasPermission('can_view_suppliers')) return <p>没有供应商查看权限。</p>;
  return <div className="space-y-4">
    <Link href="/admin/suppliers" className="text-sm text-[#92652e]">← 供应商管理</Link>
    <h1 className="text-xl font-semibold">商品资料审核 / Product review</h1>
    <p className="text-sm text-stone-700">检查英文名称、分类、图片、价格口径与规格。相同名称仅提示人工核查，不自动删除。型号放在规格的 Model 字段；仅按已确认资料维护 Material、Availability、Lead time (days) 和 Price basis。</p>
    <label className="block text-sm">审核原因 <select value={issue} onChange={e => { setIssue(e.target.value); setPage(1); }} className="ml-2 rounded-lg border border-stone-300 bg-white p-2"><option value="">全部待审核</option>{Object.entries(issues).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
    {error ? <div role="alert">{error} <button onClick={() => setRetry(n => n + 1)} className="underline">重试</button></div> : loading || result.country !== country ? <p role="status">加载中…</p> : <>
      <p className="text-sm">{result.total} 件商品需要检查</p>
      <div className="overflow-x-auto rounded-xl border border-stone-200 bg-white"><table className="w-full text-left text-sm"><thead><tr className="border-b border-stone-200"><th className="p-3">商品</th><th className="p-3">分类</th><th className="p-3">审核原因</th><th className="p-3">操作</th></tr></thead><tbody>{result.products.map(product => <tr key={product.id} className="border-b border-stone-100"><td className="p-3"><p className="font-medium">#{product.id} {product.title_translated || product.title || '未命名'}</p>{product.title_translated && <p className="text-xs text-stone-600">原名：{product.title}</p>}</td><td className="p-3">{product.category || '缺失'}</td><td className="p-3">{product.flags.map(flag => issues[flag] || flag).join(' · ')}</td><td className="p-3"><Link className="whitespace-nowrap font-medium text-[#92652e]" href={`/admin/suppliers/${product.supplier_id}`}>查看并编辑</Link></td></tr>)}</tbody></table></div>
      {!result.products.length && <p>当前条件下没有待审核商品。</p>}
      <div className="flex items-center gap-3"><button disabled={page === 1} onClick={() => setPage(n => n - 1)} className="rounded border border-stone-300 bg-white px-3 py-2 disabled:opacity-40">上一页</button><span>{page} / {Math.max(1, Math.ceil(result.total / 30))}</span><button disabled={page * 30 >= result.total} onClick={() => setPage(n => n + 1)} className="rounded border border-stone-300 bg-white px-3 py-2 disabled:opacity-40">下一页</button></div>
    </>}
  </div>;
}
