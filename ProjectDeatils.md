# Build Spec: Recall — Weighted-Practice Quiz App

This document is the implementation spec for a coding agent. Build in the phase order given in Section 10. Each phase has explicit acceptance criteria — do not move to the next phase until the current one's criteria are met. Ask the user only if something here is genuinely ambiguous; otherwise follow this spec exactly.

---

## 0. Project Summary

A personal, phone-browser, installable PWA for practicing multiple-choice questions across topics (decks). Questions that are answered wrong resurface more often than questions answered correctly, via a per-question `weight` field driving weighted-random selection. Single user, no public signup. Data stored in MongoDB Atlas, accessed through a small Express API, consumed by a React/Vite frontend.

**Monorepo with two apps:**
```
recall-app/
├── backend/     Node.js + Express + Mongoose
├── frontend/    React + Vite + Tailwind CSS
└── README.md
```

---

## 1. Tech Stack & Exact Dependencies

### Backend (`backend/`)
- Node.js 20+
- `express`
- `mongoose`
- `dotenv`
- `cors`
- `jsonwebtoken`
- `bcryptjs` (hash the single passcode at rest, don't store it plain)
- `nanoid` (or built-in `crypto`) for hash/id generation
- dev: `nodemon`

### Frontend (`frontend/`)
- React 18 + Vite
- `tailwindcss` (+ `postcss`, `autoprefixer`)
- `react-router-dom`
- `recharts` (Stats charts)
- `lucide-react` (icons)
- `vite-plugin-pwa` (installable PWA + offline shell caching)
- No global state library needed — React context + hooks is enough at this scope

---

## 2. Environment Variables

### `backend/.env`
```
PORT=4000
MONGODB_URI=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/recall
JWT_SECRET=<long-random-string>
APP_PASSCODE=<the-one-passcode-the-user-logs-in-with>
CORS_ORIGIN=http://localhost:5173
```
`APP_PASSCODE` is compared with bcrypt against a hash generated once at setup (see Section 4.1). Never log or return it.

### `frontend/.env`
```
VITE_API_URL=http://localhost:4000
```

Provide a `.env.example` for both with placeholder values, and gitignore the real `.env` files.

---

## 3. Database Schemas (Mongoose)

Create these as separate files under `backend/src/models/`.

### 3.1 `Deck.js`
```js
const deckSchema = new Schema({
  name: { type: String, required: true, trim: true },
  slug: { type: String, required: true, unique: true, lowercase: true },
  color: { type: String, required: true }, // hex, assigned from a rotating palette on create
  tags: { type: [String], default: [] },   // denormalized rollup of all tags in this deck's questions
  questionCount: { type: Number, default: 0 },
}, { timestamps: true });
```

### 3.2 `Question.js`
```js
const statsSchema = new Schema({
  weight: { type: Number, default: 1, min: 1, max: 20 },
  timesShown: { type: Number, default: 0 },
  timesCorrect: { type: Number, default: 0 },
  timesWrong: { type: Number, default: 0 },
  consecutiveCorrect: { type: Number, default: 0 },
  consecutiveWrong: { type: Number, default: 0 },
  isLeech: { type: Boolean, default: false },
  knewItCount: { type: Number, default: 0 },
  guessedCount: { type: Number, default: 0 },
  lastShownAt: { type: Date, default: null },
}, { _id: false });

const questionSchema = new Schema({
  deckId: { type: Schema.Types.ObjectId, ref: 'Deck', required: true, index: true },
  contentHash: { type: String, required: true },
  question: { type: String, required: true },
  options: {
    type: [String],
    required: true,
    validate: v => v.length >= 2,
  },
  answer: { type: Number, required: true }, // index into options
  description: { type: String, default: '' },
  difficulty: { type: String, enum: ['easy', 'medium', 'hard'], default: 'medium' },
  tags: { type: [String], default: [] },
  stats: { type: statsSchema, default: () => ({}) },
}, { timestamps: true });

questionSchema.index({ deckId: 1, contentHash: 1 }, { unique: true });
questionSchema.index({ deckId: 1, 'stats.weight': -1 });
questionSchema.index({ deckId: 1, tags: 1 });
questionSchema.index({ 'stats.isLeech': 1 });
```

**`contentHash` generation** (in `backend/src/services/hash.js`): normalize `question.trim().toLowerCase()`, run through a stable hash (e.g. Node's `crypto.createHash('sha1')`), take first 16 hex chars. This is the de-dup key for import diffing — it must be computed identically every time the same question text is imported.

### 3.3 `DailyLog.js`
```js
const dailyLogSchema = new Schema({
  date: { type: String, required: true, unique: true }, // 'YYYY-MM-DD'
  questionsShown: { type: Number, default: 0 },
  questionsCorrect: { type: Number, default: 0 },
  deckBreakdown: { type: Schema.Types.Mixed, default: {} }, // { [deckSlug]: { shown, correct } }
});
```

### 3.4 Validation on write
Reject (400) any `Question` write where `answer` is not a valid index into `options`, or `options.length < 2`. Return a clear error message naming the offending field.

---

## 4. Backend API Contract

Base URL: `VITE_API_URL` (e.g. `http://localhost:4000`). All routes except `/auth/login` require header `Authorization: Bearer <jwt>`. On missing/invalid token, respond `401 { error: "Unauthorized" }`.

### 4.1 `POST /auth/login`
Request:
```json
{ "passcode": "string" }
```
Behavior: compare against `bcrypt.compare(passcode, hash-of-APP_PASSCODE)`. On match, sign a JWT (`{ sub: "owner" }`, expiry e.g. 30 days) with `JWT_SECRET`.
Response `200`:
```json
{ "token": "eyJ..." }
```
Response `401`:
```json
{ "error": "Invalid passcode" }
```

### 4.2 `GET /decks`
Response `200`:
```json
[
  { "id": "...", "name": "SQL", "slug": "sql", "color": "#f5a623", "tags": ["joins","aggregation"], "questionCount": 214 }
]
```

### 4.3 `POST /decks`
Request:
```json
{ "name": "React" }
```
Behavior: slugify `name`, reject if slug already exists (`409`), assign next color from a fixed rotating palette array (`['#f5a623','#5b8dd6','#4caf82','#e0524a','#a679d2','#3fb8c9']`, cycling by current deck count).
Response `201`: the created deck object (same shape as 4.2 entries).

### 4.4 `DELETE /decks/:id`
Deletes the deck and all its questions (cascade). Response `204`.

### 4.5 `POST /decks/:id/reset-stats`
Resets `stats` to schema defaults for every question in the deck. Response `200 { "resetCount": 214 }`.

### 4.6 `POST /decks/:id/import/preview`
Request:
```json
{
  "questions": [
    { "question": "...", "options": ["...","..."], "answer": 0, "description": "...", "difficulty": "medium", "tags": ["..."] }
  ]
}
```
Behavior:
1. Validate every entry against the rules in Section 6 below. Invalid entries go into `errors` with their original array index and a message; they are excluded from further processing.
2. For each valid entry, compute `contentHash` and compare against existing questions in this deck:
   - Not found by hash → `new`
   - Found, but `{question, options, answer, description, difficulty, tags}` differs from stored → `changed`
   - Found, identical → `unchanged`
3. Do **not** write anything to the database in this step. Store the validated+classified payload in a short-lived server-side cache (in-memory Map keyed by a generated `previewId`, TTL ~10 minutes) so `/import/confirm` doesn't require re-sending the whole payload.

Response `200`:
```json
{
  "previewId": "uuid",
  "summary": { "new": 12, "changed": 3, "unchanged": 40, "errors": 1 },
  "errors": [ { "index": 7, "message": "options must have at least 2 entries" } ]
}
```

### 4.7 `POST /decks/:id/import/confirm`
Request:
```json
{ "previewId": "uuid" }
```
Behavior: look up the cached preview payload, upsert `new` and `changed` questions (changed questions update content fields only — never touch `stats`), skip `unchanged`. Update `Deck.tags` (union of all tags now present) and `Deck.questionCount`. Invalidate the cache entry.
Response `200`:
```json
{ "imported": 12, "updated": 3, "skipped": 40 }
```
If `previewId` is missing/expired: `410 { "error": "Preview expired, re-run import" }`.

### 4.8 `GET /decks/:id/questions`
Query params: `tags` (comma-separated, optional), `mode` (`all|new|focused`, optional, default `all`).
Behavior: `focused` filters to `stats.weight >= 4 OR stats.isLeech == true`. `new` filters to `stats.timesShown == 0`. Returns the **full matching question pool** (frontend does weighted picking client-side — see Section 7).
Response `200`: array of full question objects (including `stats`).

### 4.9 `POST /questions/:id/answer`
Request:
```json
{ "selectedOption": 1, "confidence": "knew_it" }
```
`confidence` is one of `"knew_it" | "guessed" | null`. It is only meaningful/required when the answer was correct; send `null` when incorrect.

Behavior: apply the weight-update algorithm from Section 7.2, persist updated `stats` on the question, and `$inc` today's `DailyLog` (`questionsShown`, `questionsCorrect` if correct, and the matching `deckBreakdown[slug]` counters — upsert the daily log doc if it doesn't exist yet for today).

Response `200`:
```json
{
  "correct": true,
  "correctOption": 1,
  "description": "...",
  "isLeech": false,
  "newWeight": 1
}
```

### 4.10 `GET /stats/overview`
Response `200`:
```json
{
  "totalQuestions": 812,
  "totalDecks": 5,
  "overallAccuracy": 0.71,
  "weakestTags": [ { "tag": "subqueries", "accuracy": 0.42, "attempts": 19 } ],
  "leeches": [ { "id": "...", "deckSlug": "sql", "question": "...", "consecutiveWrong": 5 } ]
}
```
`weakestTags`: aggregate across all questions, sorted ascending by accuracy, top 5, minimum 3 attempts to qualify (avoid noisy single-attempt tags).

### 4.11 `GET /stats/trend?days=14`
Response `200`:
```json
[
  { "date": "2026-08-02", "shown": 18, "correct": 13, "accuracy": 0.72 }
]
```
Sorted ascending by date. Missing days (no activity) should still appear with zeros — fill gaps, don't just return sparse data, so the chart x-axis is continuous.

### 4.12 `GET /export`
Response `200`: full backup —
```json
{
  "exportedAt": "2026-08-15T10:00:00Z",
  "decks": [ /* full deck objects */ ],
  "questions": [ /* full question objects incl. stats */ ],
  "dailyLogs": [ /* all DailyLog docs */ ]
}
```
Frontend triggers a file download of this JSON (see Section 8.6).

### 4.13 `POST /import-backup`
Request: the same shape as `/export`'s response.
Behavior: wipe and replace all three collections in a transaction (or best-effort sequential if not using a replica set with transactions). This is a full restore, not a merge — state that clearly in the frontend confirmation dialog before calling it.
Response `200 { "restored": true, "questionCount": 812 }`.

---

## 5. Weighted-Pick & Scoring Algorithm — Exact Spec

Put this in **both** `backend/src/services/weightedPick.js` (used nowhere server-side in v1 since picking is client-side, but keep it here for a future server-side mode) and `frontend/src/lib/weightedPick.js` (actually used). Keep the two implementations identical.

### 5.1 Weight update on answer (`applyAnswer(question, correct, confidence)`)
```js
function applyAnswer(stats, correct, confidence) {
  const next = { ...stats };
  next.timesShown += 1;
  next.lastShownAt = new Date();

  if (correct) {
    next.timesCorrect += 1;
    if (confidence === 'knew_it') {
      next.weight = Math.max(1, next.weight * 0.5);
      next.consecutiveCorrect += 1;
      next.consecutiveWrong = 0;
      next.knewItCount += 1;
      if (next.consecutiveCorrect >= 1) next.isLeech = false; // clear leech flag on a confident correct
    } else if (confidence === 'guessed') {
      // weight unchanged — correct but not "known"
      next.guessedCount += 1;
      // do not reset consecutiveWrong/consecutiveCorrect — treat as still-learning
    }
  } else {
    next.timesWrong += 1;
    next.weight = Math.min(20, next.weight * 2);
    next.consecutiveWrong += 1;
    next.consecutiveCorrect = 0;
    if (next.consecutiveWrong >= 4) next.isLeech = true;
  }
  return next;
}
```

### 5.2 Weighted random pick with cooldown (`pickNext(pool, recentIds)`)
```js
function pickNext(pool, recentIds = []) {
  if (pool.length === 0) return null;
  const candidates = pool.filter(q => !recentIds.includes(q.id));
  const usePool = candidates.length > 0 ? candidates : pool;
  const totalWeight = usePool.reduce((sum, q) => sum + q.stats.weight, 0);
  let r = Math.random() * totalWeight;
  for (const q of usePool) {
    r -= q.stats.weight;
    if (r <= 0) return q;
  }
  return usePool[usePool.length - 1]; // float rounding fallback
}
```
`recentIds`: maintain as a rolling array of the last 5 question ids shown in the current session (push new, shift oldest past 5). This prevents the same question from repeating back-to-back even under high weight.

### 5.3 Session mode → pool filter (client-side, before picking)
```js
function filterForMode(pool, mode) {
  switch (mode) {
    case 'new': return pool.filter(q => q.stats.timesShown === 0);
    case 'focused': return pool.filter(q => q.stats.weight >= 4 || q.stats.isLeech);
    case 'full_random':
    case 'quick10':
    case 'drill':
    default: return pool; // weighting still applies; 'full_random' should use uniform pick instead — see below
  }
}
```
For `full_random` mode specifically, use `pool[Math.floor(Math.random() * pool.length)]` (uniform, ignore weight) instead of `pickNext`. All other modes use the weighted `pickNext`.

**Session end conditions:**
- `quick10`: stop after 10 questions answered
- `drill`: 3-minute countdown from session start; stop when timer hits 0
- `new`: stop when the filtered pool has no more `timesShown === 0` questions left (recompute the filter after each answer, since timesShown just changed)
- `focused`, `full_random`: no automatic end; user taps "End session"

---

## 6. Import Validation Rules

Applied per-entry in `/decks/:id/import/preview`:

| Field | Rule | Error message if violated |
|---|---|---|
| `question` | required, non-empty string after trim | `"question is required"` |
| `options` | required array, length ≥ 2, all strings | `"options must be an array of at least 2 strings"` |
| `answer` | required integer, `0 <= answer < options.length` | `"answer must be a valid index into options"` |
| `description` | optional string, default `""` | — |
| `difficulty` | optional, one of `easy\|medium\|hard`, default `medium` | `"difficulty must be easy, medium, or hard"` |
| `tags` | optional array of strings, default `[]` | `"tags must be an array of strings"` |

An entry failing any rule is excluded from `new/changed/unchanged` counts and reported in `errors` with its original index in the submitted array (not the deck).

---

## 7. Frontend Pages & Component Spec

### 7.1 Routing (`react-router-dom`)
```
/login          → passcode entry, stores JWT in memory + localStorage (not window.storage — this is a real backend now)
/               → Home (deck list)
/add            → Add Questions
/practice       → session setup
/practice/run   → active session
/stats          → dashboard
/settings       → export/import/reset/delete
```
Wrap all routes except `/login` in an auth guard that redirects to `/login` if no valid token is present.

### 7.2 Home (`/`)
- Grid of deck cards: name, color accent bar, question count, a small "heat" indicator (average `stats.weight` across the deck, shown as a colored dot: cool blue → hot red)
- "+ New Deck" button opens a small inline form (name only; color auto-assigned by backend)
- Tapping a deck card navigates to `/practice` with that deck pre-selected

### 7.3 Add Questions (`/add`)
- Deck selector (dropdown of existing decks + "+ create new")
- Large textarea for pasting JSON (placeholder text shows the exact expected format from Section 6)
- "Validate & Preview" button → calls `/decks/:id/import/preview`, renders:
  - Counts: `N new · N changed · N unchanged · N errors`
  - Expandable list of errors with index + message
  - "Confirm Import" button (disabled if 0 new+changed) → calls `/decks/:id/import/confirm`, shows a success toast, clears the textarea

### 7.4 Practice Setup (`/practice`)
- Deck multi-select chips (default: whichever deck was clicked from Home, or "All" if navigated directly)
- Tag filter chips, computed from the union of `tags` on selected decks (only shown if selected decks have tags)
- Mode selector, presented as cards, one line of description each:
  - **Quick 10** — "Ten questions, weighted toward what you're missing"
  - **Focused Review** — "Only the ones you're still shaky on"
  - **New Only** — "Questions you haven't seen yet"
  - **Full Random** — "Everything, evenly, no weighting"
  - **Drill (3 min)** — "Race the clock, see how many you land"
- "Start" button: fetch pool via `GET /decks/:id/questions` for each selected deck (merge results client-side if multiple decks), apply mode filter, navigate to `/practice/run` with the pool + mode in route state or a context

### 7.5 Practice Run (`/practice/run`)
- Question card: question text, difficulty badge, deck name chip
- Options rendered as tappable buttons, **shuffled on each render** (shuffle order client-side only; remap which shuffled index maps to the true `answer` index — never persist shuffle order)
- On tap: lock in selection, call `POST /questions/:id/answer` with `selectedOption` and `confidence: null` initially if wrong, or defer the call until confidence is picked if correct (see below)
- Reveal state: highlight correct option in the "correct" color, selected-wrong option (if applicable) in the "wrong" color, show `description` text below
- If correct: show two buttons, "Knew it" / "Guessed" — selecting one fires `POST /questions/:id/answer` with that confidence value, *then* shows "Next question"
- If incorrect: fire the answer call immediately with `confidence: null`, show "Next question" directly (no confidence prompt — an incorrect answer is unambiguous)
- If `isLeech` comes back `true` in the response, show a small inline badge: "Reviewed wrong 4+ times in a row — flagged for extra review"
- Header shows running count (`7 / 10` for quick10, or a countdown timer for drill, or just a running tally for open-ended modes) and an "End session" button (hidden for quick10/drill, which end automatically)
- On session end: navigate to a summary view (can be a modal or a route param state) showing: score (`X / Y`), accuracy %, list of tags that came up wrong this session, and buttons "Practice again" (same setup) / "Back to decks"

### 7.6 Stats (`/stats`)
- Top row: total questions answered lifetime, overall accuracy, current streak (consecutive days with `questionsShown > 0` in DailyLog, computed client-side from the trend data)
- Recharts `LineChart`: accuracy over last 14 days (from `/stats/trend`)
- Recharts `BarChart`: weakest tags (from `/stats/overview.weakestTags`)
- "Needs re-learning" list: leeches from `/stats/overview.leeches`, each row tappable → navigates to `/practice` with that deck pre-selected and mode pre-set to `focused`

### 7.7 Settings (`/settings`)
- **Export**: button triggers `GET /export`, converts the JSON response to a `Blob`, creates an `<a download>` link, clicks it programmatically to trigger a file download named `recall-backup-YYYY-MM-DD.json`
- **Import backup**: textarea for pasting a full backup JSON, with a clear warning ("This replaces all current data — it does not merge") and a confirm step before calling `/import-backup`
- **Per-deck management**: list of decks, each with "Reset stats" (confirm modal) and "Delete deck" (confirm modal, red/destructive styling)
- **Log out**: clears the stored JWT, redirects to `/login`

---

## 8. Auth Flow (Frontend)

1. `/login`: single passcode input field, "Enter" button → `POST /auth/login`
2. On success: store `token` in `localStorage` under a namespaced key (e.g. `recall_token`), set it in a React context, redirect to `/`
3. All subsequent API calls attach `Authorization: Bearer <token>` via a shared `frontend/src/lib/api.js` fetch wrapper
4. On any `401` response, clear the stored token and redirect to `/login`

---

## 9. PWA Configuration

In `vite.config.js`, configure `vite-plugin-pwa`:
- `registerType: 'autoUpdate'`
- `manifest`: name "Recall", short_name "Recall", `display: 'standalone'`, theme/background colors matching the app's accent, icons (192x192 and 512x512 — generate simple placeholder icons if none are supplied)
- `workbox` runtime caching: cache the app shell (JS/CSS/HTML) with a `CacheFirst` strategy; do **not** cache API responses aggressively — use `NetworkFirst` with a short timeout for `GET` API calls so stats/decks stay reasonably fresh but still resolve offline from last-known cache if the network fails

---

## 10. Build Order & Acceptance Criteria

Build and verify each phase before starting the next.

### Phase 1 — Skeleton & Auth
- Express server boots, connects to MongoDB Atlas, `/auth/login` works end-to-end with the frontend login screen
- **Accept when:** logging in with the correct passcode redirects to Home; wrong passcode shows an error; reloading the page keeps you logged in (token persisted)

### Phase 2 — Decks & Import
- `Deck` and `Question` models, `POST /decks`, `GET /decks`, `/import/preview`, `/import/confirm`
- Add Questions page fully functional
- **Accept when:** you can create a "SQL" deck, paste 10 questions, see an accurate new/changed/unchanged preview, confirm, and see `questionCount: 10` reflected on Home

### Phase 3 — Practice: Full Random only
- `GET /decks/:id/questions`, basic Practice Run screen with uniform random picking, no weighting yet, no confidence buttons
- **Accept when:** you can start a session, answer questions, see correct/incorrect + description, and end the session

### Phase 4 — Weighted Recall + Confidence
- Implement `applyAnswer` and `pickNext` exactly as specified in Section 5
- Add confidence buttons, wire `POST /questions/:id/answer` fully
- **Accept when:** deliberately answering the same question wrong 3 times in a row visibly increases how often it's picked relative to a question answered "knew it"

### Phase 5 — Modes + Leech Detection
- Quick 10, Focused Review, New Only, Drill modes; leech flagging and badge
- **Accept when:** each mode's stop condition works correctly, and a question answered wrong 4 times consecutively shows the leech badge and appears in Focused Review

### Phase 6 — Stats Dashboard
- `DailyLog` writes on every answer, `/stats/overview`, `/stats/trend`, Stats page with charts
- **Accept when:** the trend chart shows real data after a few practice sessions across different days (can be tested by manually inserting DailyLog docs with past dates), and weakest tags reflect actual accuracy

### Phase 7 — Export/Import Backup, Deck Management, PWA
- `/export`, `/import-backup`, deck reset/delete, PWA manifest + service worker
- **Accept when:** exporting downloads a valid JSON file, importing that same file back restores identical state, and the app is installable on a phone home screen and opens standalone

---

## 11. Things to Explicitly Not Build in v1

- Multi-user support / signup flow — single passcode only
- Server-side question picking endpoint — client-side only for now (Section 5 keeps the server-side stub for future use, but don't wire it up)
- Image/audio questions — text only
- Real-time sync across multiple devices beyond "same backend, reload to see latest" — no websockets/live updates needed
- Session history collection (`Session` from the earlier architecture doc) — skip unless the user asks for streak/history features beyond what DailyLog already supports