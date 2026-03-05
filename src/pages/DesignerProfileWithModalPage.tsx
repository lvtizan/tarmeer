import { useNavigate, useParams } from 'react-router-dom';
import DesignerProfilePage from './DesignerProfilePage';
import ProjectDetailModal from '../components/project/ProjectDetailModal';

/**
 * Renders the designer profile with the project detail as a modal overlay.
 * Used for route /designers/:slug/projects/:projectId. Closing the modal navigates to /designers/:slug.
 */
export default function DesignerProfileWithModalPage() {
  const { slug, projectId } = useParams<{ slug: string; projectId: string }>();
  const navigate = useNavigate();

  if (!slug || !projectId) {
    navigate('/designers');
    return null;
  }

  return (
    <>
      <DesignerProfilePage />
      <ProjectDetailModal
        slug={slug}
        projectId={projectId}
        onClose={() => navigate(`/designers/${slug}`)}
      />
    </>
  );
}
