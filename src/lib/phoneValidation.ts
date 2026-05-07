/**
 * International phone number validation.
 * Returns null if valid, or an error string if invalid.
 *
 * Rules applied to all countries:
 *   1. All same digit (000…, 111…, 555555555)
 *   2. Sequential run ≥6 digits (123456, 876543)
 *   3. Repeating 2-digit cycle (121212, 123123)
 *   4. Country-specific prefix rules
 */

// ─── Universal invalid patterns ──────────────────────────────────────────────

function isAllSameDigit(d: string): boolean {
  return /^(\d)\1+$/.test(d);
}

function hasSequentialRun(d: string, minLen = 6): boolean {
  for (let i = 0; i <= d.length - minLen; i++) {
    let asc = true, desc = true;
    for (let j = i + 1; j < i + minLen; j++) {
      if (+d[j] !== +d[j - 1] + 1) asc = false;
      if (+d[j] !== +d[j - 1] - 1) desc = false;
    }
    if (asc || desc) return true;
  }
  return false;
}

function hasRepeatingCycle(d: string): boolean {
  const len = d.length;
  for (let patLen = 2; patLen <= Math.floor(len / 2); patLen++) {
    const pat = d.slice(0, patLen);
    if (isAllSameDigit(pat)) continue; // already caught above
    if (pat.repeat(Math.ceil(len / patLen)).slice(0, len) === d) return true;
  }
  return false;
}

function commonChecks(d: string): string | null {
  if (/^0+$/.test(d))          return 'Invalid phone number';
  if (isAllSameDigit(d))        return 'Invalid phone number';
  if (hasSequentialRun(d, 6))   return 'Invalid phone number';
  if (hasRepeatingCycle(d))     return 'Invalid phone number';
  return null;
}

// ─── Per-country rules ────────────────────────────────────────────────────────

type CountryRule = {
  digits: number;
  validate?: (d: string) => string | null;
};

const RULES: Record<string, CountryRule> = {
  '+971': {
    digits: 9,
    validate(d) {
      const mobile  = ['50','52','54','55','56','58'];
      const landline = ['2','3','4','6','7'];
      const ok = [...mobile, ...landline].some(p => d.startsWith(p));
      return ok ? null : 'UAE: start with 50/52/54/55/56/58 (mobile) or 2/3/4/6/7 (landline)';
    },
  },
  '+86': {
    digits: 11,
    validate(d) {
      const ok = ['13','14','15','16','17','18','19'].some(p => d.startsWith(p));
      return ok ? null : 'China: mobile must start with 13x–19x';
    },
  },
  '+966': {
    digits: 9,
    validate(d) {
      const ok = ['50','51','53','54','55','56','57','58','59'].some(p => d.startsWith(p));
      return ok ? null : 'KSA: mobile must start with 5x';
    },
  },
  '+974': {
    digits: 8,
    validate(d) {
      const ok = ['3','5','6','7'].some(p => d.startsWith(p));
      return ok ? null : 'Qatar: must start with 3, 5, 6, or 7';
    },
  },
  '+965': {
    digits: 8,
    validate(d) {
      const ok = ['5','6','9'].some(p => d.startsWith(p));
      return ok ? null : 'Kuwait: must start with 5, 6, or 9';
    },
  },
  '+968': {
    digits: 8,
    validate(d) {
      const ok = ['7','9'].some(p => d.startsWith(p));
      return ok ? null : 'Oman: must start with 7 or 9';
    },
  },
  '+973': {
    digits: 8,
    validate(d) {
      const ok = ['3','6','7'].some(p => d.startsWith(p));
      return ok ? null : 'Bahrain: must start with 3, 6, or 7';
    },
  },
  '+91': {
    digits: 10,
    validate(d) {
      const ok = ['6','7','8','9'].some(p => d.startsWith(p));
      return ok ? null : 'India: mobile must start with 6, 7, 8, or 9';
    },
  },
  '+44': {
    digits: 10,
    validate(d) {
      // UK: mobile starts with 7; landline 1/2/3/8
      const ok = ['1','2','3','7','8'].some(p => d.startsWith(p));
      return ok ? null : 'UK: must start with 1, 2, 3, 7, or 8';
    },
  },
  '+1': {
    digits: 10,
    validate(d) {
      // Area code: first digit 2-9, exchange: 4th digit 2-9
      if (+d[0] < 2) return 'US: area code cannot start with 0 or 1';
      if (+d[3] < 2) return 'US: exchange code cannot start with 0 or 1';
      return null;
    },
  },
};

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Validate phone digits (without country code prefix).
 * Returns null when valid, error string when invalid.
 * Returns null for empty input (let "required" checks handle that separately).
 */
export function validatePhone(digits: string, countryCode: string): string | null {
  if (!digits) return null;

  const rule = RULES[countryCode];
  if (!rule) return null; // unknown country — skip

  // Length check (only error when complete length exceeded)
  if (digits.length > rule.digits) return `Must be ${rule.digits} digits`;

  // Don't validate prefix/patterns until number is complete
  if (digits.length < rule.digits) return null;

  // Universal pattern checks
  const common = commonChecks(digits);
  if (common) return common;

  // Country-specific prefix check
  return rule.validate?.(digits) ?? null;
}

/**
 * True when digits exactly match the expected length for this country.
 */
export function isPhoneComplete(digits: string, countryCode: string): boolean {
  const rule = RULES[countryCode];
  if (!rule) return digits.length >= 7;
  return digits.length === rule.digits;
}

/**
 * Expected digit count for a country code. Returns 9 as fallback.
 */
export function phoneDigitCount(countryCode: string): number {
  return RULES[countryCode]?.digits ?? 9;
}
