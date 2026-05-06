/**
 * CompanyProjectsSection — 公司详情页的项目卡片网格模块
 *
 * 锁死布局：每个项目一张 16:9 封面卡片 + 左下角图片数量角标 + 标题 + 位置/简介。
 * 点卡片跳到该项目详情。
 *
 * 这是详情页最容易被改坏的一块（参 commit 20b7b5f7 / 243a6c24 引入的双 pipeline
 * 回归），抽成独立组件 + 单一渲染入口，所有 detail 页面（public 直访 / admin
 * preview / company-dashboard preview）都用这个组件渲染，不再有第二份样式。
 */
import { useNavigate } from 'react-router-dom';
import { ImageIcon, MapPin } from 'lucide-react';
import SmartImage from './ui/SmartImage';
import type { Company, CompanyProjectCard } from '../lib/companyData';

interface Props {
  company: Pick<Company, 'id' | 'name'>;
  projects: CompanyProjectCard[];
}

export default function CompanyProjectsSection({ company, projects }: Props) {
  const navigate = useNavigate();
  if (!projects.length) return null;

  return (
    <section className="py-10 lg:py-14">
      <div className="flex items-end justify-between mb-8">
        <h2 className="font-serif text-3xl sm:text-4xl text-[#1c1917]">Projects</h2>
        <span className="text-sm text-[#6b6b6b] tabular-nums">
          {projects.length} {projects.length === 1 ? 'project' : 'projects'}
        </span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        {projects.map((proj) => (
          <div
            key={proj.slug}
            className="group cursor-pointer"
            onClick={() => navigate(`/companies/${company.id}/${proj.slug}`)}
          >
            <div className="relative aspect-video rounded-xl overflow-hidden bg-stone-100">
              <SmartImage
                src={proj.images[0]}
                alt={`${proj.title} by ${company.name}`}
                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
              />
              {proj.images.length > 1 && (
                <div className="absolute bottom-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/60 text-white text-xs font-medium backdrop-blur-sm">
                  <ImageIcon className="w-3.5 h-3.5" />
                  {proj.images.length}
                </div>
              )}
            </div>
            <div className="mt-3">
              <h3 className="text-[15px] font-medium text-[#1c1917] group-hover:text-[#b8864a] transition line-clamp-1">
                {proj.title}
              </h3>
              {proj.location && (
                <p className="flex items-center gap-1 text-sm text-stone-500 mt-1">
                  <MapPin className="w-3.5 h-3.5" /> {proj.location}
                </p>
              )}
              {!proj.location && proj.description && (
                <p className="text-sm text-stone-500 mt-1 line-clamp-1">{proj.description}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
