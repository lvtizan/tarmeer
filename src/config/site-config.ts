/**
 * Tarmeer 网站配置
 * 支持战时/和平模式切换
 */

export type SiteMode = 'WARTIME' | 'PEACETIME';

export interface SiteConfig {
  mode: SiteMode;
  wartime: WartimeConfig;
  peacetime: PeacetimeConfig;
}

export interface WartimeConfig {
  bannerTitle: string;
  bannerSubtitle: string;
  bannerCta: string;
  badge: string;
  notice: string;
  noticeZh: string;
}

export interface PeacetimeConfig {
  bannerTitle: string;
  bannerSubtitle: string;
  bannerCta: string;
  badge: string;
  notice: string;
  noticeZh: string;
}

export const SITE_CONFIG: SiteConfig = {
  mode: 'PEACETIME',

  wartime: {
    bannerTitle: 'UAE Design Services',
    bannerSubtitle: 'Professional interior design across the UAE. Meet designers in person for face-to-face consultation and local project delivery.',
    bannerCta: 'Get Started',
    badge: 'UAE • Local Design',
    notice: '',
    noticeZh: ''
  },

  peacetime: {
    bannerTitle: 'UAE Design Services',
    bannerSubtitle: 'Professional interior design across the UAE. Meet designers in person for face-to-face consultation and local project delivery.',
    bannerCta: 'Get Started',
    badge: 'UAE • Dubai • Sharjah • Design Services',
    notice: '',
    noticeZh: ''
  }
};

// 获取当前模式的配置
export const getCurrentConfig = (): WartimeConfig | PeacetimeConfig => {
  return SITE_CONFIG.mode === 'WARTIME' ? SITE_CONFIG.wartime : SITE_CONFIG.peacetime;
};

// 是否为战时模式
export const isWartime = (): boolean => {
  return SITE_CONFIG.mode === 'WARTIME';
};
