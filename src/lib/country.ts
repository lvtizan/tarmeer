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

export type CountryCode = 'ae' | 'vn';

export interface CountryConfig {
  code: CountryCode;
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
};

/** server component：从 x-country header 取配置（兜底 ae） */
export function getCountry(code?: string | null): CountryConfig {
  return code === 'vn' ? COUNTRY.vn : COUNTRY.ae;
}

/** client component：从 useSiteLocale().lang 取配置（'vi' → vn，兜底 ae） */
export function countryFromLang(lang?: string | null): CountryConfig {
  return lang === 'vi' ? COUNTRY.vn : COUNTRY.ae;
}
