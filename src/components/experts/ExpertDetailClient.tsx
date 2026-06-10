'use client';

import { useEffect, useState } from 'react';
import {
  MapPin, Briefcase, Phone, ShieldCheck, X,
  ChevronLeft, ChevronRight, CheckCircle2,
} from 'lucide-react';
import Avatar from '@/components/ui/Avatar';
import { resolveImageUrl } from '@/lib/imageUrl';
import { validatePhone, isPhoneComplete, phoneDigitCount } from '@/lib/phoneValidation';
import { ExpertBadges } from './ExpertBadges';
import type { ExpertDetail } from './types';

interface ExpertDetailClientProps {
  expert: ExpertDetail;
  isVn: boolean;
}

/** 电话点击才显示：完整号码只从 reveal 接口返回，同时记一次点击（真实需求统计）。
 *  与 CompanyDetailClient.RevealPhoneRow 同款交互，target_type='expert'。 */
function RevealExpertPhone({ expertId, isVn }: { expertId: number; isVn: boolean }) {
  const [phone, setPhone] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const reveal = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const res = await fetch('/api/phone-reveals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target_type: 'expert', target_id: expertId }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.phone) setPhone(data.phone);
    } finally {
      setLoading(false);
    }
  };

  if (phone) {
    return (
      <a href={`tel:${phone}`} className="inline-flex items-center gap-2.5 text-[#1c1917] font-medium hover:text-[#b8864a] transition">
        <Phone className="w-4 h-4 text-[#c6a065]" /> {phone}
      </a>
    );
  }
  return (
    <button
      type="button"
      onClick={reveal}
      disabled={loading}
      className="inline-flex items-center gap-2.5 px-4 py-2.5 rounded-lg border border-[#b8864a] text-[#b8864a] text-sm font-medium hover:bg-[#b8864a] hover:text-white transition disabled:opacity-50"
    >
      <Phone className="w-4 h-4" /> {loading ? '…' : isVn ? 'Xem số điện thoại' : 'Show phone number'}
    </button>
  );
}

/** Minimal lightbox for certificate images */
function CertificateLightbox({ images, index, onClose, onNavigate }: {
  images: string[];
  index: number;
  onClose: () => void;
  onNavigate: (i: number) => void;
}) {
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft' && index > 0) onNavigate(index - 1);
      if (e.key === 'ArrowRight' && index < images.length - 1) onNavigate(index + 1);
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      document.removeEventListener('keydown', onKey);
    };
  }, [index, images.length, onClose, onNavigate]);

  return (
    <div className="fixed inset-0 z-[100] bg-black/85 flex items-center justify-center p-4" onClick={onClose}>
      <button
        type="button"
        onClick={onClose}
        className="absolute top-4 right-4 p-2 rounded-full bg-white/10 text-white hover:bg-white/20 transition"
        aria-label="Close"
      >
        <X className="w-5 h-5" />
      </button>
      {index > 0 && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onNavigate(index - 1); }}
          className="absolute left-3 sm:left-6 p-2 rounded-full bg-white/10 text-white hover:bg-white/20 transition"
          aria-label="Previous"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
      )}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={resolveImageUrl(images[index])}
        alt={`Certificate ${index + 1}`}
        className="max-w-full max-h-[88vh] object-contain rounded-lg"
        onClick={(e) => e.stopPropagation()}
      />
      {index < images.length - 1 && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onNavigate(index + 1); }}
          className="absolute right-3 sm:right-6 p-2 rounded-full bg-white/10 text-white hover:bg-white/20 transition"
          aria-label="Next"
        >
          <ChevronRight className="w-6 h-6" />
        </button>
      )}
    </div>
  );
}

/** 留言表单：手机号按国家码校验（vi→+84，否则 +971），area_range 留言场景固定 'N/A' */
function ExpertInquiryForm({ expertId, isVn }: { expertId: number; isVn: boolean }) {
  const countryCode = isVn ? '+84' : '+971';
  const [name, setName] = useState('');
  const [digits, setDigits] = useState('');
  const [message, setMessage] = useState('');
  const [touched, setTouched] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const phoneError = touched ? validatePhone(digits, countryCode) : null;
  const phoneComplete = isPhoneComplete(digits, countryCode);
  const canSubmit = Boolean(name.trim() && message.trim() && phoneComplete && !validatePhone(digits, countryCode));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch('/api/inquiries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          phone: countryCode + digits,
          message: message.trim(),
          expert_id: expertId,
          area_range: 'N/A',
          source_page: typeof window !== 'undefined' ? window.location.href : '',
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { message?: string })?.message || `Request failed (${res.status})`);
      }
      setSubmitted(true);
    } catch (err: unknown) {
      setError(
        err instanceof Error && err.message
          ? err.message
          : isVn ? 'Gửi không thành công, vui lòng thử lại.' : 'Failed to submit. Please try again.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="text-center py-8">
        <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-emerald-100 flex items-center justify-center">
          <CheckCircle2 className="w-6 h-6 text-emerald-600" />
        </div>
        <p className="text-sm font-semibold text-[#1c1917]">
          {isVn ? 'Đã gửi tin nhắn!' : 'Message sent!'}
        </p>
        <p className="text-xs text-stone-500 mt-1">
          {isVn ? 'Chuyên gia sẽ liên hệ với bạn sớm.' : "We'll get back to you soon."}
        </p>
      </div>
    );
  }

  const inputCls =
    'h-12 w-full rounded-lg border border-stone-200 bg-stone-50 px-4 text-sm text-[#2c2c2c] focus:border-[#b8864a] focus:ring-2 focus:ring-[#b8864a]/40 outline-none transition-colors';

  return (
    <form className="space-y-3" onSubmit={handleSubmit}>
      {error && <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
      <input
        type="text"
        placeholder={isVn ? 'Họ và tên' : 'Your name'}
        value={name}
        onChange={(e) => setName(e.target.value)}
        className={inputCls}
      />
      <div>
        <div className={`flex h-12 rounded-lg border bg-stone-50 overflow-hidden focus-within:ring-2 transition ${
          phoneError
            ? 'border-red-400 focus-within:border-red-400 focus-within:ring-red-400/20'
            : 'border-stone-200 focus-within:border-[#b8864a] focus-within:ring-[#b8864a]/40'
        }`}>
          <span className="flex items-center px-3 text-sm text-stone-500 border-r border-stone-200 bg-stone-100/60 shrink-0">
            {countryCode}
          </span>
          <input
            type="tel"
            placeholder={'0'.repeat(phoneDigitCount(countryCode))}
            value={digits}
            maxLength={phoneDigitCount(countryCode)}
            onChange={(e) => setDigits(e.target.value.replace(/[^0-9]/g, ''))}
            onBlur={() => setTouched(true)}
            className="flex-1 h-full px-3 bg-transparent text-sm text-[#2c2c2c] placeholder:text-stone-400 focus:outline-none min-w-0"
          />
        </div>
        {phoneError && <p className="text-xs text-red-500 mt-1.5">{phoneError}</p>}
      </div>
      <textarea
        placeholder={isVn ? 'Nội dung tin nhắn' : 'Your message'}
        rows={4}
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        className="w-full rounded-lg border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-[#2c2c2c] resize-none focus:border-[#b8864a] focus:ring-2 focus:ring-[#b8864a]/40 outline-none transition-colors"
      />
      <button
        type="submit"
        disabled={!canSubmit || submitting}
        className="w-full h-12 bg-[#1c1917] hover:bg-[#b8864a] text-white text-sm font-semibold rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {submitting
          ? (isVn ? 'Đang gửi...' : 'Sending...')
          : (isVn ? 'Gửi tin nhắn' : 'Send Message')}
      </button>
    </form>
  );
}

export default function ExpertDetailClient({ expert, isVn }: ExpertDetailClientProps) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const currentYear = new Date().getFullYear();
  const age = expert.birth_year && expert.birth_year > 1900 ? currentYear - expert.birth_year : null;

  const metaParts: string[] = [];
  if (age) metaParts.push(isVn ? `${age} tuổi` : `Age ${age}`);
  if (Number(expert.experience_years) > 0) {
    metaParts.push(isVn ? `${expert.experience_years} năm kinh nghiệm` : `${expert.experience_years} yrs experience`);
  }
  if (expert.city) metaParts.push(expert.city);

  const sectionTitle = 'font-serif text-xl text-[#1c1917] mb-4';

  return (
    <div className="min-h-screen bg-[#faf9f7]">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10 sm:py-14 space-y-6">
        {/* 1. Header card */}
        <div className="bg-white border border-stone-200/60 rounded-2xl p-6 sm:p-8">
          <div className="flex flex-col sm:flex-row items-start gap-5">
            <Avatar name={expert.full_name} avatarUrl={expert.avatar_url || ''} size="xl" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap mb-2">
                <h1 className="font-serif text-2xl sm:text-3xl text-[#1c1917]">{expert.full_name}</h1>
                <ExpertBadges isSigned={expert.is_signed} isCertified={expert.is_certified} isVn={isVn} />
              </div>
              {expert.services.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {expert.services.map((svc) => (
                    <span key={svc} className="px-2.5 py-0.5 text-[11px] text-[#8b6914] bg-[#f5f0e8] rounded-full font-medium">
                      {svc}
                    </span>
                  ))}
                </div>
              )}
              {metaParts.length > 0 && (
                <p className="text-sm text-stone-500 flex items-center gap-1.5 flex-wrap">
                  {metaParts.map((part, i) => (
                    <span key={part} className="flex items-center gap-1.5">
                      {i > 0 && <span className="text-stone-300">·</span>}
                      {part}
                    </span>
                  ))}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* 2. Bio */}
        {expert.bio && (
          <div className="bg-white border border-stone-200/60 rounded-2xl p-6 sm:p-8">
            <h2 className={sectionTitle}>{isVn ? 'Giới thiệu' : 'About'}</h2>
            <p className="text-[15px] text-stone-600 leading-relaxed whitespace-pre-line">{expert.bio}</p>
          </div>
        )}

        {/* 3. Work history timeline */}
        {expert.work_history.length > 0 && (
          <div className="bg-white border border-stone-200/60 rounded-2xl p-6 sm:p-8">
            <h2 className={sectionTitle}>{isVn ? 'Kinh nghiệm làm việc' : 'Work Experience'}</h2>
            <ol className="relative border-l border-stone-200 ml-1.5 space-y-6">
              {expert.work_history.map((item, i) => (
                <li key={`${item.org}-${i}`} className="pl-5 relative">
                  <span className="absolute -left-[5px] top-1.5 w-2.5 h-2.5 rounded-full bg-[#b8864a] ring-4 ring-[#b8864a]/15" />
                  <p className="text-xs text-stone-400 mb-0.5">
                    {[item.from, item.to].filter(Boolean).join(' – ')}
                  </p>
                  <p className="text-[15px] font-semibold text-[#1c1917]">{item.org}</p>
                  {item.role && <p className="text-sm text-stone-500">{item.role}</p>}
                </li>
              ))}
            </ol>
          </div>
        )}

        {/* 4. Skills */}
        {expert.skills.length > 0 && (
          <div className="bg-white border border-stone-200/60 rounded-2xl p-6 sm:p-8">
            <h2 className={sectionTitle}>{isVn ? 'Kỹ năng' : 'Skills'}</h2>
            <div className="flex flex-wrap gap-2">
              {expert.skills.map((skill) => (
                <span key={skill} className="px-3 py-1.5 text-sm text-stone-600 border border-stone-200 rounded-full bg-stone-50">
                  {skill}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* 5. Certificates + license verified */}
        {(expert.certificates.length > 0 || Boolean(expert.license_verified)) && (
          <div className="bg-white border border-stone-200/60 rounded-2xl p-6 sm:p-8">
            <h2 className={sectionTitle}>{isVn ? 'Chứng chỉ' : 'Certificates'}</h2>
            {Boolean(expert.license_verified) && (
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm font-medium mb-4">
                <ShieldCheck className="w-4 h-4" />
                {isVn ? 'Giấy phép kinh doanh đã được xác minh ✓' : 'Business license verified ✓'}
              </div>
            )}
            {expert.certificates.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {expert.certificates.map((cert, i) => (
                  <button
                    key={`${cert}-${i}`}
                    type="button"
                    onClick={() => setLightboxIndex(i)}
                    className="group aspect-[4/3] rounded-xl overflow-hidden border border-stone-200 bg-stone-50 hover:border-[#b8864a]/50 transition"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={resolveImageUrl(cert)}
                      alt={`${expert.full_name} certificate ${i + 1}`}
                      className="w-full h-full object-cover group-hover:scale-[1.03] transition duration-300"
                      loading="lazy"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 6. Contact phone */}
        {Boolean(expert.has_phone) && (
          <div className="bg-white border border-stone-200/60 rounded-2xl p-6 sm:p-8">
            <h2 className={sectionTitle}>{isVn ? 'Liên hệ' : 'Contact'}</h2>
            <RevealExpertPhone expertId={expert.id} isVn={isVn} />
          </div>
        )}

        {/* 7. Inquiry form */}
        <div className="bg-white border border-stone-200/60 rounded-2xl p-6 sm:p-8">
          <h2 className={sectionTitle}>{isVn ? 'Gửi tin nhắn cho chuyên gia' : 'Message this expert'}</h2>
          <p className="text-xs text-stone-500 -mt-2 mb-4">
            {isVn
              ? 'Mô tả nhu cầu của bạn, chuyên gia sẽ phản hồi trực tiếp.'
              : 'Describe your project and the expert will get back to you directly.'}
          </p>
          <ExpertInquiryForm expertId={expert.id} isVn={isVn} />
        </div>
      </div>

      {lightboxIndex !== null && expert.certificates.length > 0 && (
        <CertificateLightbox
          images={expert.certificates}
          index={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onNavigate={setLightboxIndex}
        />
      )}
    </div>
  );
}
