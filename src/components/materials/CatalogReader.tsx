'use client';

// 供应商 PDF 图册 → 网页内电子书阅读器。
// - 供应商上传 PDF 即入库，本组件用 pdf.js 在浏览器逐页渲染成电子书（无服务端转换）。
// - 懒渲染：打开只渲当前页，其余空闲后台补；懒加载：整个组件经 next/dynamic(ssr:false) 单独成 chunk。
// - 双层交叉淡出切页（无黑闪）；缩略图/页码/全屏叠加在图上；无下载入口。
// - 多本图册用顶部 tab 切换；catalogs 为空时调用方不渲染本组件。

import { useCallback, useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { Maximize2, X, ChevronLeft, ChevronRight, BookOpen } from 'lucide-react';
import { resolveImageUrl } from '@/lib/imageUrl';
import type { SupplierCatalog } from '@/lib/materialsApi';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

type PdfDoc = Awaited<ReturnType<typeof pdfjsLib.getDocument>['promise']>;

async function renderToCanvas(pdf: PdfDoc, num: number, canvas: HTMLCanvasElement, targetW: number) {
  const page = await pdf.getPage(num);
  const vp0 = page.getViewport({ scale: 1 });
  const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
  const vp = page.getViewport({ scale: (targetW / vp0.width) * dpr });
  canvas.width = vp.width;
  canvas.height = vp.height;
  await page.render({ canvasContext: canvas.getContext('2d')!, viewport: vp }).promise;
  return { w: vp0.width, h: vp0.height };
}

async function renderToDataURL(pdf: PdfDoc, num: number, targetW: number): Promise<string> {
  const c = document.createElement('canvas');
  await renderToCanvas(pdf, num, c, targetW);
  return c.toDataURL('image/jpeg', 0.82);
}

// 流式下载一张图并回报进度（loaded/total）→ 首页有确定进度条。返回 blob URL 直接当图源用。
// 无 Content-Length（拿不到 total）时回报 null = 走不确定态；同源失败(如 CORS)由调用方 catch 回退普通 <img>。
async function fetchWithProgress(url: string, onProgress: (pct: number | null) => void): Promise<string> {
  const resp = await fetch(url);
  if (!resp.ok || !resp.body) throw new Error('fetch failed: ' + resp.status);
  const total = Number(resp.headers.get('Content-Length')) || 0;
  const reader = resp.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    chunks.push(value);
    received += value.length;
    onProgress(total ? Math.min(99, Math.round((received / total) * 100)) : null);
  }
  onProgress(100);
  return URL.createObjectURL(new Blob(chunks as BlobPart[], { type: 'image/webp' }));
}

export default function CatalogReader({ catalogs }: { catalogs: SupplierCatalog[] }) {
  const [activeIdx, setActiveIdx] = useState(0);
  const [numPages, setNumPages] = useState(0);
  const [curPage, setCurPage] = useState(1);
  const [ratio, setRatio] = useState(1.6);
  const [thumbUrls, setThumbUrls] = useState<(string | null)[]>([]);
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState<number | null>(null); // 首页加载进度 %（null=不确定态）
  const [error, setError] = useState(false);
  const [fs, setFs] = useState(false);

  const layer0 = useRef<HTMLImageElement>(null);
  const layer1 = useRef<HTMLImageElement>(null);
  const wrap0 = useRef<HTMLDivElement>(null);
  const wrap1 = useRef<HTMLDivElement>(null);

  const pdfRef = useRef<PdfDoc | null>(null);
  // 全分辨率整页缓存做 LRU（大 PDF 不无限累积 base64）；pending 去重防同页重复渲染
  const urlsRef = useRef<Map<number, string>>(new Map());
  const pendingRef = useRef<Map<number, Promise<string | null>>>(new Map());
  const topRef = useRef(0);
  const seqRef = useRef(0); // 单调递增，切换图册时不重置（否则跨册 id 撞号会串页）
  const targetWRef = useRef(1400);
  // 方案③：有预渲染 WebP 就走 image 模式（拉单页图，秒开），否则回退 pdf 模式（pdf.js 现渲）
  const modeRef = useRef<'pdf' | 'image'>('pdf');
  const pagesBaseRef = useRef('');
  // 预渲染版本号 ?r=<rev>：重渲染换 rev → 打破 nginx 30d immutable 缓存（同名 WebP 内容变了也能刷新）
  const revQueryRef = useRef('');
  const numPagesRef = useRef(0);
  const loadingTaskRef = useRef<ReturnType<typeof pdfjsLib.getDocument> | null>(null);

  const active = catalogs[activeIdx];

  const CACHE_CAP = 12;
  const ensurePage = useCallback(async (p: number): Promise<string | null> => {
    if (p < 1 || p > numPagesRef.current) return null;
    if (modeRef.current === 'image') {
      // 首页可能已带进度预取为 blob（见加载流程），命中直接用；否则给带版本号的 URL，浏览器缓存
      const cachedImg = urlsRef.current.get(p);
      if (cachedImg) return cachedImg;
      return `${pagesBaseRef.current}/${p}.webp${revQueryRef.current}`;
    }
    const pdf = pdfRef.current;
    if (!pdf) return null;
    const cached = urlsRef.current.get(p);
    if (cached) {
      urlsRef.current.delete(p);
      urlsRef.current.set(p, cached); // LRU touch：移到队尾
      return cached;
    }
    const inflight = pendingRef.current.get(p);
    if (inflight) return inflight;
    const task = (async () => {
      try {
        const url = await renderToDataURL(pdf, p, targetWRef.current);
        urlsRef.current.set(p, url);
        while (urlsRef.current.size > CACHE_CAP) {
          const oldest = urlsRef.current.keys().next().value;
          if (oldest === undefined) break;
          urlsRef.current.delete(oldest);
        }
        return url;
      } catch {
        return null; // 渲染被 destroy 打断等：吞掉，避免未处理 rejection
      } finally {
        pendingRef.current.delete(p);
      }
    })();
    pendingRef.current.set(p, task);
    return task;
  }, []);

  const showPage = useCallback(
    async (n: number, mode?: 'open') => {
      if (n < 1 || n > numPagesRef.current) return;
      const my = ++seqRef.current;
      const url = await ensurePage(n);
      if (my !== seqRef.current || !url) return;
      const top = topRef.current;
      const bi = 1 - top;
      const imgs = [layer0.current, layer1.current];
      const wraps = [wrap0.current, wrap1.current];
      const bottomImg = imgs[bi];
      const bottomWrap = wraps[bi];
      const topWrap = wraps[top];
      if (!bottomImg || !bottomWrap || !topWrap) return;
      bottomImg.src = url;
      try {
        if (bottomImg.decode) await bottomImg.decode();
      } catch {
        /* ignore decode abort */
      }
      if (my !== seqRef.current) return;
      if (mode === 'open') {
        bottomWrap.style.zIndex = '2';
        bottomWrap.style.opacity = '1';
      } else {
        // 新页瞬间铺满于下方（关过渡），仅顶层淡出 → 中间不露黑
        bottomWrap.style.transition = 'none';
        bottomWrap.style.zIndex = '1';
        bottomWrap.style.opacity = '1';
        void bottomWrap.offsetWidth;
        bottomWrap.style.transition = '';
        topWrap.style.zIndex = '2';
        void topWrap.offsetWidth;
        topWrap.style.opacity = '0';
      }
      topRef.current = bi;
      setCurPage(n);
      // 预取相邻页，下次切换即时
      void ensurePage(n + 1);
      void ensurePage(n - 1);
    },
    [ensurePage]
  );

  // 加载/切换某本图册
  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    setLoading(true);
    setProgress(null);
    setError(false);
    setNumPages(0);
    setThumbUrls([]);
    setCurPage(1);
    urlsRef.current.forEach((u) => { if (u.startsWith('blob:')) URL.revokeObjectURL(u); });
    urlsRef.current = new Map();
    pendingRef.current = new Map();
    topRef.current = 0;
    // 注意：seqRef 不重置（单调递增），否则旧册在途 showPage 与新册撞号会串页
    // 重置双层
    [wrap0.current, wrap1.current].forEach((w) => {
      if (w) {
        w.style.opacity = '0';
        w.style.transition = '';
      }
    });

    modeRef.current = 'pdf';
    pagesBaseRef.current = '';
    revQueryRef.current = '';
    numPagesRef.current = 0;

    (async () => {
      try {
        // ① 优先用预渲染的 WebP（方案③）：拉单页图秒开，不碰大 PDF
        const pagesBase = resolveImageUrl(`/uploads/suppliers/catalogs/pages/${active.id}`);
        try {
          // manifest 用 no-cache（每次向服务器校验）：重渲染后能拿到新页数/新版本号，不被 30d immutable 锁死
          const mf = await fetch(`${pagesBase}/manifest.json`, { cache: 'no-cache' });
          if (mf.ok) {
            const data = await mf.json();
            const pages = Number(data?.pages) || 0;
            if (pages > 0 && !cancelled) {
              modeRef.current = 'image';
              pagesBaseRef.current = pagesBase;
              revQueryRef.current = data?.rev ? `?r=${data.rev}` : '';
              numPagesRef.current = pages;
              setNumPages(pages);
              setRatio(Number(data?.ar) || 1.4);
              setThumbUrls(Array.from({ length: pages }, (_, i) => `${pagesBase}/${i + 1}-thumb.webp${revQueryRef.current}`));
              // 首页带进度加载：流式拉 WebP 显示真实百分比，加载完再淡入（用户有"加载到哪了"的底）
              try {
                const objUrl = await fetchWithProgress(
                  `${pagesBase}/1.webp${revQueryRef.current}`,
                  (pct) => { if (!cancelled) setProgress(pct); }
                );
                if (cancelled) { URL.revokeObjectURL(objUrl); return; }
                urlsRef.current.set(1, objUrl);
              } catch {
                /* 带进度下载失败（如跨域 CORS）→ 退回让 <img> 直接拉 URL，不阻塞打开 */
              }
              if (cancelled) return;
              setLoading(false);
              setProgress(null);
              await showPage(1, 'open');
              return; // 图片模式，无需 pdf.js
            }
          }
        } catch {
          /* 无预渲染或取 manifest 失败 → 回退 pdf.js */
        }
        if (cancelled) return;

        // ② 回退：pdf.js 现渲（disableAutoFetch + Range，只按需拉字节）
        const src = resolveImageUrl(active.file_url);
        const loadingTask = pdfjsLib.getDocument({ url: src, disableAutoFetch: true, rangeChunkSize: 262144 });
        // pdf.js 下载进度（字节级）→ 驱动进度条
        loadingTask.onProgress = (data: { loaded: number; total: number }) => {
          if (!cancelled) setProgress(data.total ? Math.min(99, Math.round((data.loaded / data.total) * 100)) : null);
        };
        loadingTaskRef.current = loadingTask;
        const pdf = await loadingTask.promise;
        if (cancelled) return;
        pdfRef.current = pdf;
        numPagesRef.current = pdf.numPages;
        setNumPages(pdf.numPages);
        setThumbUrls(new Array(pdf.numPages).fill(null));

        const d0 = (await pdf.getPage(1)).getViewport({ scale: 1 });
        if (cancelled) return;
        setRatio(Number((d0.width / d0.height).toFixed(4)) || 1.6);
        targetWRef.current = Math.min(
          Math.round((window.innerWidth || 1200) * (window.devicePixelRatio || 1)),
          1600
        );

        const first = await ensurePage(1);
        if (cancelled) return;
        if (!first) {
          // getDocument 成功但首页渲染失败：给错误态，不留黑屏
          setError(true);
          setLoading(false);
          return;
        }
        setLoading(false);
        setProgress(null);
        await showPage(1, 'open');

        // 缩略图（小图，便宜）——逐页容错，单页失败不拖垮整条
        for (let p = 1; p <= pdf.numPages; p++) {
          if (cancelled) return;
          let turl: string | null = null;
          try {
            turl = await renderToDataURL(pdf, p, 90);
          } catch {
            turl = null;
          }
          if (cancelled) return;
          setThumbUrls((prev) => {
            const next = prev.slice();
            next[p - 1] = turl;
            return next;
          });
        }
        // 整页按需渲染 + 相邻页预取（见 showPage），不再一次性全量 backfill —— 大 PDF 不占内存/CPU
      } catch {
        if (!cancelled) {
          setError(true);
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
      loadingTaskRef.current?.destroy?.();
      loadingTaskRef.current = null;
      pdfRef.current = null;
      urlsRef.current.forEach((u) => { if (u.startsWith('blob:')) URL.revokeObjectURL(u); });
    };
  }, [active, ensurePage, showPage]);

  // 全屏时锁滚动 + 键盘翻页
  useEffect(() => {
    if (fs) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    const onKey = (e: KeyboardEvent) => {
      if (!fs) return;
      if (e.key === 'ArrowLeft') showPage(curPage - 1);
      else if (e.key === 'ArrowRight') showPage(curPage + 1);
      else if (e.key === 'Escape') setFs(false);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [fs, curPage, showPage]);

  if (!catalogs || catalogs.length === 0) return null;

  return (
    <div
      className={
        fs
          ? 'fixed inset-0 z-[70] bg-[#141110] flex flex-col'
          : 'relative rounded-2xl overflow-hidden bg-[#1c1917]'
      }
    >
      {/* 多本图册 tab */}
      {catalogs.length > 1 && (
        <div className="flex gap-1.5 px-3 pt-3 pb-2 overflow-x-auto">
          {catalogs.map((c, i) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setActiveIdx(i)}
              className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition ${
                i === activeIdx
                  ? 'bg-[#b8864a] text-white'
                  : 'bg-white/10 text-white/70 hover:bg-white/20'
              }`}
            >
              {c.title || `Catalog ${i + 1}`}
            </button>
          ))}
        </div>
      )}

      {/* 舞台：整块一张图，控件叠加 */}
      <div
        className={fs ? 'relative flex-1 min-h-0' : 'relative w-full'}
        style={fs ? undefined : { aspectRatio: String(ratio) }}
      >
        <div
          ref={wrap0}
          className="absolute inset-0 flex items-center justify-center opacity-0"
          style={{ transition: 'opacity .28s ease', ...(fs ? { padding: '20px 80px' } : {}) }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img ref={layer0} alt="" className="w-full h-full object-contain" />
        </div>
        <div
          ref={wrap1}
          className="absolute inset-0 flex items-center justify-center opacity-0"
          style={{ transition: 'opacity .28s ease', ...(fs ? { padding: '20px 80px' } : {}) }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img ref={layer1} alt="" className="w-full h-full object-contain" />
        </div>

        {/* 页码 pill（左上） */}
        <div className="absolute top-3 left-3 z-[6] flex items-center gap-1.5 rounded-full bg-black/50 px-2.5 py-1 text-xs font-semibold text-white backdrop-blur">
          <BookOpen className="w-3.5 h-3.5 text-[#e6c88f]" />
          {curPage} / {numPages || '–'}
        </div>

        {/* 全屏 / 退出（右上） */}
        <button
          type="button"
          onClick={() => setFs((v) => !v)}
          aria-label={fs ? 'Exit fullscreen' : 'Fullscreen'}
          className="absolute top-2.5 right-2.5 z-[6] flex h-8 w-8 items-center justify-center rounded-lg bg-black/45 text-white backdrop-blur transition hover:bg-black/70"
        >
          {fs ? <X className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
        </button>

        {/* 箭头 */}
        <button
          type="button"
          onClick={() => showPage(curPage - 1)}
          aria-label="Previous page"
          className={`absolute left-3 top-1/2 -translate-y-1/2 z-[5] flex h-10 w-10 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur transition hover:bg-black/60 ${
            curPage <= 1 ? 'opacity-0 pointer-events-none' : ''
          }`}
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <button
          type="button"
          onClick={() => showPage(curPage + 1)}
          aria-label="Next page"
          className={`absolute right-3 top-1/2 -translate-y-1/2 z-[5] flex h-10 w-10 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur transition hover:bg-black/60 ${
            curPage >= numPages ? 'opacity-0 pointer-events-none' : ''
          }`}
        >
          <ChevronRight className="w-5 h-5" />
        </button>

        {/* 缩略图浮层（底部，居中，渐变托底） */}
        {numPages > 1 && (
          <div className="absolute inset-x-0 bottom-0 z-[6] bg-gradient-to-t from-black/60 to-transparent px-3 pb-2.5 pt-8">
            <div className="flex justify-center gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {thumbUrls.map((t, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => showPage(i + 1)}
                  aria-label={`Page ${i + 1}`}
                  className={`h-10 w-[30px] shrink-0 overflow-hidden rounded border-2 bg-white/15 transition ${
                    i + 1 === curPage ? 'border-[#e6c88f]' : 'border-transparent'
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {t && <img src={t} alt="" className="h-full w-full object-cover" />}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 加载态：进度条（有 total 显示百分比，否则不确定态脉冲），让用户知道加载到哪了 */}
        {loading && !error && (
          <div className="absolute inset-0 z-[7] flex flex-col items-center justify-center gap-3 px-10">
            <div className="flex items-center gap-2 text-sm text-white/70">
              <BookOpen className="h-4 w-4 text-[#e6c88f]" />
              {progress === null ? 'Loading…' : `Loading ${progress}%`}
            </div>
            <div className="h-1.5 w-52 max-w-[75%] overflow-hidden rounded-full bg-white/15">
              <div
                className={`h-full rounded-full bg-[#e6c88f] ${
                  progress === null ? 'w-1/3 animate-pulse' : 'transition-[width] duration-200 ease-out'
                }`}
                style={progress === null ? undefined : { width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {/* 错误态：加载失败给明确提示，不留黑屏 */}
        {error && (
          <div className="absolute inset-0 z-[7] flex flex-col items-center justify-center gap-1 px-6 text-center text-sm text-white/60">
            <BookOpen className="mb-1 h-6 w-6 text-white/30" />
            Unable to load this catalog.
          </div>
        )}
      </div>
    </div>
  );
}
