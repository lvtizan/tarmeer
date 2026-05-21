import { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { Check } from 'lucide-react';
import TarmeerLogo from '../components/TarmeerLogo';

type Lang = 'en' | 'zh';

const API_BASE = import.meta.env.VITE_API_URL?.trim() || '/api';

// ── Fetch real supplier product images for visual mockups ────────────────────
function useSupplierImages(count: number): string[] {
  const [images, setImages] = useState<string[]>([]);
  useEffect(() => {
    fetch(`${API_BASE}/suppliers?limit=20`)
      .then(r => r.ok ? r.json() : Promise.reject())
      .then((data: any) => {
        const suppliers: any[] = Array.isArray(data) ? data : (data.suppliers || []);
        const imgs: string[] = [];
        for (const s of suppliers) {
          const cover = s.cover_url || s.cover_image_url;
          if (cover && typeof cover === 'string' && !imgs.includes(cover)) imgs.push(cover);
          const products = s.products || s.product_images;
          if (Array.isArray(products)) {
            for (const p of products) {
              const url = typeof p === 'string' ? p : (p?.image_url || p?.url);
              if (url && !imgs.includes(url)) imgs.push(url);
              if (imgs.length >= count) break;
            }
          }
          if (imgs.length >= count) break;
        }
        if (imgs.length >= 3) setImages(imgs.slice(0, count));
      })
      .catch(() => {});
  }, [count]);
  return images;
}

// Fallback gradients (when API images aren't loaded)
const FALLBACK_GRADS = [
  'linear-gradient(135deg, #9a7d5a 0%, #c9a96e 100%)',
  'linear-gradient(135deg, #4a5d3a 0%, #7a8e5e 100%)',
  'linear-gradient(135deg, #5c4a3a 0%, #8e7d5a 100%)',
  'linear-gradient(135deg, #3a4a5c 0%, #5e7d8e 100%)',
  'linear-gradient(135deg, #6a4a3a 0%, #9e7d5a 100%)',
];

// ── Step 1: Supplier registration form ───────────────────────────────────────
function Step1Image({ lang }: { lang: Lang }) {
  const zh = lang === 'zh';
  const fields = zh
    ? [
        { label: '姓名', placeholder: '您的姓名' },
        { label: '邮箱', placeholder: 'you@supplier.com' },
        { label: '手机号', placeholder: '+971 50 000 0000' },
        { label: '密码', placeholder: '••••••••' },
      ]
    : [
        { label: 'Full Name', placeholder: 'Your full name' },
        { label: 'Email', placeholder: 'you@supplier.com' },
        { label: 'Phone', placeholder: '+971 50 000 0000' },
        { label: 'Password', placeholder: '••••••••' },
      ];
  return (
    <div className="h-full overflow-hidden flex items-start justify-center pt-4"
      style={{ background: 'linear-gradient(160deg, #1a1410 0%, #2d1f0e 100%)' }}>
      <div style={{ transform: 'scale(0.62)', transformOrigin: 'top center', width: '100%' }}>
        <div className="bg-white rounded-2xl mx-4 px-5 pt-5 pb-4 shadow-2xl">
          <div className="text-[22px] font-bold text-[#1a1410] mb-1"
            style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
            {zh ? '注册供应商账号' : 'Join as a Supplier'}
          </div>
          <div className="text-[13px] text-stone-400 mb-4">
            {zh ? '上架材料，触达 UAE 设计公司' : 'List your materials & reach UAE design firms'}
          </div>

          {/* Google */}
          <div className="h-11 rounded-xl border border-stone-200 flex items-center justify-center gap-2.5 mb-3">
            <svg width="18" height="18" viewBox="0 0 48 48">
              <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
              <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
              <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
              <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.31-8.16 2.31-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
            </svg>
            <span className="text-[13px] font-medium text-stone-700">
              {zh ? '使用 Google 登录' : 'Continue with Google'}
            </span>
          </div>
          <div className="flex items-center gap-3 mb-3">
            <div className="flex-1 h-px bg-stone-200" />
            <span className="text-[10px] text-stone-400 uppercase tracking-wider">
              {zh ? '或使用邮箱' : 'or with email'}
            </span>
            <div className="flex-1 h-px bg-stone-200" />
          </div>

          {fields.map(f => (
            <div key={f.label} className="mb-3">
              <div className="text-[11px] font-semibold text-stone-400 uppercase tracking-wider mb-1">{f.label}</div>
              <div className="h-11 rounded-xl bg-stone-50 border border-stone-200 flex items-center px-4">
                <span className="text-[13px] text-stone-300">{f.placeholder}</span>
              </div>
            </div>
          ))}
          <div className="mt-4 h-12 rounded-xl flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #b8864a 0%, #d4a96a 100%)' }}>
            <span className="text-white font-semibold text-[15px]">
              {zh ? '创建账号 →' : 'Create Account →'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Step 2: Email verification ───────────────────────────────────────────────
function Step2Image({ lang }: { lang: Lang }) {
  const zh = lang === 'zh';
  return (
    <div className="h-full overflow-hidden flex items-start justify-center bg-[#f5f0ea] pt-4">
      <div style={{ transform: 'scale(0.66)', transformOrigin: 'top center', width: '100%' }}>
        <div className="bg-white rounded-2xl mx-4 px-6 pt-6 pb-6 shadow-2xl text-center">
          <div className="w-14 h-14 rounded-2xl bg-[#f5ede0] flex items-center justify-center mx-auto mb-4">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#b8864a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="4" width="20" height="16" rx="2"/>
              <path d="m22 7-10 7L2 7"/>
            </svg>
          </div>
          <div className="text-[20px] font-bold text-[#1a1410] mb-1.5"
            style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
            {zh ? '请查收邮件' : 'Check Your Inbox'}
          </div>
          <div className="text-[13px] text-stone-500 mb-4 leading-relaxed px-2">
            {zh ? '我们已向以下地址发送验证链接' : 'We sent a verification link to'}<br />
            <strong className="text-[#1a1410]">you@supplier.com</strong>
          </div>
          <div className="bg-[#fdf8f2] border border-[#b8864a]/20 rounded-xl px-4 py-3 mb-4 text-left">
            <div className="text-[11px] text-stone-500 mb-1">From: Tarmeer &lt;noreply@tarmeer.com&gt;</div>
            <div className="text-[12.5px] font-semibold text-[#1a1410] mb-1">
              {zh ? '验证您的供应商账号' : 'Verify your supplier account'}
            </div>
            <div className="text-[11.5px] text-stone-500">
              {zh ? '点击按钮激活账号...' : 'Click the button to activate...'}
            </div>
            <div className="mt-2 inline-flex h-7 px-3 rounded-md items-center text-[11px] font-semibold text-white"
              style={{ background: '#b8864a' }}>
              {zh ? '验证邮箱 →' : 'Verify Email →'}
            </div>
          </div>
          <div className="text-[11px] text-stone-400">
            {zh ? '没收到？30 秒后重新发送' : "Didn't receive it? Resend in 30s"}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Step 3: Profile (categories pickable) ────────────────────────────────────
function Step3Image({ lang }: { lang: Lang }) {
  const zh = lang === 'zh';
  const cats = zh
    ? [
        { name: '家具', selected: true },
        { name: '石材', selected: true },
        { name: '灯具', selected: false },
        { name: '地板', selected: true },
        { name: '橱柜', selected: false },
        { name: '窗帘', selected: false },
        { name: '涂料', selected: false },
        { name: '五金', selected: false },
      ]
    : [
        { name: 'Furniture', selected: true },
        { name: 'Stone', selected: true },
        { name: 'Lighting', selected: false },
        { name: 'Flooring', selected: true },
        { name: 'Kitchen', selected: false },
        { name: 'Curtains', selected: false },
        { name: 'Paint', selected: false },
        { name: 'Hardware', selected: false },
      ];
  return (
    <div className="h-full overflow-hidden flex items-start justify-center bg-[#faf9f7] pt-4">
      <div style={{ transform: 'scale(0.7)', transformOrigin: 'top center', width: '100%' }}>
        <div className="bg-white rounded-2xl mx-4 px-5 pt-5 pb-4 shadow-2xl">
          <div className="text-[19px] font-bold text-[#1a1410] mb-1"
            style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
            {zh ? '供应商资料' : 'Your Supplier Profile'}
          </div>
          <div className="text-[12px] text-stone-400 mb-4">
            {zh ? '告诉设计公司您的供货专长' : 'Tell design firms what you specialise in'}
          </div>

          <div className="mb-3">
            <div className="text-[11px] font-semibold text-stone-400 uppercase tracking-wider mb-1.5">
              {zh ? '公司名称' : 'Company Name'}
            </div>
            <div className="h-11 rounded-xl bg-stone-50 border border-stone-200 flex items-center px-4">
              <span className="text-[13px] text-[#1a1410]">Al Andalus Stone Trading</span>
            </div>
          </div>

          <div className="mb-3">
            <div className="text-[11px] font-semibold text-stone-400 uppercase tracking-wider mb-1.5">
              {zh ? '供货类别' : 'Categories'}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {cats.map(c => (
                <span key={c.name} className={`px-3 py-1.5 rounded-full text-[11.5px] font-medium ${
                  c.selected
                    ? 'bg-[#b8864a] text-white'
                    : 'bg-stone-100 text-stone-500 border border-stone-200'
                }`}>{c.name}</span>
              ))}
            </div>
          </div>

          <div className="mb-3">
            <div className="text-[11px] font-semibold text-stone-400 uppercase tracking-wider mb-1.5">
              {zh ? '公司简介' : 'Description'}
            </div>
            <div className="rounded-xl bg-stone-50 border border-stone-200 px-4 py-2.5 text-[12px] text-stone-500 leading-relaxed">
              {zh
                ? '进口优质天然石材 —— 大理石、石灰华、缟玛瑙，产地意大利、土耳其、西班牙。2014 年起扎根 UAE。'
                : 'Importer of premium natural stone — marble, travertine, onyx — sourced from quarries in Italy, Turkey & Spain. UAE-based since 2014.'}
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <div className="w-12 h-12 rounded-xl bg-[#f5ede0] flex items-center justify-center flex-shrink-0">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#b8864a" strokeWidth="2" strokeLinecap="round">
                <rect x="3" y="3" width="18" height="18" rx="2"/>
                <circle cx="8.5" cy="8.5" r="1.5" fill="#b8864a"/>
                <polyline points="21 15 16 10 5 21"/>
              </svg>
            </div>
            <div className="text-[12px] text-stone-500">
              {zh ? '上传 Logo 和封面图（推荐）' : 'Upload logo & cover image (recommended)'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Step 4: Products grid + catalog list ─────────────────────────────────────
function Step4Image({ images, lang }: { images: string[]; lang: Lang }) {
  const zh = lang === 'zh';
  return (
    <div className="h-full bg-[#faf9f7] overflow-hidden flex items-start justify-center pt-4">
      <div style={{ transform: 'scale(0.78)', transformOrigin: 'top center', width: '100%' }}>
        <div className="mx-4">
          {/* Title bar */}
          <div className="flex items-center justify-between mb-2">
            <div className="text-[14px] font-semibold text-[#1a1410]">
              {zh ? '产品' : 'Products'}
            </div>
            <div className="text-[11px] text-stone-400">
              {zh ? '已上传 12 件' : '12 uploaded'}
            </div>
          </div>

          {/* 4-photo product grid */}
          <div className="grid grid-cols-4 gap-1.5 mb-3" style={{ height: '70px' }}>
            {[0, 1, 2, 3].map(i => (
              <div key={i} className="rounded-lg overflow-hidden">
                {images[i]
                  ? <img src={images[i]} alt="" className="w-full h-full object-cover" loading="lazy" />
                  : <div className="w-full h-full" style={{ background: FALLBACK_GRADS[i % FALLBACK_GRADS.length] }} />}
              </div>
            ))}
          </div>

          {/* Add product card */}
          <div className="border-2 border-dashed border-[#b8864a]/40 rounded-xl bg-[#fdf8f2] p-3 mb-3 flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#f5ede0] flex items-center justify-center flex-shrink-0">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#b8864a" strokeWidth="2.5" strokeLinecap="round">
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
            </div>
            <div>
              <div className="text-[12px] font-semibold text-[#1a1410]">
                {zh ? '添加产品照片' : 'Add product photo'}
              </div>
              <div className="text-[11px] text-stone-400">
                {zh ? '标题、类别及可选价格' : 'Title, category & price (optional)'}
              </div>
            </div>
          </div>

          {/* Catalog list */}
          <div className="text-[14px] font-semibold text-[#1a1410] mb-2">
            {zh ? '产品目录 (PDF)' : 'Catalogs (PDF)'}
          </div>
          <div className="space-y-1.5">
            {[
              { name: '2026 Marble Collection.pdf', size: '4.2 MB' },
              { name: 'Travertine Pricing.pdf', size: '1.8 MB' },
            ].map(c => (
              <div key={c.name} className="flex items-center gap-2.5 bg-white border border-stone-200 rounded-lg px-3 py-2">
                <div className="w-7 h-7 rounded-md bg-red-50 flex items-center justify-center flex-shrink-0">
                  <span className="text-[9px] font-bold text-red-500">PDF</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[12px] font-medium text-[#1a1410] truncate">{c.name}</div>
                  <div className="text-[10.5px] text-stone-400">{c.size}</div>
                </div>
                <div className="text-[#b8864a]">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                    <polyline points="7 10 12 15 17 10"/>
                    <line x1="12" y1="15" x2="12" y2="3"/>
                  </svg>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Step 5: WhatsApp lead from a design company ──────────────────────────────
function Step5Image({ lang }: { lang: Lang }) {
  const zh = lang === 'zh';
  const rows = zh
    ? [
        ['公司', 'Sahara Design Studio'],
        ['联系人', 'Layla Haddad · 高级设计师'],
        ['采购需求', '石灰华地板 · 350 平方米'],
        ['项目', '迪拜山庄别墅翻新'],
      ]
    : [
        ['Firm', 'Sahara Design Studio'],
        ['Contact', 'Layla Haddad · Senior Designer'],
        ['Looking for', 'Travertine flooring · 350 sqm'],
        ['Project', 'Villa renovation, Dubai Hills'],
      ];
  return (
    <div className="h-full overflow-hidden flex flex-col" style={{ background: '#dfe7d0' }}>
      <div className="flex-shrink-0 px-3 py-2.5 flex items-center gap-2.5"
        style={{ background: '#075E54' }}>
        <div className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-white text-[14px] flex-shrink-0"
          style={{ background: '#25D366' }}>T</div>
        <div className="flex-1 min-w-0">
          <div className="text-white text-[12px] font-semibold">
            {zh ? 'Tarmeer 供应商询盘' : 'Tarmeer Supplier Leads'}
          </div>
          <div className="text-white/60 text-[10px]">online</div>
        </div>
        <div className="flex gap-2.5">
          <div className="w-4 h-4 rounded-full bg-white/10" />
          <div className="w-4 h-4 rounded-full bg-white/10" />
        </div>
      </div>

      <div className="flex-1 px-2.5 py-2.5 flex flex-col gap-2 overflow-hidden">
        <div className="bg-white rounded-xl rounded-tl-sm px-3 py-2 shadow-sm">
          <div className="text-[11px] font-bold mb-1.5" style={{ color: '#075E54' }}>
            {zh ? '来自设计公司的新询盘' : 'New Inquiry from Design Firm'}
          </div>
          <div className="space-y-0.5">
            {rows.map(([k, v]) => (
              <div key={k} className="text-[11px] text-stone-700">
                <span className="text-stone-400">{k}: </span><strong>{v}</strong>
              </div>
            ))}
          </div>
          <div className="text-[9px] text-stone-400 text-right mt-1.5">10:18 AM ✓✓</div>
        </div>

        <div className="bg-white rounded-xl rounded-tl-sm px-3 py-2 shadow-sm">
          <div className="text-[11px] text-stone-700 flex items-center gap-1.5">
            <span style={{ color: '#25D366' }}>📞</span>
            <strong>+971 50 234 5678</strong>
          </div>
          <div className="text-[10px] text-stone-400 mt-0.5">
            {zh ? '点击拨打或发消息给设计师' : 'Tap to call or message the designer'}
          </div>
          <div className="text-[9px] text-stone-400 text-right mt-1">10:18 AM ✓✓</div>
        </div>
      </div>
    </div>
  );
}

// ── Step data ────────────────────────────────────────────────────────────────
const STEPS_EN = [
  {
    num: '01',
    time: '~2 min',
    title: 'Sign Up Your Supplier Account',
    body: 'Use Google or your email to create a supplier account. Tarmeer is free to join — you only pay when a deal closes.',
    highlights: [
      'One-click Google sign-up',
      'Or email + password',
      'Phone number for WhatsApp leads',
    ],
  },
  {
    num: '02',
    time: '~1 min',
    title: 'Verify Your Email',
    body: "We'll email you a verification link. Click it to activate your supplier account.",
    highlights: [
      'Email arrives within 30 seconds',
      'Skip this step entirely with Google sign-in',
    ],
  },
  {
    num: '03',
    time: '~5 min',
    title: 'Complete Your Supplier Profile',
    body: 'Pick the categories you supply (stone, lighting, flooring, kitchen, hardware…), add a description, and upload your logo & cover image.',
    highlights: [
      'Pick 1–5 supplier categories',
      'Brief company description (origin, years in UAE)',
      'Logo & cover for your public listing',
    ],
    active: true,
  },
  {
    num: '04',
    time: '~10 min · Required',
    title: 'Upload Products & Catalogs',
    body: 'Add product photos and PDF catalogs. The richer your profile, the higher you rank when designers search materials.',
    highlights: [
      'Product photos with title, category & optional price',
      'PDF catalogs (collections / pricing)',
      'More products + catalogs = higher search ranking',
    ],
  },
  {
    num: '05',
    time: 'Automated',
    title: 'Receive Design Firm Inquiries',
    body: 'When a design firm needs your category of materials, Tarmeer pushes the lead straight to you with the firm name, designer contact, and project scope.',
    highlights: [
      "WhatsApp notification with designer's name, project & contact",
      'You reach out directly — no middlemen, no commission',
    ],
  },
];

const STEPS_ZH = [
  {
    num: '01',
    time: '约 2 分钟',
    title: '注册供应商账号',
    body: '通过 Google 或邮箱注册供应商账号。加入 Tarmeer 完全免费 —— 只在成交时收费。',
    highlights: [
      '一键 Google 登录',
      '或使用邮箱 + 密码',
      '手机号用于接收 WhatsApp 询盘',
    ],
  },
  {
    num: '02',
    time: '约 1 分钟',
    title: '验证您的邮箱',
    body: '我们会向您发送验证链接，点击后即可激活供应商账号。',
    highlights: [
      '验证邮件 30 秒内送达',
      '使用 Google 登录可跳过此步骤',
    ],
  },
  {
    num: '03',
    time: '约 5 分钟',
    title: '完善供应商资料',
    body: '选择您的供货类别（石材、灯具、地板、橱柜、五金…），填写公司简介，上传 Logo 和封面图。',
    highlights: [
      '选择 1–5 个供货类别',
      '简短公司介绍（产地、在 UAE 年限）',
      'Logo 和封面图用于公开展示',
    ],
    active: true,
  },
  {
    num: '04',
    time: '约 10 分钟（必填）',
    title: '上传产品与产品目录',
    body: '上传产品照片和 PDF 目录。资料越丰富，设计师搜索材料时排名越靠前。',
    highlights: [
      '产品照片：标题、类别和可选价格',
      'PDF 目录（系列 / 报价单）',
      '产品越多 + 目录越全 = 搜索排名越高',
    ],
  },
  {
    num: '05',
    time: '自动推送',
    title: '接收设计公司询盘',
    body: '当设计公司需要您所属类别的材料时，Tarmeer 会直接将线索推送给您，包含公司名称、设计师联系方式和项目范围。',
    highlights: [
      'WhatsApp 通知附带设计师姓名、项目信息和联系方式',
      '直接与对方沟通 —— 无中间商，无佣金',
    ],
  },
];

// ── Page ─────────────────────────────────────────────────────────────────────
export default function SupplierStartGuidePage() {
  const [lang, setLang] = useState<Lang>('en');
  const images = useSupplierImages(8);

  const zh = lang === 'zh';
  const STEPS = zh ? STEPS_ZH : STEPS_EN;

  const renderImage = (index: number) => {
    if (index === 0) return <Step1Image lang={lang} />;
    if (index === 1) return <Step2Image lang={lang} />;
    if (index === 2) return <Step3Image lang={lang} />;
    if (index === 3) return <Step4Image images={images.slice(0, 4)} lang={lang} />;
    return <Step5Image lang={lang} />;
  };

  return (
    <div className="min-h-screen bg-[#faf8f5] font-sans">
      <Helmet>
        <title>How to Get Started as a Supplier on Tarmeer | Material Supplier Onboarding</title>
        <meta name="description" content="Step-by-step guide for material suppliers joining Tarmeer UAE. List your products & catalogs, get matched to design firms, receive verified inquiries via WhatsApp." />
        <meta property="og:title" content="How to Get Started as a Supplier on Tarmeer" />
        <meta property="og:description" content="List your products & catalogs and receive verified design-firm inquiries across UAE." />
        <meta property="og:image" content="https://www.tarmeer.com/images/tarmeer_logo.svg" />
        <meta property="og:url" content="https://www.tarmeer.com/start-suppliers" />
        <meta property="og:type" content="website" />
        <meta name="robots" content="index, follow" />
        <link rel="canonical" href="https://www.tarmeer.com/start-suppliers" />
        <script type="application/ld+json">{JSON.stringify({
          "@context": "https://schema.org",
          "@type": "HowTo",
          "name": "How to Join Tarmeer as a Material Supplier",
          "description": "Step-by-step guide for material suppliers joining Tarmeer UAE.",
          "totalTime": "PT20M",
          "step": STEPS_EN.map((s, i) => ({
            "@type": "HowToStep",
            "position": i + 1,
            "name": s.title,
            "text": s.body,
          })),
        })}</script>
      </Helmet>

      {/* ── Header ── */}
      <header className="h-14 bg-white border-b border-stone-100 flex items-center px-4">
        <div className="max-w-2xl mx-auto w-full flex items-center justify-between">
          <TarmeerLogo />
          {/* Language toggle */}
          <div className="flex items-center gap-1 bg-stone-100 rounded-full p-1">
            <button
              onClick={() => setLang('en')}
              className={`px-3 py-1 rounded-full text-[13px] font-medium transition-all ${
                lang === 'en'
                  ? 'bg-white text-[#1a1410] shadow-sm'
                  : 'text-stone-500 hover:text-stone-700'
              }`}
            >
              EN
            </button>
            <button
              onClick={() => setLang('zh')}
              className={`px-3 py-1 rounded-full text-[13px] font-medium transition-all ${
                lang === 'zh'
                  ? 'bg-white text-[#1a1410] shadow-sm'
                  : 'text-stone-500 hover:text-stone-700'
              }`}
            >
              中文
            </button>
          </div>
        </div>
      </header>

      {/* ── Hero ── */}
      <section
        className="relative overflow-hidden text-center px-6 py-12"
        style={{ background: 'linear-gradient(160deg, #1a1410 0%, #2d1f0e 60%, #3d2910 100%)' }}
      >
        <div className="absolute -top-16 -right-16 w-72 h-72 rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(184,134,74,0.18) 0%, transparent 70%)' }} />
        <div className="absolute -bottom-20 -left-10 w-64 h-64 rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(184,134,74,0.12) 0%, transparent 70%)' }} />

        <div className="relative z-10 max-w-lg mx-auto">
          <div className="inline-flex items-center gap-2 border border-[#b8864a]/30 bg-[#b8864a]/15 text-[#d4a96a] text-[12px] font-semibold tracking-[0.12em] uppercase px-4 py-1.5 rounded-full mb-5">
            {zh ? '✦ 面向材料供应商' : '✦ For Material Suppliers'}
          </div>

          <h1 className="text-[clamp(32px,8vw,52px)] font-bold leading-[1.15] text-white mb-4"
            style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
            {zh ? (
              <>在 Tarmeer 触达<br /><em className="not-italic text-[#d4a96a]">UAE 设计公司</em></>
            ) : (
              <>Reach UAE Design Firms<br />on{' '}<em className="not-italic text-[#d4a96a]">Tarmeer</em></>
            )}
          </h1>

          <p className="text-[17px] text-white/60 font-light max-w-sm mx-auto leading-relaxed">
            {zh
              ? '一次性上传您的产品与目录，Tarmeer 自动将您推送给正在采购您类别材料的设计公司。'
              : 'List your products & catalogs once. Tarmeer pushes you to design firms actively sourcing your category.'}
          </p>
        </div>
      </section>

      {/* ── Section heading ── */}
      <div className="text-center px-6 pt-10 pb-6">
        <span className="text-[12px] font-semibold tracking-[0.14em] uppercase text-[#b8864a] block mb-2">
          {zh ? '操作流程' : 'How it works'}
        </span>
        <h2 className="text-[clamp(24px,6vw,36px)] font-semibold text-[#1a1410] leading-snug"
          style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
          {zh ? (
            <>五步完成入驻<br />拿到第一个设计公司询盘</>
          ) : (
            <>Five steps to your<br />first design-firm lead</>
          )}
        </h2>
        <p className="text-[15px] text-[#7a6a5a] mt-2 max-w-xs mx-auto">
          {zh
            ? '大多数供应商在 20 分钟内完成全部设置。'
            : 'Most suppliers complete the full setup in under 20 minutes.'}
        </p>
      </div>

      {/* ── Steps ── */}
      <div className="px-5 pb-12 max-w-xl mx-auto">
        {STEPS.map((step, i) => (
          <div key={step.num}>
            {i > 0 && (
              <div className="flex justify-center my-1">
                <div className="w-px h-5 bg-[#e8ddd0]" />
              </div>
            )}

            <div className={`rounded-[20px] overflow-hidden border bg-white shadow-sm ${
              step.active
                ? 'border-[#b8864a]/30 shadow-[0_4px_28px_rgba(184,134,74,0.10)]'
                : 'border-[#e8ddd0]'
            }`}>
              <div className="relative overflow-hidden" style={{ height: 280 }}>
                {renderImage(i)}
              </div>

              <div className="px-5 py-4">
                <div className="flex items-center gap-3 mb-2.5">
                  <span className={`text-[36px] font-bold leading-none tabular-nums ${
                    step.active ? 'text-[#b8864a]' : 'text-[#a89888]'
                  }`} style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
                    {step.num}
                  </span>
                  <span className={`text-[11px] font-semibold tracking-[0.08em] uppercase px-2.5 py-1 rounded-full ${
                    step.active ? 'text-[#b8864a] bg-[#f5ede0]' : 'text-[#7a6a5a] bg-[#f0ebe3]'
                  }`}>
                    {step.time}
                  </span>
                </div>

                <h3 className="text-[20px] font-semibold text-[#1a1410] mb-2 leading-snug"
                  style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
                  {step.title}
                </h3>

                <p className="text-[16px] text-[#7a6a5a] leading-relaxed mb-3">
                  {step.body}
                </p>

                <ul className="space-y-2">
                  {step.highlights.map((h) => (
                    <li key={h} className="flex items-start gap-2.5 text-[15px] text-[#2c2420]">
                      <span className="flex-shrink-0 mt-0.5 w-5 h-5 rounded-full bg-[#f5ede0] flex items-center justify-center">
                        <Check size={10} strokeWidth={2.5} className="text-[#b8864a]" />
                      </span>
                      {h}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Footer ── */}
      <div className="flex flex-wrap justify-center gap-x-8 gap-y-2 px-6 py-6 border-t border-[#e8ddd0]">
        <a href="/for-suppliers" className="text-[14px] text-[#b8864a] font-medium">tarmeer.com/for-suppliers</a>
      </div>
    </div>
  );
}
