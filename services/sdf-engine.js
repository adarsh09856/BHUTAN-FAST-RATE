const db = require('../database/db');

/**
 * Calculates Royal Government of Bhutan Sustainable Development Fee (SDF)
 * Compliant with Department of Tourism regulations.
 */
function calculateSDF(params) {
  const nights = Math.max(1, parseInt(params.nights, 10) || 1);
  const adults = Math.max(0, parseInt(params.adults, 10) || 0);
  const children_6_12 = Math.max(0, parseInt(params.children_6_12, 10) || 0);
  const children_under_6 = Math.max(0, parseInt(params.children_under_6, 10) || 0);
  const nationality_type = params.nationality_type === 'india' ? 'india' : 'international';

  // Read rate configuration from database settings
  const settingsRows = db.query("SELECT key, value FROM settings WHERE key LIKE 'sdf_%' OR key = 'visa_fee_usd'");
  const config = {};
  settingsRows.forEach(r => config[r.key] = r.value);

  const baseRate = nationality_type === 'india' 
    ? (parseInt(config.sdf_rate_india, 10) || 1200)
    : (parseInt(config.sdf_rate_international, 10) || 100);

  const currency = nationality_type === 'india' ? 'INR' : 'USD';
  const childDiscountPercent = parseInt(config.sdf_child_6_12_discount, 10) || 50;
  const childRate = baseRate * (1 - childDiscountPercent / 100);

  const adultSubtotal = adults * nights * baseRate;
  const childSubtotal = children_6_12 * nights * childRate;
  const infantSubtotal = 0; // 100% exempt under 6

  let rawTotal = adultSubtotal + childSubtotal + infantSubtotal;

  // Check promotional waiver
  const isWaiverActive = config.sdf_waiver_active === '1';
  const waiverPercent = isWaiverActive ? (parseInt(config.sdf_waiver_percent, 10) || 0) : 0;
  let waiverDiscount = 0;
  if (waiverPercent > 0) {
    waiverDiscount = Math.round(rawTotal * (waiverPercent / 100));
  }
  const totalSdf = rawTotal - waiverDiscount;

  // One-time Visa / Permit Fee
  const visaFeePerPerson = nationality_type === 'india' ? 0 : (parseInt(config.visa_fee_usd, 10) || 40);
  const totalVisaFee = (adults + children_6_12) * visaFeePerPerson;

  return {
    nights,
    travelers_count: adults + children_6_12 + children_under_6,
    nationality_type,
    currency,
    breakdown: {
      adults: { count: adults, rate_per_night: baseRate, nights, subtotal: adultSubtotal },
      children_6_12: { count: children_6_12, rate_per_night: childRate, nights, subtotal: childSubtotal, discount: `${childDiscountPercent}%` },
      children_under_6: { count: children_under_6, rate_per_night: 0, nights, subtotal: 0, exempt: true },
      waiver_applied: isWaiverActive ? `${waiverPercent}% Government Promotional Waiver` : null,
      waiver_discount: waiverDiscount
    },
    total_sdf: totalSdf,
    visa_fee_per_person: visaFeePerPerson,
    total_visa_fee: totalVisaFee,
    grand_government_dues: totalSdf + totalVisaFee,
    compliance_note: '100% of the SDF is remitted to the Royal Government of Bhutan for healthcare, free education, carbon neutrality, and tourism sustainability infrastructure.'
  };
}

module.exports = { calculateSDF };
