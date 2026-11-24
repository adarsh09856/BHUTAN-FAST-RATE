-- ============================================================
-- BHUTAN FAST RATE TOURS - PRODUCTION POSTGRESQL SCHEMA
-- Compatible with PostgreSQL 14+, Supabase, Neon, AWS RDS
-- ============================================================

CREATE TABLE IF NOT EXISTS users (
    id            SERIAL PRIMARY KEY,
    uuid          VARCHAR(64) UNIQUE NOT NULL DEFAULT gen_random_uuid(),
    full_name     VARCHAR(255) NOT NULL,
    email         VARCHAR(255) UNIQUE NOT NULL,
    phone         VARCHAR(50),
    password_hash VARCHAR(255) NOT NULL,
    role          VARCHAR(50) NOT NULL CHECK(role IN ('super_admin','admin','concierge','guide','finance')),
    avatar_url    TEXT,
    is_active     BOOLEAN DEFAULT TRUE,
    last_login    TIMESTAMPTZ,
    created_at    TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at    TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tours (
    id              VARCHAR(100) PRIMARY KEY,
    title           VARCHAR(255) NOT NULL,
    slug            VARCHAR(255) UNIQUE NOT NULL,
    subtitle        TEXT,
    duration_days   INTEGER NOT NULL,
    duration_nights INTEGER NOT NULL,
    category        VARCHAR(100) NOT NULL,
    difficulty      VARCHAR(50) DEFAULT 'Easy',
    group_size_min  INTEGER DEFAULT 1,
    group_size_max  INTEGER DEFAULT 20,
    price_usd       INTEGER NOT NULL,
    price_3star_usd INTEGER,
    price_5star_usd INTEGER,
    valleys         TEXT NOT NULL,
    highlight_text  TEXT,
    cover_image     TEXT,
    itinerary_json  JSONB NOT NULL DEFAULT '[]'::jsonb,
    inclusions_json JSONB NOT NULL DEFAULT '[]'::jsonb,
    exclusions_json JSONB DEFAULT '[]'::jsonb,
    is_featured     BOOLEAN DEFAULT FALSE,
    is_active       BOOLEAN DEFAULT TRUE,
    sort_order      INTEGER DEFAULT 0,
    created_at      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS bookings (
    id                    VARCHAR(50) PRIMARY KEY,
    tour_id               VARCHAR(100) REFERENCES tours(id) ON DELETE SET NULL,
    tour_title            VARCHAR(255) NOT NULL,
    is_custom_trip        BOOLEAN DEFAULT FALSE,
    lead_name             VARCHAR(255) NOT NULL,
    lead_email            VARCHAR(255) NOT NULL,
    lead_phone            VARCHAR(50) NOT NULL,
    lead_country          VARCHAR(100) NOT NULL,
    lead_passport_no      VARCHAR(50),
    lead_passport_expiry  DATE,
    travel_date_start     DATE NOT NULL,
    travel_date_end       DATE NOT NULL,
    total_nights          INTEGER NOT NULL,
    total_travelers       INTEGER NOT NULL,
    adults_count          INTEGER NOT NULL DEFAULT 1,
    children_6_12         INTEGER DEFAULT 0,
    children_under_6      INTEGER DEFAULT 0,
    hotel_tier            VARCHAR(50) DEFAULT '4-Star Premium',
    base_price_usd        INTEGER NOT NULL,
    sdf_total_usd         INTEGER NOT NULL,
    visa_fee_usd          INTEGER DEFAULT 40,
    extras_usd            INTEGER DEFAULT 0,
    total_price_usd       INTEGER NOT NULL,
    currency              VARCHAR(10) DEFAULT 'USD',
    deposit_paid_usd      INTEGER DEFAULT 0,
    full_paid             BOOLEAN DEFAULT FALSE,
    booking_status        VARCHAR(50) NOT NULL DEFAULT 'inquiry',
    visa_status           VARCHAR(50) DEFAULT 'not_started',
    visa_clearance_number VARCHAR(100),
    visa_submitted_date   DATE,
    visa_approved_date    DATE,
    assigned_guide_id     INTEGER REFERENCES users(id) ON DELETE SET NULL,
    assigned_vehicle      VARCHAR(100),
    special_requests      TEXT,
    internal_notes        TEXT,
    source                VARCHAR(50) DEFAULT 'website',
    created_at            TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at            TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS travelers (
    id              SERIAL PRIMARY KEY,
    booking_id      VARCHAR(50) REFERENCES bookings(id) ON DELETE CASCADE,
    full_name       VARCHAR(255) NOT NULL,
    passport_number VARCHAR(50),
    passport_expiry DATE,
    nationality     VARCHAR(100) NOT NULL,
    date_of_birth   DATE,
    age_category    VARCHAR(50) DEFAULT 'adult',
    gender          VARCHAR(20),
    passport_scan   TEXT,
    insurance_doc   TEXT,
    photo_url       TEXT,
    dietary_needs   TEXT,
    medical_notes   TEXT,
    sdf_rate_usd    INTEGER,
    visa_status     VARCHAR(50) DEFAULT 'pending',
    created_at      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS inquiries (
    id                   SERIAL PRIMARY KEY,
    ref_code             VARCHAR(50) UNIQUE,
    name                 VARCHAR(255) NOT NULL,
    email                VARCHAR(255) NOT NULL,
    phone                VARCHAR(50),
    country              VARCHAR(100),
    preferred_dates      VARCHAR(100),
    duration_days        INTEGER,
    travelers_count      INTEGER,
    budget_range         VARCHAR(50),
    interests            TEXT,
    message              TEXT NOT NULL,
    source               VARCHAR(50) DEFAULT 'website',
    status               VARCHAR(50) DEFAULT 'new',
    assigned_to          INTEGER REFERENCES users(id) ON DELETE SET NULL,
    converted_booking_id VARCHAR(50) REFERENCES bookings(id) ON DELETE SET NULL,
    internal_notes       TEXT,
    created_at           TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at           TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS payments (
    id              SERIAL PRIMARY KEY,
    booking_id      VARCHAR(50) REFERENCES bookings(id) ON DELETE CASCADE,
    amount_usd      INTEGER NOT NULL,
    payment_type    VARCHAR(50),
    payment_method  VARCHAR(50),
    transaction_ref VARCHAR(100),
    receipt_file    TEXT,
    status          VARCHAR(50) DEFAULT 'pending',
    verified_by     INTEGER REFERENCES users(id) ON DELETE SET NULL,
    verified_at     TIMESTAMPTZ,
    notes           TEXT,
    created_at      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS guide_assignments (
    id             SERIAL PRIMARY KEY,
    guide_id       INTEGER REFERENCES users(id) ON DELETE CASCADE,
    booking_id     VARCHAR(50) REFERENCES bookings(id) ON DELETE CASCADE,
    start_date     DATE NOT NULL,
    end_date       DATE NOT NULL,
    vehicle_plate  VARCHAR(50),
    driver_name    VARCHAR(255),
    daily_rate_usd INTEGER,
    status         VARCHAR(50) DEFAULT 'scheduled',
    guide_notes    TEXT,
    created_at     TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS notifications (
    id             SERIAL PRIMARY KEY,
    recipient_type VARCHAR(50),
    recipient_id   VARCHAR(255),
    channel        VARCHAR(50),
    category       VARCHAR(50),
    title          VARCHAR(255) NOT NULL,
    message        TEXT NOT NULL,
    action_url     TEXT,
    is_read        BOOLEAN DEFAULT FALSE,
    is_sent        BOOLEAN DEFAULT FALSE,
    sent_at        TIMESTAMPTZ,
    created_at     TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS reviews (
    id             SERIAL PRIMARY KEY,
    booking_id     VARCHAR(50) REFERENCES bookings(id) ON DELETE SET NULL,
    author_name    VARCHAR(255) NOT NULL,
    author_country VARCHAR(100) NOT NULL,
    author_avatar  TEXT,
    tour_taken     VARCHAR(255),
    travel_date    DATE,
    rating         INTEGER DEFAULT 5 CHECK(rating BETWEEN 1 AND 5),
    title          VARCHAR(255),
    comment        TEXT NOT NULL,
    is_verified    BOOLEAN DEFAULT TRUE,
    is_featured    BOOLEAN DEFAULT FALSE,
    is_published   BOOLEAN DEFAULT TRUE,
    admin_response TEXT,
    created_at     TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS destinations (
    id              VARCHAR(50) PRIMARY KEY,
    name            VARCHAR(255) NOT NULL,
    slug            VARCHAR(255) UNIQUE NOT NULL,
    tagline         TEXT,
    altitude_meters INTEGER,
    region          VARCHAR(50),
    description     TEXT NOT NULL,
    highlights_json JSONB DEFAULT '[]'::jsonb,
    best_months     VARCHAR(100),
    cover_image     TEXT,
    sort_order      INTEGER DEFAULT 0,
    is_active       BOOLEAN DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS settings (
    key         VARCHAR(100) PRIMARY KEY,
    value       TEXT NOT NULL,
    category    VARCHAR(50),
    description TEXT,
    updated_at  TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS audit_log (
    id          SERIAL PRIMARY KEY,
    user_id     INTEGER,
    user_name   VARCHAR(255),
    user_role   VARCHAR(50),
    action      VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50),
    entity_id   VARCHAR(100),
    old_value   TEXT,
    new_value   TEXT,
    ip_address  VARCHAR(50),
    created_at  TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_pg_bookings_status ON bookings(booking_status);
CREATE INDEX IF NOT EXISTS idx_pg_bookings_visa ON bookings(visa_status);
CREATE INDEX IF NOT EXISTS idx_pg_tours_active ON tours(is_active);
CREATE INDEX IF NOT EXISTS idx_pg_inquiries_status ON inquiries(status);
