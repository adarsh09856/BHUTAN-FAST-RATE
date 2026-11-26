/**
 * Bhutan Fast Rate Tours — Live Multi-Tier & Multi-Currency Booking Sidebar Widget
 * Preserves tour-theme.css (#14231E / #E05A47 / #F8FAF9) aesthetics and
 * routes selected trip parameters directly into book.html checkout.
 */
(function (global) {
  'use strict';

  let nextMountSeq = 0;

  function esc(val) {
    if (global.SiteShell && typeof global.SiteShell.escapeHtml === 'function') {
      return global.SiteShell.escapeHtml(val);
    }
    if (val === undefined || val === null) return '';
    return String(val)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function fmtCurrency(amount, currency) {
    if (global.ApiClient && typeof global.ApiClient.formatCurrency === 'function') {
      return global.ApiClient.formatCurrency(amount, currency);
    }
    const curr = String(currency || 'USD').toUpperCase() === 'INR' ? 'INR' : 'USD';
    const symbol = curr === 'INR' ? '₹' : '$';
    return `${symbol}${Math.round(Number(amount) || 0).toLocaleString('en-US')}`;
  }

  function defaultFutureDate(daysAhead = 30) {
    const dt = new Date(Date.now() + daysAhead * 86400000);
    return dt.toISOString().slice(0, 10);
  }

  function normalizeTierValue(rawTier) {
    const t = String(rawTier || '').toLowerCase();
    if (/5/.test(t) || /luxury/.test(t)) return '5-star';
    if (/4/.test(t) || /premium/.test(t)) return '4-star';
    return '3-star';
  }

  function normalizeNationality(rawNat) {
    const n = String(rawNat || '').toLowerCase();
    return (n === 'india' || n === 'regional_india' || n === 'regional') ? 'india' : 'international';
  }

  class BookingWidget {
    constructor(containerOrId, options = {}) {
      const doc = global.document;
      if (!doc) return;

      this.container = typeof containerOrId === 'string'
        ? doc.getElementById(containerOrId)
        : containerOrId;

      if (!this.container) return;

      this.options = options || {};
      this.tour = options.tour || null;
      this.tourId = options.tourId || (this.tour && this.tour.id) || (this.container.getAttribute ? this.container.getAttribute('data-tour-id') : '') || '';
      this.tourSlug = options.tourSlug || (this.tour && (this.tour.slug || this.tour.id)) || (this.container.getAttribute ? this.container.getAttribute('data-tour-slug') : '') || this.tourId;
      this.tourTitle = options.tourTitle || (this.tour && this.tour.title) || 'Bhutan Tour Package';
      this.isCustom = Boolean(options.isCustom || this.tourSlug === 'custom' || this.tourSlug === 'custom_trip');
      this.allowNightsEdit = Boolean(options.allowNightsEdit || this.isCustom);

      this.state = {
        date: options.defaultDate || defaultFutureDate(30),
        nights: Number(options.nights || (this.tour && this.tour.duration_nights) || (this.container.getAttribute ? this.container.getAttribute('data-nights') : 0) || 6),
        tier: normalizeTierValue(options.defaultTier || '4-star'),
        nationality: normalizeNationality(options.defaultNationality || 'international'),
        adults: Math.max(1, Number(options.adults || 2)),
        children_6_12: Math.max(0, Number(options.children_6_12 || 0)),
        children_under_6: Math.max(0, Number(options.children_under_6 || 0))
      };

      this.quote = null;
      this.whatsappPhone = '+97517654321';
      this.licenseText = '#TR/2018/9882';
      this._calcSeq = 0;
      this._debounceTimer = null;
      this.mountSeq = ++nextMountSeq;

      if (this.container.dataset) {
        this.container.dataset.bfrWidgetMounted = '1';
        this.container.dataset.bfrMountSeq = String(this.mountSeq);
      }
      this.render();
      this._readyPromise = this.initializeData();
    }

    isStaleMount() {
      return Boolean(
        this.container &&
        this.container.dataset &&
        this.container.dataset.bfrMountSeq !== String(this.mountSeq)
      );
    }

    static async mount(containerOrOptions, maybeOptions = {}) {
      let container = containerOrOptions;
      let opts = maybeOptions || {};

      if (
        containerOrOptions &&
        typeof containerOrOptions === 'object' &&
        !containerOrOptions.tagName &&
        typeof containerOrOptions.nodeType !== 'number'
      ) {
        opts = containerOrOptions;
        container = opts.container || opts.containerId || 'tourBookingWidget';
      }

      const instance = new BookingWidget(container, opts);
      if (instance._readyPromise) {
        await instance._readyPromise;
      }
      return instance;
    }

    async initializeData() {
      const tasks = [];

      if (global.SiteShell && typeof global.SiteShell.getPublicSettings === 'function') {
        tasks.push(
          global.SiteShell.getPublicSettings()
            .then((settings) => {
              if (this.isStaleMount()) return;
              if (settings) {
                this.whatsappPhone = settings.company_whatsapp || this.whatsappPhone;
                const lic = settings.company_license || 'TR/2018/9882';
                this.licenseText = lic.startsWith('#') ? lic : `#${lic}`;
                this.syncMetaLinks();
              }
            })
            .catch(() => {})
        );
      }

      if (!this.tour && this.tourSlug && !this.isCustom && global.ApiClient && typeof global.ApiClient.getTour === 'function') {
        tasks.push(
          global.ApiClient.getTour(this.tourSlug)
            .then((res) => {
              if (this.isStaleMount()) return;
              const tour = res && res.data ? res.data : res;
              if (tour && tour.title) {
                this.setTour(tour, { skipQuote: true });
              }
            })
            .catch((err) => {
              if (this.isStaleMount()) return;
              this.showError(err.message || 'Unable to load live tour pricing.');
            })
        );
      }

      await Promise.all(tasks);
      if (this.isStaleMount()) return;
      await this.updateQuote();
    }

    setTour(tour, opts = {}) {
      if (!tour || this.isStaleMount()) return;
      this.tour = tour;
      this.tourId = tour.id || this.tourId;
      this.tourSlug = tour.id || tour.slug || this.tourSlug;
      this.tourTitle = tour.title || this.tourTitle;
      if (tour.duration_nights && !this.allowNightsEdit) {
        this.state.nights = Number(tour.duration_nights) || this.state.nights;
      }
      this.updateTierOptionLabels();
      this.syncInputsFromState();
      this.syncCtaUrls();
      if (!opts.skipQuote) {
        this.updateQuote();
      }
    }

    getTierPrices() {
      const t = this.tour || {};
      const p3 = Number(t.price_3star_usd || t.price_usd || this.options.basePrice || 0);
      const p4 = Number(t.price_4star_usd || 0) || (p3 ? Math.round(p3 * 1.25) : 0);
      const p5 = Number(t.price_5star_usd || 0) || (p3 ? Math.round(p3 * 1.6) : 0);
      return { p3, p4, p5 };
    }

    getBookUrl() {
      const params = {
        tour: this.isCustom ? 'custom' : (this.tourId || this.tourSlug),
        date: this.state.date,
        nights: this.state.nights,
        tier: this.state.tier,
        nationality: this.state.nationality,
        adults: this.state.adults,
        children_6_12: this.state.children_6_12,
        children_under_6: this.state.children_under_6
      };
      if (this.isCustom) {
        params.custom = 1;
      }

      if (global.ApiClient && typeof global.ApiClient.buildBookUrl === 'function') {
        return global.ApiClient.buildBookUrl(params);
      }
      const sp = new URLSearchParams();
      for (const [k, v] of Object.entries(params)) {
        if (v !== undefined && v !== null && v !== '') sp.set(k, String(v));
      }
      return `book.html?${sp.toString()}`;
    }

    getWhatsAppUrl() {
      const msg = `Kuzuzangpo La! I would like a quote for "${this.tourTitle}" (${this.state.nights} nights, ${this.state.tier.toUpperCase()}, ${this.state.adults} adults, ${this.state.children_6_12} children 6-12, departure ${this.state.date}).`;
      if (global.ApiClient && typeof global.ApiClient.buildWhatsAppUrl === 'function') {
        return global.ApiClient.buildWhatsAppUrl(this.whatsappPhone, msg);
      }
      const digits = String(this.whatsappPhone || '97517654321').replace(/\D+/g, '');
      return `https://wa.me/${digits}?text=${encodeURIComponent(msg)}`;
    }

    getContactUrl() {
      return `contact.html?tour=${encodeURIComponent(this.tourTitle)}`;
    }

    render() {
      const { p3, p4, p5 } = this.getTierPrices();
      const tierLabel = (label, price) => (price > 0 ? `${label} (${fmtCurrency(price, 'USD')}/adult)` : label);

      this.container.innerHTML = `
        <div class="bg-white p-6 sm:p-7 rounded-2xl border border-zinc-200 shadow-lg space-y-5" style="color-scheme: light !important;">
          <style>
            .bfr-bw-input {
              color-scheme: light !important;
              background-color: #ffffff !important;
              color: #14231E !important;
            }
          </style>
          <div>
            <span class="text-[11px] font-bold uppercase tracking-wider text-[#E05A47]">ROYAL GOVT LICENSED BOOKING DESK</span>
            <h3 class="text-xl font-extrabold text-[#14231E] mt-1">Configure &amp; Book This Trip</h3>
            <p class="text-xs text-zinc-500 mt-1">Live Department of Tourism SDF &amp; multi-tier package pricing.</p>
          </div>

          <div id="bwError" class="hidden p-3 rounded-xl bg-red-50 border border-red-200 text-xs font-semibold text-red-700"></div>

          <form id="bwForm" class="space-y-4">
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label for="bwDate" class="block text-xs font-bold text-[#14231E] mb-1">Departure Date</label>
                <input type="date" id="bwDate" value="${esc(this.state.date)}" required
                  class="bfr-bw-input w-full px-3 py-2 rounded-lg border border-zinc-300 text-xs font-semibold">
              </div>
              <div>
                <label for="bwNights" class="block text-xs font-bold text-[#14231E] mb-1">Nights</label>
                <input type="number" id="bwNights" value="${esc(this.state.nights)}" min="1" max="60"
                  ${this.allowNightsEdit ? '' : 'readonly'}
                  class="bfr-bw-input w-full px-3 py-2 rounded-lg border border-zinc-300 text-xs font-semibold">
              </div>
            </div>

            <div>
              <label for="bwTier" class="block text-xs font-bold text-[#14231E] mb-1">Accommodation Tier</label>
              <select id="bwTier" class="bfr-bw-input w-full px-3 py-2.5 rounded-lg border border-zinc-300 text-xs font-semibold">
                <option value="3-star" ${this.state.tier === '3-star' ? 'selected' : ''}>${esc(tierLabel('3-Star Heritage Lodges', p3))}</option>
                <option value="4-star" ${this.state.tier === '4-star' ? 'selected' : ''}>${esc(tierLabel('4-Star Premium Boutique', p4))}</option>
                <option value="5-star" ${this.state.tier === '5-star' ? 'selected' : ''}>${esc(tierLabel('5-Star Luxury Resorts', p5))}</option>
              </select>
            </div>

            <div>
              <label for="bwNationality" class="block text-xs font-bold text-[#14231E] mb-1">Guest Nationality / Currency</label>
              <select id="bwNationality" class="bfr-bw-input w-full px-3 py-2.5 rounded-lg border border-zinc-300 text-xs font-semibold">
                <option value="international" ${this.state.nationality === 'international' ? 'selected' : ''}>International Guest (USD $100/night SDF)</option>
                <option value="india" ${this.state.nationality === 'india' ? 'selected' : ''}>Indian National (INR ₹1,200/night SDF)</option>
              </select>
            </div>

            <div class="grid grid-cols-3 gap-2">
              <div>
                <label for="bwAdults" class="block text-[11px] font-bold text-[#14231E] mb-1">Adults (13+)</label>
                <input type="number" id="bwAdults" value="${esc(this.state.adults)}" min="1" max="30"
                  class="bfr-bw-input w-full px-2.5 py-2 rounded-lg border border-zinc-300 text-xs font-bold">
              </div>
              <div>
                <label for="bwChildren612" class="block text-[11px] font-bold text-[#14231E] mb-1">Child (6–12)</label>
                <input type="number" id="bwChildren612" value="${esc(this.state.children_6_12)}" min="0" max="20"
                  class="bfr-bw-input w-full px-2.5 py-2 rounded-lg border border-zinc-300 text-xs font-bold">
              </div>
              <div>
                <label for="bwChildrenUnder6" class="block text-[11px] font-bold text-[#14231E] mb-1">Under 6</label>
                <input type="number" id="bwChildrenUnder6" value="${esc(this.state.children_under_6)}" min="0" max="15"
                  class="bfr-bw-input w-full px-2.5 py-2 rounded-lg border border-zinc-300 text-xs font-bold">
              </div>
            </div>

            <div class="p-4 rounded-xl bg-[#F8FAF9] border border-zinc-200 space-y-2 text-xs">
              <div class="flex justify-between">
                <span class="text-zinc-600">Tour Package (<span id="bwCurrencyLabel">${this.state.nationality === 'india' ? 'INR' : 'USD'}</span>):</span>
                <span id="bwPackageTotal" class="font-bold text-[#14231E]">—</span>
              </div>
              <div class="flex justify-between">
                <span class="text-zinc-600">Royal Gov SDF Tax:</span>
                <span id="bwSdfTotal" class="font-bold text-[#14231E]">—</span>
              </div>
              <div class="flex justify-between">
                <span class="text-zinc-600">Tourist Visa Fee (24–48h):</span>
                <span id="bwVisaTotal" class="font-bold text-[#14231E]">—</span>
              </div>
              <div class="flex justify-between pt-2 border-t border-zinc-200 text-sm font-black text-[#E05A47]">
                <span>Estimated Total:</span>
                <span id="bwGrandTotal">—</span>
              </div>
              <div class="flex justify-between text-[11px] text-zinc-500">
                <span>Reservation Deposit (<span id="bwDepositPct">30%</span>):</span>
                <span id="bwDepositTotal" class="font-bold text-[#14231E]">—</span>
              </div>
            </div>

            <a id="bwReserveBtn" href="${esc(this.getBookUrl())}"
              class="block w-full text-center py-3.5 rounded-xl bg-[#E05A47] hover:bg-[#c94937] text-white font-black text-xs uppercase tracking-wider shadow transition-colors">
              Book Now &amp; Continue Checkout
            </a>

            <div class="grid grid-cols-2 gap-2">
              <a id="bwWhatsappBtn" href="${esc(this.getWhatsAppUrl())}" target="_blank" rel="noopener"
                class="block text-center py-2.5 px-2 rounded-xl border border-zinc-300 text-[#14231E] font-bold text-[11px] uppercase tracking-wide hover:bg-[#F8FAF9] transition-colors">
                WhatsApp Quote
              </a>
              <a id="bwContactBtn" href="${esc(this.getContactUrl())}"
                class="block text-center py-2.5 px-2 rounded-xl border border-zinc-300 text-[#14231E] font-bold text-[11px] uppercase tracking-wide hover:bg-[#F8FAF9] transition-colors">
                Custom Inquiry
              </a>
            </div>
          </form>

          <div class="text-[11px] text-zinc-500 text-center space-y-1 pt-1 border-t border-zinc-100">
            <p>✓ 100% Refundable up to 30 days before departure.</p>
            <p>✓ Direct booking guarantee · License <span id="bwLicenseText">${esc(this.licenseText)}</span>.</p>
          </div>
        </div>
      `;

      this.attachEvents();
      this.syncCtaUrls();
    }

    _el(id) {
      return this.container && typeof this.container.querySelector === 'function'
        ? (this.container.querySelector(`#${id}`) || (global.document && global.document.getElementById(id)))
        : (global.document && global.document.getElementById(id));
    }

    updateTierOptionLabels() {
      const tierSelect = this._el('bwTier');
      if (!tierSelect || !tierSelect.options) return;
      const { p3, p4, p5 } = this.getTierPrices();
      const map = {
        '3-star': p3 > 0 ? `3-Star Heritage Lodges (${fmtCurrency(p3, 'USD')}/adult)` : '3-Star Heritage Lodges',
        '4-star': p4 > 0 ? `4-Star Premium Boutique (${fmtCurrency(p4, 'USD')}/adult)` : '4-Star Premium Boutique',
        '5-star': p5 > 0 ? `5-Star Luxury Resorts (${fmtCurrency(p5, 'USD')}/adult)` : '5-Star Luxury Resorts'
      };
      for (const opt of Array.from(tierSelect.options)) {
        if (map[opt.value]) opt.textContent = map[opt.value];
      }
    }

    syncInputsFromState() {
      const dateEl = this._el('bwDate');
      const nightsEl = this._el('bwNights');
      const tierEl = this._el('bwTier');
      const natEl = this._el('bwNationality');
      const adultsEl = this._el('bwAdults');
      const c1El = this._el('bwChildren612');
      const c2El = this._el('bwChildrenUnder6');

      if (dateEl) dateEl.value = this.state.date;
      if (nightsEl) nightsEl.value = String(this.state.nights);
      if (tierEl) tierEl.value = this.state.tier;
      if (natEl) natEl.value = this.state.nationality;
      if (adultsEl) adultsEl.value = String(this.state.adults);
      if (c1El) c1El.value = String(this.state.children_6_12);
      if (c2El) c2El.value = String(this.state.children_under_6);
    }

    readInputsToState() {
      const dateEl = this._el('bwDate');
      const nightsEl = this._el('bwNights');
      const tierEl = this._el('bwTier');
      const natEl = this._el('bwNationality');
      const adultsEl = this._el('bwAdults');
      const c1El = this._el('bwChildren612');
      const c2El = this._el('bwChildrenUnder6');

      if (dateEl && dateEl.value) this.state.date = dateEl.value;
      if (nightsEl) this.state.nights = Math.max(1, parseInt(nightsEl.value, 10) || this.state.nights || 1);
      if (tierEl) this.state.tier = normalizeTierValue(tierEl.value);
      if (natEl) this.state.nationality = normalizeNationality(natEl.value);
      if (adultsEl) this.state.adults = Math.max(1, parseInt(adultsEl.value, 10) || 1);
      if (c1El) this.state.children_6_12 = Math.max(0, parseInt(c1El.value, 10) || 0);
      if (c2El) this.state.children_under_6 = Math.max(0, parseInt(c2El.value, 10) || 0);
    }

    syncMetaLinks() {
      const licEl = this._el('bwLicenseText');
      if (licEl) licEl.textContent = this.licenseText;
      this.syncCtaUrls();
    }

    syncCtaUrls() {
      const reserveBtn = this._el('bwReserveBtn');
      const waBtn = this._el('bwWhatsappBtn');
      const contactBtn = this._el('bwContactBtn');

      const bookUrl = this.getBookUrl();
      if (reserveBtn) reserveBtn.setAttribute('href', bookUrl);
      if (waBtn) waBtn.setAttribute('href', this.getWhatsAppUrl());
      if (contactBtn) contactBtn.setAttribute('href', this.getContactUrl());
    }

    showError(message) {
      if (this.isStaleMount()) return;
      const errEl = this._el('bwError');
      if (!errEl) return;
      errEl.textContent = String(message || 'Unable to compute live quote.');
      if (errEl.classList) errEl.classList.remove('hidden');
    }

    clearError() {
      if (this.isStaleMount()) return;
      const errEl = this._el('bwError');
      if (!errEl) return;
      errEl.textContent = '';
      if (errEl.classList) errEl.classList.add('hidden');
    }

    scheduleQuoteUpdate() {
      if (this.isStaleMount()) return;
      this.readInputsToState();
      this.syncCtaUrls();
      if (this._debounceTimer) clearTimeout(this._debounceTimer);
      this._debounceTimer = setTimeout(() => {
        if (!this.isStaleMount()) {
          this.updateQuote();
        }
      }, 150);
    }

    async updateQuote() {
      if (this.isStaleMount()) return;
      if (!global.ApiClient || typeof global.ApiClient.calculateSDF !== 'function') return;

      const seq = ++this._calcSeq;
      this.readInputsToState();
      this.syncCtaUrls();
      this.clearError();

      try {
        const quote = await global.ApiClient.calculateSDF({
          tour_slug: this.isCustom ? 'custom' : (this.tourId || this.tourSlug || undefined),
          nights: this.state.nights,
          hotel_tier: this.state.tier,
          nationality_type: this.state.nationality,
          adults: this.state.adults,
          children_6_12: this.state.children_6_12,
          children_under_6: this.state.children_under_6
        });

        if (this.isStaleMount() || seq !== this._calcSeq || !quote) return;
        this.quote = quote;
        this.renderQuoteSummary(quote);
      } catch (err) {
        if (this.isStaleMount() || seq !== this._calcSeq) return;
        this.showError(err.message || 'Unable to load live pricing quote from server.');
      }
    }

    renderQuoteSummary(quote) {
      if (this.isStaleMount()) return;
      const curr = quote.currency || (this.state.nationality === 'india' ? 'INR' : 'USD');
      const currEl = this._el('bwCurrencyLabel');
      const pkgEl = this._el('bwPackageTotal');
      const sdfEl = this._el('bwSdfTotal');
      const visaEl = this._el('bwVisaTotal');
      const grandEl = this._el('bwGrandTotal');
      const depPctEl = this._el('bwDepositPct');
      const depEl = this._el('bwDepositTotal');

      if (currEl) currEl.textContent = curr;
      if (pkgEl) pkgEl.textContent = fmtCurrency(quote.package_total_local ?? quote.package_total_usd, curr);
      if (sdfEl) sdfEl.textContent = fmtCurrency(quote.total_sdf_local ?? quote.total_sdf, curr);
      if (visaEl) {
        const visaAmt = quote.visa_fee_local ?? quote.total_visa_fee ?? 0;
        visaEl.textContent = curr === 'INR' && visaAmt === 0 ? 'Exempt (₹0)' : fmtCurrency(visaAmt, curr);
      }
      if (grandEl) grandEl.textContent = fmtCurrency(quote.total_price_local ?? quote.total_price_usd, curr);
      if (depPctEl && quote.deposit_percent !== undefined) {
        depPctEl.textContent = `${Math.round(Number(quote.deposit_percent) * 100)}%`;
      }
      if (depEl) depEl.textContent = fmtCurrency(quote.deposit_amount_local ?? quote.deposit_amount_usd, curr);
    }

    attachEvents() {
      const onChange = () => this.scheduleQuoteUpdate();
      for (const id of ['bwDate', 'bwNights', 'bwTier', 'bwNationality', 'bwAdults', 'bwChildren612', 'bwChildrenUnder6']) {
        const el = this._el(id);
        if (el) {
          el.addEventListener('change', onChange);
          el.addEventListener('input', onChange);
        }
      }

      const form = this._el('bwForm');
      if (form) {
        form.addEventListener('submit', (e) => {
          e.preventDefault();
          this.readInputsToState();
          if (global.location) {
            global.location.href = this.getBookUrl();
          }
        });
      }
    }
  }

  global.BookingWidget = BookingWidget;

  if (!global.__BFR_DISABLE_AUTO_INIT__ && global.document && typeof global.document.addEventListener === 'function') {
    const autoMount = () => {
      const el = global.document.getElementById('tourBookingWidget');
      if (el && !el.dataset.bfrWidgetMounted && !global.__BFR_DEFER_WIDGET_MOUNT__) {
        BookingWidget.mount({ container: el });
      }
    };
    if (global.document.readyState === 'loading') {
      global.document.addEventListener('DOMContentLoaded', autoMount);
    } else {
      autoMount();
    }
  }
})(typeof window !== 'undefined' ? window : globalThis);
