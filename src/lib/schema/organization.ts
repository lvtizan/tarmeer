import type { CountryConfig } from '../country';
import { INSTAGRAM_URL, WHATSAPP_LINK } from '../constants';

// 全站 Organization 实体块——注入根 layout,让每个页面都携带一致的实体身份信号
// (name / url / logo / telephone / sameAs),供 AI 引擎做实体链接。
// 稳定 @id 使多页出现的同一实体被识别为一个节点。按国家取 c,避免跨国串联。
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
    telephone: c.telephone,
    areaServed: { '@type': 'Country', name: c.fullName },
    sameAs: [INSTAGRAM_URL, WHATSAPP_LINK],
  };
}
