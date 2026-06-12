import { BadgeCheck } from 'lucide-react';

/** Gold (signed) + Verified (certified) badges — shared by experts list cards and expert detail header.
 *  Styles mirror the company Gold badge in src/components/companies/CompaniesClient.tsx. */
export function GoldBadge() {
  return (
    <span className="inline-flex items-center px-1.5 py-[2px] rounded bg-gradient-to-b from-[#d4a853] to-[#b8864a] text-white text-[10px] font-bold tracking-wider leading-none shrink-0 align-middle">
      Gold
    </span>
  );
}

export function VerifiedBadge({ isVn = false }: { isVn?: boolean }) {
  // 花瓣环形 + 勾的认证 icon（与装企认证一致），紧凑不抢眼
  return (
    <BadgeCheck
      className="w-[18px] h-[18px] text-[#b8864a] shrink-0 align-middle"
      aria-label={isVn ? 'Đã xác minh' : 'Verified'}
    />
  );
}

export function ExpertBadges({ isSigned, isCertified, isVn = false }: { isSigned?: boolean | number; isCertified?: boolean | number; isVn?: boolean }) {
  if (!isSigned && !isCertified) return null;
  return (
    <span className="inline-flex items-center gap-1.5 align-middle">
      {Boolean(isSigned) && <GoldBadge />}
      {Boolean(isCertified) && <VerifiedBadge isVn={isVn} />}
    </span>
  );
}
