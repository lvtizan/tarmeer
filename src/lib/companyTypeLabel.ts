/**
 * 装企类型 中英双语 label。
 * IMPORTANT: 与 UAEMapSVG.tsx 和 server-side VALID_COMPANY_TYPES 保持同步。
 */
export const COMPANY_TYPE_LABELS: Record<string, { zh: string; en: string }> = {
  renovation_company:  { zh: '装修公司',   en: 'Renovation Co.'    },
  design_studio:       { zh: '设计工作室', en: 'Design Studio'     },
  maintenance_company: { zh: '维修公司',   en: 'Maintenance Co.'   },
  mep_contractor:      { zh: 'MEP 承包商', en: 'MEP Contractor'    },
  general_contractor:  { zh: '总承包商',   en: 'General Contractor'},
  landscaping:         { zh: '园林绿化',   en: 'Landscaping'       },
  swimming_pool:       { zh: '游泳池工程', en: 'Swimming Pool'     },
  specialty_trade:     { zh: '专项工程',   en: 'Specialty Trade'   },
  furnishing:          { zh: '软装供应商', en: 'Furnishing'        },
};

export function labelCompanyType(type: string, lang: 'zh' | 'en' = 'zh'): string {
  return COMPANY_TYPE_LABELS[type]?.[lang] ?? type;
}
