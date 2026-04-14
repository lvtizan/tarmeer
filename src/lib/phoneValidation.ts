/**
 * Phone number validation for GCC countries.
 * Returns null if valid, or an error message string if invalid.
 */

// UAE mobile prefixes (2-digit after country code)
const UAE_MOBILE_PREFIXES = ['50', '52', '54', '55', '56', '58'];
// UAE landline prefixes (1-digit after country code)
const UAE_LANDLINE_PREFIXES = ['2', '3', '4', '6', '7'];

// KSA mobile: 5x
const KSA_MOBILE_PREFIXES = ['50', '51', '53', '54', '55', '56', '57', '58', '59'];

// Per-country validation rules
const COUNTRY_RULES: Record<string, {
  mobilePrefixes?: string[];
  landlinePrefixes?: string[];
  digits: number;
}> = {
  '+971': { mobilePrefixes: UAE_MOBILE_PREFIXES, landlinePrefixes: UAE_LANDLINE_PREFIXES, digits: 9 },
  '+966': { mobilePrefixes: KSA_MOBILE_PREFIXES, digits: 9 },
  '+974': { digits: 8 },
  '+965': { digits: 8 },
  '+968': { digits: 8 },
  '+973': { digits: 8 },
};

/**
 * Validate a phone number (digits only, without country code).
 * @param digits - The phone digits (e.g. "501234567")
 * @param countryCode - The country code (e.g. "+971")
 * @returns null if valid, error message string if invalid
 */
export function validatePhone(digits: string, countryCode: string): string | null {
  if (!digits) return null; // Don't show error for empty (let required check handle it)

  const rules = COUNTRY_RULES[countryCode];
  if (!rules) return null; // Unknown country, skip validation

  // Check length
  if (digits.length < rules.digits) return null; // Still typing, don't error yet
  if (digits.length > rules.digits) return `Must be ${rules.digits} digits`;

  // Check all zeros
  if (/^0+$/.test(digits)) return 'Invalid phone number';

  // Check 5+ consecutive same digit (e.g. 555555555)
  if (/(.)\1{4,}/.test(digits)) return 'Invalid phone number';

  // Check sequential (123456789, 987654321)
  if (digits === '123456789' || digits === '987654321') return 'Invalid phone number';

  // Country-specific prefix validation
  if (rules.mobilePrefixes || rules.landlinePrefixes) {
    const allPrefixes = [...(rules.mobilePrefixes || []), ...(rules.landlinePrefixes || [])];
    const matchesPrefix = allPrefixes.some(p => digits.startsWith(p));
    if (!matchesPrefix) {
      if (countryCode === '+971') {
        return 'UAE numbers must start with 50, 52, 54, 55, 56, or 58';
      }
      if (countryCode === '+966') {
        return 'KSA mobile numbers must start with 5';
      }
      return 'Invalid phone number prefix';
    }
  }

  return null; // Valid
}

/**
 * Check if phone digits are complete (reached expected length).
 */
export function isPhoneComplete(digits: string, countryCode: string): boolean {
  const rules = COUNTRY_RULES[countryCode];
  if (!rules) return digits.length >= 7;
  return digits.length === rules.digits;
}
