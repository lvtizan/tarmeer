export const ORIGIN_LABEL: Record<'china' | 'dubai', string> = {
  china: '🇨🇳 China',
  dubai: '🇦🇪 Dubai',
};

// For light backgrounds (supplier cards, list pages)
export const ORIGIN_BADGE_CLASS: Record<'china' | 'dubai', string> = {
  china: 'bg-red-50 text-red-600',
  dubai: 'bg-emerald-50 text-emerald-700',
};

// For dark/overlay backgrounds (supplier detail hero)
export const ORIGIN_HERO_BADGE_CLASS: Record<'china' | 'dubai', string> = {
  china: 'bg-red-500/20 text-red-200 border border-red-400/20',
  dubai: 'bg-emerald-500/20 text-emerald-200 border border-emerald-400/20',
};
