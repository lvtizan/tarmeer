# AI Image Tagging — Design Doc

**Date**: 2026-04-10
**Goal**: Auto-tag project images with Google Vision API on upload, mapping to existing category tags + storing fine-grained AI tags for SEO/article generation.

---

## Architecture

```
Image upload → persistProjectImages() saves files
            → return success to frontend
            → fire-and-forget tagProjectImages()
                → per-image Google Vision API call
                → map labels to 14 category tags → merge into project tags
                → store raw AI tags in images object array
```

## Data Structure

`images` field changes from URL string array to object array (backward-compatible):

```json
[
  {
    "url": "/uploads/projects/1/2/2026/04/abc.jpg",
    "ai_tags": ["Marble Floor", "Modern", "White", "Open Plan"],
    "ai_category": ["Kitchen", "Living"],
    "ai_tagged_at": "2026-04-10T12:00:00Z"
  }
]
```

Old format `["/uploads/..."]` continues to work — treated as `{ url: string }`.

Project `tags` field = deduplicated union of all images' `ai_category`, auto-maintained.

## Category Mapping

Vision labels mapped to existing 14 tags via keyword matching (case-insensitive):

- Kitchen: kitchen, countertop, cabinet, sink, cooking
- Bathroom: bathroom, shower, bathtub, toilet, vanity
- Living: living room, sofa, couch, lounge
- Bedroom: bedroom, bed, mattress, wardrobe
- Villa: villa, mansion, estate, facade, exterior
- Apartment: apartment, flat, condo, balcony
- Majlis: majlis, arabic, traditional seating
- Dining: dining, table, chair, chandelier
- Outdoor: outdoor, garden, pool, patio, terrace, landscape
- Lighting: lighting, lamp, chandelier, pendant, sconce
- Storage: storage, closet, shelf, bookcase, drawer
- Renovation: renovation, construction, remodel
- Materials: marble, wood, tile, stone, granite, ceramic
- Workspace: office, desk, workspace, study

## Backend

### New file: `server/src/services/visionTagging.ts`
- `tagProjectImages(projectId)` — main entry, loads project, processes untagged images
- `callVisionApi(imagePath)` — calls Google Vision labelDetection + objectLocalization
- `mapToCategories(labels)` — maps to 14 categories via keyword match
- `updateProjectWithTags(projectId, images, mergedCategories)` — writes back to DB

### Trigger points
- `projectController.ts` createProject: after response, fire-and-forget
- `projectController.ts` updateProject: after response, fire-and-forget (new images only)

### Config
- `GOOGLE_VISION_CREDENTIALS` env var — path to service account JSON
- `@google-cloud/vision` npm package
- Top 15 labels per image, confidence > 0.7

## Frontend

### CompanyProjectsPage.tsx
- Show AI tag pills below each image thumbnail (shimmer while loading)
- Auto-check category tags when AI suggests them (user can override)
- Small sparkle icon on tagged images

### Compatibility
- `normalizeProject()` updated to handle both string URLs and image objects
- `parseMaybeArray()` works with both formats
- Old data unaffected; only newly uploaded images get AI tags

## Cost
- Google Vision: ~$1.50/1000 images
- Only new images tagged (skip if `ai_tagged_at` exists)
