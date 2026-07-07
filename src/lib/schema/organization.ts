import type { CountryConfig } from '../country';
import { INSTAGRAM_URL } from '../constants';

// 全站唯一 Organization 实体块——注入根 layout,让每个页面(含首页)都携带同一份
// 完整实体身份(name/url/logo/description/telephone/address/contactPoint/sameAs),
// 供 AI 引擎做实体链接。稳定 @id 使多页识别为一个节点。按国家取 c,字段全部从 c 派生
// 避免跨国串联(不硬编码 AE 的号码/社媒/城市)。这是站内唯一的 Organization,首页不再单独发。
export function buildOrganizationJsonLd(c: CountryConfig): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': `${c.baseUrl}/#organization`,
    name: 'Tarmeer',
    url: c.baseUrl,
    logo: {
      '@type': 'ImageObject',
      url: `${c.baseUrl}/images/tarmeer_logo.svg`,
    },
    description: `${c.fullName} interior design & renovation platform connecting homeowners with verified design companies, experts, and material suppliers.`,
    telephone: c.telephone,
    address: {
      '@type': 'PostalAddress',
      addressLocality: c.addressLocality,
      addressCountry: c.isoCode,
    },
    contactPoint: {
      '@type': 'ContactPoint',
      telephone: c.telephone,
      contactType: 'customer service',
      availableLanguage: c.code === 'vn' ? ['Vietnamese', 'English'] : ['English', 'Arabic'],
    },
    areaServed: { '@type': 'Country', name: c.fullName },
    sameAs: [INSTAGRAM_URL, c.whatsappLink],
  };
}
