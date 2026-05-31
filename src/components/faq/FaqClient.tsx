'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { FAQ_DATA } from './faqData';

type Lang = 'en' | 'ar';

export default function FaqClient() {
  const [lang, setLang] = useState<Lang>('en');
  const [openItems, setOpenItems] = useState<Set<string>>(new Set());
  const isRtl = lang === 'ar';

  const toggleItem = (key: string) => {
    setOpenItems(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <div dir={isRtl ? 'rtl' : 'ltr'}>
      <div className="min-h-screen bg-[var(--color-tarmeer-bg)]">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10 sm:py-16">
          <div className="flex items-center justify-between mb-8">
            <h1 className="text-xl font-bold text-[var(--color-tarmeer-text)]">
              {lang === 'en' ? 'Frequently Asked Questions' : 'الأسئلة الشائعة'}
            </h1>
            <button
              onClick={() => setLang(lang === 'en' ? 'ar' : 'en')}
              className="px-4 py-2 rounded-2xl border border-stone-200 text-sm font-medium text-stone-600 hover:bg-stone-50 transition"
            >
              {lang === 'en' ? 'العربية' : 'English'}
            </button>
          </div>

          {FAQ_DATA.map((cat, ci) => (
            <section key={ci} className="mb-10">
              <h2 className="text-lg font-semibold text-[var(--color-tarmeer-text)] mb-4">
                {cat.title[lang]}
              </h2>
              <div className="space-y-3">
                {cat.items.map((item, ii) => {
                  const key = `${ci}-${ii}`;
                  const isOpen = openItems.has(key);
                  return (
                    <div key={key} className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
                      <button
                        onClick={() => toggleItem(key)}
                        className="w-full flex items-center justify-between px-5 py-4 text-left"
                      >
                        <span className="text-[15px] font-medium text-[var(--color-tarmeer-text)] pr-4">
                          {item.q[lang]}
                        </span>
                        <ChevronDown className={`w-5 h-5 text-stone-400 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                      </button>
                      {isOpen && (
                        <div className="px-5 pb-4">
                          <p className="text-[15px] text-[var(--color-tarmeer-muted)] leading-relaxed">
                            {item.a[lang]}
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
