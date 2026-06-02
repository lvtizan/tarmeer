import { describe, it, expect } from 'vitest';
import { labelCompanyType, COMPANY_TYPE_LABELS } from '@/lib/companyTypeLabel';

describe('labelCompanyType', () => {
  it('returns Chinese label by default', () => {
    expect(labelCompanyType('renovation_company')).toBe('装修公司');
  });

  it('returns English label when lang is en', () => {
    expect(labelCompanyType('renovation_company', 'en')).toBe('Renovation Co.');
  });

  it('returns the raw type for unknown types', () => {
    expect(labelCompanyType('unknown_type')).toBe('unknown_type');
    expect(labelCompanyType('unknown_type', 'en')).toBe('unknown_type');
  });

  it('returns correct labels for all defined types', () => {
    for (const [type, labels] of Object.entries(COMPANY_TYPE_LABELS)) {
      expect(labelCompanyType(type, 'zh')).toBe(labels.zh);
      expect(labelCompanyType(type, 'en')).toBe(labels.en);
    }
  });
});

describe('COMPANY_TYPE_LABELS', () => {
  it('has both zh and en for every entry', () => {
    for (const labels of Object.values(COMPANY_TYPE_LABELS)) {
      expect(labels.zh).toBeTruthy();
      expect(labels.en).toBeTruthy();
    }
  });

  it('contains expected types', () => {
    expect(COMPANY_TYPE_LABELS).toHaveProperty('renovation_company');
    expect(COMPANY_TYPE_LABELS).toHaveProperty('design_studio');
    expect(COMPANY_TYPE_LABELS).toHaveProperty('mep_contractor');
    expect(COMPANY_TYPE_LABELS).toHaveProperty('general_contractor');
    expect(COMPANY_TYPE_LABELS).toHaveProperty('landscaping');
  });
});
