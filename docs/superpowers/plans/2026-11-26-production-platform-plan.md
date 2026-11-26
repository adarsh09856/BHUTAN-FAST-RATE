# Bhutan Fast Rate Tours — Complete Production Platform Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver an end-to-end, production-ready tour operator platform for Bhutan Fast Rate Tours running cleanly on both SQLite and PostgreSQL, with genuine traveler checkout (`book.html`), Admin "book on behalf of caller" + WhatsApp/Email dispatch automation, strict DoI visa compliance, private document uploads, guide field operations, and Admin control over all public content—without altering the existing visual design or theme.

**Architecture:** Convert the database layer and all Express routes cleanly to `async/await` so every endpoint works identically against `node:sqlite` and PostgreSQL (`pg`). Enforce `scrypt` + HMAC-SHA256 JWT RBAC middleware, private `multer` upload storage outside web root, server-authoritative pricing/multi-currency ledgers, and clean modular Vanilla JS replacing the offline `index.html` prototype and static portal shells while preserving existing CSS themes (`#FFF8EC`/`#0B2A22`/`#C9A24B` on luxury editorial pages, `tour-theme.css` `#14231E`/`#E05A47` on subpages/portals, and `admin-theme.css` in Admin).

**Tech Stack:** Node.js `v22.22+`, Express 4, SQLite (`node:sqlite`), PostgreSQL (`pg`), `multer`, `nodemailer`, Vanilla ES6 JS, Tailwind CSS.

**Spec:** [docs/superpowers/specs/2026-11-26-production-platform-design.md](../specs/2026-11-26-production-platform-design.md)

## Global Constraints
- Runtime floor: Node.js `v22.22.0+` (uses built-in `node:sqlite` & `node:crypto`).
- Dual-engine parity: every query in `routes/*.js` and `services/*.js` uses `await db.query/get/run/transaction` and passes cleanly against both SQLite and PostgreSQL (`DATABASE_URL`).
- Strict HTTP purity over web: disable `localStorage` stateful mutations and remove embedded credentials (`admin123`) from `js/api-client.js` when served over `http:`/`https:`.
- Design preservation: preserve existing layout, spacing, fonts (`Fraunces`, `Manrope`), colors, and `color-scheme: light !important` input guards on every existing page; do not alter visual themes.
- Canonical license & settings keys: `#TR/2018/9882`, `sdf_rate_international`, `sdf_rate_india`, `sdf_child_6_12_discount`, `usd_to_inr_rate`, `company_email`, `company_phone`, `company_whatsapp`.
- Sensitive uploads (`uploads/`) and database files (`database/*.db`) must never be statically served by `express.static`.

## Review Focus
1. **Mixed-Currency Invoice vs USD Finance Aggregation:** Regional `India` bookings (`₹1,200/night` INR SDF + USD package converted at `usd_to_inr_rate`) must store exact local invoice amounts without adding `$ USD + ₹ INR` raw numbers, while Admin Finance KPIs aggregate normalized USD equivalents — test pinned in Task 3 & Task 4.
2. **Passport 6-Month Validity Boundary & Regional Permit Bypass:** An international guest whose `passport_expiry` is `travel_date_end + 5 months 29 days` must be rejected by `checkDocumentReadiness()` and block `submitted_to_doi`, whereas an Indian regional guest with National/Voter ID + scan bypasses the 6-month passport check — test pinned in Task 3 & Task 5.
3. **Guide Schedule Overlap Conflict:** Assigning a guide whose active assignment overlaps `booking.travel_date_start <= other.end_date AND booking.travel_date_end >= other.start_date` must return `409 Conflict` with the conflicting booking ref — test pinned in Task 6.
4. **Cross-Tenant & Role Isolation:** A `client` JWT for `BFR-2026-8841` must receive `403` when reading/uploading to `BFR-2026-8850`, and a `guide` JWT must receive `403` on any `/api/admin/*` route — test pinned in Task 2 & Task 5.
5. **Double-Submit Idempotency & Failed-Network Checkout Safety:** Slow or failed `/api/bookings` calls on `book.html` must disable the submit button while in-flight, allow `Idempotency-Key` deduplication on retry, and surface a clear retry error rather than silently faking a booking in `localStorage` — test pinned in Task 4 & Task 11.

---

## File Map (Creation & Modification Responsibilities)

- **DB & Setup:** `package.json`, `.env.example`, `database/schema.sql`, `database/postgres-schema.sql`, `database/db.js`, `database/seed.js`, `database/setup-postgres.js`
- **Middleware & Security (New):** `middleware/auth.js`, `middleware/upload.js`, `server.js`
- **Services:** `services/sdf-engine.js`, `services/visa-workflow.js`, `services/notification-service.js`, `services/document-templates.js` *(New)*
- **Routes:** `routes/public.js`, `routes/bookings.js`, `routes/client.js`, `routes/guide.js`, `routes/admin.js`, `routes/notifications.js` *(New)*
- **Shared Frontend JS:** `js/api-client.js`, `js/site-shell.js` *(New)*, `js/booking-widget.js`, `js/tour-detail.js` *(New)*, `js/home-app.js` *(New)*, retire `js/main.js`
- **Admin Portal:** `admin/js/admin-app.js`, `admin/css/admin-theme.css`, `admin/login.html`, `admin/dashboard.html`, `admin/bookings.html`, `admin/booking-detail.html`, `admin/visa-desk.html`, `admin/tours-manager.html`, `admin/inquiries.html`, `admin/guides.html`, `admin/content-cms.html` *(New)*, `admin/finance.html`, `admin/notifications.html`, `admin/settings.html`, `admin/audit-log.html`
- **Client & Guide Portals:** `client/login.html`, `client/dashboard.html`, `client/documents.html`, `client/itinerary.html`, `guide/login.html`, `guide/dashboard.html`, `guide/trip-detail.html`
- **Public Site:** `index.html`, `tours.html`, `tour.html` *(New)*, `book.html` *(New)*, `booking-confirmed.html` *(New)*, `contact.html`, `sdf-calculator.html`, `services.html`, `track-visa.html`, `reviews.html`, `faq.html`, `destinations.html`, `festivals.html`, `about.html`, `visa-guide.html`, `packing-guide.html`, `terms.html`, `privacy.html`, `10 × tour-*.html`, `6 × destination-*.html`, `4 × festival-*.html`, retire `app.html`
- **Tests:** `tests/unit-services.js` *(New)*, `test-crud.js` (expanded end-to-end production test), `tests/smoke-links-ui.js` *(New)*

---

### Task 1: Dependencies, Async Dual Database Engine & Expanded Schemas

**Files:**
- Modify: `package.json`, `.env.example`, `database/schema.sql`, `database/postgres-schema.sql`, `database/db.js`, `database/seed.js`, `database/setup-postgres.js`
- Create: `tests/test-db-parity.js`

**Interfaces:**
- Produces in `database/db.js`:
  - `async query(sql: string, params?: any[]) -> Promise<Array<object>>`
  - `async get(sql: string, params?: any[]) -> Promise<object|undefined>`
  - `async run(sql: string, params?: any[]) -> Promise<{ changes: number, lastInsertRowid: number|string|null }>`
  - `async transaction(fn: (tx) => Promise<T>) -> Promise<T>`
  - `getEngine() -> 'sqlite'|'postgres'`, `async closeDb()`

- [ ] **Step 1: Write failing database parity & schema test (`tests/test-db-parity.js`)**
  Assert that `await db.query('SELECT id, name FROM festivals WHERE is_active = ?', [1])`, `await db.get('SELECT COUNT(*) as count FROM guide_assignments')`, `await db.query('SELECT license_no, specialty FROM users WHERE role = ?', ['guide'])`, and `await db.get("SELECT value FROM settings WHERE key = 'usd_to_inr_rate'")` all return Promises and seeded records, and that `bookings` includes `payment_plan, nationality_type, sdf_remitted_at`, `payments` includes `currency, amount_local`, and `tours` includes `price_4star_usd`.

- [ ] **Step 2: Run test to verify failure**
  Run: `node tests/test-db-parity.js`
  Expected: FAIL (`festivals` table missing, `db.query` not returning Promise, unseeded `guide_assignments` = 0).

- [ ] **Step 3: Install `multer` and `nodemailer` in `package.json` and update scripts**
  Run `npm install multer nodemailer` inside `e:\ai\bhutanprojects\newecomdemo\bhutan-fast-rate-tours` and set `"test": "node tests/unit-services.js && node test-crud.js"`. Update `.env.example` with `UPLOAD_MAX_MB=5` and `APP_URL=http://localhost:3000`.

- [ ] **Step 4: Expand `database/schema.sql` & `database/postgres-schema.sql` cleanly**
  - Add tables `festivals` and `guide_checkins` identically in both schemas.
  - Add columns on `users` (`license_no`, `languages`, `specialty`), `tours` (`price_4star_usd`), `bookings` (`discount_usd`, `flight_assistance`, `nationality_type`, `exchange_rate`, `payment_plan`, `balance_due_date`, `sdf_remitted_at`, `sdf_remittance_ref`, `visa_rejection_reason`, `cancellation_reason`, `custom_itinerary_json`, `created_by_staff_id`), `travelers` (`emergency_contact_name`, `emergency_contact_phone`, `document_notes`), `payments` (`currency`, `amount_local`), `notifications` (`whatsapp_url`, `metadata_json`, `error_message`).
  - Use integer `0/1` flags consistently in `postgres-schema.sql` (`SMALLINT DEFAULT 1/0`) OR translate `1/0` flags cleanly in `db.js` so **zero** SQL queries break across engines (`SMALLINT` avoids PG `boolean = integer` operator errors while keeping strict `0/1` JSON output parity!).

- [ ] **Step 5: Refactor `database/db.js` to pure async + quote-safe PG SQL translator + full idempotent auto-migration**
  - Replace naive `sql.replace(/\?/g, ...)` with a string/comment-aware placeholder scanner so `?` inside `'...'` strings isn't corrupted.
  - Ensure `run()` appends `RETURNING id` on PG `INSERT` statements lacking `RETURNING` (when table has `id`) cleanly.
  - Support schema auto-migration (`ALTER TABLE ... ADD COLUMN` if upgrading an existing `database/tours.db` safely!).
  - Fix `insertInq` bind mismatch (`11` `?` -> `12` `?` binding `status`) and seed `travelers`, `payments`, `guide_assignments`, `festivals`, `notifications`, and hashed staff passwords (`scrypt` format `scrypt$<salt>$<hash>`).

- [ ] **Step 6: Expand `database/seed.js` & `database/setup-postgres.js`**
  - Add 5 realistic staff users (`super_admin`, `admin`, `concierge`, `finance`, `guide` x2 with `license_no`, `languages`, `specialty`), all canonical `settings` keys (Section 3.1 of spec), 4 rich `festivals`, `price_4star_usd` on all 10 tours, and companion `travelers` + `payments` + `guide_assignments` + `notifications` for the 3 sample bookings.

- [ ] **Step 7: Recreate local SQLite DB from expanded schema/seed & run `tests/test-db-parity.js`**
  Backup/remove stale `database/tours.db` (if safe/untracked seed DB) or run auto-migration; run `node tests/test-db-parity.js`.
  Expected: PASS with counts (`>= 10 tours`, `>= 6 destinations`, `>= 4 festivals`, `>= 3 bookings`, `>= 3 guide_assignments`, `>= 5 users`).

- [ ] **Step 8: Commit**
  `git commit -am "feat(db): async dual SQLite/PostgreSQL engine with festivals, checkins, and parity seed"`

---

### Task 2: Auth/RBAC Middleware, Private File Upload Security & Core Server Hardening

**Files:**
- Create: `middleware/auth.js`, `middleware/upload.js`, `tests/test-middleware.js`
- Modify: `server.js`

**Interfaces:**
- Produces in `middleware/auth.js`:
  - `hashPassword(plain: string) -> string` (`scrypt$...`) & `verifyPassword(plain: string, stored: string) -> boolean`
  - `signToken(payload: object, expiresInSec?: number) -> string` & `verifyToken(token: string) -> object|null`
  - `requireStaff(...allowedRoles)` (rejects missing/expired -> `401`, wrong role -> `403`, explicitly blocks `'guide'` from admin)
  - `requireGuide()` (strictly `role === 'guide'`)
  - `requireClient()` (strictly `role === 'client'`, sets `req.clientBookingId`)
- Produces in `middleware/upload.js`:
  - `uploadTravelerDocs` (`passport_scan`, `photo_url`, `insurance_doc`), `uploadPaymentReceipt` (`receipt_file`), saving outside static web root under `uploads/` with MIME/size checks (`5MB`, `jpg|png|pdf`).

- [ ] **Step 1: Write failing security & upload tests (`tests/test-middleware.js`)**
  Test `hashPassword`/`verifyPassword` (`timingSafeEqual`), `signToken`/`verifyToken` expiry & tampering rejection, RBAC matrix (`guide` token rejected `403` by `requireStaff('admin', 'concierge')`, `concierge` rejected `403` by `requireStaff('super_admin')`, valid `client` token sets `req.clientBookingId` and fails for mismatched booking), plus `server.js` returning `403/404` on `GET /database/tours.db` and `GET /uploads/test.txt` and serving dynamic HTML fallback for `GET /tour-nonexistent-custom.html`.

- [ ] **Step 2: Run test to verify failure**
  Run: `node tests/test-middleware.js` -> Expected: FAIL (`Cannot find module '../middleware/auth'`).

- [ ] **Step 3: Implement `middleware/auth.js` & `middleware/upload.js`**
  Implement `scryptSync` + HMAC-SHA256 JWT without hardcoded insecure fallback secrets in production warnings, and configure `multer` storage into `uploads/{passports,insurance,photos,receipts}` with strict extension/MIME filtering.

- [ ] **Step 4: Harden `server.js`**
  - Bootstrap `uploads/` subdirectories on startup.
  - Add blocklist middleware rejecting HTTP access to `/database/*`, `/uploads/*`, `/middleware/*`, `/services/*`, `/routes/*`, `/tests/*`, `/docs/*`, `.env*`, `package*.json`.
  - Mount `/api/notifications` cleanly.
  - Add clean Express fallback middleware for `/tour-*.html` -> serve `tour.html`, `/destination-*.html` -> serve `destinations.html`, `/festival-*.html` -> serve `festivals.html` when static file does not exist on disk (supports newly Admin-created packages without regenerating files!).
  - Add JSON error handler middleware (including Multer file size / MIME error messages returning clean `400`).

- [ ] **Step 5: Verify `tests/test-middleware.js` passes**
  Run: `node tests/test-middleware.js` -> Expected: PASS.

- [ ] **Step 6: Commit**
  `git commit -am "feat(security): add scrypt+JWT RBAC middleware, private multer uploads, and hardened server.js"`

---

### Task 3: Authoritative Pricing/SDF Engine, Visa State Machine, WhatsApp/SMTP Notifier & Document Renderer

**Files:**
- Modify: `services/sdf-engine.js`, `services/visa-workflow.js`, `services/notification-service.js`
- Create: `services/document-templates.js`, `tests/unit-services.js`

**Interfaces:**
- Produces:
  - `calculatePricingQuote(params: { tour, nights, adults, children_6_12, children_under_6, nationality_type, hotel_tier, extras_usd, discount_usd }) -> Promise<QuoteBreakdown>` (in `services/sdf-engine.js`, keeping `calculateSDF` exported too)
  - `checkDocumentReadiness(traveler, travelEndDate, nationalityType, requireInsurance)` & `checkVisaTransition(currentStage, targetStage, booking, travelers, options)` (in `services/visa-workflow.js`)
  - `dispatchNotification(event, payload)` & `buildWhatsAppShareUrl(phone, text)` & `renderConfirmationText(event, booking, settings)` (in `services/notification-service.js`)
  - `renderInvoiceHtml(booking, travelers, payments, settings)` & `renderClearanceLetterHtml(booking, travelers, settings)` (in `services/document-templates.js`)

- [ ] **Step 1: Write comprehensive unit tests in `tests/unit-services.js` covering Review Focus #1 & #2**
  - Test `calculatePricingQuote` for `international` (3★/4★/5★ tiers, 40% child package discount, 50% child SDF, under-6 exempt, government waiver).
  - Test `calculatePricingQuote` for `india` booking: verify `currency === 'INR'`, `total_sdf_local === nights * adults * 1200`, `visa_fee_local === 0`, INR invoice total uses `usd_to_inr_rate`, AND `total_price_usd` stores normalized USD equivalent (`!== baseUsd + sdfInr` raw addition!).
  - Test **Review Focus #2**: Passport expiring `5 months 29 days` after `travel_date_end` fails `checkDocumentReadiness()` with explicit 6-month error for international guest, whereas `>= 6 months` with `passport_scan` & `photo_url` passes; Indian regional guest with National ID scan passes without 6-month passport error.
  - Test `checkVisaTransition`: blocks `submitted_to_doi` & `approved` when `full_paid !== 1` or any traveler missing docs; requires `rejection_reason` for `rejected`.
  - Test `dispatchNotification`: inserts row into `notifications` with valid pre-filled `https://wa.me/...` URL + skips SMTP cleanly when `smtp_host` blank without throwing.

- [ ] **Step 2: Run test to verify failures**
  Run: `node tests/unit-services.js` -> Expected: FAIL.

- [ ] **Step 3: Implement async `services/sdf-engine.js`, strict `services/visa-workflow.js`, `services/notification-service.js` (`nodemailer` + webhook/Meta/Twilio + `wa.me` template engine), and `services/document-templates.js`**

- [ ] **Step 4: Run `tests/unit-services.js`**
  Run: `node tests/unit-services.js` -> Expected: ALL PASS.

- [ ] **Step 5: Commit**
  `git commit -am "feat(services): multi-currency SDF engine, strict visa workflow, WhatsApp/SMTP dispatcher, invoice/clearance templates"`

---

### Task 4: Public API, Notifications API & Self-Serve Multi-Guest Booking / Tracking API

**Files:**
- Modify: `routes/public.js`, `routes/bookings.js`
- Create: `routes/notifications.js`, `tests/test-public-bookings.js`

**Interfaces:**
- Produces routes:
  - `/api/tours`, `/api/tours/:slug`, `/api/destinations`, `/api/destinations/:id`, `/api/festivals`, `/api/festivals/:id`, `/api/reviews`, `/api/settings/public`, `POST /api/calculate-sdf`, `POST /api/inquiries`
  - `POST /api/bookings` (supports `tour_id` OR `custom_daily_rate` calculation, `travelers[]` array matching `total_travelers`, optional `Idempotency-Key` header deduplication, returns `booking` + `client_token` + `whatsapp_concierge_url`), `GET /api/bookings/track/:ref` (email-checked or masked status preview), `GET /api/bookings/:id/invoice-view`, `GET /api/bookings/:id/clearance-view`
  - `/api/notifications`: `GET /`, `PATCH /:id/read`, `PATCH /read-all`, `PATCH /:id/sent`, `POST /send`

- [ ] **Step 1: Write failing tests (`tests/test-public-bookings.js`) covering Review Focus #1 & #5**
  - Verify `/api/settings/public` never leaks `smtp_pass`, `whatsapp_api_token`, or `bank_account` to anonymous callers.
  - Verify `POST /api/bookings` ignores tampered client `total_price_usd: 1`, computes exact server totals, inserts **3** `travelers` records when party is `2 adults + 1 child (6–12)`, rejects India mixed-currency tamper, and deduplicates repeat requests carrying identical `Idempotency-Key` header.
  - Verify `GET /api/festivals` returns seeded festivals.

- [ ] **Step 2: Run test -> Expected: FAIL.**

- [ ] **Step 3: Refactor `routes/public.js`, `routes/bookings.js`, and create `routes/notifications.js` using pure `async/await` transactions**

- [ ] **Step 4: Verify `tests/test-public-bookings.js` passes.**
  Run: `node tests/test-public-bookings.js` -> Expected: PASS.

- [ ] **Step 5: Commit**
  `git commit -am "feat(api): async public catalog, multi-traveler booking checkout, notifications hub, printable views"`

---

### Task 5: Client Portal API & Guide Field Portal API

**Files:**
- Modify: `routes/client.js`, `routes/guide.js`
- Create: `tests/test-portals-api.js`

**Interfaces:**
- Client endpoints (protected by `requireClient()` except `/auth`):
  - `POST /api/client/auth` (`booking_ref`, `email`) -> returns `token` + basic summary
  - `GET /api/client/booking`, `GET /api/client/itinerary`, `GET /api/client/payments`, `GET /api/client/notifications`, `PATCH /api/client/notifications/:id/read`
  - `POST /api/client/travelers` (add unfilled companion slot or notify add-on request), `POST /api/client/travelers/:id/documents` (multipart `uploadTravelerDocs` + runs `checkDocumentReadiness()` + auto-advances `visa_status` to `documents_complete`), `GET /api/client/documents/:travelerId/:field` (authenticated file stream)
  - `POST /api/client/payments/receipt` (multipart `uploadPaymentReceipt` creating `'pending'` payment & Finance alert)
  - `POST /api/client/reviews` (allowed when `booking_status === 'completed'`)
  - `GET /api/client/invoice-view`, `GET /api/client/clearance-view`
- Guide endpoints (protected by `requireGuide()` except `/auth/login`):
  - `POST /api/guide/auth/login` (fixed `'guide'` SQL + `verifyPassword`) -> returns `token` + guide profile
  - `GET /api/guide/assignments` (current, upcoming, past), `GET /api/guide/assignments/:booking_id` (roster + dietary + emergency contacts + itinerary + checkins), `PATCH /api/guide/assignments/:id/checkin` (writes `guide_checkins` + `audit_log` + admin notification), `GET /api/guide/notifications`

- [ ] **Step 1: Write failing tests (`tests/test-portals-api.js`) covering Review Focus #2 & #4**
  - Assert `client` JWT for `BFR-2026-8841` gets `403` when accessing `BFR-2026-8850` or uploading to its traveler.
  - Assert multipart upload (`passport_scan`, `photo_url`, `insurance_doc`) persists privately to `uploads/`, updates readiness, and rejects `.exe`/oversized files.
  - Assert `POST /api/guide/auth/login` works (`200`) with seeded guide credentials and fails `403` when calling `/api/admin/bookings`.

- [ ] **Step 2: Run test -> Expected: FAIL.**

- [ ] **Step 3: Implement `routes/client.js` & `routes/guide.js` cleanly with `async/await`**

- [ ] **Step 4: Run `tests/test-portals-api.js` -> Expected: PASS.**

- [ ] **Step 5: Commit**
  `git commit -am "feat(portals-api): secured client document uploads, receipts, reviews and guide field checkins"`

---

### Task 6: Complete Admin Operations, On-Behalf Booking & CMS REST API (`routes/admin.js`)

**Files:**
- Modify: `routes/admin.js`, `test-crud.js`

**Interfaces:**
- Protected by `requireStaff(...)` per RBAC matrix:
  - Auth & KPIs: `POST /auth/login`, `GET /auth/me`, `GET /stats` (live revenue, monthly trends, SDF collected/remitted, pipeline counts, today checkins, unread notifs)
  - Bookings & Ops: `POST /bookings` (**"Book on Behalf of Client"** with custom/tour mode, discount, optional initial deposit, returning `whatsapp_share_url` & logged notification), `GET /bookings`, `GET /bookings/:id`, `PATCH /bookings/:id/status` (enforces assigned guide before `confirmed`), `PATCH /bookings/:id/notes`, `PATCH /bookings/:id/visa` (calls strict `checkVisaTransition`, supports `rejection_reason`), `PATCH /bookings/:id/assign-guide` (checks date overlap -> `409 Conflict` with conflicting booking ref!), `GET /documents/:travelerId/:field` (private doc preview stream), `DELETE /bookings/:id` (`super_admin` cancel/refund guard)
  - Finance: `GET /payments`, `POST /bookings/:id/payments` (supports wire/cash/refund & updates balances), `PATCH /payments/:id/verify` (verify/reject client uploaded receipt), `PATCH /bookings/:id/sdf-remit`, `GET /reports/finance-csv`, `GET /reports/bookings-csv`
  - CRM Inquiries: `GET /inquiries`, `PATCH /inquiries/:id`, `POST /inquiries/:id/convert`
  - Guides CRUD: `GET /guides`, `POST /guides`, `PUT /guides/:id`, `PATCH /guides/:id/toggle`
  - Catalog & Content CMS: Tours (`GET/POST/PUT/PATCH/DELETE /tours`), Destinations (`GET/POST/PUT /destinations`), Festivals (`GET/POST/PUT/DELETE /festivals`), Reviews Moderation (`GET/PATCH/DELETE /reviews/:id`)
  - Settings, Integrations, Staff & Audit: `GET/PUT /settings` (upsert), `POST /settings/test-notification`, `GET/POST/PUT/PATCH /users` (`super_admin`), `GET /audit-log`, `GET /notifications`

- [ ] **Step 1: Upgrade `test-crud.js` first to assert RBAC (`401`/`403`), guide overlap `409`, admin-on-behalf booking creating `whatsapp_share_url` + notification, payment verification, inquiry conversion, destinations/festivals/reviews CMS, and settings upsert**

- [ ] **Step 2: Run `node test-crud.js` to confirm new assertions fail against old `routes/admin.js`.**

- [ ] **Step 3: Refactor & expand `routes/admin.js` using pure `async/await` and RBAC middleware guards**

- [ ] **Step 4: Run `npm test` (`tests/unit-services.js` + `test-crud.js`) -> Expected: ALL PASS.**

- [ ] **Step 5: Commit**
  `git commit -am "feat(admin-api): RBAC protection, admin-assisted booking, inquiry convert, finance verify, guide conflict guard, CMS"`

---

### Task 7: Frontend Shared Modules (`api-client.js`, `site-shell.js`, `booking-widget.js`, `tour-detail.js`)

**Files:**
- Modify: `js/api-client.js`, `js/booking-widget.js`
- Create: `js/site-shell.js`, `js/tour-detail.js`, `tests/test-frontend-api.js`

**Interfaces:**
- Produces `window.ApiClient`: automatic token injection per portal (`bfr_admin_token`, `bfr_client_token`, `bfr_guide_token`), `401` auto-redirect hook on protected portals, complete typed wrapper methods for every Public, Booking, Client, Guide, Admin, Notification, Finance, CMS, and Upload endpoint. Disables stateful `localStorage` fallback & embedded `admin123` credentials on `http:`/`https:`.
- Produces `window.SiteShell`: theme-preserving hydrator syncing `company_license` (`#TR/2018/9882`), phone, email, WhatsApp hotline, and subtle `Client Portal` / `Track Visa` nav access without altering existing page styling.
- Produces `window.BookingWidget` & `window.TourDetailHydrator`: loads live tour pricing tiers (`3★/4★/5★`), SDF rules, day-by-day itinerary, inclusions, and forwards pre-selected configuration directly into `book.html`.

- [ ] **Step 1: Write Node/JSDOM-free logic verification (`tests/test-frontend-api.js`) checking `api-client.js` contains zero `'admin123'` credentials, disables HTTP localStorage fallback on bookings, attaches `Authorization` headers cleanly, and formats multi-currency & `book.html` query URLs accurately**

- [ ] **Step 2: Implement `js/api-client.js`, `js/site-shell.js`, `js/booking-widget.js`, and `js/tour-detail.js`**

- [ ] **Step 3: Run `node tests/test-frontend-api.js` -> Expected: PASS.**

- [ ] **Step 4: Commit**
  `git commit -am "feat(frontend-core): authenticated ApiClient, theme-preserving SiteShell, BookingWidget & live TourDetail hydrator"`

---

### Task 8: Admin Panel — Auth, Live Dashboard, On-Behalf Booking, Deep Inspector & Visa Desk

**Files:**
- Modify: `admin/css/admin-theme.css`, `admin/js/admin-app.js`, `admin/login.html`, `admin/dashboard.html`, `admin/bookings.html`, `admin/booking-detail.html`, `admin/visa-desk.html`

- [ ] **Step 1: Upgrade `admin/css/admin-theme.css` & `admin/js/admin-app.js`**
  Preserve dark slate `#0F172A` / `#1E293B` / `#E05A47` aesthetic and light-input rules; add live unread notification counter badge in header/sidebar across all admin pages, add `Content CMS` link (`content-cms.html`), enforce role visibility, verify token against `/api/admin/auth/me`, auto-inject Bearer tokens.

- [ ] **Step 2: Wire `admin/login.html` & `admin/dashboard.html`**
  Replace all hardcoded `$84,600` / `24` stats & static audit feed in `dashboard.html` with live `/api/admin/stats` KPIs, revenue & pipeline distribution bars, Today's Guide Field Check-ins feed, pending receipt/visa attention cards, and live recent actions.

- [ ] **Step 3: Wire `admin/bookings.html` with "+ Create Booking on Behalf of Client" & Instant WhatsApp Dispatch**
  Add guided modal (Source Phone/WhatsApp/Agent, Tour or Custom Bespoke trip, dates, travelers breakdown, lead details, optional initial deposit, instant confirmation toggles). On save, show **WhatsApp & Email Confirmation Ready** card with editable message + 1-click **"Open in WhatsApp (`wa.me`) & Mark Dispatched"** + **"Print Invoice"**. Add status/source filtering, search, and server CSV export.

- [ ] **Step 4: Upgrade `admin/booking-detail.html` & `admin/visa-desk.html`**
  - `booking-detail.html`: Load active guides dynamically from `/api/admin/guides` (with conflict error surfacing), render full **Travelers Table + Private Document Preview Modal**, **Payment Ledger + Verify Receipt + Record Payment/Refund**, **Visa Control + Rejection Reason + Live Printable Clearance Letter (`/api/bookings/:id/clearance-view`) & Invoice**, **Direct WhatsApp/Email Client Messenger**, **Editable Staff Notes**, and **Audit Timeline**.
  - `visa-desk.html`: Show `Payment ✓/✗` & `Passports ✓/✗` readiness indicators per row, enforce backend compliance rules with clear toast feedback, add Rejection Reason modal, and link printable Official Clearance Letters.

- [ ] **Step 5: Verify no residual static hardcoded numbers or toast stubs remain in these 5 files & verify syntax/links.**

- [ ] **Step 6: Commit**
  `git commit -am "feat(admin-ops): live dashboard, on-behalf bookings + WhatsApp dispatch, full booking inspector, visa desk"`

---

### Task 9: Admin Panel — Tour Builder, Inquiries CRM, Guides, Finance, Content CMS, Notifications, Settings & Audit

**Files:**
- Modify: `admin/tours-manager.html`, `admin/inquiries.html`, `admin/guides.html`, `admin/finance.html`, `admin/notifications.html`, `admin/settings.html`, `admin/audit-log.html`
- Create: `admin/content-cms.html`

- [ ] **Step 1: Upgrade `admin/tours-manager.html`**
  Add dynamic Day 1..N Itinerary Editor (add/remove/reorder days), explicit `price_3star_usd`, `price_4star_usd`, `price_5star_usd` fields, editable Inclusions list in Edit modal, and live link cleanly opening the tour page.

- [ ] **Step 2: Wire `admin/inquiries.html` (replace static Claire/Miller HTML)**
  Load `/api/admin/inquiries`, filter by status, open Lead Detail Drawer to update stage (`new → proposal_sent → ...`), save notes/follow-up, click 1-click WhatsApp reply, or **Convert to Booking (`POST /api/admin/inquiries/:id/convert`)** jumping straight to created `booking-detail.html`.

- [ ] **Step 3: Wire `admin/guides.html` & `admin/finance.html` (replace all static placeholders & toasts)**
  - `guides.html`: Live roster from `/api/admin/guides`, real **Add / Edit Certified Guide modal**, active/inactive toggle, and assigned trip count/availability schedule.
  - `finance.html`: Live USD-normalized Revenue MTD/YTD KPIs, SDF Collected vs Remitted tracker + 1-click **"Mark SDF Remitted"** control, **Pending Client Wire Receipts Verify/Reject queue**, Overdue Balances table with 1-click WhatsApp payment reminder link, Refunds log, and real CSV ledger export.

- [ ] **Step 4: Build `admin/content-cms.html` (Destinations, Festivals & Reviews Admin Control)**
  Tabbed Admin workspace keeping identical `admin-theme.css` styling:
  - Tab 1: Destinations CRUD (tagline, altitude, highlights, best months, active toggle -> updates `destinations.html` & `index.html`).
  - Tab 2: Festivals CRUD (season, lunar dates label, venue, linked tour, summary, featured/active -> updates `festivals.html` & `index.html`).
  - Tab 3: Reviews Moderation (approve/publish, feature on homepage, reply as operator, delete spam -> updates `reviews.html` & `index.html`).

- [ ] **Step 5: Wire `admin/notifications.html`, `admin/settings.html`, & `admin/audit-log.html`**
  - `notifications.html`: Live notification inbox, Mark Read / Mark All Read, WhatsApp Pending Queue (`Open WhatsApp & Mark Sent`), Manual WhatsApp/Email Client Message composer.
  - `settings.html`: Fix all canonical keys (`sdf_rate_international`, `sdf_rate_india`, `sdf_child_6_12_discount`, `usd_to_inr_rate`, `child_6_12_package_discount_pct`, `custom_daily_rate_*`, `company_*`, `bank_*`, `cancellation_*`, `whatsapp_*`, `smtp_*`), test notification trigger button, plus `super_admin` **Staff Users & RBAC Manager** table.
  - `audit-log.html`: Live searchable/filterable table of real `audit_log` rows + CSV export.

- [ ] **Step 6: Verify zero remaining toast stubs across `admin/*.html` and run full admin API test suite.**

- [ ] **Step 7: Commit**
  `git commit -am "feat(admin-cms): tour itinerary builder, CRM lead conversion, finance ledger, content CMS, settings & audit"`

---

### Task 10: Client Self-Service Portal & Guide Field Portal

**Files:**
- Modify: `client/login.html`, `client/dashboard.html`, `client/documents.html`, `client/itinerary.html`, `guide/login.html`, `guide/dashboard.html`, `guide/trip-detail.html`

- [ ] **Step 1: Wire `client/login.html` & `client/dashboard.html` (preserving `#14231E`/`#F8FAF9`/`#E05A47` theme)**
  - `login.html`: Authenticate strictly via `POST /api/client/auth`, pre-fill from `?ref=...&email=...` deep-links sent in WhatsApp/Email confirmations, redirect to `dashboard.html` on valid token.
  - `dashboard.html`: Require `bfr_client_token` (no silent fallback to `BFR-2026-8841`!), show real status progress stepper, real payment ledger + Bank Wire instructions + **Upload Payment Receipt modal**, real assigned guide (or `"Guide assignment in progress"`), Client notification inbox, buttons for **Print Official Invoice** & **Download Visa Clearance Letter** (`client/clearance` token view), and **Rate Your Bhutan Trip** review form when `booking_status === 'completed'`.

- [ ] **Step 2: Rebuild `client/documents.html` & `client/itinerary.html` with live backend flows**
  - `documents.html`: Fetch `/api/client/booking`, render every traveler card + completion progress bar, highlight missing requirements or `< 6 month` passport validity issues, handle real multipart upload forms (`passport_scan`, `photo_url`, `insurance_doc`) + passport fields saving via `POST /api/client/travelers/:id/documents`, support filling companion guest details & "Request Add-On Guest" inquiry.
  - `itinerary.html`: Fetch `/api/client/itinerary`, render full day-by-day route, accommodations, meals, and guide/emergency contacts with clean print CSS.

- [ ] **Step 3: Rebuild `guide/login.html`, `guide/dashboard.html`, & `guide/trip-detail.html`**
  - `guide/login.html`: Authenticate via fixed `POST /api/guide/auth/login` -> store `bfr_guide_token`.
  - `guide/dashboard.html`: Render live Today's Active Expedition, Upcoming Schedule, and Past Completed Trips from `/api/guide/assignments`; replace `alert(...)` stub with real **Field Check-In form** (`location`, `weather`, `guest_status`, `notes`) calling `PATCH /api/guide/assignments/:id/checkin`.
  - `guide/trip-detail.html`: Read `?id=...`, fetch `/api/guide/assignments/:id`, render live traveler roster, dietary/medical notes, emergency contacts, guest WhatsApp direct links, full daily itinerary, and field check-in timeline.

- [ ] **Step 4: Commit**
  `git commit -am "feat(portals): full authenticated Client self-service uploads/receipts/reviews & Guide live ops"`

---

### Task 11: Public Conversion Flows — Homepage Refactor (Design-Intact), Dedicated Checkout (`book.html`), Confirmation & Live Tour Pages

**Files:**
- Modify: `index.html`, `tours.html`, `10 × tour-*.html`
- Create: `js/home-app.js`, `tour.html`, `book.html`, `booking-confirmed.html`

- [ ] **Step 1: Replace minified React bundle in `index.html` cleanly with `js/home-app.js` preserving exact visual layout/design**
  Keep every CSS rule, font, cream `#FFF8EC`/forest `#0B2A22`/gold `#C9A24B` palette, Ken Burns hero carousel, AI Search bar, Featured Tours grid, Festivals 2027 cards, Specialty experience preview cards, Services grid, Looking Glass places carousel, Custom Itinerary builder, Testimonials, Trust strip, Footer, and AI Travel Concierge Drawer visually identical.
  - Wire Featured Tours, Festivals, Destinations, Testimonials, and Contact/License details **live** from `/api/*`.
  - Remove fake **"Add to trip plan"** e-commerce shopping cart drawer & every `"local preview only"` dead end! Tour cards link directly to **`tour-<slug>.html`** (`View Details`) and **`book.html?tour=<id>`** (`Book Now`). Custom itinerary form submits directly to `POST /api/inquiries` (returning real `INQ-...` confirmation & WhatsApp option). Hero buttons link directly to the corresponding featured tour page & `tours.html`.

- [ ] **Step 2: Build dedicated multi-step checkout `book.html` & receipt `booking-confirmed.html` matching brand visual style + Review Focus #5**
  - Style cleanly in exact cream `#FFF8EC` / forest `#0B2A22` / gold `#C9A24B` luxury aesthetic with strict light-input protection (`color-scheme: light !important`).
  - Implement 4 validated checkout steps (Departure/Tier/Nationality/Flights → Lead Info + Dynamic Per-Guest Traveler Roster + live 6-month expiry warning → Authoritative `POST /api/calculate-sdf` breakdown + Deposit 30% vs Full 100% + Live Terms → Confirmed Commit with `Idempotency-Key`, in-flight lock preventing duplicate clicks, and real error banner if server unreachable).
  - Redirect cleanly to `booking-confirmed.html?ref=...` showing Ref ID, Wire instructions, **Print Invoice**, **Enter Client Portal (`client/login.html?ref=...&email=...`)**, and **1-Click Open WhatsApp Concierge**.

- [ ] **Step 3: Update `tours.html`, create `tour.html`, and wire all `10 × tour-*.html` pages via `js/tour-detail.js` + `BookingWidget`**
  - Keep existing visual design of `tours.html` & `tour-*.html` untouched while replacing `"Inquire / Get Quote"` `contact.html` dead ends with live `BookingWidget` sidebar (`#tourBookingWidget`) leading straight to `book.html?tour=...` + secondary WhatsApp/Inquiry options, and hydrating live DB prices/tiers/itinerary/inclusions.

- [ ] **Step 4: Commit**
  `git commit -am "feat(checkout): design-preserving live index.html, dedicated book.html checkout, confirmation & live tour pages"`

---

### Task 12: Remaining Public Pages Hydration, Cleanup & Full End-to-End Platform Verification

**Files:**
- Modify: `contact.html`, `sdf-calculator.html`, `services.html`, `track-visa.html`, `reviews.html`, `faq.html`, `destinations.html`, `6 × destination-*.html`, `festivals.html`, `4 × festival-*.html`, `about.html`, `visa-guide.html`, `packing-guide.html`, `terms.html`, `privacy.html`
- Remove: `app.html`, `js/main.js` (after verifying zero inbound references)
- Create: `tests/smoke-links-ui.js`

- [ ] **Step 1: Wire `contact.html`, `sdf-calculator.html`, `services.html`, `track-visa.html`, `reviews.html`, `faq.html`**
  - `contact.html`: Submit `#inquiryForm` via `ApiClient.submitInquiry()`, populate `#custTour` from `/api/tours`, read URL params (`?tour=`, `?nights=`, `?adults=`, `?children=`, `?nation=`), show real `INQ-YYYY-XXXX` ref & 1-click WhatsApp continuation.
  - `sdf-calculator.html` & `services.html`: Remove stray `</script>` bug, unify on canonical `/api/settings/public` keys + `/api/calculate-sdf`, wire `"Reserve Custom Dates ->"` directly to `book.html?custom=1&...` and `"Request Specialist Quote ->"` to `contact.html?...`.
  - `track-visa.html`: Prompt clean Ref + Email lookup (no leaking other guests on load), show step timeline, Printable Clearance button, and link to `client/login.html`.
  - `reviews.html`: Hydrate live verified reviews + average rating from `GET /api/reviews` + link completed travelers to leave a review via `client/dashboard.html`.
  - `faq.html`: Interactive searchable FAQ accordion covering Visas, SDF Tax, Health & Altitude, Flights, Trekking, Payments & Cancellation synced with live SDF/cancellation numbers from `settings`.

- [ ] **Step 2: Hydrate `destinations.html`, `6 × destination-*.html`, `festivals.html`, `4 × festival-*.html`, & info pages via `site-shell.js` + live `/api/destinations`, `/api/festivals`, `/api/tours`, `/api/settings/public`**
  Ensure every destination & festival page pulls live valley/festival details, displays live DB-backed related tours (`Book Now -> book.html?tour=...`), and uses canonical license `#TR/2018/9882` + Admin contact settings with zero theme alteration.

- [ ] **Step 3: Retire orphan `app.html` & stub `js/main.js` and run full verification suite (`tests/smoke-links-ui.js` + `npm test`)**
  - Run `npm test` (`tests/unit-services.js` + `test-crud.js`) against running app / test process.
  - Run `tests/smoke-links-ui.js`: check all HTML files on disk for **0 broken relative links**, **0 stray script tags / syntax errors**, **0 hardcoded fake credentials (`admin123`) in client JS**, **0 `local preview only` strings**, **0 toast-only action stubs in admin/client/guide**, and verify live server HTTP `200` responses across public, dynamic `/tour-*.html`, client, guide, and admin routes (plus verify `database/setup-postgres.js` dry-run & SQL syntax validation).

- [ ] **Step 4: Commit & verify final clean git status**
  `git commit -am "feat(complete): full production wiring across all public pages, cleanup and end-to-end verification"`

---

## Plan Self-Review Checklist
- **Spec Coverage:** Every DB table, security rule, canonical setting, end-to-end flow (1–7), and file listed in `2026-11-26-production-platform-design.md` maps directly to Tasks 1–12.
- **Type & Symbol Consistency:** Token keys (`bfr_admin_token`, `bfr_client_token`, `bfr_guide_token`), setting keys (`sdf_rate_international`, `sdf_rate_india`, `usd_to_inr_rate`, `child_6_12_package_discount_pct`, `final_payment_due_days`, `require_insurance_for_visa`), and async DB helpers (`query/get/run/transaction`) match identically across all tasks.
- **Review Focus Pinned:** All 5 high-risk failure modes carry dedicated assertions in Tasks 2, 3, 4, 5, 6, and 11.
- **Design Constraint Preserved:** Explicit layout/theme-preservation guard applied across Tasks 7–12 (`index.html`, `tours.html`, `book.html`, subpages, `admin/`, `client/`, `guide/`).
