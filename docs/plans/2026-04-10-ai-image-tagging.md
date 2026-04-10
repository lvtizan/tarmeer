# AI Image Tagging Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Auto-tag project images via Google Vision API on upload, mapping to 14 category tags + storing fine-grained AI tags per image.

**Architecture:** After images are persisted to disk, fire-and-forget calls a tagging service that sends each image to Google Vision API (labelDetection + objectLocalization), maps results to category tags, and updates the project's `images` field (now an object array with `ai_tags`/`ai_category`) and `tags` field (merged categories).

**Tech Stack:** Google Cloud Vision API (`@google-cloud/vision`), Express/MySQL backend, React frontend

---

## Task 1: Install @google-cloud/vision + config

**Files:**
- Modify: `server/package.json` (add dependency)
- Modify: `server/src/config/index.ts` (add vision config)

**Step 1: Install the package**

```bash
cd server && npm install @google-cloud/vision
```

**Step 2: Add config**

In `server/src/config/index.ts`, add to the config object after `oauth`:

```typescript
  vision: {
    credentialsPath: process.env.GOOGLE_VISION_CREDENTIALS || '',
    enabled: process.env.GOOGLE_VISION_ENABLED === 'true',
    maxLabels: 15,
    minConfidence: 0.7,
  },
```

**Step 3: Commit**

```bash
git add server/package.json server/package-lock.json server/src/config/index.ts
git commit -m "feat: add @google-cloud/vision dependency + config"
```

---

## Task 2: Vision tagging service

**Files:**
- Create: `server/src/services/visionTagging.ts`

**Step 1: Create the service**

```typescript
import vision from '@google-cloud/vision';
import path from 'path';
import pool from '../config/database';
import config from '../config';
import { parseJsonField } from '../lib/parseJsonField';

const TAG = '[vision-tagging]';

const CATEGORY_MAP: Record<string, string[]> = {
  Kitchen:    ['kitchen', 'countertop', 'cabinet', 'sink', 'cooking', 'stove', 'oven'],
  Bathroom:   ['bathroom', 'shower', 'bathtub', 'toilet', 'vanity', 'faucet'],
  Living:     ['living room', 'sofa', 'couch', 'lounge', 'television', 'fireplace'],
  Bedroom:    ['bedroom', 'bed', 'mattress', 'pillow', 'wardrobe', 'nightstand'],
  Villa:      ['villa', 'mansion', 'estate', 'facade', 'exterior', 'house'],
  Apartment:  ['apartment', 'flat', 'condo', 'balcony', 'high-rise'],
  Majlis:     ['majlis', 'arabic', 'traditional', 'cushion'],
  Dining:     ['dining', 'dining room', 'dining table', 'chandelier'],
  Outdoor:    ['outdoor', 'garden', 'pool', 'swimming pool', 'patio', 'terrace', 'landscape'],
  Lighting:   ['lighting', 'lamp', 'chandelier', 'pendant light', 'sconce', 'ceiling light'],
  Storage:    ['storage', 'closet', 'shelf', 'bookcase', 'drawer', 'cabinet'],
  Renovation: ['renovation', 'construction', 'remodel', 'building'],
  Materials:  ['marble', 'wood', 'tile', 'stone', 'granite', 'ceramic', 'glass', 'concrete'],
  Workspace:  ['office', 'desk', 'workspace', 'study', 'computer', 'monitor'],
};

// Image entry: either a plain URL string (legacy) or an object with metadata
interface ImageEntry {
  url: string;
  ai_tags?: string[];
  ai_category?: string[];
  ai_tagged_at?: string;
}

function normalizeImageEntry(entry: unknown): ImageEntry {
  if (typeof entry === 'string') return { url: entry };
  if (entry && typeof entry === 'object' && 'url' in entry) return entry as ImageEntry;
  return { url: '' };
}

function mapToCategories(labels: string[]): string[] {
  const matched = new Set<string>();
  const lowerLabels = labels.map((l) => l.toLowerCase());
  for (const [category, keywords] of Object.entries(CATEGORY_MAP)) {
    for (const keyword of keywords) {
      if (lowerLabels.some((l) => l.includes(keyword))) {
        matched.add(category);
        break;
      }
    }
  }
  return [...matched];
}

let client: vision.ImageAnnotatorClient | null = null;

function getClient(): vision.ImageAnnotatorClient | null {
  if (!config.vision.enabled) return null;
  if (client) return client;
  const opts: any = {};
  if (config.vision.credentialsPath) {
    opts.keyFilename = config.vision.credentialsPath;
  }
  client = new vision.ImageAnnotatorClient(opts);
  return client;
}

async function analyzeImage(absolutePath: string): Promise<{ labels: string[] }> {
  const visionClient = getClient();
  if (!visionClient) return { labels: [] };

  try {
    const [result] = await visionClient.annotateImage({
      image: { source: { filename: absolutePath } },
      features: [
        { type: 'LABEL_DETECTION', maxResults: config.vision.maxLabels },
        { type: 'OBJECT_LOCALIZATION', maxResults: 10 },
      ],
    });

    const labels: string[] = [];
    const minScore = config.vision.minConfidence;

    for (const label of result.labelAnnotations || []) {
      if ((label.score ?? 0) >= minScore && label.description) {
        labels.push(label.description);
      }
    }
    for (const obj of result.localizedObjectAnnotations || []) {
      if ((obj.score ?? 0) >= minScore && obj.name) {
        labels.push(obj.name);
      }
    }

    // Deduplicate (case-insensitive)
    const seen = new Set<string>();
    return {
      labels: labels.filter((l) => {
        const key = l.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      }),
    };
  } catch (err) {
    console.error(TAG, 'Vision API error for', absolutePath, err);
    return { labels: [] };
  }
}

function resolveAbsolutePath(imageUrl: string): string {
  // imageUrl is like /uploads/projects/1/2/2026/04/uuid.jpg
  return path.join(__dirname, '..', '..', 'public', imageUrl);
}

export async function tagProjectImages(projectId: number): Promise<void> {
  if (!config.vision.enabled) {
    console.log(TAG, 'Vision API disabled, skipping project', projectId);
    return;
  }

  try {
    const [rows] = await pool.execute('SELECT images, tags FROM projects WHERE id = ?', [projectId]);
    const project = (rows as any[])[0];
    if (!project) return;

    const rawImages = parseJsonField(project.images) || [];
    const entries: ImageEntry[] = rawImages.map(normalizeImageEntry).filter((e) => e.url);

    let changed = false;
    const allCategories = new Set<string>();

    for (const entry of entries) {
      // Skip already tagged images
      if (entry.ai_tagged_at) {
        if (entry.ai_category) entry.ai_category.forEach((c) => allCategories.add(c));
        continue;
      }

      // Skip external URLs (only tag local uploads)
      if (!entry.url.startsWith('/uploads/')) {
        continue;
      }

      const absPath = resolveAbsolutePath(entry.url);
      const { labels } = await analyzeImage(absPath);

      if (labels.length > 0) {
        entry.ai_tags = labels;
        entry.ai_category = mapToCategories(labels);
        entry.ai_tagged_at = new Date().toISOString();
        entry.ai_category.forEach((c) => allCategories.add(c));
        changed = true;
        console.log(TAG, `Tagged image ${entry.url}: ${labels.length} labels, ${entry.ai_category.length} categories`);
      }
    }

    if (!changed) return;

    // Merge AI categories with existing manual tags
    const existingTags: string[] = parseJsonField(project.tags) || [];
    const mergedTags = [...new Set([...existingTags, ...allCategories])];

    await pool.execute(
      'UPDATE projects SET images = ?, tags = ? WHERE id = ?',
      [JSON.stringify(entries), JSON.stringify(mergedTags), projectId]
    );

    console.log(TAG, `Project ${projectId}: updated ${entries.length} images, ${mergedTags.length} tags`);
  } catch (err) {
    console.error(TAG, 'Failed to tag project', projectId, err);
  }
}
```

**Step 2: Commit**

```bash
git add server/src/services/visionTagging.ts
git commit -m "feat: add Vision API tagging service with category mapping"
```

---

## Task 3: Hook tagging into project create/update

**Files:**
- Modify: `server/src/controllers/projectController.ts`

**Step 1: Add fire-and-forget calls**

Import at top of file:

```typescript
import { tagProjectImages } from '../services/visionTagging';
```

In `createProject`, after `res.status(201).json(...)` but before the catch block, add:

```typescript
    // Fire-and-forget: AI tag images
    tagProjectImages(projectId).catch((err) =>
      console.error('[vision-tagging] Background tagging failed:', err)
    );
```

In `updateProject`, after `res.json(...)` but before the catch block, add:

```typescript
    // Fire-and-forget: AI tag new images
    tagProjectImages(Number(id)).catch((err) =>
      console.error('[vision-tagging] Background tagging failed:', err)
    );
```

**Step 2: Commit**

```bash
git add server/src/controllers/projectController.ts
git commit -m "feat: trigger Vision API tagging on project create/update"
```

---

## Task 4: Update normalizeProject + projectPersistence for image objects

**Files:**
- Modify: `server/src/controllers/projectController.ts` (normalizeProject)
- Modify: `server/src/lib/projectPersistence.ts` (validation)

**Step 1: Update normalizeProject**

The `normalizeProject` function in `projectController.ts` needs to handle both old (string[]) and new (object[]) image formats:

```typescript
function normalizeProject(project: any) {
  const rawImages = parseJsonField(project.images) || [];
  // Support both string URLs and image objects
  const images = rawImages.map((entry: any) =>
    typeof entry === 'string' ? entry : entry
  );
  return {
    ...project,
    images,
    tags: parseJsonField(project.tags) || [],
  };
}
```

**Step 2: Update projectPersistence validation**

In `projectPersistence.ts`, update `normalizeProjectImages` to handle objects:

```typescript
export function normalizeProjectImages(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      if (typeof item === 'string') return item.trim();
      if (item && typeof item === 'object' && 'url' in item) return (item as any).url;
      return '';
    })
    .filter((item) => item.length > 0);
}
```

Update `validateNoBase64Images` similarly:

```typescript
function validateNoBase64Images(images: unknown): void {
  if (!Array.isArray(images)) return;
  for (const image of images) {
    const url = typeof image === 'string' ? image : (image as any)?.url || '';
    if (url.startsWith('data:')) {
      throw new Error(BASE64_IMAGES_NOT_ALLOWED_ERROR);
    }
  }
}
```

**Step 3: Commit**

```bash
git add server/src/controllers/projectController.ts server/src/lib/projectPersistence.ts
git commit -m "feat: support image objects in normalizeProject + persistence validation"
```

---

## Task 5: Frontend — display AI tags on project images

**Files:**
- Modify: `src/pages/company/CompanyProjectsPage.tsx`

**Step 1: Update parseMaybeArray to handle image objects**

Update the existing `parseMaybeArray` function at the top of the file to also return image objects:

```typescript
// New helper for image entries
interface ImageEntry {
  url: string;
  ai_tags?: string[];
  ai_category?: string[];
  ai_tagged_at?: string;
}

function parseImageEntries(value: unknown): ImageEntry[] {
  const raw = typeof value === 'string' ? (() => { try { return JSON.parse(value); } catch { return []; } })() : value;
  if (!Array.isArray(raw)) return [];
  return raw.map((item: any) => {
    if (typeof item === 'string') return { url: item };
    if (item && typeof item === 'object' && item.url) return item as ImageEntry;
    return { url: '' };
  }).filter((e) => e.url);
}
```

**Step 2: Show AI tags under image thumbnails**

Where images are displayed in the edit form (the image grid), add below each thumbnail:

```tsx
{entry.ai_tags && entry.ai_tags.length > 0 && (
  <div className="flex flex-wrap gap-1 mt-1.5 px-1">
    {entry.ai_tags.slice(0, 5).map((tag) => (
      <span key={tag} className="inline-flex px-1.5 py-0.5 rounded text-[10px] bg-[#b8864a]/10 text-[#b8864a]">
        {tag}
      </span>
    ))}
    {entry.ai_tags.length > 5 && (
      <span className="text-[10px] text-stone-400">+{entry.ai_tags.length - 5}</span>
    )}
  </div>
)}
```

**Step 3: Auto-check AI-suggested category tags**

When loading a project for editing, merge AI categories into the selected tags:

```typescript
// In the project load/edit handler, after setting tags:
const aiCategories = imageEntries
  .flatMap((e) => e.ai_category || [])
  .filter((c, i, arr) => arr.indexOf(c) === i);
setTags((prev) => [...new Set([...prev, ...aiCategories])]);
```

**Step 4: Add sparkle icon on tagged images**

On each image thumbnail that has `ai_tagged_at`, show a small sparkle indicator:

```tsx
{entry.ai_tagged_at && (
  <div className="absolute top-1 right-1 w-5 h-5 rounded-full bg-[#b8864a]/20 flex items-center justify-center" title="AI Tagged">
    <span className="text-[10px]">✦</span>
  </div>
)}
```

**Step 5: Commit**

```bash
git add src/pages/company/CompanyProjectsPage.tsx
git commit -m "feat: display AI tags on project images in company dashboard"
```

---

## Task 6: Add GOOGLE_VISION env vars to .env.example and docs

**Files:**
- Modify: `server/.env.example` (if exists, otherwise create)
- Modify: `docs/plans/2026-04-10-ai-image-tagging-design.md` (mark as implemented)

**Step 1: Add env var documentation**

Add to server `.env.example` or `.env`:

```
# Google Vision API (AI image tagging)
GOOGLE_VISION_ENABLED=false
GOOGLE_VISION_CREDENTIALS=/path/to/service-account.json
```

**Step 2: Commit**

```bash
git add -A
git commit -m "docs: add Google Vision env vars"
```

---

## Task 7: Manual integration test

**Step 1: Set up Google Vision credentials**

1. Create a GCP project, enable Cloud Vision API
2. Create a service account key JSON
3. Set `GOOGLE_VISION_ENABLED=true` and `GOOGLE_VISION_CREDENTIALS=/path/to/key.json` in server `.env`

**Step 2: Test the flow**

1. Start backend: `cd server && npm run dev`
2. Start frontend: `npm run dev`
3. Log in as a company user
4. Create a new project with 2-3 interior design photos
5. Submit the project
6. Wait 5-10 seconds, refresh the page
7. Verify:
   - [ ] Images now show AI tag pills (e.g. "Kitchen", "Marble", "Modern")
   - [ ] Category tags auto-checked in the tag selector
   - [ ] Console shows `[vision-tagging]` log messages
   - [ ] Database `images` field contains object array with `ai_tags`, `ai_category`, `ai_tagged_at`

**Step 3: Test with Vision disabled**

1. Set `GOOGLE_VISION_ENABLED=false`
2. Upload a new project
3. Verify no errors, images work normally without tags
