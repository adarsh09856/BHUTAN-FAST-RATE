/**
 * Bhutan Visa & Permit Processing Workflow State Machine
 * Implements Department of Immigration (DoI) compliance logic.
 */

const CANONICAL_STAGES = [
  'pending_docs',
  'docs_received',
  'payment_verified',
  'submitted_to_doi',
  'under_review',
  'approved',
  'rejected'
];

const VALID_STAGES = [
  ...CANONICAL_STAGES,
  'not_started',
  'documents_incomplete',
  'documents_complete',
  'clearance_letter_issued',
  'on_arrival'
];

const DOI_GATED_STAGES = new Set([
  'submitted_to_doi',
  'under_review',
  'approved',
  'clearance_letter_issued'
]);

function isRegionalNationality(nationalityType) {
  const norm = String(nationalityType || '').trim().toLowerCase();
  return norm === 'india' || norm === 'regional_india' || norm === 'regional';
}

function hasText(value) {
  return typeof value === 'string' ? value.trim().length > 0 : Boolean(value);
}

/**
 * Parses a YYYY-MM-DD (or Date / ISO timestamp) strictly into UTC midnight.
 */
function parseUTCDate(value) {
  if (!value) return null;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
  }
  const str = String(value).trim();
  const match = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    const year = Number(match[1]);
    const monthIdx = Number(match[2]) - 1;
    const day = Number(match[3]);
    const dt = new Date(Date.UTC(year, monthIdx, day));
    if (dt.getUTCFullYear() === year && dt.getUTCMonth() === monthIdx && dt.getUTCDate() === day) {
      return dt;
    }
    return null;
  }
  const parsed = new Date(str);
  if (Number.isNaN(parsed.getTime())) return null;
  return new Date(Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate()));
}

/**
 * Adds calendar months in UTC while clamping month-end days cleanly
 * (e.g., Aug 31 + 6 months -> Feb 28/29, never rolling over into March).
 */
function addMonthsUTC(date, months) {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  const day = date.getUTCDate();
  const totalMonths = year * 12 + month + months;
  const targetYear = Math.floor(totalMonths / 12);
  const targetMonth = ((totalMonths % 12) + 12) % 12;
  const lastDayOfTargetMonth = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
  return new Date(Date.UTC(targetYear, targetMonth, Math.min(day, lastDayOfTargetMonth)));
}

function formatUTCDate(date) {
  return date.toISOString().split('T')[0];
}

/**
 * Validates whether a traveler's documents satisfy Bhutan DoI requirements.
 * International travelers require passport validity >= 6 calendar months after travelEndDate.
 * Indian / regional travelers follow Entry Permit rules without the 6-month passport block.
 */
function checkDocumentReadiness(traveler = {}, travelEndDate, nationalityType = 'international', requireInsurance = false) {
  const missing = [];
  const errors = [];
  const regional = isRegionalNationality(nationalityType);
  const scanProvided = hasText(traveler.passport_scan) || hasText(traveler.id_scan);

  if (regional) {
    if (!hasText(traveler.passport_number) && !hasText(traveler.national_id)) {
      missing.push('passport_number_or_national_id');
    }
    if (!scanProvided) missing.push('passport_scan');
    if (!hasText(traveler.photo_url)) missing.push('photo_url');
    if (requireInsurance && !hasText(traveler.insurance_doc)) missing.push('insurance_doc');

    const ready = missing.length === 0 && errors.length === 0;
    return { ready, is_ready: ready, missing, errors, issues: [...missing, ...errors] };
  }

  if (!hasText(traveler.passport_number)) missing.push('passport_number');
  if (!hasText(traveler.passport_expiry)) missing.push('passport_expiry');
  if (!scanProvided) missing.push('passport_scan');
  if (!hasText(traveler.photo_url)) missing.push('photo_url');
  if (requireInsurance && !hasText(traveler.insurance_doc)) missing.push('insurance_doc');

  if (hasText(traveler.passport_expiry)) {
    const expiryDate = parseUTCDate(traveler.passport_expiry);
    const endDate = travelEndDate ? parseUTCDate(travelEndDate) : parseUTCDate(new Date());

    if (!expiryDate) {
      errors.push(`Invalid passport expiration date: ${traveler.passport_expiry}`);
    } else if (!endDate) {
      errors.push(`Invalid travel end date: ${travelEndDate}`);
    } else {
      const minRequiredExpiry = addMonthsUTC(endDate, 6);
      if (expiryDate < minRequiredExpiry) {
        errors.push(
          `Passport expires on ${formatUTCDate(expiryDate)}, which violates the 6-month minimum validity requirement after travel end date (${formatUTCDate(endDate)}; must be valid through at least ${formatUTCDate(minRequiredExpiry)}).`
        );
      }
    }
  }

  const ready = missing.length === 0 && errors.length === 0;
  return {
    ready,
    is_ready: ready,
    missing,
    errors,
    issues: [...missing, ...errors]
  };
}

/**
 * Enforces strict DoI visa workflow stage transitions.
 */
function checkVisaTransition(currentStage, targetStage, booking = {}, travelers = [], options = {}) {
  if (!VALID_STAGES.includes(targetStage)) {
    return {
      allowed: false,
      reason: `Unknown visa stage: ${targetStage}`,
      errors: [`Unknown visa stage: ${targetStage}`]
    };
  }

  if (targetStage === 'rejected') {
    const reason = options && typeof options.rejection_reason === 'string'
      ? options.rejection_reason.trim()
      : '';
    if (!reason) {
      return {
        allowed: false,
        reason: 'A non-empty rejection_reason is required when transitioning a visa application to rejected.',
        errors: ['rejection_reason is required']
      };
    }
    return { allowed: true, reason: null, errors: [] };
  }

  if (DOI_GATED_STAGES.has(targetStage)) {
    const errors = [];

    if (Number(booking?.full_paid) !== 1) {
      errors.push('100% full advance payment is required before DoI submission or visa approval.');
    }

    const roster = Array.isArray(travelers) ? travelers : [];
    if (roster.length === 0) {
      errors.push('At least one traveler record with verified documents is required before DoI processing.');
    } else {
      const nationalityType = options.nationality_type || booking?.nationality_type || 'international';
      const requireInsurance = Boolean(options.require_insurance ?? options.requireInsurance);
      const travelEndDate = booking?.travel_date_end;

      roster.forEach((traveler, index) => {
        const readiness = checkDocumentReadiness(traveler, travelEndDate, nationalityType, requireInsurance);
        if (!readiness.ready) {
          const label = traveler?.full_name || `Traveler #${index + 1}`;
          const details = [
            ...readiness.missing.map((m) => `missing ${m}`),
            ...readiness.errors
          ].join(', ');
          errors.push(`${label}: ${details}`);
        }
      });
    }

    if (errors.length > 0) {
      return {
        allowed: false,
        reason: errors.join(' | '),
        errors
      };
    }
  }

  return { allowed: true, reason: null, errors: [] };
}

function canAdvanceTo(currentStage, targetStage, booking, travelers = [], options = {}) {
  return checkVisaTransition(currentStage, targetStage, booking, travelers, options);
}

function generateClearanceNotice(booking, travelers = []) {
  return {
    clearance_number: booking.visa_clearance_number || `VCL-${booking.id}`,
    issued_to_tour_operator: 'Bhutan Fast Rate Tours (License #TR/2018/9882)',
    lead_traveler: booking.lead_name,
    passport_number: booking.lead_passport_no,
    nationality: booking.lead_country,
    travel_dates: `${booking.travel_date_start} to ${booking.travel_date_end} (${booking.total_nights} Nights)`,
    entry_point: isRegionalNationality(booking.nationality_type)
      ? 'Phuentsholing / Paro International Airport (PBH)'
      : 'Paro International Airport (PBH)',
    sdf_status: Number(booking.full_paid) === 1
      ? 'Fully Paid & Remitted to Royal Monetary Authority'
      : 'Pending Full SDF Remittance',
    total_travelers: booking.total_travelers || travelers.length,
    clearance_letter_url: `/api/bookings/${booking.id}/clearance-view`,
    instructions: 'Please present this official digital clearance letter to Drukair / Bhutan Airlines check-in desk and Bhutan Immigration upon arrival at Paro International Airport.'
  };
}

module.exports = {
  CANONICAL_STAGES,
  VALID_STAGES,
  DOI_GATED_STAGES,
  parseUTCDate,
  addMonthsUTC,
  checkDocumentReadiness,
  checkVisaTransition,
  canAdvanceTo,
  generateClearanceNotice
};
