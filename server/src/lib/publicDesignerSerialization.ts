import { parseJsonField } from './parseJsonField';
import { sanitizeAvatarUrl, sanitizeImageUrls } from './publicImageCleanup';

function toPublicString(value: unknown) {
  return typeof value === 'string' ? value : '';
}

export function sanitizePublicDesigner(designer: any) {
  const featuredImages = sanitizeImageUrls(parseJsonField(designer.featured_project_images) || []);

  return {
    id: designer.id,
    full_name: toPublicString(designer.full_name),
    title: toPublicString(designer.title),
    city: toPublicString(designer.city),
    bio: toPublicString(designer.bio),
    avatar_url: sanitizeAvatarUrl(designer.avatar_url),
    style: toPublicString(designer.style),
    expertise: parseJsonField(designer.expertise) || [],
    display_order: designer.display_order || 0,
    project_count: designer.project_count || 0,
    featured_images: featuredImages,
    featured_project_images: featuredImages,
    created_at: toPublicString(designer.created_at),
  };
}

export function sanitizePublicProject(project: any) {
  return {
    id: project.id,
    title: toPublicString(project.title),
    description: toPublicString(project.description),
    style: toPublicString(project.style),
    location: toPublicString(project.location),
    area: toPublicString(project.area),
    year: toPublicString(project.year),
    cost: toPublicString(project.cost),
    images: sanitizeImageUrls(parseJsonField(project.images) || []),
    tags: parseJsonField(project.tags) || [],
    designer_name: toPublicString(project.designer_name),
    designer_city: toPublicString(project.designer_city),
    designer_avatar: sanitizeAvatarUrl(project.designer_avatar),
    designer_bio: toPublicString(project.designer_bio),
    created_at: toPublicString(project.created_at),
  };
}
