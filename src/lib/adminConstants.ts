export { EMIRATES } from './constants';

/**
 * Tailwind class pairs for common status badges used across admin pages.
 *
 * Consumers pick the map that matches their domain, then look up a status key:
 *   `STATUS_BADGE_CLASSES.approval[record.status]`
 */
export const STATUS_BADGE_CLASSES = {
  /** new / contacted / resolved / archived  (inquiries, complaints) */
  workflow: {
    new: 'bg-blue-100 text-blue-700',
    contacted: 'bg-amber-100 text-amber-700',
    processing: 'bg-amber-100 text-amber-700',
    resolved: 'bg-green-100 text-green-700',
    rejected: 'bg-red-100 text-red-700',
    archived: 'bg-stone-100 text-stone-500',
  },
  /** active / suspended  (users) */
  activation: {
    active: 'bg-green-100 text-green-700',
    suspended: 'bg-red-100 text-red-700',
  },
} as const;
