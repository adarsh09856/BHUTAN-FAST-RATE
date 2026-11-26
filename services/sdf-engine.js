const db = require('../database/db');

const DEFAULT_SETTINGS = {
  sdf_rate_international: 100,
  sdf_rate_india: 1200,
  sdf_child_6_12_discount: 50,
  sdf_child_under_6_exempt: 1,
  sdf_waiver_active: 0,
  sdf_waiver_percent: 0,
  visa_fee_usd: 40,
  usd_to_inr_rate: 85,
  child_under_6_package_discount_pct: 100,
  custom_daily_rate_3star_usd: 220,
  custom_daily_rate_4star_usd: 295,
  custom_daily_rate_5star_usd: 490,
  hotel_4star_surcharge_usd: 0,
  hotel_5star_surcharge_usd: 0
};

function toNonNegativeNumber(value, fallback = 0) {
  if (value === undefined || value === null || value === '') return fallback;
  const num = Number(value);
  return Number.isFinite(num) && num >= 0 ? num : fallback;
}

function toPositiveNumber(value, fallback) {
  const num = Number(value);
  return Number.isFinite(num) && num > 0 ? num : fallback;
}

/**
 * Normalizes rate inputs that may come from DB percentages ('50', '40', '30')
 * or decimal fractions in test overrides (0.50, 0.40, 0.30).
 */
function normalizeRateFraction(value, defaultFraction) {
  if (value === undefined || value === null || value === '') return defaultFraction;
  const num = Number(value);
  if (!Number.isFinite(num) || num < 0) return defaultFraction;
  if (num > 1) return Math.min(1, num / 100);
  return num;
}

function isIndiaNationality(nationalityType) {
  const norm = String(nationalityType || '').trim().toLowerCase();
  return norm === 'india' || norm === 'regional_india' || norm === 'regional';
}

function normalizeHotelTier(hotelTier) {
  const raw = String(hotelTier || '').trim();
  if (/5[-\s]?star|luxury/i.test(raw)) return '5-star';
  if (/4[-\s]?star|premium/i.test(raw)) return '4-star';
  return '3-star';
}

function isTruthyFlag(val) {
  return val === true || val === 1 || val === '1' || val === 'true';
}

async function loadPricingSettings(settingsOverride) {
  if (settingsOverride && typeof settingsOverride === 'object') {
    return { ...DEFAULT_SETTINGS, ...settingsOverride };
  }
  const rows = await db.query('SELECT key, value FROM settings');
  const merged = { ...DEFAULT_SETTINGS };
  for (const row of rows || []) {
    merged[row.key] = row.value;
  }
  return merged;
}

function resolveAdultPackageUsd({ tour, hotelTier, nights, customDailyRate, settings }) {
  const customRate = Number(customDailyRate);
  if (Number.isFinite(customRate) && customRate > 0) {
    return customRate * nights;
  }

  if (tour && typeof tour === 'object') {
    const threeStar = toNonNegativeNumber(tour.price_3star_usd ?? tour.price_usd, 0);
    if (hotelTier === '5-star') {
      const p5 = Number(tour.price_5star_usd);
      if (Number.isFinite(p5) && p5 > 0) return p5;
      return threeStar + toNonNegativeNumber(settings.hotel_5star_surcharge_usd, 0);
    }
    if (hotelTier === '4-star') {
      const p4 = Number(tour.price_4star_usd);
      if (Number.isFinite(p4) && p4 > 0) return p4;
      return threeStar + toNonNegativeNumber(settings.hotel_4star_surcharge_usd, 0);
    }
    return threeStar;
  }

  if (hotelTier === '5-star') {
    return toPositiveNumber(settings.custom_daily_rate_5star_usd, 490) * nights;
  }
  if (hotelTier === '4-star') {
    return toPositiveNumber(settings.custom_daily_rate_4star_usd, 295) * nights;
  }
  return toPositiveNumber(settings.custom_daily_rate_3star_usd, 220) * nights;
}

function computeSdfAndVisa({ nights, adults, children_6_12, children_under_6, isIndia, isSdfWaived, settings }) {
  const baseRateLocal = isIndia
    ? toNonNegativeNumber(settings.sdf_rate_india, 1200)
    : toNonNegativeNumber(settings.sdf_rate_international, 100);
  const currency = isIndia ? 'INR' : 'USD';
  const exchangeRate = isIndia ? toPositiveNumber(settings.usd_to_inr_rate, 85) : 1;

  const sdfChildDiscountFrac = normalizeRateFraction(settings.sdf_child_6_12_discount, 0.50);
  const childRateLocal = baseRateLocal * (1 - sdfChildDiscountFrac);
  const sdfChildDiscountPct = Math.round(sdfChildDiscountFrac * 100);

  const under6Exempt = settings.sdf_child_under_6_exempt === undefined
    ? true
    : !(settings.sdf_child_under_6_exempt === 0 || settings.sdf_child_under_6_exempt === '0' || settings.sdf_child_under_6_exempt === false);

  const adultSdfLocal = adults * nights * baseRateLocal;
  const childSdfLocal = children_6_12 * nights * childRateLocal;
  const infantSdfLocal = under6Exempt ? 0 : children_under_6 * nights * childRateLocal;
  const rawSdfLocal = adultSdfLocal + childSdfLocal + infantSdfLocal;

  const promoActive = isTruthyFlag(settings.sdf_waiver_active);
  const waiverPercent = isSdfWaived
    ? 100
    : (promoActive ? Math.min(100, toNonNegativeNumber(settings.sdf_waiver_percent, 0)) : 0);

  const waiverDiscountLocal = waiverPercent > 0 ? Math.round(rawSdfLocal * (waiverPercent / 100)) : 0;
  const totalSdfLocal = Math.max(0, rawSdfLocal - waiverDiscountLocal);
  const totalSdfUsd = isIndia ? Number((totalSdfLocal / exchangeRate).toFixed(2)) : totalSdfLocal;

  // Existing Bhutan Fast Rate Tours rule: $40 visa fee per traveler aged 6+ for international; $0 for India.
  const visaFeePerPersonUsd = isIndia ? 0 : toNonNegativeNumber(settings.visa_fee_usd, 40);
  const totalVisaFeeUsd = (adults + children_6_12) * visaFeePerPersonUsd;
  const totalVisaFeeLocal = totalVisaFeeUsd;

  return {
    currency,
    exchangeRate,
    baseRateLocal,
    childRateLocal,
    sdfChildDiscountPct,
    under6Exempt,
    adultSdfLocal,
    childSdfLocal,
    infantSdfLocal,
    waiverPercent,
    waiverDiscountLocal,
    totalSdfLocal,
    totalSdfUsd,
    visaFeePerPersonUsd,
    totalVisaFeeUsd,
    totalVisaFeeLocal
  };
}

/**
 * Authoritative multi-currency pricing and SDF breakdown.
 * Never mixes raw USD + INR totals: INR bookings convert USD package/extras/discount
 * using `usd_to_inr_rate` and report normalized USD equivalents via division.
 */
async function calculatePricingQuote(params = {}) {
  const settings = await loadPricingSettings(params.settingsOverride);
  const tour = params.tour || null;
  const nights = Math.max(1, parseInt(params.nights ?? tour?.duration_nights, 10) || 1);
  const adults = Math.max(0, parseInt(params.adults ?? params.adults_count, 10) || 0);
  const children_6_12 = Math.max(0, parseInt(params.children_6_12, 10) || 0);
  const children_under_6 = Math.max(0, parseInt(params.children_under_6, 10) || 0);
  const travelers_count = adults + children_6_12 + children_under_6;

  const isIndia = isIndiaNationality(params.nationality_type);
  const nationality_type = isIndia ? 'india' : 'international';
  const hotelTier = normalizeHotelTier(params.hotel_tier);
  const isSdfWaived = isTruthyFlag(params.is_sdf_waived);

  const sdfInfo = computeSdfAndVisa({
    nights,
    adults,
    children_6_12,
    children_under_6,
    isIndia,
    isSdfWaived,
    settings
  });

  const adultPackageUsd = resolveAdultPackageUsd({
    tour,
    hotelTier,
    nights,
    customDailyRate: params.custom_daily_rate,
    settings
  });

  const childPkgDiscountFrac = normalizeRateFraction(
    settings.child_package_discount ?? settings.child_6_12_package_discount_pct,
    0.40
  );
  const adultsPackageUsd = adults * adultPackageUsd;
  const childrenPackageUsd = children_6_12 * adultPackageUsd * (1 - childPkgDiscountFrac);
  const package_total_usd = Math.round(adultsPackageUsd + childrenPackageUsd);

  const extras_usd = toNonNegativeNumber(params.extras_usd, 0);
  const discount_usd = toNonNegativeNumber(params.discount_usd, 0);

  let package_total_local;
  let extras_local;
  let discount_local;
  let total_price_local;
  let total_price_usd;

  if (isIndia) {
    package_total_local = Math.round(package_total_usd * sdfInfo.exchangeRate);
    extras_local = Math.round(extras_usd * sdfInfo.exchangeRate);
    discount_local = Math.round(discount_usd * sdfInfo.exchangeRate);
    total_price_local = Math.max(
      0,
      package_total_local + sdfInfo.totalSdfLocal + extras_local - discount_local
    );
    total_price_usd = Number((total_price_local / sdfInfo.exchangeRate).toFixed(2));
  } else {
    package_total_local = package_total_usd;
    extras_local = Math.round(extras_usd);
    discount_local = Math.round(discount_usd);
    total_price_usd = Math.max(
      0,
      package_total_usd + sdfInfo.totalSdfUsd + sdfInfo.totalVisaFeeUsd + extras_usd - discount_usd
    );
    total_price_local = Math.round(total_price_usd);
  }

  const depositPctFrac = normalizeRateFraction(
    settings.booking_deposit_percent ?? settings.deposit_percent,
    0.30
  );
  const deposit_amount_local = Math.round(total_price_local * depositPctFrac);
  const deposit_amount_usd = isIndia
    ? Number((deposit_amount_local / sdfInfo.exchangeRate).toFixed(2))
    : deposit_amount_local;

  return {
    currency: sdfInfo.currency,
    nationality_type,
    exchange_rate: sdfInfo.exchangeRate,
    hotel_tier: hotelTier,
    nights,
    adults,
    children_6_12,
    children_under_6,
    travelers_count,
    is_sdf_waived: isSdfWaived || sdfInfo.waiverPercent === 100,
    waiver_percent: sdfInfo.waiverPercent,
    per_adult_package_usd: adultPackageUsd,
    package_total_usd,
    package_total_local,
    base_price_usd: package_total_usd,
    total_sdf_local: sdfInfo.totalSdfLocal,
    total_sdf_usd: sdfInfo.totalSdfUsd,
    sdf_total_usd: sdfInfo.totalSdfUsd,
    visa_fee_local: sdfInfo.totalVisaFeeLocal,
    visa_fee_usd: sdfInfo.totalVisaFeeUsd,
    extras_usd,
    extras_local,
    discount_usd,
    discount_local,
    total_price_local,
    total_price_usd,
    deposit_percent: depositPctFrac,
    deposit_amount_local,
    deposit_amount_usd,
    breakdown: {
      adults: {
        count: adults,
        sdf_rate_per_night: sdfInfo.baseRateLocal,
        nights,
        sdf_subtotal_local: sdfInfo.adultSdfLocal,
        package_per_person_usd: adultPackageUsd
      },
      children_6_12: {
        count: children_6_12,
        sdf_rate_per_night: sdfInfo.childRateLocal,
        nights,
        sdf_subtotal_local: sdfInfo.childSdfLocal,
        sdf_discount: `${sdfInfo.sdfChildDiscountPct}%`,
        package_discount: `${Math.round(childPkgDiscountFrac * 100)}%`
      },
      children_under_6: {
        count: children_under_6,
        sdf_rate_per_night: 0,
        nights,
        sdf_subtotal_local: 0,
        package_subtotal_usd: 0,
        exempt: true
      },
      waiver_applied: sdfInfo.waiverPercent > 0 ? `${sdfInfo.waiverPercent}% Government Promotional Waiver` : null,
      waiver_discount: sdfInfo.waiverDiscountLocal
    }
  };
}

/**
 * Calculates Royal Government of Bhutan Sustainable Development Fee (SDF)
 * Compliant with Department of Tourism regulations.
 */
async function calculateSDF(params = {}) {
  const settings = await loadPricingSettings(params.settingsOverride);
  const nights = Math.max(1, parseInt(params.nights, 10) || 1);
  const adults = Math.max(0, parseInt(params.adults ?? params.adults_count, 10) || 0);
  const children_6_12 = Math.max(0, parseInt(params.children_6_12, 10) || 0);
  const children_under_6 = Math.max(0, parseInt(params.children_under_6, 10) || 0);
  const isIndia = isIndiaNationality(params.nationality_type);
  const nationality_type = isIndia ? 'india' : 'international';

  const sdfInfo = computeSdfAndVisa({
    nights,
    adults,
    children_6_12,
    children_under_6,
    isIndia,
    isSdfWaived: isTruthyFlag(params.is_sdf_waived),
    settings
  });

  return {
    nights,
    travelers_count: adults + children_6_12 + children_under_6,
    nationality_type,
    currency: sdfInfo.currency,
    exchange_rate: sdfInfo.exchangeRate,
    breakdown: {
      adults: { count: adults, rate_per_night: sdfInfo.baseRateLocal, nights, subtotal: sdfInfo.adultSdfLocal },
      children_6_12: {
        count: children_6_12,
        rate_per_night: sdfInfo.childRateLocal,
        nights,
        subtotal: sdfInfo.childSdfLocal,
        discount: `${sdfInfo.sdfChildDiscountPct}%`
      },
      children_under_6: { count: children_under_6, rate_per_night: 0, nights, subtotal: 0, exempt: true },
      waiver_applied: sdfInfo.waiverPercent > 0 ? `${sdfInfo.waiverPercent}% Government Promotional Waiver` : null,
      waiver_discount: sdfInfo.waiverDiscountLocal
    },
    total_sdf: sdfInfo.totalSdfLocal,
    total_sdf_local: sdfInfo.totalSdfLocal,
    total_sdf_usd: sdfInfo.totalSdfUsd,
    visa_fee_per_person: sdfInfo.visaFeePerPersonUsd,
    total_visa_fee: sdfInfo.totalVisaFeeLocal,
    grand_government_dues: sdfInfo.totalSdfLocal + sdfInfo.totalVisaFeeLocal,
    compliance_note: '100% of the SDF is remitted to the Royal Government of Bhutan for healthcare, free education, carbon neutrality, and tourism sustainability infrastructure.'
  };
}

module.exports = {
  calculateSDF,
  calculatePricingQuote,
  loadPricingSettings,
  normalizeRateFraction
};
