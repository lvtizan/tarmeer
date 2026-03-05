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
  // 当前模式：战时（物流阻断，线上服务为主）
  mode: 'WARTIME',

  // 战时模式配置
  wartime: {
    bannerTitle: 'Remote Design Services',
    bannerSubtitle: 'Professional interior design from anywhere. Postpone construction until logistics resume. Special wartime service available now.',
    bannerCta: 'Get Started',
    badge: 'Online Service • Global Available',
    notice: '⚡ Special Wartime Service: Remote design with postponed construction',
    noticeZh: '⚡ 战时特别服务：远程设计，延后施工'
  },

  // 和平模式配置（战后恢复，线下业务为主）
  peacetime: {
    bannerTitle: 'Find Your Designer',
    bannerSubtitle: 'Our interior design services are tailored to your space, style, and budget — across the UAE.',
    bannerCta: 'Meet Designers',
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
