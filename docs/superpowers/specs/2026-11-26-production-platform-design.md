# Bhutan Fast Rate Tours — Production Full-Stack Architecture & File-by-File Design Spec

**Date:** 2026-11-26  
**Workspace:** `e:\ai\bhutanprojects\newecomdemo\bhutan-fast-rate-tours`  
**Licensed Entity:** Bhutan Fast Rate Tours (Department of Tourism License `#TR/2018/9882`)  
**Scope:** Transform a partially-wired 55+ page multi-file prototype into a production-ready tour operator platform running identically on **PostgreSQL** and **SQLite**, with complete end-to-end traveler self-checkout, admin-assisted ("on behalf of caller/WhatsApp lead") booking & confirmation automation, compliance-enforced visa workflow, guide field operations, private document security, and unified Admin control over public content.

---

## 1. Real-World Business Model & Why Every Screen Exists

Bhutan inbound tourism operates under strict Royal Government compliance: every international visitor (COTI) pays a daily Sustainable Development Fee (**SDF**, currently `$100/adult/night`, `50%` discount for ages `6–12`, exempt under `6`, negotiable/waiverable via government promo), `$40` visa fee, must stay at certified properties with a licensed Bhutanese guide and pre-paid itinerary before the Department of Immigration (DoI) issues an electronic **Visa Clearance Letter (`VCL-...`)**. Regional visitors (India, Bangladesh, Maldives) follow a parallel Entry Permit & INR rate (`₹1,200/adult/night`, `₹0` visa fee).

In real agency operations, bookings enter through **two primary channels**:
1. **Self-Serve Web Travelers**: Arrive via homepage (`index.html`), Google organic tour/valley/festival landing pages (`tour-*.html`, `destination-*.html`, `festival-*.html`), or the SDF estimator (`sdf-calculator.html`), inspect real day-by-day itineraries, calculate dues, submit either a **direct multi-guest checkout booking (`book.html`)** or a **custom trip lead (`contact.html`)**, track progress via `track-visa.html`, and upload passport/insurance docs in the **Client Self-Service Portal (`client/*.html`)**.
2. **Phone & WhatsApp Assisted Bookings ("Admin Books on Behalf of Customer")**: Prospective travelers call or message the agency WhatsApp hotline, agree on dates, guest counts, and hotel tier verbally, and rely on the Travel Manager / Concierge to enter the reservation from the **Admin Operations Center (`admin/bookings.html`)** — which immediately generates a `BFR-YYYY-XXXX` booking reference, itemized invoice breakdown, and **Confirmation + Client Portal Access Link delivered straight to the customer's WhatsApp & Email** so the customer can wire funds and upload passport scans without back-and-forth manual typing.

### Anti-Patterns Being Eliminated
- **Fake "Add to Cart" Tour Drawer**: Tours are bespoke travel commitments requiring departure dates, hotel tiers, and traveler passport nationalities—not shopping cart SKUs. The broken React "Trip Plan cart" in `index.html` that scrolled users down to an inquiry form is replaced with direct navigation to dedicated Tour Pages (`tour-*.html` / `tour.html`) and a real multi-step **Booking Checkout (`book.html`)**.
- **Popup-Only Dead Ends**: Clicking "View Tour / Festival / Destination" navigates to dedicated SEO pages (with full details + embedded booking/checkout launcher), rather than trapping users in static modals.
- **Toast / Alert Stubs**: Every toast-only button in Admin, Client, and Guide portals (`dashboard.html`, `inquiries.html`, `guides.html`, `finance.html`, `notifications.html`, `audit-log.html`, `documents.html`, `itinerary.html`, `guide/dashboard.html`) is replaced with real REST + DB persistence.

---

## 2. Architecture & Technical Decisions

| Concern | Decision | Rationale |
|:--------|:---------|:----------|
| **Server Runtime** | Node.js `v22.22+` + Express 4 | Existing lightweight stack; no build step required |
| **Dual DB Layer** | Unified **Async** `database/db.js` (`await db.query/get/run/transaction`) | Fixes current fatal crash in PostgreSQL mode (`routes/*.js` currently treat Promise returns synchronously). Supports SQLite (`node:sqlite`) locally and PostgreSQL (`pg`) via `DATABASE_URL` cleanly |
| **Schema Parity** | Smallint/Boolean normalization in `db.js` (`0/1` <-> `true/false` parameterized queries) + explicit `RETURNING id` on inserts + new `festivals` & `guide_checkins` tables | Eliminates `boolean = integer` operator errors in Postgres and eliminates unseeded tables (`guide_assignments`, `travelers`, `payments`, `notifications`) |
| **Auth & Passwords** | Native Node `crypto.scryptSync` + HMAC-SHA256 stateless JWTs (`JWT_SECRET` in `.env`, random runtime fallback) + `middleware/auth.js` RBAC | Zero native C++ build dependency on Windows; protects all `/api/admin/*`, `/api/guide/*`, `/api/client/*`, and uploaded passport docs |
| **File Uploads** | Real multipart upload parsing (`multer`) storing files under private `uploads/{passports,insurance,photos,receipts}/` outside static web root | Prevents unauthorized static URL access; streamed only via authenticated admin/client document download routes with MIME (`image/jpeg`, `image/png`, `application/pdf`) & `5MB` size checks |
| **Notifications & WhatsApp** | Unified `services/notification-service.js`: (a) persists in `notifications`, (b) optional SMTP email via `nodemailer`, (c) optional WhatsApp Cloud/Twilio webhook POST, (d) generates pre-filled `https://wa.me/<phone>?text=...` deep links + copyable WhatsApp confirmation packets tracked with `is_sent` & `sent_at` | Works 100% end-to-end both when external SMTP/WhatsApp API credentials are supplied in Admin Settings AND out-of-the-box via 1-click WhatsApp Web dispatch for operators |
| **Printable Documents** | Dedicated clean print-ready HTML invoice & Official Visa Clearance Letter views served dynamically via `/api/bookings/:id/invoice-view` & `/api/bookings/:id/clearance-view` (with `@media print` Save-as-PDF layout, signed/scoped access) | Zero fragile binary dependencies while producing genuine downloadable/printable Royal Bhutan clearance certificates & tax invoices |
| **Frontend Architecture** | Replace `index.html`'s 236KB static React bundle with clean modular Vanilla JS (`js/home-app.js`) reusing the **exact HTML structure & inline Tailwind CSS** (`#FFF8EC`/`#0B2A22`/`#C9A24B`) so the visual design is 100% preserved, while pulling live Admin-controlled tours/destinations/festivals/reviews/settings from `/api/*`. Keep each page's existing visual theme untouched (`tour-theme.css` `#14231E`/`#E05A47` for detail/utility/client/guide pages; `admin-theme.css` dark slate `#0F172A`/`#E05A47` for Admin), syncing branding/contact metadata dynamically via `js/site-shell.js` | Preserves 100% of existing visual design & theme ("without messing the design or the theme") while eliminating `#BT-8842` / `local preview only` static bugs and enabling full live DB sync |
| **HTTP API Purity** | Disable `LocalStorage` state fallback and remove hardcoded `admin123` credentials from `js/api-client.js` whenever running over `http:`/`https:`; fail loudly with retry UI if API unreachable (keep optional read-only preview strictly for `file://`) | Prevents a real client's checkout booking from silently saving only in browser `localStorage` during a server blip |

---

## 3. Canonical Data Model & Compliance Fixes

### 3.1 Canonical Settings Keys (Fixing Existing Split-Brain Bug)
Currently `seed.js` & `sdf-engine.js` use `sdf_rate_international`, whereas `settings.html`, `sdf-calculator.html`, and `api-client.js` use `sdf_usd_adult`. We standardize on ONE canonical schema stored in `settings` and upserted on `PUT /api/admin/settings` (`INSERT ... ON CONFLICT (key) DO UPDATE`):

- **Pricing & Compliance (`category = 'pricing'`)**:
  - `sdf_rate_international` (`100`) — USD/adult/night
  - `sdf_rate_india` (`1200`) — INR/adult/night
  - `sdf_child_6_12_discount` (`50`) — % off for ages 6–12
  - `sdf_child_under_6_exempt` (`1`) — 100% exempt under age 6
  - `sdf_waiver_active` (`0` / `1`) & `sdf_waiver_percent` (`0`)
  - `visa_fee_usd` (`40`) — one-time COTI tourist visa processing fee
  - `deposit_percent` (`30`) — default upfront deposit % for web bookings
  - `min_advance_booking_days` (`7`)
  - `cancellation_free_days` (`60`), `cancellation_partial_days` (`30`), `cancellation_partial_refund_percent` (`50`)
- **Company Profile & Public Contact (`category = 'general'`)**:
  - `company_name` (`Bhutan Fast Rate Tours`)
  - `company_license` (`TR/2018/9882`)
  - `company_email` (`reservations@bhutanfastratetours.bt`)
  - `company_phone` (`+975 17 654 321`)
  - `company_whatsapp` (`+97517654321`)
  - `company_address` (`Norzin Lam, Clock Tower Square, Thimphu & Paro Valley, Bhutan`)
- **Banking & Wire Instructions (`category = 'banking'`)** (returned only on Booking Confirmation, Invoice, and authenticated Client Dashboard):
  - `bank_beneficiary` (`Bhutan Fast Rate Tours Ltd.`)
  - `bank_name` (`Bank of Bhutan Ltd.`)
  - `bank_swift` (`BOBTBT22XXX`)
  - `bank_account` (`200884910023`)
  - `bank_instructions` (`Include Booking Reference BFR-YYYY-XXXX in wire memo`)
- **Integrations (`category = 'integrations'`)** (Admin-only, never exposed in `/api/settings/public`):
  - `whatsapp_provider` (`'webhook'` | `'meta_cloud'` | `'twilio'`), `whatsapp_api_url`, `whatsapp_api_token`, `whatsapp_from`, `whatsapp_template_name`
  - `smtp_host`, `smtp_port`, `smtp_user`, `smtp_pass`, `smtp_from`
- **Additional Pricing / Operations Defaults**:
  - `usd_to_inr_rate` (`85`) — FX multiplier for India/Regional local currency invoices
  - `child_6_12_package_discount_pct` (`40`) — land package % off for ages 6–12
  - `child_under_6_package_discount_pct` (`100`) — under-6 exempt from land package & SDF
  - `custom_daily_rate_3star_usd` (`220`), `custom_daily_rate_4star_usd` (`295`), `custom_daily_rate_5star_usd` (`490`) — authoritative base nightly rates for self-serve custom estimates (`sdf-calculator.html` → `book.html?custom=1`)
  - `final_payment_due_days` (`30`) — days prior to `travel_date_start` when remaining balance becomes overdue
  - `require_insurance_for_visa` (`1`) — toggle requiring travel insurance doc alongside passport scan + photo

### 3.2 New / Expanded Tables & Columns
Add identically in both `database/schema.sql` (SQLite) and `database/postgres-schema.sql` (PostgreSQL):
1. **`tours` addition**: `price_4star_usd` INTEGER (so `3-Star Heritage`, `4-Star Premium`, `5-Star Luxury` all have explicit Admin-editable tier prices; `price_usd` stays synchronized with `price_3star_usd` for list sorting/display).
2. **`festivals` table** (enables full Admin CMS control of `festivals.html`, `festival-*.html`, and Homepage festival cards):
   - `id`, `name`, `slug`, `season`, `dates_label`, `venue`, `valley`, `duration_days`, `price_usd`, `summary`, `etiquette`, `highlights_json`, `related_tour_id`, `cover_image`, `is_featured`, `is_active`, `sort_order`, `created_at`, `updated_at`
3. **`guide_checkins` table** (replaces audit-only check-in hack with structured daily checkpoint field logs visible to Admin):
   - `id`, `assignment_id`, `booking_id`, `guide_id`, `location`, `weather`, `guest_status`, `notes`, `created_at`
4. **`guides` metadata on `users` table**:
   - Add `license_no`, `languages`, `specialty` columns so Guide Roster (`admin/guides.html`) is database-backed rather than hardcoded text.
5. **Booking, Traveler & Payment additions**:
   - `bookings`: add `discount_usd` (default `0`), `flight_assistance` (`0`/`1`), `nationality_type` (`'international'`|`'india'`), `exchange_rate` (snapshot FX), `payment_plan` (`'deposit_30'`|`'full_100'`), `balance_due_date`, `sdf_remitted_at`, `sdf_remittance_ref`, `visa_rejection_reason`, `cancellation_reason`, `custom_itinerary_json`, `created_by_staff_id`. *(Normalized `*_usd` columns remain authoritative for Finance cross-currency reporting while invoices convert display amounts for `currency = 'INR'` via `exchange_rate` for base + visa and keep exact `₹1,200/night` for INR SDF.)*
   - `payments`: add `currency` (`'USD'`|`'INR'`), `amount_local` INTEGER (authoritative receipt currency), storing normalized USD equivalent in `amount_usd`.
   - `travelers`: add `emergency_contact_name`, `emergency_contact_phone`, `document_notes`.
   - `notifications`: add `whatsapp_url`, `metadata_json`, `error_message` for delivery tracking.

### 3.3 Authoritative Business, Multi-Currency, Visa & RBAC Rules (Locked)
- **Pricing Display & Authoritative Checkout**: `tours.price_usd` stores the land package base (excluding SDF & Visa); public tour cards display both land rate and computed `"All-Inclusive from $X (incl. SDF & Visa)"` so guests never get surprised at checkout. `book.html` calculates SDF + Visa + Tier Price strictly via `POST /api/calculate-sdf` & server-side `POST /api/bookings`. Self-serve `book.html?custom=1` uses `custom_daily_rate_*_usd` from DB settings while Admin `"Book on Behalf"` supports bespoke price/discount overrides.
- **Regional vs International Multi-Currency**: Nationality track (`international` USD vs `india` INR regional permit) is booking-wide for clean single-currency invoicing (`$ USD` vs `₹ INR`). Mixed parties use `Admin Book on Behalf` or separate bookings. Finance KPIs convert INR payments/SDF into USD equivalents (`usd_to_inr_rate`).
- **Visa Compliance & Companion Roster**:
  - **International (COTI)**: Submission (`submitted_to_doi`) & Approval (`approved`) require `full_paid = 1` AND every traveler having `passport_number`, `passport_expiry >= travel_date_end + 6 months`, `date_of_birth`, `nationality`, `passport_scan`, `photo_url`, plus `insurance_doc` when `require_insurance_for_visa = '1'`.
  - **Regional (India/Bangladesh/Maldives)**: Entry Permit requires `full_paid = 1`, ID/passport number, DOB, nationality, ID scan + photo (exempt from 6-month expiry block), and generates an **Official Entry Permit Clearance** notice.
  - **Companion Guests**: `client/documents.html` allows clients to fill/edit traveler slots up to `bookings.total_travelers` and click **"Request Add-On Guest"** (notifies Concierge to adjust group size & invoice in Admin).
- **RBAC Enforcement (`middleware/auth.js`)**:
  - `super_admin`: Full access including Staff Users CRUD, Secrets (SMTP/WhatsApp/Bank/Pricing), Refunds/Deletions, Audit Log
  - `admin`: All Ops (Bookings, Admin-assisted booking, Visa Desk, Guides, Tours, Content CMS, Finance view/record), read-only Secrets/Users
  - `concierge`: Inquiries CRM + Convert, Bookings create/manage, Visa Desk, Notifications, Read Tours/Guides
  - `finance`: Payments ledger, Verify client receipts, Record wires/refunds, SDF batch remittance, Finance CSV & Invoices
  - `guide`: Exclusively `/api/guide/*` & `guide/*` pages (rejected `403` from `/api/admin/*` and `admin/login.html`)
  - `client`: Exclusively `/api/client/*` scoped to authenticated `booking_id`

> [!IMPORTANT]
> **Strict Visual Design & Theme Constraint**: Never alter or degrade the visual aesthetic, colors, typography (`Fraunces`/`Manrope`, `#FFF8EC`/`#0B2A22`/`#C9A24B`), dark slate Admin cards (`#0F172A`/`#1E293B`/`#E05A47`), or subpage dark-emerald layout (`#14231E`/`#E05A47`/`#FBF9F5`). Every page upgrade keeps its existing design intact while fixing dead stubs, inconsistent license/contact copy, and full backend wiring.

---

## 4. Detailed End-to-End Operational Flows

### Flow 1: Public Browse → Tour Page → Multi-Step Booking Checkout (`book.html`) → Confirmation (`booking-confirmed.html`)
1. Traveler lands on `index.html`, `tours.html`, `destinations.html`, or `festivals.html`. All listings hydrate dynamically from `/api/tours`, `/api/destinations`, `/api/festivals`, `/api/reviews`, `/api/settings/public`.
2. Clicking a tour card navigates to `tour-<slug>.html` (or dynamic `tour.html?slug=<id>` if newly created in Admin, with Express routing `/tour-*.html` smoothly to dynamic hydration when a static file doesn't exist).
3. On the tour page, the sidebar **Trip Quick Configurator (`js/booking-widget.js`)** calculates live prices across Hotel Tier (`3-Star Heritage`, `4-Star Premium`, `5-Star Luxury`), Party Count, Nationality (`International` vs `India/Regional`), and Departure Date, and launches **`book.html?tour=<id>&date=...&adults=...&c1=...&c2=...&tier=...&nation=...`** (no redirect to generic contact form).
4. On `book.html` (4-stage guided checkout):
   - **Stage 1**: Confirm Tour (or Custom Bespoke package), Departure Date, Hotel Tier, Nationality Track, and Flight Ticketing Request (`Drukair / Bhutan Airlines`).
   - **Stage 2**: Enter Lead Traveler contact info (Name, Email, WhatsApp Phone with country code, Country, Emergency Contact) + auto-generated **Individual Traveler Cards** for every guest (`adults + children_6_12 + children_under_6`), capturing Name, Gender, Nationality, DOB, Dietary/Medical notes, and optional Passport Number & Expiry Date (live 6-month post-return validity check warning!).
   - **Stage 3**: Live authoritative breakdown pulled via `POST /api/calculate-sdf` (Package base tier + SDF adult/child/exempt/waiver + Visa fee + Deposit vs Full Pay choice + live Cancellation Schedule from `settings`).
   - **Stage 4**: Submits `POST /api/bookings`. Server recomputes pricing authoritatively (never trusts client-submitted totals!), inserts `bookings` + **all** `travelers`, writes `audit_log`, fires `booking_new` notifications (with WhatsApp deep link + Email), returns signed temporary confirmation token + redirects to `booking-confirmed.html?ref=BFR-...`.
5. `booking-confirmed.html` shows Reference ID, Downloadable Invoice, Wire Transfer details, 1-click **"Open WhatsApp Concierge"** pre-filled with Ref ID, and 1-click **"Enter Client Portal & Upload Passports"**.

### Flow 2: Admin "Book on Behalf of Customer" & WhatsApp/Email Automation (`admin/bookings.html`)
1. Travel Manager receives a call or WhatsApp message from a client and opens `admin/bookings.html` -> clicks **"+ Create Client Booking"**.
2. Modal/drawer collects: Source (`whatsapp`, `phone`, `walk_in`, `agent`, `email`), Tour Package (or Custom Bespoke Tour + custom price/days), Departure Date, Party breakdown (`adults`, `children_6_12`, `children_under_6`), Nationality Track, Hotel Tier, Extras USD, Negotiated Discount USD, Lead Name/Email/WhatsApp Phone/Country, Guest Names & Dietary Notes, Optional Initial Deposit Received (Method + Ref + Amount), and checkboxes for **Auto-Notify via WhatsApp** & **Auto-Notify via Email**.
3. `POST /api/admin/bookings` creates `bookings` + `travelers` + optional verified `payments` + `audit_log` (tagged with staff actor).
4. `dispatchBookingConfirmation()` generates a structured confirmation text containing Booking Ref, Itinerary dates, Total/SDF/Balance Due, Bank Wire details, and direct Client Portal link (`client/login.html?ref=...&email=...`), sends via SMTP/WhatsApp API if configured, logs in `notifications`, and returns `whatsapp_share_url` (`https://wa.me/...`).
5. Admin UI immediately pops a **"Client Confirmation Ready"** panel showing the exact message + 1-click **"Open in WhatsApp & Mark Dispatched"** button (`PATCH /api/admin/notifications/:id/sent`) so even without a paid WhatsApp Business API account, the message lands in the client's WhatsApp chat in one click!

### Flow 3: Custom Inquiry CRM → Proposal → Lead-to-Booking Conversion (`contact.html` → `admin/inquiries.html`)
1. `contact.html` and `index.html#custom` submit directly to `POST /api/inquiries` (pre-populating tour/SDF estimate if linked from `sdf-calculator.html` or `destinations.html`), persisting `INQ-YYYY-XXXX` and notifying Admin/Concierge.
2. `admin/inquiries.html` loads live inquiries, supports status progression (`new`, `contacted`, `proposal_sent`, `negotiating`, `converted`, `lost`), concierge assignment, internal notes, WhatsApp/Email reply quick-actions, and **Convert to Booking (`POST /api/admin/inquiries/:id/convert`)** to transition an inquiry directly into a `BFR-YYYY-XXXX` booking with travelers + client notification.

### Flow 4: Client Portal → Auth → Multi-Guest Uploads → Wire Receipt → Printable Letters (`client/*` & `track-visa.html`)
1. `client/login.html` validates `booking_ref + lead_email` via `POST /api/client/auth`, storing signed `bfr_client_token` (`client` JWT role scoped strictly to that `booking_id`).
2. `client/dashboard.html` fetches `GET /api/client/booking` showing real status stepper, balance & payment ledger, official wire instructions, real assigned guide (or `"Guide assignment in progress"`), Client Notification feed, printable Invoice & Official Visa Clearance Letter, payment receipt upload modal (`POST /api/client/payments/receipt`), and **Leave a Verified Review** CTA when trip is `completed`.
3. `client/documents.html` renders all `travelers` on the booking + **"Add Companion Traveler"** + per-traveler form (`passport_number`, `passport_expiry`, `nationality`, `date_of_birth`, `dietary_needs`, `medical_notes`, `passport_scan`, `photo_url`, `insurance_doc`) submitted via `multipart/form-data` to `POST /api/client/travelers/:id/documents`. Runs `checkDocumentReadiness()` immediately—returning clear green badges or exact issues (e.g., `< 6 months validity after departure`). When **all** travelers on the booking pass readiness, `visa_status` auto-advances to `documents_complete` and notifies the concierge!
4. `client/itinerary.html` fetches `GET /api/client/itinerary` and displays the confirmed tour's full day-by-day `itinerary_json`, altitude/accommodations, hotel tier, and guide contact with print styling.
5. `track-visa.html` verifies `ref` + `email` (optional masked status summary or full details when email matches) via `GET /api/bookings/track/:ref` and links to printable Clearance Letter + Client Portal.

### Flow 5: Finance, Verification & SDF Reconciliation (`admin/finance.html` + `admin/booking-detail.html`)
1. Client receipt uploads land as `status = 'pending'` in `payments`.
2. Finance/Admin inspects receipts (`GET /api/admin/documents/payment/:id`), clicks **Verify (`PATCH /api/admin/payments/:id/verify`)** or **Reject** (`failed`), or records manual wire/card/cash/refund via `POST /api/admin/bookings/:id/payments`.
3. Server recalculates `deposit_paid_usd`, sets `full_paid` when balance `<= 0`, advances booking status (`deposit_paid` / `fully_paid`) and visa status (`payment_verified` if `documents_complete`), updates `audit_log`, and sends Client WhatsApp/Email receipt notification.
4. `admin/finance.html` displays live MTD/YTD Revenue, Total SDF Collected vs Remitted/Pending Govt Dues, Pending Receipt Verifications queue, Overdue Balances table, Refunds log, and real CSV export (`bookings-csv` / `finance-csv`).

### Flow 6: DoI Visa Compliance State Machine (`admin/visa-desk.html` + `services/visa-workflow.js`)
Strict backend transitions with guardrails:
- `documents_complete` → `submitted_to_doi`: requires `full_paid === 1` AND **every** traveler in `travelers` passes `checkDocumentReadiness(t, booking.travel_date_end)` (for international COTI; regional requires valid ID/DOB + payment). If missing, API rejects with exact missing traveler/payment details (`HTTP 400`).
- `submitted_to_doi` / `under_review` → `approved` / `clearance_letter_issued`: assigns/records `VCL-YYYY-XXXX-BFR`, dates approval, unlocks printable Clearance Letter (`/api/bookings/:id/clearance-view`), and dispatches Client + Guide WhatsApp/Email notification.
- `under_review` / `submitted_to_doi` → `rejected`: requires `rejection_reason`, reverts `visa_status` to `documents_incomplete`, logs audit event, and notifies Client with exact corrective guidance.

### Flow 7: Guide Dispatch, Field Check-Ins & Post-Trip Review Loop (`admin/guides.html` → `guide/*` → `reviews.html`)
1. `admin/guides.html`: CRUD for licensed guides (license #, languages, specialty, active status) + schedule calendar & workload metrics (`GET /api/admin/guides`).
2. Assigning a guide (`PATCH /api/admin/bookings/:id/assign-guide`) checks overlap against `guide_assignments` for `travel_date_start..end` (returns `409 Conflict` with conflicting booking ID unless override confirmed), updates `bookings` + inserts/updates `guide_assignments`, and notifies Guide & Client. Moving a booking to `confirmed` or `active_trip` requires an assigned guide (`400` compliance check otherwise).
3. Guide logs into `guide/login.html` (`POST /api/guide/auth/login`), views `guide/dashboard.html` (**Today's Trip**, **Upcoming**, **Past**) & `guide/trip-detail.html` (guest dietary/medical notes, emergency contacts, full itinerary, WhatsApp click-to-chat per guest), and posts daily check-ins (`PATCH /api/guide/assignments/:id/checkin` writing to `guide_checkins` + `audit_log` + Admin alert).
4. Marking a trip `completed` triggers a `review_request` notification; Client submits a verified review (`POST /api/client/reviews`); Admin approves/features/replies in `admin/content-cms.html` → appears live on `reviews.html` and `index.html`.

---

## 5. Complete File-by-File Audit & Production Build Specification

### A. Backend Infrastructure, Database & Middleware

| File Path | Current State & Found Problems | Production Target State |
|:----------|:-------------------------------|:------------------------|
| `package.json` | Missing `multer` and `nodemailer`; `test` scripts point to non-existent `scratch/` files | Add `multer` and `nodemailer` (keep `cors`, `dotenv`, `express`, `pg`); fix scripts: `test` -> `node test-crud.js` |
| `server.js` | Mounts 5 route files & `express.static(__dirname)` (exposes raw `.db`/internal paths if placed in root, no upload dirs bootstrap, no dynamic `/tour-*.html` fallback, no error handler) | Ensure `uploads/` subdirs exist on boot; block direct access to `database/*.db`, `uploads/*`, `.env`, `docs/`; add dynamic fallback middleware for Admin-created `/tour-*.html` & `/destination-*.html` & `/festival-*.html`; mount `/api/notifications`; centralized JSON error handler |
| `database/db.js` | Sync SQLite vs Async PG mismatch breaks 100% of PG; naive `?` replacement fails inside string literals; `insertInq` bind count bug (`11` `?`, `12` params); missing `guide_assignments`, `travelers`, `payments`, `festivals`, `notifications` seeding | Expose pure **async** `query(sql, params)`, `get(sql, params)`, `run(sql, params)`, `transaction(fn)`; rewrite PG placeholder converter safely; auto-normalize `RETURNING id` on PG inserts and coerce booleans cleanly; hash seeded user passwords cleanly; seed all tables cleanly |
| `database/schema.sql` | Missing `festivals`, `guide_checkins`, guide columns on `users`, discount/flight/custom_itinerary/rejection fields on `bookings`, whatsapp/metadata columns on `notifications`, emergency contacts on `travelers` | Expand relational SQLite schema identically to target data model with foreign keys & indexes |
| `database/postgres-schema.sql` | Same missing tables/columns + boolean type friction with integer queries | Update tables/columns to match `schema.sql` using consistent types/compatibility so 100% of routes work without engine branching |
| `database/seed.js` | Plaintext passwords; mismatched settings keys (`sdf_rate_international` vs frontend `sdf_usd_adult`); no seeded travelers, payments, guide assignments, festivals, or notifications | Unified settings keys + banking + cancellation rules; hashed staff passwords; 10 tours, 6 destinations, 4 festivals, 5 users (incl. 2 guides, finance, concierge, admin), 3 rich sample bookings with all travelers, payments, guide assignments, notifications, and audit rows |
| `database/setup-postgres.js` | Does not seed `sampleInquiries`, `festivals`, `travelers`, `payments`, `guide_assignments`, or hashed passwords | Complete idempotent PG provisioning + seeding matching SQLite seed data |
| `middleware/auth.js` *(NEW)* | Does not exist — zero server auth/RBAC anywhere | Password hashing (`scryptSync` + `timingSafeEqual`), HMAC-SHA256 JWT sign/verify, `requireAuth()`, `requireRole(...roles)`, `requireClient()`, `requireGuide()` middlewares |
| `middleware/upload.js` *(NEW)* | Does not exist — zero multipart file uploads | `multer` disk storage into `uploads/{passports,insurance,photos,receipts}` with strict extension/MIME allowlist (`jpg/png/pdf`), `5MB` cap, safe randomized filenames |
| `services/sdf-engine.js` | Uses synchronous `db.query`; ignores `discount_usd` and waiver checks gracefully | Make `async calculateSDF(params)`; use unified `settings` keys; support international/india breakdown, child tiers, promos/waivers |
| `services/visa-workflow.js` | `canAdvanceTo` allows jumping straight to `approved` without `full_paid` or doc check; references nonexistent `/api/bookings/clearance-pdf/:id` | Make `checkBookingCompliance(booking, travelers)` enforce 6-month passport validity, all-traveler readiness, `full_paid`, and clean stage transitions; point clearance URL to live `/api/bookings/:id/clearance-view` |
| `services/notification-service.js` | Unused anywhere; returns fake channels; no SMTP, no WhatsApp URL/webhook support | Export `async dispatchNotification(event, payload)` persisting to `notifications`, building pre-filled `wa.me` links, triggering optional SMTP via `nodemailer` & optional WhatsApp webhook from `settings` |
| `services/document-templates.js` *(NEW)* | No invoice or visa clearance renderer exists | Server-rendered, print-ready HTML **Official Tax Invoice / Payment Receipt** & **Official Visa Clearance Letter (`VCL-...`)** using live company + bank settings |
| `routes/public.js` | Synchronous DB calls; no `/festivals` or `/bookings/clearance-pdf` support; `reviews` doesn't return averages | Async DB conversion; `GET /tours`, `/tours/:slug`, `/destinations`, `/destinations/:id`, `/festivals`, `/festivals/:id`, `/reviews` (+ stats), `/settings/public` (sanitized non-secret public fields), `POST /calculate-sdf`, `POST /inquiries` (using notification hub) |
| `routes/bookings.js` | Sync DB calls; only inserts 1 `travelers` row regardless of group size; doesn't validate server totals against tiers; unguarded `/track/:ref` leaks info; no clearance view endpoint | Async DB; server-computed prices + creating ALL `travelers` records; transactional insert + confirmation dispatch + `whatsapp_share_url`; `GET /track/:ref` (requiring email when not accessed via signed link or masking sensitive fields); printable `/clearance-view` & `/invoice-view` (token/email gated) |
| `routes/client.js` | Unauthenticated; missing `GET /booking`, `/itinerary`, `/payments`, `/notifications`, receipt upload, traveler creation, file uploads, and post-trip review submission | Protected by `requireClient()`; full REST endpoints for dashboard, traveler management, multipart document uploads + auto visa advancement, payment receipt upload, notifications read, invoice/clearance view, and verified review submission |
| `routes/guide.js` | Crashes on SQL `"guide"` double-quotes; unauthenticated (`guide_id \|\| 3` param trust); audit-only check-in | Protected by `requireGuide()`; fix `'guide'` SQL + scrypt check; full `/assignments` (active/upcoming/past), `/assignments/:id` roster + itinerary, `/assignments/:id/checkin` into `guide_checkins`, and `/notifications` |
| `routes/admin.js` | Completely unauthenticated; missing admin booking creation ("on behalf of customer"), inquiry conversion, payments ledger & verify, guide CRUD, review moderation, destination/festival CRUD, staff user CRUD, notification actions, invoice/clearance views | Protected by `requireAuth()` + role guards (`requireRole(...)`); complete CRUD & workflow endpoints covering all 7 business flows and Admin CMS |
| `routes/notifications.js` *(NEW)* | Notification actions scattered or missing | Dedicated `GET /api/notifications`, `PATCH /:id/read`, `PATCH /read-all`, `PATCH /:id/sent`, `POST /send-whatsapp-email` shared neatly |

### B. Admin Panel (`admin/`)

| File Path | Current State & Found Problems | Production Target State |
|:----------|:-------------------------------|:------------------------|
| `admin/css/admin-theme.css` | Basic styles only; missing print rules & toast/badge styling helpers | Keep dark slate + coral `#E05A47` theme + light-input protection; add responsive modal/stepper/chart bar styles |
| `admin/js/admin-app.js` | Doesn't inject `Authorization` token; doesn't show live unread notification badge in sidebar/header; minimal role awareness | Validate session via `/api/admin/auth/me`; show live unread notification bell + role-filtered sidebar items (`Inquiries`, `Guides`, `Content CMS` link for Destinations/Festivals/Reviews, `Finance`, `Settings & Users`, `Audit Trail`); global `apiFetch` helpers |
| `admin/login.html` | Submits login but doesn't redirect existing valid sessions cleanly or show role hints nicely | Live JWT login via `ApiClient.adminLogin()`, persists token/user, checks `?next=` redirect |
| `admin/dashboard.html` | **Static fake numbers (`$84,600`, `24`)**; zero API calls | Live KPI cards (`getAdminStats()`), interactive monthly revenue & pipeline breakdown bars, today's guide field check-ins panel, pending visa/verification alerts, and live audit stream |
| `admin/bookings.html` | Read/filter/export only; **cannot create booking on behalf of caller/WhatsApp customer** | Live table + status/source/search filters + **"+ Book on Behalf of Client" drawer/modal** (with WhatsApp/Email instant confirmation dispatch) + CSV export + quick status badges |
| `admin/booking-detail.html` | Hardcoded guides `3/4`; toast-only Clearance button; hides travelers, uploaded passport previews, payment history, internal notes, audit log | Complete 6-section command center: Traveler Roster + Passport Readiness & Safe Document Viewer, Visa Compliance State Machine + Rejection Reason + Printable Clearance Letter, Guide Dispatch (with conflict detection), Full Payment Ledger + Verify/Refund + Printable Invoice, Direct WhatsApp/Email Client Messenger, and Audit Timeline |
| `admin/visa-desk.html` | Allows skipping payment & doc checks; no rejection reason input; view letter links externally | Enforced compliance readiness indicators (`Payment ✓/✗`, `Passports ✓/✗`), Submit to DoI, Approve with clearance number, Reject with mandatory reason modal, Batch Submit (eligible only), and direct Clearance Letter print view |
| `admin/tours-manager.html` | Missing day-by-day itinerary builder, 3★/5★ tier pricing inputs, and inclusions editing; new tour links 404 | Full Tour Builder modal with dynamic Day 1..N Itinerary Editor, 3★/4★/5★ prices, inclusions/exclusions editor, image picker, live preview link |
| `admin/inquiries.html` | **100% static HTML** (`Claire Dupont`); no actions | Live CRM table/pipeline, filter by status, detail drawer with internal notes & follow-up date, 1-click WhatsApp reply, and **"Convert Lead → Live Booking"** flow |
| `admin/guides.html` | **100% static HTML** (`+ Register Certified Guide` = toast stub) | Live guide roster cards + **Create/Edit/Deactivate Guide modal** + live upcoming assignment calendar & date availability status |
| `admin/content-cms.html` *(NEW)* | No Admin CMS exists for Destinations, Festivals, or Reviews | Tabbed Admin CMS controlling **Destinations** (CRUD + valley metadata), **Festivals** (CRUD + dates + featured tour link), and **Traveler Reviews Moderation** (verify, feature on homepage, hide, post operator reply) |
| `admin/finance.html` | **100% static HTML** (`$22,400`); toast-only export | Live Financial & SDF Reconciliation dashboard: Revenue metrics, SDF Collected vs Remitted tracker, **Pending Client Receipts Approval Queue**, Unpaid Balances follow-up (with 1-click WhatsApp payment reminder), and real CSV ledger export |
| `admin/notifications.html` | **100% static HTML**; toast-only Mark All Read | Live notification inbox, Mark Read / Mark All Read, WhatsApp Pending Dispatch queue (1-click `wa.me` send + mark sent), and **Manual Client Notification / Broadcast composer** |
| `admin/settings.html` | Wrong SDF/contact keys (`sdf_usd_adult`); bank wire inputs ignored; no SMTP/WhatsApp/cancellation rules or staff user management | Unified canonical rate/policy/contact/banking/SMTP/WhatsApp form (saving cleanly via upsert) + **Test Email/WhatsApp Preview** + **`super_admin` Staff Users & Roles CRUD table** |
| `admin/audit-log.html` | **100% static HTML** (3 fake rows) | Live filterable/searchable immutable audit log table pulling `/api/admin/audit-log` + JSON old/new state inspector + CSV export |

### C. Client & Guide Portals

| File Path | Current State & Found Problems | Production Target State |
|:----------|:-------------------------------|:------------------------|
| `client/login.html` | Ignores email check & skips `/api/client/auth` | Calls `POST /api/client/auth` (verifies `booking_ref + lead_email`), supports URL auto-fill (`?ref=...&email=...`) from WhatsApp confirmation links, stores signed JWT |
| `client/dashboard.html` | Defaults unauthenticated users to `BFR-2026-8841`, fakes guide name, missing receipt upload, invoice/clearance buttons, review form | Auth-guarded dashboard showing live booking/visa progress stepper, itemized invoice + Wire instructions from `settings` + upload payment receipt form, real guide info (only if assigned), notification alerts, Printable Invoice & Visa Clearance buttons, and Post-Trip Review submission once `completed` |
| `client/documents.html` | **100% static HTML** (`Dr. Evelyn Martinez`) | Auth-guarded multi-traveler compliance hub: lists every guest, shows real 6-month expiry readiness indicators, accepts real `multipart/form-data` uploads (Passport Bio Scan, Photo, Travel Insurance), allows updating/adding companion travelers, auto-updates booking visa stage |
| `client/itinerary.html` | **100% static 2-day HTML** | Auth-guarded day-by-day schedule loaded live from `GET /api/client/itinerary` (tour `itinerary_json` / custom booking itinerary), hotel tier, guide contacts, print-to-PDF support |
| `guide/login.html` | Skips `/api/guide/auth/login` | Calls fixed `POST /api/guide/auth/login`, stores signed Guide JWT (`role = 'guide'`) |
| `guide/dashboard.html` | **100% static HTML**; `Check-In` triggers browser `alert()` | Auth-guarded dashboard rendering Today's Active Assignment, Upcoming Departures, and Completed Trips from `GET /api/guide/assignments`, with real **Daily Field Check-In form** (`location`, `weather`, `guest_status`, `notes`) submitting to `PATCH /api/guide/assignments/:id/checkin` |
| `guide/trip-detail.html` | **100% static HTML** | Auth-guarded view reading `?id=...` via `GET /api/guide/assignments/:id`: guest roster, dietary/medical notes, emergency contacts, WhatsApp click-to-message guest buttons, full daily itinerary, and past check-in history log |

### D. Public Website, Shared JS & Root Pages

| File Path | Current State & Found Problems | Production Target State |
|:----------|:-------------------------------|:------------------------|
| `js/api-client.js` | Missing Bearer auth header injection; missing endpoints (`bookings/admin create`, `finance`, `guides CRUD`, `festivals`, `reviews`, `users`, `client portal`, `guide portal`, `notifications read`); mismatched `getPublicSettings` keys; unsafe silent `LocalStorage` booking fallback & hardcoded `admin123` | Strict HTTP REST client attaching `Authorization: Bearer <token>` per portal (`bfr_admin_token`, `bfr_client_token`, `bfr_guide_token`), multipart FormData upload helper, retry/error reporting on unreachable server, **zero** fake `LocalStorage` booking/auth fallback over HTTP and **zero** embedded credentials (optional read-only catalog preview only if opened via `file://`) |
| `js/site-shell.js` *(NEW)* | Pages have minor license/email inconsistencies (`#BT-8842` vs `#TR/2018/9882`, `tours@` vs `reservations@`, missing Client/Guide portal links) | Theme-preserving DOM hydrator (keeps each page's exact cream/gold OR `tour-theme.css` `#14231E`/`#E05A47` layout/colors untouched!) that synchronizes canonical `company_name`, `company_license`, `company_email`, `company_phone`, `company_whatsapp` from `/api/settings/public` and injects subtle portal links (`Client Portal`, `Track Visa`) without changing page aesthetics |
| `js/booking-widget.js` | Built once, loaded nowhere; calculates hardcoded `$100` SDF & ignores tier pricing (`price_3star_usd`/`price_5star_usd`) and India rate (`INR`) | Enhanced tour sidebar widget loaded on ALL tour detail pages (`tour-*.html` & `tour.html`): fetches live settings + tour tier rates (`price_3star_usd`, `price_4star_usd`, `price_5star_usd`), computes preview SDF/Visa in USD or INR, and opens dedicated `book.html` checkout with pre-selected parameters |
| `js/main.js` | Legacy unused hardcoded `TOURS_DATA` + stub `bookingModalForm` toast | Replace/retire dead `TOURS_DATA` & fake modal toast cleanly so zero unused hardcoded catalog script remains |
| `index.html` | 236KB static React prototype (`"local preview only"`, fake Trip Plan shopping cart that redirects to inquiry form, 0 API calls) | Extract exact visual design & CSS styles intact, power homepage via clean `js/home-app.js` hydrated dynamically from `/api/tours`, `/api/destinations`, `/api/festivals`, `/api/reviews`, `/api/settings/public`; replace fake shopping cart & `"local preview only"` strings with direct navigation (`tour-*.html`, `book.html?tour=...`, `destination-*.html`, `festival-*.html`) and real `POST /api/inquiries` + `POST /api/newsletter` |
| `app.html` | 237KB duplicate React bundle artifact from earlier edit | Remove or replace with clean redirect/minimal alias cleanly after verification (keep git history clean, zero broken links) |
| `tours.html` | API-wired cards, **but** modal/cards link to `contact.html` instead of `book.html` checkout; hardcoded category counts | Keep existing cream/forest/gold design untouched; sync footer/license via `site-shell.js`; keep search/category/duration/sort filters; update card/modal CTAs: **Full Itinerary (`tour-*.html`)** and **Book Now (`book.html?tour=<id>`)** |
| `tour.html` *(NEW)* + 10 × `tour-*.html` | 8 older files don't even load `api-client.js`; none load `booking-widget.js`; static prices/itineraries; newly created admin tours 404 | Shared `js/tour-detail.js` loaded by both `tour.html?slug=...` (Express dynamic fallback for any new admin tour!) and all 10 `tour-*.html` SEO pages: preserves exact `tour-theme.css` layout while hydrating live DB price/tiers/itinerary/inclusions/status and embedding live `BookingWidget` -> routes directly to `book.html` checkout |
| `book.html` *(NEW)* | Does not exist (bookings previously bounced into `contact.html` inquiry or `alert()` modal) | Dedicated 4-step **Tour Reservation & Traveler Checkout Page** (styled in exact `--cream`/`#0B2A22`/`#C9A24B` brand palette with strict `color-scheme: light !important` inputs) collecting dates, hotel tier, nationality, full traveler party details, live SDF/visa math, payment mode & terms acceptance, submitting to `POST /api/bookings` |
| `booking-confirmed.html` *(NEW)* | Does not exist | Confirmation receipt page after booking creation: Ref `BFR-...`, itemized invoice summary, Bank Wire details, 1-click **WhatsApp Concierge Handoff**, 1-click **Open Client Portal (`client/dashboard.html`)** |
| `destinations.html` + 6 × `destination-*.html` | Static HTML ignoring Admin edits; inconsistent headers | Hydrate valleys & related Valley Tours dynamically from `/api/destinations` + `/api/tours`; replace `contact.html?tour=Custom-...` CTAs with clean destination tour links + tailored inquiry/checkout links; unified `site-shell.js` |
| `festivals.html` + 4 × `festival-*.html` | Static HTML; dates/prices disconnected from DB | Hydrate live festival calendar & linked festival packages from `/api/festivals` + `/api/tours`; offer direct **"Book Festival Departure (`book.html?tour=...`)"** or **"Request Dates (`contact.html`)"**; unified `site-shell.js` |
| `sdf-calculator.html` | Stray `</script>` bug (`L254`), wrong setting keys, `$200`/`₹6000` hardcoded estimate multiplier | Fix script syntax, fetch live `/api/settings/public` & `/api/calculate-sdf`, wire **"Book With This Estimate (`book.html`)"** and **"Get Custom Proposal (`contact.html`)"** passing exact nights/guests/nation |
| `services.html` | Has duplicate hardcoded calculator (`L400-470`) ignoring Admin settings | Replace hardcoded math with live `/api/settings/public` & `/api/calculate-sdf` + consistent `site-shell.js` navigation |
| `contact.html` | **`#inquiryForm` never submits to backend (`L431-436`)**; hardcoded tour options | Wire form submit to `ApiClient.submitInquiry()` (`POST /api/inquiries`), load live active tour options from `/api/tours`, read URL params (`?tour=`, `?nights=`, `?adults=`, etc.), display real `INQ-YYYY-XXXX` ref + 1-click **WhatsApp Chat with Pre-filled Inquiry** |
| `track-visa.html` | Exposes booking details for `BFR-2026-8841` on page load with no email guard; lacks printable clearance link | Require Booking Ref + Email lookup (or friendly sample prompt requiring confirmation), show live progress timeline + official printable Clearance Letter button + **"Sign Into Full Client Portal"** button |
| `reviews.html` | Static 2 hardcoded reviews; ignores `/api/reviews` | Fetch live published reviews + aggregate stats from `GET /api/reviews` (filtering by rating/featured) + CTA linking completed-trip travelers to submit verified reviews in `client/dashboard.html` |
| `faq.html` | Only 3 static Q&As despite claiming 40+; no search/accordion | Interactive categorized FAQ accordion (Visas, SDF Tax, Health & Altitude, Flights, Trekking, Payments & Cancellation) + search filter + dynamic SDF/visa numbers hydrated from `/api/settings/public` |
| `about.html`, `visa-guide.html`, `packing-guide.html`, `terms.html`, `privacy.html` | Static company contact/license/cancellation numbers diverge across files | Unify navigation/footer via `site-shell.js` and dynamically bind live SDF rates, visa fee, cancellation notice windows (`cancellation_free_days`), license `#TR/2018/9882`, and contact channels from `/api/settings/public` |

---

## 6. Verification & Acceptance Criteria

Every phase in implementation will be verified cleanly before proceeding:
1. **API & Workflow Integration Suite (`test-crud.js`)**: Automated end-to-end verification covering Admin Auth/RBAC rejection (`401/403` on unauthorized access), Tour CRUD + dynamic slug resolution, Destination/Festival CMS CRUD, SDF/Settings upsert parity, Public multi-guest Booking Checkout, Admin "Book on Behalf of Client" + WhatsApp confirmation payload, Inquiry CRM + Convert-to-Booking, Client Portal Auth + Multipart Passport Upload + 6-month expiry block, Finance Receipt Verification, Visa Compliance Guardrails (`400` if unpaid or missing docs; clearance issuance when valid), Guide Assignment Conflict Detection (`409` on overlapping dates) + Field Check-in, Post-Trip Review Flow, Audit Trail, and Clean DB cleanup.
2. **PostgreSQL Dual-Engine Verification**: Exported schema + seed parity runner (`database/setup-postgres.js` + async route verification tests verifying query compatibility without PG driver errors).
3. **Browser / DOM End-to-End Smoke Verification**: Start Express server, verify 0 broken links across all HTML pages, 0 console/runtime JS errors across public + admin + client + guide pages, and mobile/desktop usability (`color-scheme: light !important` input contrast preserved).
