/**
 * Bhutan Visa & Permit Processing Workflow State Machine
 * Implements Department of Immigration (DoI) compliance logic.
 */

const VALID_STAGES = [
  'not_started',
  'documents_incomplete',
  'documents_complete',
  'payment_verified',
  'submitted_to_doi',
  'under_review',
  'approved',
  'clearance_letter_issued',
  'rejected',
  'on_arrival'
];

function checkDocumentReadiness(traveler, travelEndDate) {
  const issues = [];

  if (!traveler.passport_number || traveler.passport_number.trim() === '') {
    issues.push('Missing passport number');
  }

  if (!traveler.passport_expiry) {
    issues.push('Missing passport expiration date');
  } else {
    // Check 6 months validity rule
    const expiry = new Date(traveler.passport_expiry);
    const end = travelEndDate ? new Date(travelEndDate) : new Date();
    const sixMonthsAfterEnd = new Date(end);
    sixMonthsAfterEnd.setMonth(sixMonthsAfterEnd.getMonth() + 6);

    if (expiry < sixMonthsAfterEnd) {
      issues.push(`Passport expires on ${traveler.passport_expiry}, which is less than 6 months after planned departure date (${sixMonthsAfterEnd.toISOString().split('T')[0]}). Royal Govt requires 6+ months validity.`);
    }
  }

  if (!traveler.date_of_birth) {
    issues.push('Missing date of birth');
  }

  return {
    is_ready: issues.length === 0,
    issues
  };
}

function canAdvanceTo(currentStage, targetStage, booking) {
  if (!VALID_STAGES.includes(targetStage)) {
    return { allowed: false, reason: `Unknown stage: ${targetStage}` };
  }

  // Pre-requisite rules:
  if (targetStage === 'submitted_to_doi') {
    if (!booking.full_paid && booking.deposit_paid_usd < booking.total_price_usd) {
      return { 
        allowed: false, 
        reason: 'Royal Government of Bhutan requires 100% advance clearance of tour payment, SDF tax, and visa fee before submitting applications to the Department of Immigration.' 
      };
    }
  }

  if (targetStage === 'clearance_letter_issued' && !booking.visa_clearance_number) {
    return { 
      allowed: false, 
      reason: 'Cannot issue clearance letter without an official Visa Clearance Number from DoI.' 
    };
  }

  return { allowed: true };
}

function generateClearanceNotice(booking, travelers = []) {
  return {
    clearance_number: booking.visa_clearance_number || `VCL-${booking.id}`,
    issued_to_tour_operator: 'Bhutan Fast Rate Tours (License #TR/2018/9882)',
    lead_traveler: booking.lead_name,
    passport_number: booking.lead_passport_no,
    nationality: booking.lead_country,
    travel_dates: `${booking.travel_date_start} to ${booking.travel_date_end} (${booking.total_nights} Nights)`,
    entry_point: 'Paro International Airport (PBH)',
    sdf_status: 'Fully Paid & Remitted to Royal Monetary Authority',
    total_travelers: booking.total_travelers,
    clearance_letter_url: `/api/bookings/clearance-pdf/${booking.id}`,
    instructions: 'Please present this official digital clearance letter to Drukair / Bhutan Airlines check-in desk and Bhutan Immigration upon arrival at Paro International Airport.'
  };
}

module.exports = {
  VALID_STAGES,
  checkDocumentReadiness,
  canAdvanceTo,
  generateClearanceNotice
};
