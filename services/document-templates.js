/**
 * Printable HTML Document Renderer (Official Invoice & DoI Visa Clearance Letter)
 * Escapes all DB/user inputs cleanly and embeds @media print styles.
 */

function escapeHtml(value) {
  if (value === undefined || value === null) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatLicense(rawLicense) {
  const clean = String(rawLicense || 'TR/2018/9882').trim();
  return clean.startsWith('#') ? clean : `#${clean}`;
}

function isIndiaBooking(booking = {}) {
  const nation = String(booking.nationality_type || '').trim().toLowerCase();
  const curr = String(booking.currency || '').trim().toUpperCase();
  return nation === 'india' || nation === 'regional_india' || curr === 'INR';
}

function formatCurrencyAmount(amount, currency) {
  const num = Number(amount) || 0;
  const symbol = currency === 'INR' ? '₹' : '$';
  return `${symbol}${Math.round(num).toLocaleString('en-US')} ${currency}`;
}

function computeInvoiceDisplayAmounts(booking = {}, settings = {}) {
  const isIndia = isIndiaBooking(booking);
  const currency = isIndia ? 'INR' : 'USD';
  const exchangeRate = isIndia ? (Number(booking.exchange_rate || settings.usd_to_inr_rate || 85) || 85) : 1;

  const toDisplay = (localOverride, usdVal) => {
    if (localOverride !== undefined && localOverride !== null) return Math.round(Number(localOverride) || 0);
    const usd = Number(usdVal) || 0;
    return isIndia ? Math.round(usd * exchangeRate) : Math.round(usd);
  };

  const packageAmount = toDisplay(booking.package_total_local, booking.base_price_usd);
  const sdfAmount = toDisplay(booking.total_sdf_local, booking.sdf_total_usd);
  const visaAmount = isIndia ? 0 : toDisplay(booking.visa_fee_local, booking.visa_fee_usd);
  const extrasAmount = toDisplay(booking.extras_local, booking.extras_usd);
  const discountAmount = toDisplay(booking.discount_local, booking.discount_usd);
  const totalAmount = toDisplay(booking.total_price_local, booking.total_price_usd);
  const paidAmount = toDisplay(booking.deposit_paid_local, booking.deposit_paid_usd);
  const balanceDue = Math.max(0, totalAmount - paidAmount);

  return {
    currency,
    exchangeRate,
    packageAmount,
    sdfAmount,
    visaAmount,
    extrasAmount,
    discountAmount,
    totalAmount,
    paidAmount,
    balanceDue
  };
}

function buildBaseDocumentShell({ title, bodyHtml }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 24px;
      font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
      color: #14231e;
      background: #f6f4ee;
      line-height: 1.5;
    }
    .sheet {
      max-width: 860px;
      margin: 0 auto;
      background: #ffffff;
      border: 1px solid #dfd7c4;
      border-radius: 10px;
      padding: 36px 40px;
      box-shadow: 0 6px 24px rgba(11, 42, 34, 0.08);
    }
    .toolbar {
      max-width: 860px;
      margin: 0 auto 14px;
      display: flex;
      justify-content: flex-end;
      gap: 10px;
    }
    .btn-print {
      background: #0b2a22;
      color: #ffffff;
      border: none;
      padding: 10px 18px;
      border-radius: 6px;
      font-weight: 700;
      font-size: 13px;
      cursor: pointer;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2px solid #0b2a22;
      padding-bottom: 18px;
      margin-bottom: 24px;
      gap: 16px;
    }
    .brand h1 {
      margin: 0;
      font-size: 22px;
      color: #0b2a22;
      letter-spacing: 0.02em;
    }
    .license-badge {
      display: inline-block;
      margin-top: 6px;
      padding: 3px 9px;
      background: #fff8ec;
      border: 1px solid #c9a24b;
      color: #0b2a22;
      border-radius: 4px;
      font-size: 12px;
      font-weight: 700;
    }
    .meta-right { text-align: right; font-size: 13px; }
    .grid-2 {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 16px;
      margin-bottom: 22px;
    }
    .card {
      background: #fbf9f5;
      border: 1px solid #e7dcc4;
      border-radius: 6px;
      padding: 14px 16px;
      font-size: 13px;
    }
    .card h3 {
      margin: 0 0 8px;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: #6b7280;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 14px 0 22px;
      font-size: 13px;
    }
    th, td {
      padding: 9px 10px;
      border-bottom: 1px solid #e5e7eb;
      text-align: left;
    }
    th {
      background: #0b2a22;
      color: #ffffff;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .num { text-align: right; font-variant-numeric: tabular-nums; }
    .total-row td {
      font-weight: 800;
      font-size: 14px;
      border-top: 2px solid #0b2a22;
      background: #fff8ec;
    }
    .notice {
      background: #f0fdf4;
      border: 1px solid #bbf7d0;
      border-left: 4px solid #0b2a22;
      padding: 12px 16px;
      border-radius: 6px;
      font-size: 13px;
      margin-top: 16px;
    }
    .footer-sign {
      margin-top: 28px;
      padding-top: 14px;
      border-top: 1px dashed #cbd5e1;
      display: flex;
      justify-content: space-between;
      font-size: 12px;
      color: #4b5563;
    }
    @media print {
      body { background: #ffffff; padding: 0; }
      .no-print { display: none !important; }
      .sheet {
        box-shadow: none;
        border: none;
        padding: 12px 16px;
        max-width: 100%;
      }
    }
  </style>
</head>
<body>
  <div class="toolbar no-print">
    <button type="button" class="btn-print" onclick="window.print()">Print / Save PDF</button>
  </div>
  <main class="sheet">
    ${bodyHtml}
  </main>
</body>
</html>`;
}

/**
 * Renders a print-ready official tax invoice & payment ledger HTML page.
 */
function renderInvoiceHtml(booking = {}, travelers = [], payments = [], settings = {}) {
  const companyName = settings.company_name || 'Bhutan Fast Rate Tours';
  const license = formatLicense(settings.company_license);
  const companyEmail = settings.company_email || 'reservations@bhutanfastratetours.bt';
  const companyPhone = settings.company_phone || '+975 17 654 321';
  const companyAddress = settings.company_address || 'Norzin Lam, Clock Tower Square, Thimphu & Paro Valley, Bhutan';

  const amounts = computeInvoiceDisplayAmounts(booking, settings);
  const issueDate = new Date().toISOString().split('T')[0];

  const travelersHtml = (Array.isArray(travelers) ? travelers : []).map((tr, idx) => `
    <tr>
      <td>${idx + 1}</td>
      <td>${escapeHtml(tr.full_name)}</td>
      <td>${escapeHtml(tr.age_category || 'adult')}</td>
      <td>${escapeHtml(tr.nationality || booking.lead_country || '')}</td>
      <td>${escapeHtml(tr.passport_number || tr.national_id || 'Pending')}</td>
    </tr>
  `).join('') || '<tr><td colspan="5">Lead traveler on booking</td></tr>';

  const paymentsHtml = (Array.isArray(payments) ? payments : []).map((p) => {
    const pCurr = (p.currency || amounts.currency).toUpperCase();
    const pAmt = p.amount_local !== undefined && p.amount_local !== null
      ? p.amount_local
      : (pCurr === 'INR' ? Math.round((Number(p.amount_usd) || 0) * amounts.exchangeRate) : (p.amount_usd || 0));
    return `
      <tr>
        <td>${escapeHtml(p.created_at || p.verified_at || issueDate)}</td>
        <td>${escapeHtml(p.payment_type || 'payment')}</td>
        <td>${escapeHtml(p.payment_method || 'bank_transfer')}</td>
        <td>${escapeHtml(p.transaction_ref || '-')}</td>
        <td>${escapeHtml(p.status || 'pending')}</td>
        <td class="num">${escapeHtml(formatCurrencyAmount(pAmt, pCurr))}</td>
        <td>${escapeHtml(p.notes || '')}</td>
      </tr>
    `;
  }).join('') || '<tr><td colspan="7">No payments recorded yet.</td></tr>';

  const bodyHtml = `
    <header class="header">
      <div class="brand">
        <h1>${escapeHtml(companyName)}</h1>
        <span class="license-badge">Department of Tourism License ${escapeHtml(license)}</span>
        <div style="font-size:12px;color:#4b5563;margin-top:6px;">
          ${escapeHtml(companyAddress)}<br>
          ${escapeHtml(companyEmail)} • ${escapeHtml(companyPhone)}
        </div>
      </div>
      <div class="meta-right">
        <strong style="font-size:16px;color:#0b2a22;">OFFICIAL TOUR INVOICE</strong><br>
        Booking Ref: <strong>${escapeHtml(booking.id || 'N/A')}</strong><br>
        Issue Date: ${escapeHtml(issueDate)}<br>
        Currency Track: <strong>${escapeHtml(amounts.currency)}</strong>
      </div>
    </header>

    <section class="grid-2">
      <div class="card">
        <h3>Billed To (Lead Guest)</h3>
        <strong>${escapeHtml(booking.lead_name)}</strong><br>
        ${escapeHtml(booking.lead_email)}<br>
        ${escapeHtml(booking.lead_phone)}<br>
        Country: ${escapeHtml(booking.lead_country)}
      </div>
      <div class="card">
        <h3>Itinerary Summary</h3>
        <strong>${escapeHtml(booking.tour_title)}</strong><br>
        Dates: ${escapeHtml(booking.travel_date_start)} to ${escapeHtml(booking.travel_date_end)} (${escapeHtml(booking.total_nights)} Nights)<br>
        Hotel Tier: ${escapeHtml(booking.hotel_tier || 'Standard')}<br>
        Party Size: ${escapeHtml(booking.total_travelers || (Array.isArray(travelers) ? travelers.length : 1))} Traveler(s)
      </div>
    </section>

    <h3 style="margin-bottom:6px;">Itemized Cost Breakdown (${escapeHtml(amounts.currency)})</h3>
    <table>
      <thead>
        <tr>
          <th>Description</th>
          <th class="num">Amount (${escapeHtml(amounts.currency)})</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>Land Tour Package (${escapeHtml(booking.hotel_tier || 'Standard')} • Guide, Hotels, Meals, Transport)</td>
          <td class="num">${escapeHtml(formatCurrencyAmount(amounts.packageAmount, amounts.currency))}</td>
        </tr>
        <tr>
          <td>Royal Government Sustainable Development Fee (SDF)</td>
          <td class="num">${escapeHtml(formatCurrencyAmount(amounts.sdfAmount, amounts.currency))}</td>
        </tr>
        <tr>
          <td>Bhutan Visa / Entry Permit Processing Fee</td>
          <td class="num">${escapeHtml(formatCurrencyAmount(amounts.visaAmount, amounts.currency))}</td>
        </tr>
        ${amounts.extrasAmount > 0 ? `
        <tr>
          <td>Optional Extras &amp; Upgrades</td>
          <td class="num">${escapeHtml(formatCurrencyAmount(amounts.extrasAmount, amounts.currency))}</td>
        </tr>` : ''}
        ${amounts.discountAmount > 0 ? `
        <tr>
          <td>Negotiated Package Discount</td>
          <td class="num">-${escapeHtml(formatCurrencyAmount(amounts.discountAmount, amounts.currency))}</td>
        </tr>` : ''}
        <tr class="total-row">
          <td>Total Authoritative Invoice Amount</td>
          <td class="num">${escapeHtml(formatCurrencyAmount(amounts.totalAmount, amounts.currency))}</td>
        </tr>
        <tr>
          <td>Total Payments Credited</td>
          <td class="num">${escapeHtml(formatCurrencyAmount(amounts.paidAmount, amounts.currency))}</td>
        </tr>
        <tr class="total-row">
          <td>Balance Due</td>
          <td class="num">${escapeHtml(formatCurrencyAmount(amounts.balanceDue, amounts.currency))}</td>
        </tr>
      </tbody>
    </table>

    <h3 style="margin-bottom:6px;">Traveler Roster</h3>
    <table>
      <thead>
        <tr><th>#</th><th>Full Name</th><th>Category</th><th>Nationality</th><th>Passport / ID</th></tr>
      </thead>
      <tbody>${travelersHtml}</tbody>
    </table>

    <h3 style="margin-bottom:6px;">Payments Ledger</h3>
    <table>
      <thead>
        <tr><th>Date</th><th>Type</th><th>Method</th><th>Reference</th><th>Status</th><th class="num">Amount</th><th>Notes</th></tr>
      </thead>
      <tbody>${paymentsHtml}</tbody>
    </table>

    <section class="card">
      <h3>Official Bank Wire Instructions</h3>
      Beneficiary: <strong>${escapeHtml(settings.bank_beneficiary || 'Bhutan Fast Rate Tours Ltd.')}</strong> •
      Bank: ${escapeHtml(settings.bank_name || 'Bank of Bhutan Ltd.')}<br>
      SWIFT / BIC: <strong>${escapeHtml(settings.bank_swift || 'BOBTBT22XXX')}</strong> •
      Account No: <strong>${escapeHtml(settings.bank_account || '200884910023')}</strong><br>
      Memo: ${escapeHtml(settings.bank_instructions || `Include Booking Reference ${booking.id || 'BFR-YYYY-XXXX'} in wire memo`)}
      ${booking.special_requests ? `<div style="margin-top:8px;"><strong>Special Requests:</strong> ${escapeHtml(booking.special_requests)}</div>` : ''}
    </section>

    <footer class="footer-sign">
      <span>${escapeHtml(companyName)} • License ${escapeHtml(license)}</span>
      <span>100% SDF remitted to Royal Monetary Authority of Bhutan</span>
    </footer>
  `;

  return buildBaseDocumentShell({
    title: `Invoice ${booking.id || ''} — ${companyName}`,
    bodyHtml
  });
}

/**
 * Renders a print-ready Department of Immigration Visa / Entry Permit Clearance Letter.
 */
function renderClearanceLetterHtml(booking = {}, travelers = [], settings = {}) {
  const companyName = settings.company_name || 'Bhutan Fast Rate Tours';
  const license = formatLicense(settings.company_license);
  const companyEmail = settings.company_email || 'reservations@bhutanfastratetours.bt';
  const companyPhone = settings.company_phone || '+975 17 654 321';

  const isIndia = isIndiaBooking(booking);
  const documentTitle = isIndia
    ? 'OFFICIAL ENTRY PERMIT CLEARANCE'
    : 'OFFICIAL BHUTAN TOURIST VISA CLEARANCE LETTER';
  const clearanceNumber = booking.visa_clearance_number || `VCL-${booking.id || 'PENDING'}`;
  const entryPoint = isIndia
    ? 'Phuentsholing Checkpost / Paro International Airport (PBH)'
    : 'Paro International Airport (PBH)';

  const travelerRows = (Array.isArray(travelers) ? travelers : []).map((tr, idx) => `
    <tr>
      <td>${idx + 1}</td>
      <td>${escapeHtml(tr.full_name)}</td>
      <td>${escapeHtml(tr.nationality || booking.lead_country || '')}</td>
      <td>${escapeHtml(tr.date_of_birth || '-')}</td>
      <td>${escapeHtml(tr.passport_number || tr.national_id || '-')}</td>
      <td>${escapeHtml(tr.passport_expiry || (isIndia ? 'N/A (Regional)' : '-'))}</td>
      <td>${escapeHtml(tr.visa_status || booking.visa_status || 'approved')}</td>
    </tr>
  `).join('') || '<tr><td colspan="7">No travelers listed.</td></tr>';

  const bodyHtml = `
    <header class="header">
      <div class="brand">
        <h1>${escapeHtml(companyName)}</h1>
        <span class="license-badge">Royal Govt Licensed Operator ${escapeHtml(license)}</span>
        <div style="font-size:12px;color:#4b5563;margin-top:6px;">
          Department of Tourism &amp; Department of Immigration Authorized Submission Agent<br>
          ${escapeHtml(companyEmail)} • ${escapeHtml(companyPhone)}
        </div>
      </div>
      <div class="meta-right">
        <strong style="font-size:15px;color:#0b2a22;">${escapeHtml(documentTitle)}</strong><br>
        Clearance No: <strong>${escapeHtml(clearanceNumber)}</strong><br>
        Booking Ref: <strong>${escapeHtml(booking.id || 'N/A')}</strong><br>
        Approval Date: ${escapeHtml(booking.visa_approved_date || new Date().toISOString().split('T')[0])}
      </div>
    </header>

    <section class="grid-2">
      <div class="card">
        <h3>Authorized Travel Details</h3>
        Lead Guest: <strong>${escapeHtml(booking.lead_name)}</strong><br>
        Nationality Track: ${escapeHtml(isIndia ? 'Regional Entry Permit (INR)' : 'International Tourist Visa (USD)')}<br>
        Travel Period: <strong>${escapeHtml(booking.travel_date_start)} to ${escapeHtml(booking.travel_date_end)}</strong> (${escapeHtml(booking.total_nights)} Nights)<br>
        Authorized Port of Entry: ${escapeHtml(entryPoint)}
      </div>
      <div class="card">
        <h3>Tour &amp; Compliance Verification</h3>
        Package: <strong>${escapeHtml(booking.tour_title)}</strong><br>
        Accommodation Tier: ${escapeHtml(booking.hotel_tier || 'Certified Hotel')}<br>
        SDF Status: <strong>${escapeHtml(Number(booking.full_paid) === 1 ? 'Fully Paid & Remitted to Royal Monetary Authority' : 'Pending Full Remittance')}</strong><br>
        ${booking.sdf_remittance_ref ? `RMA Remittance Ref: ${escapeHtml(booking.sdf_remittance_ref)}` : ''}
      </div>
    </section>

    <h3 style="margin-bottom:6px;">Cleared Traveler Manifest</h3>
    <table>
      <thead>
        <tr>
          <th>#</th>
          <th>Full Name</th>
          <th>Nationality</th>
          <th>Date of Birth</th>
          <th>Passport / National ID</th>
          <th>Expiry Date</th>
          <th>DoI Status</th>
        </tr>
      </thead>
      <tbody>
        ${travelerRows}
      </tbody>
    </table>

    <div class="notice">
      <strong>Immigration &amp; Airline Check-In Instructions:</strong>
      Please carry a printed or digital copy of this clearance notice along with your original valid passport
      (or government-issued ID for Indian nationals) for Drukair / Bhutan Airlines check-in and Bhutan Department of Immigration inspection upon arrival at ${escapeHtml(entryPoint)}.
      ${booking.special_requests ? `<div style="margin-top:8px;"><strong>Notes:</strong> ${escapeHtml(booking.special_requests)}</div>` : ''}
    </div>

    <footer class="footer-sign">
      <span>Issued by ${escapeHtml(companyName)} (${escapeHtml(license)})</span>
      <span>Clearance Reference: ${escapeHtml(clearanceNumber)}</span>
    </footer>
  `;

  return buildBaseDocumentShell({
    title: `${clearanceNumber} — Bhutan Visa Clearance`,
    bodyHtml
  });
}

module.exports = {
  escapeHtml,
  renderInvoiceHtml,
  renderClearanceLetterHtml
};
