'use client';

import { useState } from 'react';
import { Camera } from 'lucide-react';
import { resolveImageUrl } from '../../lib/imageUrl';

interface AvatarProps {
  name: string;
  avatarUrl?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  onClick?: () => void;
  editable?: boolean;
}

const SIZE_MAP = {
  sm: 'size-8 text-xs',
  md: 'size-10 text-sm',
  lg: 'size-12 text-base',
  xl: 'size-16 text-lg',
};

const CAMERA_SIZE_MAP = {
  sm: 'w-3 h-3',
  md: 'w-3.5 h-3.5',
  lg: 'w-4 h-4',
  xl: 'w-4 h-4',
};

export default function Avatar({ name, avatarUrl, size = 'md', className = '', onClick, editable = false }: AvatarProps) {
  const [imgFailed, setImgFailed] = useState(false);

  const getInitials = (fullName: string): string => {
    if (!fullName) return '?';
    const words = fullName.trim().split(/\s+/);
    return words.length === 1
      ? words[0].charAt(0).toUpperCase()
      : (words[0].charAt(0) + words[1].charAt(0)).toUpperCase();
  };

  const getColorFromName = (fullName: string): string => {
    if (!fullName) return '#b8864a';
    const colors = ['#b8864a', '#6366f1', '#8b5cf6', '#ec4899', '#14b8a6', '#f59e0b', '#ef4444', '#22c55e'];
    let hash = 0;
    for (let i = 0; i < fullName.length; i++) {
      hash = fullName.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  };

  const initials = getInitials(name);
  const bgColor = getColorFromName(name);
  const sizeClass = SIZE_MAP[size];
  const cameraSizeClass = CAMERA_SIZE_MAP[size];
  const wrapperClass = editable ? 'cursor-pointer' : '';

  const cameraButton = editable && (
    <div className="absolute bottom-0 right-0 w-6 h-6 rounded-full bg-black/80 flex items-center justify-center shadow-sm pointer-events-none">
      <Camera className={`${cameraSizeClass} text-white`} strokeWidth={1.5} />
    </div>
  );

  const resolvedAvatarUrl = resolveImageUrl(avatarUrl || '');

  if (resolvedAvatarUrl && !imgFailed) {
    return (
      <div className={`relative inline-flex ${wrapperClass} ${className}`} onClick={editable ? onClick : undefined}>
        <div className={`${sizeClass} rounded-full overflow-hidden flex-shrink-0 border-2 border-white shadow-sm bg-stone-200`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={resolvedAvatarUrl} alt={`${name} avatar`} className="w-full h-full object-cover" onError={() => setImgFailed(true)} />
        </div>
        {cameraButton}
      </div>
    );
  }

  return (
    <div className={`relative inline-flex ${wrapperClass} ${className}`} onClick={editable ? onClick : undefined}>
      <div
        className={`${sizeClass} rounded-full flex items-center justify-center flex-shrink-0 border-2 border-white shadow-sm`}
        style={{ backgroundColor: `${bgColor}20`, color: bgColor }}
      >
        <span className="font-bold">{initials}</span>
      </div>
      {cameraButton}
    </div>
  );
}
