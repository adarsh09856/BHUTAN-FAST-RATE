-- ============================================================
-- BHUTAN FAST RATE TOURS - PRODUCTION RELATIONAL SCHEMA
-- ============================================================

-- 1. Users (Admin, Concierge, Guides)
CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    uuid          TEXT UNIQUE NOT NULL,
    full_name     TEXT NOT NULL,
    email         TEXT UNIQUE NOT NULL,
    phone         TEXT,
    password_hash TEXT NOT NULL,
    role          TEXT NOT NULL CHECK(role IN ('super_admin','admin','concierge','guide','finance')),
    avatar_url    TEXT,
    is_active     INTEGER DEFAULT 1,
    last_login    DATETIME,
    created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at    DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 2. Tour Packages Catalog
CREATE TABLE IF NOT EXISTS tours (
    id              TEXT PRIMARY KEY,
    title           TEXT NOT NULL,
    slug            TEXT UNIQUE NOT NULL,
    subtitle        TEXT,
    duration_days   INTEGER NOT NULL,
    duration_nights INTEGER NOT NULL,
    category        TEXT NOT NULL,
    difficulty      TEXT DEFAULT 'Easy',
    group_size_min  INTEGER DEFAULT 1,
    group_size_max  INTEGER DEFAULT 20,
    price_usd       INTEGER NOT NULL,
    price_3star_usd INTEGER,
    price_5star_usd INTEGER,
    valleys         TEXT NOT NULL,
    highlight_text  TEXT,
    cover_image     TEXT,
    itinerary_json  TEXT NOT NULL,
    inclusions_json TEXT NOT NULL,
    exclusions_json TEXT,
    is_featured     INTEGER DEFAULT 0,
    is_active       INTEGER DEFAULT 1,
    sort_order      INTEGER DEFAULT 0,
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 3. Bookings & Reservations
CREATE TABLE IF NOT EXISTS bookings (
    id                    TEXT PRIMARY KEY,
    tour_id               TEXT,
    tour_title            TEXT NOT NULL,
    is_custom_trip        INTEGER DEFAULT 0,
    lead_name             TEXT NOT NULL,
    lead_email            TEXT NOT NULL,
    lead_phone            TEXT NOT NULL,
    lead_country          TEXT NOT NULL,
    lead_passport_no      TEXT,
    lead_passport_expiry  DATE,
    travel_date_start     DATE NOT NULL,
    travel_date_end       DATE NOT NULL,
    total_nights          INTEGER NOT NULL,
    total_travelers       INTEGER NOT NULL,
    adults_count          INTEGER NOT NULL DEFAULT 1,
    children_6_12         INTEGER DEFAULT 0,
    children_under_6      INTEGER DEFAULT 0,
    hotel_tier            TEXT DEFAULT '4-Star Premium',
    base_price_usd        INTEGER NOT NULL,
    sdf_total_usd         INTEGER NOT NULL,
    visa_fee_usd          INTEGER DEFAULT 40,
    extras_usd            INTEGER DEFAULT 0,
    total_price_usd       INTEGER NOT NULL,
    currency              TEXT DEFAULT 'USD',
    deposit_paid_usd      INTEGER DEFAULT 0,
    full_paid             INTEGER DEFAULT 0,
    booking_status        TEXT NOT NULL DEFAULT 'inquiry',
    visa_status           TEXT DEFAULT 'not_started',
    visa_clearance_number TEXT,
    visa_submitted_date   DATE,
    visa_approved_date    DATE,
    assigned_guide_id     INTEGER,
    assigned_vehicle      TEXT,
    special_requests      TEXT,
    internal_notes        TEXT,
    source                TEXT DEFAULT 'website',
    created_at            DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at            DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(tour_id) REFERENCES tours(id),
    FOREIGN KEY(assigned_guide_id) REFERENCES users(id)
);

-- 4. Individual Travelers (Per Booking)
CREATE TABLE IF NOT EXISTS travelers (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    booking_id      TEXT NOT NULL,
    full_name       TEXT NOT NULL,
    passport_number TEXT,
    passport_expiry DATE,
    nationality     TEXT NOT NULL,
    date_of_birth   DATE,
    age_category    TEXT DEFAULT 'adult',
    gender          TEXT,
    passport_scan   TEXT,
    insurance_doc   TEXT,
    photo_url       TEXT,
    dietary_needs   TEXT,
    medical_notes   TEXT,
    sdf_rate_usd    INTEGER,
    visa_status     TEXT DEFAULT 'pending',
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(booking_id) REFERENCES bookings(id)
);

-- 5. Inquiries & Custom Trip Leads
CREATE TABLE IF NOT EXISTS inquiries (
    id                   INTEGER PRIMARY KEY AUTOINCREMENT,
    ref_code             TEXT UNIQUE,
    name                 TEXT NOT NULL,
    email                TEXT NOT NULL,
    phone                TEXT,
    country              TEXT,
    preferred_dates      TEXT,
    duration_days        INTEGER,
    travelers_count      INTEGER,
    budget_range         TEXT,
    interests            TEXT,
    message              TEXT NOT NULL,
    source               TEXT DEFAULT 'website',
    status               TEXT DEFAULT 'new',
    assigned_to          INTEGER,
    converted_booking_id TEXT,
    internal_notes       TEXT,
    created_at           DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at           DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(assigned_to) REFERENCES users(id)
);

-- 6. Financial Ledger & Payments
CREATE TABLE IF NOT EXISTS payments (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    booking_id      TEXT NOT NULL,
    amount_usd      INTEGER NOT NULL,
    payment_type    TEXT,
    payment_method  TEXT,
    transaction_ref TEXT,
    receipt_file    TEXT,
    status          TEXT DEFAULT 'pending',
    verified_by     INTEGER,
    verified_at     DATETIME,
    notes           TEXT,
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(booking_id) REFERENCES bookings(id),
    FOREIGN KEY(verified_by) REFERENCES users(id)
);

-- 7. Guide & Field Assignments
CREATE TABLE IF NOT EXISTS guide_assignments (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    guide_id       INTEGER NOT NULL,
    booking_id     TEXT NOT NULL,
    start_date     DATE NOT NULL,
    end_date       DATE NOT NULL,
    vehicle_plate  TEXT,
    driver_name    TEXT,
    daily_rate_usd INTEGER,
    status         TEXT DEFAULT 'scheduled',
    guide_notes    TEXT,
    created_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(guide_id) REFERENCES users(id),
    FOREIGN KEY(booking_id) REFERENCES bookings(id)
);

-- 8. Notifications Hub
CREATE TABLE IF NOT EXISTS notifications (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    recipient_type TEXT,
    recipient_id   TEXT,
    channel        TEXT,
    category       TEXT,
    title          TEXT NOT NULL,
    message        TEXT NOT NULL,
    action_url     TEXT,
    is_read        INTEGER DEFAULT 0,
    is_sent        INTEGER DEFAULT 0,
    sent_at        DATETIME,
    created_at     DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 9. Reviews & Testimonials
CREATE TABLE IF NOT EXISTS reviews (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    booking_id     TEXT,
    author_name    TEXT NOT NULL,
    author_country TEXT NOT NULL,
    author_avatar  TEXT,
    tour_taken     TEXT,
    travel_date    DATE,
    rating         INTEGER DEFAULT 5,
    title          TEXT,
    comment        TEXT NOT NULL,
    is_verified    INTEGER DEFAULT 1,
    is_featured    INTEGER DEFAULT 0,
    is_published   INTEGER DEFAULT 1,
    admin_response TEXT,
    created_at     DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 10. Destinations (Valleys)
CREATE TABLE IF NOT EXISTS destinations (
    id              TEXT PRIMARY KEY,
    name            TEXT NOT NULL,
    slug            TEXT UNIQUE NOT NULL,
    tagline         TEXT,
    altitude_meters INTEGER,
    region          TEXT,
    description     TEXT NOT NULL,
    highlights_json TEXT,
    best_months     TEXT,
    cover_image     TEXT,
    sort_order      INTEGER DEFAULT 0,
    is_active       INTEGER DEFAULT 1
);

-- 11. System Configuration & Settings
CREATE TABLE IF NOT EXISTS settings (
    key         TEXT PRIMARY KEY,
    value       TEXT NOT NULL,
    category    TEXT,
    description TEXT,
    updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 12. Immutable Audit Trail
CREATE TABLE IF NOT EXISTS audit_log (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     INTEGER,
    user_name   TEXT,
    user_role   TEXT,
    action      TEXT NOT NULL,
    entity_type TEXT,
    entity_id   TEXT,
    old_value   TEXT,
    new_value   TEXT,
    ip_address  TEXT,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);
