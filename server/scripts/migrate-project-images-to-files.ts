import dotenv from 'dotenv';
import pool from '../src/config/database';
import { parseJsonField } from '../src/lib/parseJsonField';
import { normalizeProjectImages } from '../src/lib/projectPersistence';
import { isImageDataUrl, persistProjectImages } from '../src/lib/projectImageStorage';

dotenv.config();

type ProjectRow = {
  id: number;
  designer_id: number;
  images: unknown;
};

async function main() {
  console.log('[migrate-project-images] Starting migration...');
  const [rows] = await pool.execute(
    'SELECT id, designer_id, images FROM projects ORDER BY id ASC'
  );

  const projects = rows as ProjectRow[];
  let scanned = 0;
  let migrated = 0;
  let skipped = 0;

  for (const project of projects) {
    scanned += 1;
    const parsed = parseJsonField(project.images);
    const currentImages = normalizeProjectImages(parsed);
    if (currentImages.length === 0) {
      skipped += 1;
      continue;
    }

    const hasDataUrl = currentImages.some((image) => isImageDataUrl(image));
    if (!hasDataUrl) {
      skipped += 1;
      continue;
    }

    const nextImages = await persistProjectImages(currentImages, {
      designerId: project.designer_id,
      projectId: project.id,
    });

    if (nextImages.length === 0) {
      console.warn(`[migrate-project-images] Project ${project.id} produced no valid URLs; skipped.`);
      skipped += 1;
      continue;
    }

    await pool.execute(
      'UPDATE projects SET images = ? WHERE id = ?',
      [JSON.stringify(nextImages), project.id]
    );
    migrated += 1;

    if (migrated % 20 === 0) {
      console.log(`[migrate-project-images] Progress: migrated ${migrated} projects...`);
    }
  }

  console.log(
    `[migrate-project-images] Completed. scanned=${scanned}, migrated=${migrated}, skipped=${skipped}`
  );
}

main()
  .catch((error) => {
    console.error('[migrate-project-images] Failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
