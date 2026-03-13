import { Camera } from 'lucide-react';

interface AvatarProps {
  name: string;
  avatarUrl?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  onClick?: () => void;
  editable?: boolean; // 是否显示编辑相机图标
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
  // 获取用户名首字母（取名字的前两个单词的首字母）
  const getInitials = (fullName: string): string => {
    if (!fullName) return '?';
    const words = fullName.trim().split(/\s+/);
    if (words.length === 1) {
      return words[0].charAt(0).toUpperCase();
    }
    return (words[0].charAt(0) + words[1].charAt(0)).toUpperCase();
  };

  // 生成基于名字的颜色
  const getColorFromName = (fullName: string): string => {
    if (!fullName) return '#b8864a';
    const colors = [
      '#b8864a', // 主题色
      '#6366f1', // indigo
      '#8b5cf6', // violet
      '#ec4899', // pink
      '#14b8a6', // teal
      '#f59e0b', // amber
      '#ef4444', // red
      '#22c55e', // green
    ];
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

  // 相机图标按钮（右下角）- 黑色80%半透明圆形 + 白色线性图标
  const cameraButton = editable && (
    <div className="absolute bottom-0 right-0 w-6 h-6 rounded-full bg-black/80 flex items-center justify-center shadow-sm pointer-events-none">
      <Camera className={`${cameraSizeClass} text-white`} strokeWidth={1.5} />
    </div>
  );

  const wrapperClass = editable ? 'cursor-pointer' : '';

  // 如果有头像URL，显示图片
  if (avatarUrl) {
    return (
      <div 
        className={`relative inline-flex ${wrapperClass} ${className}`} 
        onClick={editable ? onClick : undefined}
      >
        <div
          className={`${sizeClass} rounded-full bg-cover bg-center flex-shrink-0 border-2 border-white shadow-sm`}
          style={{ backgroundImage: `url(${avatarUrl})` }}
        />
        {cameraButton}
      </div>
    );
  }

  // 否则显示首字母头像
  return (
    <div 
      className={`relative inline-flex ${wrapperClass} ${className}`} 
      onClick={editable ? onClick : undefined}
    >
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
