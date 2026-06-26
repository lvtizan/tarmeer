// 顶层语言层 · 组合所有按域拆分的 section 模块。
// 语言维度由国家决定（layout 注入 SiteLocaleProvider lang），组件只消费 tr.<域>.*，
// 不在组件内写语言判断。新增域：在 sections/ 下建模块 + 在此组合两行即可。
// SiteLang 收敛到国家配置中心一处定义，此处 re-export 保持既有 import 路径不变。
export type { SiteLang } from '@/lib/country';

import { nav } from './sections/nav';
import { spaces, rooms, styles } from './sections/spaces';
import { footer } from './sections/footer';
import { banner } from './sections/banner';
import { home } from './sections/home';
import { companies } from './sections/companies';
import { auth } from './sections/auth';
import { modals } from './sections/modals';
import { onboarding } from './sections/onboarding';
import { start } from './sections/start';
import { portal } from './sections/portal';
import { expert } from './sections/expert';
import { about } from './sections/about';
import { portfolio } from './sections/portfolio';

export const siteTranslations = {
  en: {
    nav: nav.en,
    spaces: spaces.en,
    rooms: rooms.en,
    styles: styles.en,
    footer: footer.en,
    banner: banner.en,
    home: home.en,
    companies: companies.en,
    auth: auth.en,
    modals: modals.en,
    onboarding: onboarding.en,
    start: start.en,
    portal: portal.en,
    expert: expert.en,
    about: about.en,
    portfolio: portfolio.en,
  },
  vi: {
    nav: nav.vi,
    spaces: spaces.vi,
    rooms: rooms.vi,
    styles: styles.vi,
    footer: footer.vi,
    banner: banner.vi,
    home: home.vi,
    companies: companies.vi,
    auth: auth.vi,
    modals: modals.vi,
    onboarding: onboarding.vi,
    start: start.vi,
    portal: portal.vi,
    expert: expert.vi,
    about: about.vi,
    portfolio: portfolio.vi,
  },
} as const;

export type SiteTranslations = typeof siteTranslations.en;
