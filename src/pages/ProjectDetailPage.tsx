import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import PageContainer from '../components/PageContainer';
import { fetchPublicDesignerDetail } from '../lib/publicApi';
import ProjectDetailContent from '../components/project/ProjectDetailContent';

export default function ProjectDetailPage() {
  const { slug, projectId } = useParams<{ slug: string; projectId: string }>();
  const [detail, setDetail] = useState<Awaited<ReturnType<typeof fetchPublicDesignerDetail>> | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!slug) return;
    setIsLoading(true);
    fetchPublicDesignerDetail(slug)
      .then(setDetail)
      .catch((error) => {
        console.error('Failed to load project detail page:', error);
        setDetail(null);
      })
      .finally(() => setIsLoading(false));
  }, [slug]);

  const designer = detail;
  const project = detail?.projects.find((item) => item.id === projectId);

  if (isLoading) {
    return (
      <PageContainer className="py-12 text-center">
        <p className="text-[#6b6b6b]">Loading project...</p>
      </PageContainer>
    );
  }

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
      <ProjectDetailContent project={project} designer={designer} />
    </PageContainer>
  );
}
