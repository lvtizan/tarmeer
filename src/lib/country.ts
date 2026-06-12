// 国家配置中心 — AE（阿联酋）/ VN（越南）双站
//
// 用法：
//   server component:  import { getCountry } from '@/lib/country';
//                      const c = getCountry((await headers()).get('x-country'));
//   client component:  import { countryFromLang } from '@/lib/country';
//                      const { lang } = useSiteLocale();
//                      const c = countryFromLang(lang);
//
// 凡是会在 VN 站显示的国家相关字样（国家名、城市、货币、电话、域名、SEO）
// 一律从这里取，禁止硬编码 UAE/Dubai/AED/+971。
// 国家数据隔离规则见 AGENTS.md。

export type CountryCode = 'ae' | 'vn' | 'sa';

/**
 * 站点语言维度（UI 文案）。收敛到此处一份，site-translations.ts re-export。
 * 加新国家时在这里加语言码，并在对应 CountryConfig.lang 指定。
 * ⚠️ 内容表（siteTranslations）可能尚未覆盖某语言（如 'ar' 待补），
 *    SiteLocaleContext 必须对缺失语言回退到 'en'。
 */
export type SiteLang = 'en' | 'vi' | 'ar';

export interface CountryConfig {
  code: CountryCode;
  /** 站点 UI 语言（注入 SiteLocaleProvider）— ae→en / vn→vi / sa→ar */
  lang: SiteLang;
  /** 简称，用于正文 "in {name}" — "UAE" / "Vietnam" */
  name: string;
  /** 全称，用于 schema.org Country.name — "United Arab Emirates" / "Vietnam" */
  fullName: string;
  /** schema.org addressCountry ISO 码 — "AE" / "VN" */
  isoCode: string;
  /** 默认/主城市（示例数据、占位符兜底）— "Dubai" / "Ho Chi Minh City" */
  defaultCity: string;
  /** schema.org addressLocality 默认值（公司注册地）— "Sharjah" / "Ho Chi Minh City" */
  addressLocality: string;
  /** 城市下拉列表（onboarding / dashboard / expert projects） */
  cities: string[];
  /** 货币代码 — "AED" / "VND" */
  currency: string;
  /** 国际电话区号 — "+971" / "+84" */
  phoneCode: string;
  /** 表单电话 placeholder */
  phonePlaceholder: string;
  /** WhatsApp 主号显示文本 */
  whatsappDisplay: string;
  /** WhatsApp 主号 wa.me 链接 */
  whatsappLink: string;
  /** schema.org telephone 格式 */
  telephone: string;
  /** 站点域名（无协议）— "www.tarmeer.com" / "vn.tarmeer.com" */
  domain: string;
  /** 站点根 URL（带协议） */
  baseUrl: string;
}

export const COUNTRY: Record<CountryCode, CountryConfig> = {
  ae: {
    code: 'ae',
    lang: 'en',
    name: 'UAE',
    fullName: 'United Arab Emirates',
    isoCode: 'AE',
    defaultCity: 'Dubai',
    addressLocality: 'Sharjah',
    cities: ['Dubai', 'Abu Dhabi', 'Sharjah', 'Ajman', 'Ras Al Khaimah', 'Fujairah', 'Umm Al Quwain'],
    currency: 'AED',
    phoneCode: '+971',
    phonePlaceholder: '+971 50 123 4567',
    whatsappDisplay: '+971 58 838 8922',
    whatsappLink: 'https://wa.me/971588388922',
    telephone: '+971-58-838-8922',
    domain: 'www.tarmeer.com',
    baseUrl: 'https://www.tarmeer.com',
  },
  vn: {
    code: 'vn',
    lang: 'vi',
    name: 'Vietnam',
    fullName: 'Vietnam',
    isoCode: 'VN',
    defaultCity: 'Ho Chi Minh City',
    addressLocality: 'Ho Chi Minh City',
    cities: ['Ho Chi Minh City', 'Hanoi', 'Da Nang', 'Hai Phong', 'Can Tho', 'Bien Hoa', 'Nha Trang', 'Hue'],
    currency: 'VND',
    phoneCode: '+84',
    phonePlaceholder: '+84 90 123 4567',
    whatsappDisplay: '+84 886 770 218',
    whatsappLink: 'https://wa.me/84886770218',
    telephone: '+84-886-770-218',
    domain: 'vn.tarmeer.com',
    baseUrl: 'https://vn.tarmeer.com',
  },
  sa: {
    code: 'sa',
    lang: 'ar',
    name: 'Saudi Arabia',
    fullName: 'Saudi Arabia',
    isoCode: 'SA',
    defaultCity: 'Riyadh',
    addressLocality: 'Riyadh',
    cities: ['Riyadh', 'Jeddah', 'Mecca', 'Medina', 'Dammam', 'Al Khobar', 'Tabuk', 'Abha'],
    currency: 'SAR',
    phoneCode: '+966',
    phonePlaceholder: '+966 50 123 4567',
    // TODO(sa): 以下 whatsapp/domain 为占位，上线前需业务确认真实号码与子域名
    whatsappDisplay: '+966 58 838 8922',
    whatsappLink: 'https://wa.me/966588388922',
    telephone: '+966-58-838-8922',
    domain: 'sa.tarmeer.com',
    baseUrl: 'https://sa.tarmeer.com',
  },
};

/** server component：从 x-country header 取配置（查表，未知码兜底 ae）。加国家无需改此函数。 */
export function getCountry(code?: string | null): CountryConfig {
  return code && code in COUNTRY ? COUNTRY[code as CountryCode] : COUNTRY.ae;
}

/** client component：从 useSiteLocale().lang 反查配置（按 lang 查表，未知兜底 ae）。加国家无需改此函数。 */
export function countryFromLang(lang?: string | null): CountryConfig {
  return Object.values(COUNTRY).find((c) => c.lang === lang) ?? COUNTRY.ae;
}
