import { describe, it, expect } from 'vitest';
import { validatePhone, isPhoneComplete, phoneDigitCount } from '@/lib/phoneValidation';

describe('validatePhone', () => {
  it('returns null for empty input', () => {
    expect(validatePhone('', '+971')).toBeNull();
  });

  it('returns null for unknown country code', () => {
    expect(validatePhone('503847291', '+999')).toBeNull();
  });

  it('returns null for incomplete number (not yet at expected length)', () => {
    expect(validatePhone('50384', '+971')).toBeNull();
  });

  it('rejects number exceeding expected digit count', () => {
    expect(validatePhone('5038472910', '+971')).toBe('Must be 9 digits');
  });

  // UAE (+971)
  describe('UAE (+971)', () => {
    it('accepts valid mobile number starting with 50', () => {
      expect(validatePhone('503847291', '+971')).toBeNull();
    });

    it('accepts valid mobile number starting with 55', () => {
      expect(validatePhone('559284731', '+971')).toBeNull();
    });

    it('accepts valid landline starting with 2', () => {
      expect(validatePhone('247391852', '+971')).toBeNull();
    });

    it('rejects invalid prefix', () => {
      const result = validatePhone('803847291', '+971');
      expect(result).toContain('UAE');
    });
  });

  // China (+86)
  describe('China (+86)', () => {
    it('accepts valid mobile starting with 13x', () => {
      expect(validatePhone('13829475061', '+86')).toBeNull();
    });

    it('rejects invalid prefix', () => {
      const result = validatePhone('10029475061', '+86');
      expect(result).toContain('China');
    });
  });

  // Saudi Arabia (+966)
  describe('KSA (+966)', () => {
    it('accepts valid mobile starting with 50', () => {
      expect(validatePhone('508374291', '+966')).toBeNull();
    });

    it('rejects invalid prefix', () => {
      const result = validatePhone('608374291', '+966');
      expect(result).toContain('KSA');
    });
  });

  // Qatar (+974)
  describe('Qatar (+974)', () => {
    it('accepts valid number starting with 3', () => {
      expect(validatePhone('38472951', '+974')).toBeNull();
    });

    it('rejects invalid prefix', () => {
      const result = validatePhone('18472951', '+974');
      expect(result).toContain('Qatar');
    });
  });

  // Kuwait (+965)
  describe('Kuwait (+965)', () => {
    it('accepts valid number starting with 5', () => {
      expect(validatePhone('58374291', '+965')).toBeNull();
    });

    it('rejects invalid prefix', () => {
      const result = validatePhone('18374291', '+965');
      expect(result).toContain('Kuwait');
    });
  });

  // Oman (+968)
  describe('Oman (+968)', () => {
    it('accepts valid number starting with 9', () => {
      expect(validatePhone('93847291', '+968')).toBeNull();
    });

    it('rejects invalid prefix', () => {
      const result = validatePhone('13847291', '+968');
      expect(result).toContain('Oman');
    });
  });

  // Bahrain (+973)
  describe('Bahrain (+973)', () => {
    it('accepts valid number starting with 3', () => {
      expect(validatePhone('38472951', '+973')).toBeNull();
    });

    it('rejects invalid prefix', () => {
      const result = validatePhone('18472951', '+973');
      expect(result).toContain('Bahrain');
    });
  });

  // India (+91)
  describe('India (+91)', () => {
    it('accepts valid mobile starting with 9', () => {
      expect(validatePhone('9384729105', '+91')).toBeNull();
    });

    it('rejects invalid prefix', () => {
      const result = validatePhone('1384729105', '+91');
      expect(result).toContain('India');
    });
  });

  // UK (+44)
  describe('UK (+44)', () => {
    it('accepts valid mobile starting with 7', () => {
      expect(validatePhone('7384729105', '+44')).toBeNull();
    });

    it('rejects invalid prefix', () => {
      const result = validatePhone('4384729105', '+44');
      expect(result).toContain('UK');
    });
  });

  // US (+1)
  describe('US (+1)', () => {
    it('accepts valid number', () => {
      expect(validatePhone('2125839471', '+1')).toBeNull();
    });

    it('rejects area code starting with 0', () => {
      expect(validatePhone('0125839471', '+1')).toContain('area code');
    });

    it('rejects exchange code starting with 0', () => {
      expect(validatePhone('2120839471', '+1')).toContain('exchange code');
    });
  });

  // Universal invalid patterns
  describe('universal pattern checks', () => {
    it('rejects all-zero digits', () => {
      expect(validatePhone('000000000', '+971')).toBe('Invalid phone number');
    });

    it('rejects all same digit', () => {
      expect(validatePhone('555555555', '+971')).toBe('Invalid phone number');
    });

    it('rejects sequential ascending run (6+ digits)', () => {
      // 50 + 123456 + 7 → has sequential run 123456
      expect(validatePhone('501234567', '+971')).toBe('Invalid phone number');
    });

    it('rejects repeating 2-digit cycle', () => {
      expect(validatePhone('121212121', '+966')).toBe('Invalid phone number');
    });

    it('rejects repeating 3-digit cycle', () => {
      expect(validatePhone('507507507', '+966')).toBe('Invalid phone number');
    });
  });
});

describe('isPhoneComplete', () => {
  it('returns true when digits match expected length for UAE', () => {
    expect(isPhoneComplete('503847291', '+971')).toBe(true);
  });

  it('returns false when digits are short for UAE', () => {
    expect(isPhoneComplete('50384', '+971')).toBe(false);
  });

  it('falls back to >= 7 for unknown country', () => {
    expect(isPhoneComplete('3847291', '+999')).toBe(true);
    expect(isPhoneComplete('384729', '+999')).toBe(false);
  });
});

describe('phoneDigitCount', () => {
  it('returns correct digit count for known countries', () => {
    expect(phoneDigitCount('+971')).toBe(9);
    expect(phoneDigitCount('+86')).toBe(11);
    expect(phoneDigitCount('+1')).toBe(10);
  });

  it('returns 9 as fallback for unknown country', () => {
    expect(phoneDigitCount('+999')).toBe(9);
  });
});
