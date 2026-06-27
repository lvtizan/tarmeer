'use client';

import SmartImage from '@/components/ui/SmartImage';
import type { ReactNode } from 'react';

/**
 * 固定比例图片框（默认 16:9 / aspect-video）。图片用 object-cover 填满，防 CLS。
 * 项目封面 / 项目详情主图等统一用它，符合「项目图必须 aspect-video」规范(AGENTS 图片比例规范)。
 * children 作为覆盖层(轮播按钮、计数等)叠在图上。
 */
export default function AspectImage({
  src, alt, ratioClass = 'aspect-video', className = '', imgClassName = '', children,
}: {
  src: string;
  alt: string;
  ratioClass?: string;
  className?: string;
  imgClassName?: string;
  children?: ReactNode;
}) {
  return (
    <div className={`relative ${ratioClass} overflow-hidden bg-stone-100 ${className}`}>
      <SmartImage src={src} alt={alt} className={`absolute inset-0 w-full h-full object-cover ${imgClassName}`} />
      {children}
    </div>
  );
}
