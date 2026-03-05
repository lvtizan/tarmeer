import { Link, useParams } from 'react-router-dom';
import { MapPin, CircleDollarSign } from 'lucide-react';
import PageContainer from '../components/PageContainer';
import { getDesignerBySlug, getProject } from '../data/designers';
import { WHATSAPP_LINK } from '../lib/constants';
import ProjectGallery from '../components/project/ProjectGallery';

export default function ProjectDetailPage() {
  const { slug, projectId } = useParams<{ slug: string; projectId: string }>();
  const designer = slug ? getDesignerBySlug(slug) : undefined;
  const project = slug && projectId ? getProject(slug, projectId) : undefined;

  if (!designer || !project) {
    return (
      <PageContainer className="py-12 text-center">
        <p className="text-[#6b6b6b]">Project not found.</p>
        <Link to={slug ? `/designers/${slug}` : '/designers'} className="text-[#c6a065] hover:underline mt-4 inline-block">
          ← Back
        </Link>
      </PageContainer>
    );
  }

  return (
    <PageContainer className="py-8 sm:py-12">
      <Link to={`/designers/${slug}`} className="text-[#c6a065] hover:underline text-sm mb-8 inline-block">
        ← {designer.firstName}&apos;s portfolio
      </Link>

      <ProjectGallery images={project.images} title={project.title} />

      <h1 className="font-serif text-2xl sm:text-3xl font-semibold text-[#2c2c2c] mt-8">
        {project.title}
      </h1>
      <p className="text-[#6b6b6b] mt-2">
        By{' '}
        <Link to={`/designers/${slug}`} className="text-[#c6a065] hover:underline">
          {designer.name}
        </Link>
        {project.year && ` · ${project.year}`}
        {project.location && ` · ${project.location}`}
      </p>

      <div className="mt-8 space-y-6 border-t border-stone-200 pt-8">
        <div className="flex gap-3 items-start">
          <MapPin className="w-5 h-5 text-[#c6a065] flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-[#2c2c2c] text-sm uppercase tracking-wider">Address</h3>
            <p className="text-[#2c2c2c] mt-1">{project.address}</p>
          </div>
        </div>
        <div className="flex gap-3 items-start">
          <CircleDollarSign className="w-5 h-5 text-[#c6a065] flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-[#2c2c2c] text-sm uppercase tracking-wider">Project cost</h3>
            <p className="text-[#2c2c2c] mt-1">{project.cost}</p>
          </div>
        </div>
        <div>
          <h3 className="font-semibold text-[#2c2c2c] text-sm uppercase tracking-wider mb-2">Project overview</h3>
          <p className="text-[#2c2c2c] leading-relaxed">{project.description}</p>
        </div>
      </div>

      <div className="mt-10 flex flex-wrap gap-3">
        <a href={WHATSAPP_LINK} target="_blank" rel="noopener noreferrer" className="btn-primary">
          Contact us
        </a>
      </div>
    </PageContainer>
  );
}
