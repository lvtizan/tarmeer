# Field Survey Enhancements Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enhance the field survey page with per-question photos, a free-text Q&A module, Google Maps address pinning, and remove the global camera button.

**Architecture:**
- Photos: extend flat `photos` array with `field_key` tags; camera icon per question
- Q&A: new `survey_questions` DB table + `qa_answers` JSON column in `company_interviews`; admin tab in existing survey-questions page
- Map pin: new `MapPinModal` component using Google Maps JS API (Places + draggable marker); stores `location_pin` JSON in interview
- CRM: new fields flow through existing `mergeInterviewToProfile` → `partnerSync`

**Tech Stack:** Next.js App Router, Google Maps JS API (`@googlemaps/js-api-loader`), Express, MySQL, TypeScript

---

## Task 1: Backend — DB migration + survey_questions table + CRUD controller

**Files:**
- Modify: `server/dist/controllers/fieldInterviewController.js`
- Create: `server/dist/controllers/surveyQuestionsController.js`
- Modify: `server/dist/routes/field.js`
- Modify: `server/dist/routes/admin.js`

### Step 1: Add `qa_answers` and `location_pin` columns to `ensureInterviewColumns`

In `fieldInterviewController.js`, find `ensureInterviewColumns()` and add two more column checks after the `country` block:

```js
if (!existingSet.has('qa_answers')) {
  await database_1.default.execute(`ALTER TABLE company_interviews ADD COLUMN qa_answers JSON NULL`);
  console.log('[field] added column: qa_answers');
}
if (!existingSet.has('location_pin')) {
  await database_1.default.execute(`ALTER TABLE company_interviews ADD COLUMN location_pin JSON NULL`);
  console.log('[field] added column: location_pin');
}
```

### Step 2: Add `qa_answers` and `location_pin` to `saveDraft`

In the `saveDraft` function, the destructured body currently ends with `photos`. Add `qa_answers` and `location_pin` to the destructuring and handling:

```js
const { ..., photos, qa_answers, location_pin } = req.body;
// after the photos block:
if (qa_answers !== undefined)
    fields.qa_answers = JSON.stringify(qa_answers);
if (location_pin !== undefined)
    fields.location_pin = location_pin ? JSON.stringify(location_pin) : null;
```

### Step 3: Add `field_key` to `uploadPhoto`

In the `uploadPhoto` handler, find the `newPhoto` object construction and add `field_key`:

```js
const newPhoto = {
    url: `/uploads/field-photos/${req.file.filename}`,
    lat: parseFloat(req.body.lat) || null,
    lng: parseFloat(req.body.lng) || null,
    timestamp: req.body.timestamp || new Date().toISOString(),
    field_key: req.body.field_key || null,
};
```

### Step 4: Create `surveyQuestionsController.js`

Create `server/dist/controllers/surveyQuestionsController.js`:

```js
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.listQuestions = listQuestions;
exports.createQuestion = createQuestion;
exports.updateQuestion = updateQuestion;
exports.deleteQuestion = deleteQuestion;
exports.reorderQuestions = reorderQuestions;

const database_1 = __importDefault(require("../config/database"));

async function ensureSurveyQuestionsTable() {
    try {
        await database_1.default.execute(`
            CREATE TABLE IF NOT EXISTS survey_questions (
                id INT AUTO_INCREMENT PRIMARY KEY,
                question_text VARCHAR(500) NOT NULL,
                sort_order INT NOT NULL DEFAULT 0,
                is_active TINYINT(1) NOT NULL DEFAULT 1,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
        `);
    } catch (e) {
        console.error('[survey_questions] ensureTable:', e.message);
    }
}
ensureSurveyQuestionsTable();

async function listQuestions(req, res) {
    try {
        const activeOnly = req.query.active !== 'false';
        const where = activeOnly ? 'WHERE is_active = 1' : '';
        const [rows] = await database_1.default.execute(
            `SELECT id, question_text, sort_order, is_active FROM survey_questions ${where} ORDER BY sort_order ASC, id ASC`
        );
        res.json({ questions: rows });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
}

async function createQuestion(req, res) {
    const { question_text } = req.body;
    if (!question_text?.trim()) return res.status(400).json({ error: 'question_text required' });
    try {
        const [maxRow] = await database_1.default.execute('SELECT COALESCE(MAX(sort_order),0)+1 AS next_order FROM survey_questions');
        const nextOrder = maxRow[0].next_order;
        const [result] = await database_1.default.execute(
            'INSERT INTO survey_questions (question_text, sort_order) VALUES (?, ?)',
            [question_text.trim(), nextOrder]
        );
        res.status(201).json({ id: result.insertId, question_text: question_text.trim(), sort_order: nextOrder, is_active: 1 });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
}

async function updateQuestion(req, res) {
    const { id } = req.params;
    const { question_text, is_active } = req.body;
    try {
        const sets = [];
        const vals = [];
        if (question_text !== undefined) { sets.push('question_text = ?'); vals.push(question_text.trim()); }
        if (is_active !== undefined) { sets.push('is_active = ?'); vals.push(is_active ? 1 : 0); }
        if (sets.length === 0) return res.json({ ok: true });
        vals.push(id);
        await database_1.default.execute(`UPDATE survey_questions SET ${sets.join(', ')} WHERE id = ?`, vals);
        res.json({ ok: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
}

async function deleteQuestion(req, res) {
    const { id } = req.params;
    try {
        await database_1.default.execute('DELETE FROM survey_questions WHERE id = ?', [id]);
        res.json({ ok: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
}

async function reorderQuestions(req, res) {
    // ids: array of ids in new order
    const { ids } = req.body;
    if (!Array.isArray(ids)) return res.status(400).json({ error: 'ids array required' });
    try {
        for (let i = 0; i < ids.length; i++) {
            await database_1.default.execute('UPDATE survey_questions SET sort_order = ? WHERE id = ?', [i, ids[i]]);
        }
        res.json({ ok: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
}
```

### Step 5: Register routes

In `server/dist/routes/field.js`, add public GET before the `router.use(auth...)` line:

```js
const surveyQuestionsController_1 = require("../controllers/surveyQuestionsController");
// add before router.use(authenticateAdmin...):
router.get('/survey-questions', surveyQuestionsController_1.listQuestions);
```

In `server/dist/routes/admin.js`, after the survey-schema routes, add:

```js
const surveyQuestionsController_1 = require("../controllers/surveyQuestionsController");
// Survey Q&A questions management
router.get('/survey-questions', surveyQuestionsController_1.listQuestions);
router.post('/survey-questions', surveyQuestionsController_1.createQuestion);
router.patch('/survey-questions/:id', surveyQuestionsController_1.updateQuestion);
router.delete('/survey-questions/:id', surveyQuestionsController_1.deleteQuestion);
router.post('/survey-questions/reorder', surveyQuestionsController_1.reorderQuestions);
```

### Step 6: Verify

Run locally, check that `GET /api/field/survey-questions` returns `{ questions: [] }`.

### Step 7: Commit

```bash
git add server/dist/controllers/fieldInterviewController.js \
        server/dist/controllers/surveyQuestionsController.js \
        server/dist/routes/field.js \
        server/dist/routes/admin.js
git commit -m "feat(field): add qa_answers/location_pin columns, survey_questions CRUD, field_key on photos"
```

---

## Task 2: Frontend — Install Google Maps loader package

**Files:**
- `package.json` (check if `@googlemaps/js-api-loader` exists; if not, install)

### Step 1: Check and install

```bash
grep -r "@googlemaps" package.json || npm install @googlemaps/js-api-loader
```

### Step 2: Commit if package changed

```bash
git add package.json package-lock.json
git commit -m "feat: add @googlemaps/js-api-loader"
```

---

## Task 3: Frontend — `MapPinModal` component

**Files:**
- Create: `src/components/field/MapPinModal.tsx`

This is a full-screen modal that:
1. Shows a Google Maps embedded map
2. Has a Places Autocomplete input at the top
3. Places a draggable marker on the map
4. Has a "Confirm" button that captures `{ address, lat, lng }`

```tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import { X, MapPin } from 'lucide-react';
import { Loader } from '@googlemaps/js-api-loader';

export interface PinResult {
  address: string;
  lat: number;
  lng: number;
}

interface MapPinModalProps {
  initialAddress?: string;
  onConfirm: (result: PinResult) => void;
  onClose: () => void;
}

export default function MapPinModal({ initialAddress = '', onConfirm, onClose }: MapPinModalProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const markerRef = useRef<google.maps.marker.AdvancedMarkerElement | null>(null);
  const [address, setAddress] = useState(initialAddress);
  const [pinResult, setPinResult] = useState<PinResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY!;
    const loader = new Loader({
      apiKey,
      version: 'weekly',
      libraries: ['places', 'marker'],
    });

    loader.load().then(async () => {
      if (!mapRef.current) return;
      const { Map } = await google.maps.importLibrary('maps') as google.maps.MapsLibrary;
      const { AdvancedMarkerElement } = await google.maps.importLibrary('marker') as google.maps.MarkerLibrary;
      const { Autocomplete } = await google.maps.importLibrary('places') as google.maps.PlacesLibrary;

      // Default center: Dubai
      const defaultCenter = { lat: 25.2048, lng: 55.2708 };
      const map = new Map(mapRef.current, {
        center: defaultCenter,
        zoom: 12,
        mapId: 'tarmeer-field-survey',
        disableDefaultUI: false,
        zoomControl: true,
        streetViewControl: false,
        mapTypeControl: false,
      });
      mapInstanceRef.current = map;

      // Draggable marker
      const marker = new AdvancedMarkerElement({
        map,
        position: defaultCenter,
        gmpDraggable: true,
      });
      markerRef.current = marker;

      // Update pinResult when marker is dragged
      marker.addListener('dragend', () => {
        const pos = marker.position as google.maps.LatLng;
        if (pos) {
          setPinResult(prev => ({ address: prev?.address ?? '', lat: pos.lat(), lng: pos.lng() }));
        }
      });

      // Places Autocomplete
      if (inputRef.current) {
        const autocomplete = new Autocomplete(inputRef.current, {
          fields: ['formatted_address', 'geometry'],
        });
        autocomplete.addListener('place_changed', () => {
          const place = autocomplete.getPlace();
          if (!place.geometry?.location) return;
          const lat = place.geometry.location.lat();
          const lng = place.geometry.location.lng();
          const addr = place.formatted_address ?? inputRef.current?.value ?? '';
          setAddress(addr);
          map.panTo({ lat, lng });
          map.setZoom(17);
          marker.position = { lat, lng };
          setPinResult({ address: addr, lat, lng });
        });
      }

      setLoading(false);

      // If there's an initial address, geocode it
      if (initialAddress) {
        const { Geocoder } = await google.maps.importLibrary('geocoding') as google.maps.GeocodingLibrary;
        const geocoder = new Geocoder();
        geocoder.geocode({ address: initialAddress }, (results, status) => {
          if (status === 'OK' && results?.[0]?.geometry?.location) {
            const loc = results[0].geometry.location;
            map.panTo(loc);
            map.setZoom(17);
            marker.position = loc;
            setPinResult({ address: initialAddress, lat: loc.lat(), lng: loc.lng() });
          }
        });
      }
    }).catch((err) => {
      setError('Failed to load Google Maps: ' + err.message);
      setLoading(false);
    });
  }, [initialAddress]);

  function handleConfirm() {
    if (pinResult) {
      // If user typed address but didn't pick from autocomplete, use typed value
      const finalAddress = address || pinResult.address;
      onConfirm({ ...pinResult, address: finalAddress });
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col" style={{ touchAction: 'none' }}>
      {/* Header */}
      <div className="bg-white px-4 py-3 flex items-center gap-3 shadow-sm">
        <button onClick={onClose} className="w-9 h-9 rounded-full bg-stone-100 flex items-center justify-center shrink-0">
          <X className="w-4 h-4 text-stone-500" />
        </button>
        <input
          ref={inputRef}
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="Search address…"
          className="flex-1 h-10 px-4 rounded-xl border border-stone-200 bg-stone-50 text-[15px] text-[#1c1917] placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-[#b8864a]/20 focus:border-[#b8864a]"
        />
      </div>

      {/* Map */}
      <div className="flex-1 relative">
        <div ref={mapRef} className="w-full h-full" />
        {loading && (
          <div className="absolute inset-0 bg-white flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-[#b8864a]/30 border-t-[#b8864a] rounded-full animate-spin" />
          </div>
        )}
        {error && (
          <div className="absolute inset-0 bg-white flex items-center justify-center px-8">
            <p className="text-red-500 text-sm text-center">{error}</p>
          </div>
        )}
        {!loading && !error && (
          <p className="absolute bottom-20 left-0 right-0 text-center text-xs text-white/80 pointer-events-none"
             style={{ textShadow: '0 1px 4px rgba(0,0,0,0.8)' }}>
            Drag the pin to adjust location
          </p>
        )}
      </div>

      {/* Confirm button */}
      <div className="bg-white px-4 py-4 safe-area-bottom">
        <button
          onClick={handleConfirm}
          disabled={!pinResult}
          className="w-full h-12 rounded-2xl bg-[#b8864a] text-white font-semibold text-[15px] flex items-center justify-center gap-2 disabled:opacity-40 active:opacity-80 transition"
        >
          <MapPin className="w-4 h-4" />
          {pinResult ? `Confirm Pin` : 'Place a pin first'}
        </button>
        {pinResult && (
          <p className="text-center text-xs text-stone-400 mt-2">
            {pinResult.lat.toFixed(5)}, {pinResult.lng.toFixed(5)}
          </p>
        )}
      </div>
    </div>
  );
}
```

### Step: Commit

```bash
git add src/components/field/MapPinModal.tsx
git commit -m "feat(field): add MapPinModal with Google Maps Places Autocomplete + draggable pin"
```

---

## Task 4: Frontend — survey page per-question photos + Q&A + Map pin

This is the largest task. Modify `src/app/field/survey/page.tsx`.

### Step 1: Add `field_key` to `PhotoRecord` type

```tsx
interface PhotoRecord {
  _id?: string;
  dataUrl: string;
  url: string;
  uploading?: boolean;
  error?: string;
  lat?: number;
  lng?: number;
  timestamp: string;
  field_key?: string;  // <-- ADD THIS
}
```

### Step 2: Add new state variables

After `const [locDistrict, setLocDistrict] = useState('');`, add:

```tsx
const [activePhotoFieldKey, setActivePhotoFieldKey] = useState<string | null>(null);
const [lightboxIndex, setLightboxIndex] = useState<number | null>(null); // index in filtered photos for that field
const [lightboxFieldKey, setLightboxFieldKey] = useState<string | null>(null);
const [surveyQuestions, setSurveyQuestions] = useState<{ id: number; question_text: string }[]>([]);
const [qaAnswers, setQaAnswers] = useState<Record<number, string>>({});
const [locationPin, setLocationPin] = useState<{ address: string; lat: number; lng: number } | null>(null);
const [showMapPin, setShowMapPin] = useState(false);
```

### Step 3: Add import for MapPinModal

```tsx
import MapPinModal from '@/components/field/MapPinModal';
import { MapPin } from 'lucide-react';
```

### Step 4: Fetch survey questions on mount

In the `useEffect` (after `getSurveySchema`), add:

```tsx
try {
  const res = await fieldApi.request('/field/survey-questions') as { questions: { id: number; question_text: string }[] };
  setSurveyQuestions(res.questions || []);
} catch { /* no questions yet */ }
```

Note: `fieldApi` likely wraps `fetch('/api/...')`. Check `src/lib/adminApi.ts` and add `request` method or use the appropriate call.

### Step 5: Update `handlePhotoTaken` to accept `field_key`

Change signature and logic:

```tsx
async function handlePhotoTaken(captured: CapturedPhoto, fieldKey: string | null) {
  const photoId = Date.now().toString();
  const record: PhotoRecord = {
    dataUrl: captured.dataUrl,
    url: '',
    uploading: !!draftId,
    lat: captured.lat,
    lng: captured.lng,
    timestamp: captured.timestamp,
    field_key: fieldKey ?? undefined,
  };
  setPhotos(prev => [...prev, { ...record, _id: photoId }]);
  if (!draftId) return;
  try {
    const { url } = await fieldApi.uploadPhoto(draftId, captured.blob, {
      lat: captured.lat,
      lng: captured.lng,
      timestamp: captured.timestamp,
      field_key: fieldKey,
    });
    setPhotos(prev => prev.map(p => p._id === photoId ? { ...p, url, uploading: false } : p));
  } catch {
    setPhotos(prev => prev.map(p => p._id === photoId ? { ...p, uploading: false, error: 'Upload failed' } : p));
  }
}
```

### Step 6: Update `triggerSave` to include qa_answers and location_pin

Add `qaAns` and `locPin` parameters to `triggerSave`:

```tsx
const triggerSave = useCallback((
  id: number, cName: string, cRefId: number | null, cRefSource: string,
  secs: AllSections,
  loc?: { emirate: string; group: string; district: string },
  qaAns?: Record<number, string>,
  locPin?: { address: string; lat: number; lng: number } | null,
) => {
  if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
  saveTimerRef.current = setTimeout(async () => {
    setSaveStatus('saving');
    try {
      await fieldApi.saveDraft(id, {
        company_name: cName,
        company_ref_id: cRefId,
        company_ref_source: cRefSource,
        ...Object.fromEntries(Object.entries(secs).map(([k, v]) => [k, v])),
        ...(loc !== undefined ? { section_9: loc } : {}),
        ...(qaAns !== undefined ? { qa_answers: Object.entries(qaAns).map(([qid, answer]) => ({ question_id: Number(qid), answer })) } : {}),
        ...(locPin !== undefined ? { location_pin: locPin } : {}),
      });
      setSaveStatus('saved');
    } catch {
      setSaveStatus('idle');
    }
  }, 500);
}, []);
```

Update all `triggerSave` call sites to pass `qaAnswers` and `locationPin` as well.

### Step 7: Update `hydrateDraft` and `loadExistingInterview`

In `hydrateDraft`, after the photos block, add:

```tsx
if (draft.qa_answers) {
  const raw = typeof draft.qa_answers === 'string' ? JSON.parse(draft.qa_answers) : draft.qa_answers;
  if (Array.isArray(raw)) {
    const map: Record<number, string> = {};
    raw.forEach((item: { question_id: number; answer: string }) => { map[item.question_id] = item.answer; });
    setQaAnswers(map);
  }
}
if (draft.location_pin) {
  const raw = typeof draft.location_pin === 'string' ? JSON.parse(draft.location_pin) : draft.location_pin;
  if (raw?.lat && raw?.lng) setLocationPin(raw);
}
```

Apply the same restore logic in `loadExistingInterview`.

### Step 8: Remove global Photos section and bottom Camera button

- Delete lines 496-531 (the `<div>` wrapping the global Photos section).
- Delete lines 637-644 (the Camera button in the bottom toolbar).
- Update `p.text-xs.text-stone-400` hint text if any reference to the camera button remains.

### Step 9: Add camera icon to each schema field

In the field rendering loop (around line 617), change the field label row:

```tsx
<div key={field.key}>
  <div className="flex items-center justify-between mb-2">
    <label className="text-sm font-medium text-stone-500">{field.label}</label>
    <button
      type="button"
      onClick={() => {
        setActivePhotoFieldKey(`${section.key}.${field.key}`);
        setShowCamera(true);
      }}
      className="flex items-center gap-1 text-xs text-stone-400 hover:text-[#b8864a] transition-colors"
    >
      <Camera className="w-3.5 h-3.5" />
      <span>{photos.filter(p => p.field_key === `${section.key}.${field.key}`).length > 0
        ? `${photos.filter(p => p.field_key === `${section.key}.${field.key}`).length} photo(s)`
        : 'Photo'
      }</span>
    </button>
  </div>
  <ChipSelect ... />
  {/* Photo thumbnails for this field */}
  {(() => {
    const fieldKey = `${section.key}.${field.key}`;
    const fieldPhotos = photos.filter(p => p.field_key === fieldKey);
    if (fieldPhotos.length === 0) return null;
    return (
      <div className="grid grid-cols-4 gap-1.5 mt-2">
        {fieldPhotos.map((photo, idx) => (
          <div key={photo._id || idx} className="relative aspect-square rounded-lg overflow-hidden border border-stone-200 bg-stone-100">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photo.dataUrl || photo.url}
              alt={`Photo ${idx + 1}`}
              className="w-full h-full object-cover cursor-pointer"
              onClick={() => {
                setLightboxPhoto(photo);
                setLightboxIndex(idx);
                setLightboxFieldKey(fieldKey);
              }}
            />
            {photo.uploading && (
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                <div className="w-3 h-3 border border-white/40 border-t-white rounded-full animate-spin" />
              </div>
            )}
          </div>
        ))}
      </div>
    );
  })()}
</div>
```

### Step 10: Update WatermarkCamera `onPhotoTaken` call

In the JSX, find the `<WatermarkCamera>` usage:

```tsx
{showCamera && (
  <WatermarkCamera
    onClose={() => { setShowCamera(false); setActivePhotoFieldKey(null); }}
    onPhotoTaken={(photo) => handlePhotoTaken(photo, activePhotoFieldKey)}
  />
)}
```

### Step 11: Update Lightbox to show delete button bottom-right

Replace the current lightbox JSX block:

```tsx
{lightboxPhoto && (
  <div
    className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center"
    onClick={() => setLightboxPhoto(null)}
  >
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img
      src={lightboxPhoto.dataUrl || lightboxPhoto.url}
      alt="Photo preview"
      className="max-w-full max-h-full object-contain"
      onClick={(e) => e.stopPropagation()}
    />
    {/* Close top-right */}
    <button
      onClick={() => setLightboxPhoto(null)}
      className="absolute top-4 right-4 w-10 h-10 rounded-full bg-black/50 flex items-center justify-center"
    >
      <X className="w-5 h-5 text-white" />
    </button>
    {/* Delete bottom-right (iPhone Photos style) */}
    <button
      onClick={(e) => {
        e.stopPropagation();
        if (lightboxPhoto._id) {
          setPhotos(prev => prev.filter(p => p._id !== lightboxPhoto._id));
        } else {
          // fallback: remove by matching url
          setPhotos(prev => prev.filter(p => p !== lightboxPhoto));
        }
        setLightboxPhoto(null);
      }}
      className="absolute bottom-8 right-6 w-12 h-12 rounded-full bg-black/50 flex items-center justify-center"
    >
      <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
      </svg>
    </button>
  </div>
)}
```

### Step 12: Add Q&A section (after schema sections, before fixed toolbar)

Before the closing `</div>` of the main scroll area (around line 635), add:

```tsx
{surveyQuestions.length > 0 && (
  <div>
    <h2 className="text-base font-bold text-[#2c2c2c] mb-4 pl-3 border-l-4 border-[#b8864a]">
      Q&A
    </h2>
    <div className="space-y-5">
      {surveyQuestions.map((q) => (
        <div key={q.id}>
          <label className="block text-sm font-medium text-stone-600 mb-2">{q.question_text}</label>
          <textarea
            value={qaAnswers[q.id] ?? ''}
            onChange={(e) => {
              const newAns = { ...qaAnswers, [q.id]: e.target.value };
              setQaAnswers(newAns);
              if (draftId) triggerSave(draftId, companyName, companyRefId, companyRefSource, sections,
                { emirate: locEmirate, group: locGroup, district: locDistrict }, newAns, locationPin);
            }}
            placeholder="Enter answer…"
            rows={3}
            className="w-full px-4 py-3 rounded-xl border border-stone-200 bg-white text-[14px] text-[#1c1917] placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-[#b8864a]/15 focus:border-[#b8864a] resize-none"
          />
        </div>
      ))}
    </div>
  </div>
)}
```

### Step 13: Add Location Pin section inside Project Location

Inside the Project Location section (after the district level-3 selector), add:

```tsx
<div>
  <label className="block text-sm font-medium text-stone-500 mb-2">Company Address Pin</label>
  {locationPin ? (
    <div className="flex items-center gap-3 p-3 rounded-xl bg-green-50 border border-green-200">
      <MapPin className="w-4 h-4 text-green-600 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm text-green-800 font-medium truncate">{locationPin.address || 'Pinned'}</p>
        <p className="text-xs text-green-600">{locationPin.lat.toFixed(5)}, {locationPin.lng.toFixed(5)}</p>
      </div>
      <button
        type="button"
        onClick={() => setShowMapPin(true)}
        className="text-xs text-green-600 hover:text-green-800 font-medium shrink-0"
      >
        Edit
      </button>
    </div>
  ) : (
    <button
      type="button"
      onClick={() => setShowMapPin(true)}
      className="w-full h-12 rounded-xl border-2 border-dashed border-stone-200 flex items-center justify-center gap-2 text-stone-400 hover:border-[#b8864a] hover:text-[#b8864a] transition-colors"
    >
      <MapPin className="w-4 h-4" />
      <span className="text-sm">Pin on Google Maps</span>
    </button>
  )}
</div>
```

### Step 14: Add MapPinModal to the JSX

Near the WatermarkCamera overlay:

```tsx
{showMapPin && (
  <MapPinModal
    initialAddress={locationPin?.address ?? companyRefName}
    onClose={() => setShowMapPin(false)}
    onConfirm={(result) => {
      setLocationPin(result);
      setShowMapPin(false);
      if (draftId) triggerSave(draftId, companyName, companyRefId, companyRefSource, sections,
        { emirate: locEmirate, group: locGroup, district: locDistrict }, qaAnswers, result);
    }}
  />
)}
```

### Step 15: Update handleSubmit for new fields

In `handleSubmit`, before calling `fieldApi.submit(draftId)`, ensure a final save with all fields:

```tsx
// Final save to ensure qa_answers and location_pin are persisted
await fieldApi.saveDraft(draftId, {
  company_name: companyName,
  company_ref_id: companyRefId,
  company_ref_source: companyRefSource,
  ...sections,
  section_9: { emirate: locEmirate, group: locGroup, district: locDistrict },
  qa_answers: Object.entries(qaAnswers).map(([qid, answer]) => ({ question_id: Number(qid), answer })),
  location_pin: locationPin,
});
```

### Step 16: Check `fieldApi` for `request` method or add it

Open `src/lib/adminApi.ts`, find the `fieldApi` object. If it doesn't have a generic `request` method, add one, or use a direct fetch:

```tsx
// In the survey page mount effect, use direct fetch:
const res = await fetch('/api/field/survey-questions');
if (res.ok) {
  const data = await res.json();
  setSurveyQuestions(data.questions || []);
}
```

### Step 17: Commit

```bash
git add src/app/field/survey/page.tsx src/components/field/MapPinModal.tsx
git commit -m "feat(field): per-question photos, Q&A section, Google Maps address pin"
```

---

## Task 5: Frontend — Q&A section at bottom of admin survey-questions page

**Files:**
- Modify: `src/app/admin/survey-questions/page.tsx`

No tabs needed. Just append a Q&A section below the existing schema editor.

### Step 1: Add Q&A state

At the top of `SurveyQuestionsPage`, add:

```tsx
const [qaQuestions, setQaQuestions] = useState<{ id: number; question_text: string; is_active: number }[]>([]);
const [qaLoading, setQaLoading] = useState(false);
const [newQaText, setNewQaText] = useState('');
```

### Step 2: Load Q&A questions on mount

Add a `loadQaQuestions` call inside `useEffect`:

```tsx
const loadQaQuestions = useCallback(async () => {
  setQaLoading(true);
  try {
    const data = await adminApi.request('/survey-questions?active=false');
    setQaQuestions(data.questions || []);
  } catch {
    showToast('加载 Q&A 问题失败', 'error');
  } finally {
    setQaLoading(false);
  }
}, []);

useEffect(() => { load(); loadQaQuestions(); }, [load, loadQaQuestions]);
```

### Step 3: Add CRUD handlers

```tsx
async function handleAddQa() {
  const text = newQaText.trim();
  if (!text) return;
  try {
    const q = await adminApi.request('/survey-questions', {
      method: 'POST',
      body: JSON.stringify({ question_text: text }),
    });
    setQaQuestions(prev => [...prev, q]);
    setNewQaText('');
    showToast('已添加', 'success');
  } catch {
    showToast('添加失败', 'error');
  }
}

async function handleToggleQa(id: number, active: boolean) {
  try {
    await adminApi.request(`/survey-questions/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ is_active: active }),
    });
    setQaQuestions(prev => prev.map(q => q.id === id ? { ...q, is_active: active ? 1 : 0 } : q));
  } catch {
    showToast('操作失败', 'error');
  }
}

async function handleDeleteQa(id: number) {
  const ok = await showConfirm({
    title: '删除问题',
    message: '删除后该问题不再出现在问卷中，已填写的历史答案仍保留。',
    confirmLabel: '确认删除',
  });
  if (!ok) return;
  try {
    await adminApi.request(`/survey-questions/${id}`, { method: 'DELETE' });
    setQaQuestions(prev => prev.filter(q => q.id !== id));
    showToast('已删除', 'success');
  } catch {
    showToast('删除失败', 'error');
  }
}
```

### Step 4: Add Q&A section to the JSX

After the closing `</div>` of the main schema editor flex container (the `flex gap-4 items-start` div), append:

```tsx
{/* Q&A 模块 */}
<div className="mt-10 pt-8 border-t border-stone-100">
  <div className="flex items-center justify-between mb-1">
    <h2 className="text-lg font-bold text-[#2c2c2c]">Q&A 模块</h2>
  </div>
  <p className="text-sm text-stone-500 mb-5">这里的问题会显示在外勤 App 问卷底部，由 field staff 手动填写回答。</p>

  <div className="flex gap-2 mb-4 max-w-2xl">
    <input
      value={newQaText}
      onChange={(e) => setNewQaText(e.target.value)}
      onKeyDown={(e) => e.key === 'Enter' && handleAddQa()}
      placeholder="输入问题文字…"
      className={`${inputCls} flex-1`}
    />
    <button
      onClick={handleAddQa}
      disabled={!newQaText.trim()}
      className="btn-primary h-[34px] px-4 text-sm disabled:opacity-40"
    >添加</button>
  </div>

  {qaLoading ? (
    <div className="text-center text-stone-400 py-6 text-sm">加载中…</div>
  ) : qaQuestions.length === 0 ? (
    <div className="bg-white rounded-2xl border border-stone-200 px-4 py-8 text-center text-sm text-stone-400 max-w-2xl">
      暂无 Q&A 问题
    </div>
  ) : (
    <div className="space-y-2 max-w-2xl">
      {qaQuestions.map((q) => (
        <div key={q.id} className={`flex items-center gap-3 px-4 py-3 rounded-xl border bg-white ${q.is_active ? 'border-stone-200' : 'border-stone-100 opacity-50'}`}>
          <p className="flex-1 text-sm text-[#1c1917]">{q.question_text}</p>
          <button
            onClick={() => handleToggleQa(q.id, !q.is_active)}
            className={`text-xs font-medium px-2.5 py-1 rounded-full transition-colors ${q.is_active ? 'bg-green-50 text-green-600 hover:bg-green-100' : 'bg-stone-100 text-stone-500 hover:bg-stone-200'}`}
          >
            {q.is_active ? '启用' : '禁用'}
          </button>
          <button
            onClick={() => handleDeleteQa(q.id)}
            className="text-xs text-red-400 hover:text-red-600 transition-colors"
          >删除</button>
        </div>
      ))}
    </div>
  )}
</div>
```

### Step 5: Commit

```bash
git add src/app/admin/survey-questions/page.tsx
git commit -m "feat(admin): add Q&A questions section to survey-questions page"
```

---

## Task 6: Deploy

### Step 1: Rsync backend files to production

```bash
rsync -avz server/dist/controllers/fieldInterviewController.js \
  -e "ssh -i ~/.ssh/tarmeer_ecs" \
  root@47.91.108.104:/tarmeer/tarmeer_api/dist/controllers/fieldInterviewController.js

rsync -avz server/dist/controllers/surveyQuestionsController.js \
  -e "ssh -i ~/.ssh/tarmeer_ecs" \
  root@47.91.108.104:/tarmeer/tarmeer_api/dist/controllers/surveyQuestionsController.js

rsync -avz server/dist/routes/field.js \
  -e "ssh -i ~/.ssh/tarmeer_ecs" \
  root@47.91.108.104:/tarmeer/tarmeer_api/dist/routes/field.js

rsync -avz server/dist/routes/admin.js \
  -e "ssh -i ~/.ssh/tarmeer_ecs" \
  root@47.91.108.104:/tarmeer/tarmeer_api/dist/routes/admin.js

ssh -i ~/.ssh/tarmeer_ecs root@47.91.108.104 "pm2 restart tarmeer-api"
```

### Step 2: Deploy frontend

```bash
git push origin main
# Then SSH to server:
ssh -i ~/.ssh/tarmeer_ecs root@47.91.108.104 "cd /tarmeer/tarmeer_web_next && git pull && node_modules/.bin/next build && pm2 restart tarmeer-next"
```

### Step 3: Also add NEXT_PUBLIC_GOOGLE_MAPS_KEY to server .env.production

The key is already in `.env.production` locally — verify it gets picked up at build time. Next.js bakes `NEXT_PUBLIC_*` vars at build time, so the production build needs the env var set on the server before running `next build`.

On the server, add to `/tarmeer/tarmeer_web_next/.env.production`:

```
NEXT_PUBLIC_GOOGLE_MAPS_KEY=AIzaSyDEF2LDXE56AsZP5YibJ_wg4-fQ_jaHgUs
```

Then re-run `next build`.

### Step 4: Verify

- Visit `https://www.tarmeer.com/field/survey` — confirm per-question camera icons appear
- Visit `https://www.tarmeer.com/admin/survey-questions` — confirm Q&A tab appears
- Add a Q&A question from admin → appears in field survey
- Take a question photo → thumbnail appears below that question
- Tap thumbnail → full-screen view with delete button bottom-right
- Tap "Pin on Google Maps" → map modal opens, address search works, pin draggable

---

## Checklist

- [ ] Task 1: Backend DB migration + survey_questions CRUD
- [ ] Task 2: Install @googlemaps/js-api-loader
- [ ] Task 3: MapPinModal component
- [ ] Task 4: Survey page changes (photos, Q&A, map pin)
- [ ] Task 5: Admin Q&A tab
- [ ] Task 6: Deploy
