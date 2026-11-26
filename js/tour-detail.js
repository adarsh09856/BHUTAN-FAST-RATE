/**
 * Bhutan Fast Rate Tours — Live Tour Detail Hydrator
 * Works identically on dynamic `tour.html?slug=<id>` pages and pre-rendered `tour-*.html` pages,
 * syncing live pricing tiers (3★/4★/5★), itinerary, inclusions, exclusions, and BookingWidget.
 */
(function (global) {
  'use strict';

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

  function fmtCurrency(amount, currency = 'USD') {
    if (global.ApiClient && typeof global.ApiClient.formatCurrency === 'function') {
      return global.ApiClient.formatCurrency(amount, currency);
    }
    return `$${Math.round(Number(amount) || 0).toLocaleString('en-US')}`;
  }

  function resolveTourSlug(locationLike) {
    const loc = locationLike || global.location || {};
    const search = String(loc.search || '');
    const pathname = String(loc.pathname || '');

    if (search) {
      try {
        const sp = new URLSearchParams(search);
        const querySlug = sp.get('slug') || sp.get('tour') || sp.get('id');
        if (querySlug && querySlug.trim()) {
          return querySlug.trim().replace(/^tour-/i, '').replace(/\.html$/i, '');
        }
      } catch (_) {
        // Ignore malformed query string
      }
    }

    const match = pathname.match(/(?:^|\/)tour-([a-z0-9-]+)\.html$/i);
    if (match && match[1]) {
      return match[1].toLowerCase();
    }

    return null;
  }

  function normalizeArrayField(rawVal, jsonFallback) {
    if (Array.isArray(rawVal)) return rawVal;
    const source = rawVal !== undefined && rawVal !== null ? rawVal : jsonFallback;
    if (Array.isArray(source)) return source;
    if (typeof source === 'string' && source.trim()) {
      try {
        const parsed = JSON.parse(source);
        return Array.isArray(parsed) ? parsed : [];
      } catch (_) {
        return source.split('\n').map(s => s.trim()).filter(Boolean);
      }
    }
    return [];
  }

  function renderItineraryHtml(itinerary) {
    if (!Array.isArray(itinerary) || itinerary.length === 0) {
      return '<p class="text-sm text-zinc-500">Custom day-by-day itinerary confirmed upon booking consultation.</p>';
    }

    return itinerary.map((item, idx) => {
      if (typeof item === 'string') {
        const splitIdx = item.indexOf(':');
        const hasPrefix = /^day\s+\d+/i.test(item) && splitIdx > 0 && splitIdx < 22;
        const dayLabel = hasPrefix ? item.slice(0, splitIdx).trim() : `Day ${idx + 1}`;
        const bodyText = hasPrefix ? item.slice(splitIdx + 1).trim() : item.trim();
        return `
          <div class="flex items-start gap-4 pb-6 border-b border-zinc-100 last:border-b-0 last:pb-0">
            <span class="px-3 py-1.5 rounded-lg bg-[#14231E] text-white font-extrabold text-xs shrink-0">${esc(dayLabel)}</span>
            <p class="text-sm text-zinc-700 leading-relaxed">${esc(bodyText)}</p>
          </div>
        `;
      }

      const dayNum = item.day || (idx + 1);
      const dayLabel = String(dayNum).toLowerCase().startsWith('day') ? String(dayNum) : `Day ${dayNum}`;
      const title = item.title ? `<div class="font-bold text-[#14231E] text-sm mb-1">${esc(item.title)}</div>` : '';
      const desc = item.description || item.summary || item.details || '';
      const metaParts = [];
      if (item.location) metaParts.push(item.location);
      if (item.elevation) metaParts.push(item.elevation);
      if (item.meals) metaParts.push(`Meals: ${item.meals}`);
      const metaHtml = metaParts.length > 0
        ? `<div class="text-[11px] text-zinc-500 mt-1.5 font-medium">${esc(metaParts.join(' • '))}</div>`
        : '';

      return `
        <div class="flex items-start gap-4 pb-6 border-b border-zinc-100 last:border-b-0 last:pb-0">
          <span class="px-3 py-1.5 rounded-lg bg-[#14231E] text-white font-extrabold text-xs shrink-0">${esc(dayLabel)}</span>
          <div>
            ${title}
            <p class="text-sm text-zinc-700 leading-relaxed">${esc(desc)}</p>
            ${metaHtml}
          </div>
        </div>
      `;
    }).join('');
  }

  function renderChecklistHtml(items, prefixChar = '✓') {
    if (!Array.isArray(items) || items.length === 0) return '';
    return items.map((entry) => `
      <div class="flex items-start gap-2">
        <span class="font-bold text-[#E05A47] shrink-0">${esc(prefixChar)}</span>
        <span>${esc(typeof entry === 'string' ? entry : (entry.label || entry.text || ''))}</span>
      </div>
    `).join('');
  }

  function renderTierBreakdownHtml(tour) {
    const p3 = Number(tour.price_3star_usd || tour.price_usd || 0);
    const p4 = Number(tour.price_4star_usd || 0) || (p3 ? Math.round(p3 * 1.25) : 0);
    const p5 = Number(tour.price_5star_usd || 0) || (p3 ? Math.round(p3 * 1.6) : 0);

    return `
      <div class="grid sm:grid-cols-3 gap-3">
        <div class="p-4 rounded-xl bg-[#F8FAF9] border border-zinc-200">
          <div class="text-[11px] font-bold uppercase text-zinc-500">3-Star Heritage</div>
          <div class="text-lg font-extrabold text-[#14231E] mt-1">${fmtCurrency(p3, 'USD')}</div>
          <div class="text-[11px] text-zinc-500">per adult · SDF included</div>
        </div>
        <div class="p-4 rounded-xl bg-orange-50/60 border border-[#E05A47]/40">
          <div class="text-[11px] font-bold uppercase text-[#E05A47]">4-Star Premium</div>
          <div class="text-lg font-extrabold text-[#14231E] mt-1">${fmtCurrency(p4, 'USD')}</div>
          <div class="text-[11px] text-zinc-500">per adult · SDF included</div>
        </div>
        <div class="p-4 rounded-xl bg-[#F8FAF9] border border-zinc-200">
          <div class="text-[11px] font-bold uppercase text-zinc-500">5-Star Luxury</div>
          <div class="text-lg font-extrabold text-[#14231E] mt-1">${fmtCurrency(p5, 'USD')}</div>
          <div class="text-[11px] text-zinc-500">per adult · SDF included</div>
        </div>
      </div>
    `;
  }

  function findFallbackContainer(doc, headingNeedle, innerSelector) {
    const headings = doc.querySelectorAll('h2, h3');
    for (const h of headings) {
      if ((h.textContent || '').toLowerCase().includes(headingNeedle.toLowerCase())) {
        const card = h.parentElement;
        if (card && typeof card.querySelector === 'function') {
          const inner = card.querySelector(innerSelector);
          if (inner) return inner;
        }
      }
    }
    return null;
  }

  function ensureBookingWidgetTarget(doc) {
    const explicit = doc.getElementById('tourBookingWidget') || doc.querySelector('[data-tour-booking-widget]');
    if (explicit) return explicit;

    const sidebarCol = doc.querySelector('main .lg\\:col-span-4');
    if (sidebarCol) {
      const mountDiv = doc.createElement('div');
      mountDiv.id = 'tourBookingWidget';
      mountDiv.className = 'sticky top-28';
      sidebarCol.innerHTML = '';
      sidebarCol.appendChild(mountDiv);
      return mountDiv;
    }
    return null;
  }

  function hydrate(tour) {
    if (!tour || typeof tour !== 'object') return null;
    const doc = global.document;
    if (!doc) return tour;

    const days = Number(tour.duration_days) || 1;
    const nights = Number(tour.duration_nights) || Math.max(1, days - 1);
    const durationLabel = `${days} Days / ${nights} Nights`;
    const basePrice = Number(tour.price_3star_usd || tour.price_usd || 0);

    doc.title = `${tour.title} (${durationLabel}) — Bhutan Fast Rate Tours`;

    const titleEl = doc.querySelector('[data-tour-title]') || doc.querySelector('section h1') || doc.querySelector('h1');
    if (titleEl) titleEl.textContent = tour.title || '';

    const catEl = doc.querySelector('[data-tour-category]');
    if (catEl) catEl.textContent = tour.category || 'Bhutan Tour';

    const durEl = doc.querySelector('[data-tour-duration]');
    if (durEl) durEl.textContent = durationLabel;

    const diffEl = doc.querySelector('[data-tour-difficulty]');
    if (diffEl) diffEl.textContent = tour.difficulty || 'Easy to Moderate';

    const subEl = doc.querySelector('[data-tour-subtitle]');
    if (subEl) subEl.textContent = tour.subtitle || '';

    const highEl = doc.querySelector('[data-tour-highlight]');
    if (highEl) highEl.textContent = tour.highlight_text || tour.subtitle || '';

    const valleysEl = doc.querySelector('[data-tour-valleys]');
    if (valleysEl) valleysEl.textContent = tour.valleys || '';

    const priceEl = doc.querySelector('[data-tour-price]');
    if (priceEl) priceEl.textContent = `${fmtCurrency(basePrice, 'USD')} / person`;

    const tiersEl = doc.querySelector('[data-tour-tiers]');
    if (tiersEl) tiersEl.innerHTML = renderTierBreakdownHtml(tour);

    const imgEl = doc.querySelector('[data-tour-image]');
    if (imgEl && tour.cover_image) {
      imgEl.setAttribute('src', tour.cover_image);
      imgEl.setAttribute('alt', tour.title || 'Bhutan Tour');
    }

    const itinerary = normalizeArrayField(tour.itinerary, tour.itinerary_json);
    const itinEl = doc.querySelector('[data-tour-itinerary]') || findFallbackContainer(doc, 'itinerary', '.space-y-6');
    if (itinEl && itinerary.length > 0) {
      itinEl.innerHTML = renderItineraryHtml(itinerary);
    }

    const inclusions = normalizeArrayField(tour.inclusions, tour.inclusions_json);
    const incEl = doc.querySelector('[data-tour-inclusions]') || findFallbackContainer(doc, 'inclusions', '.grid');
    if (incEl && inclusions.length > 0) {
      incEl.innerHTML = renderChecklistHtml(inclusions, '✓');
    }

    const exclusions = normalizeArrayField(tour.exclusions, tour.exclusions_json);
    const excEl = doc.querySelector('[data-tour-exclusions]');
    if (excEl && exclusions.length > 0) {
      excEl.innerHTML = renderChecklistHtml(exclusions, '✕');
    }

    const widgetContainer = ensureBookingWidgetTarget(doc);
    if (widgetContainer && global.BookingWidget && typeof global.BookingWidget.mount === 'function') {
      global.BookingWidget.mount({
        container: widgetContainer,
        tour,
        tourId: tour.id,
        tourSlug: tour.id || tour.slug
      });
    }

    return tour;
  }

  function showTourError(doc, message) {
    const errEl = doc.querySelector('[data-tour-error]');
    if (errEl) {
      errEl.textContent = String(message || 'Tour package not found.');
      if (errEl.classList) errEl.classList.remove('hidden');
    }
  }

  async function init(options = {}) {
    const doc = global.document;
    const slug = options.slug || resolveTourSlug(options.location || global.location);
    if (!slug) {
      if (doc) showTourError(doc, 'No tour package specified. Please choose a tour from our catalog.');
      return null;
    }

    if (!global.ApiClient || typeof global.ApiClient.getTour !== 'function') {
      return null;
    }

    try {
      const res = await global.ApiClient.getTour(slug);
      const tour = res && res.data ? res.data : res;
      if (!tour || !tour.title) {
        if (doc) showTourError(doc, 'Tour package not found or currently inactive.');
        return null;
      }
      return hydrate(tour);
    } catch (err) {
      if (doc) showTourError(doc, err.message || 'Unable to load tour details from server.');
      return null;
    }
  }

  const TourDetailHydrator = {
    init,
    resolveTourSlug,
    hydrate
  };

  global.TourDetailHydrator = TourDetailHydrator;

  if (!global.__BFR_DISABLE_AUTO_INIT__ && global.document && typeof global.document.addEventListener === 'function') {
    const runInit = () => {
      if (resolveTourSlug(global.location)) {
        global.__BFR_DEFER_WIDGET_MOUNT__ = true;
        init();
      }
    };
    if (global.document.readyState === 'loading') {
      global.document.addEventListener('DOMContentLoaded', runInit);
    } else {
      runInit();
    }
  }
})(typeof window !== 'undefined' ? window : globalThis);
