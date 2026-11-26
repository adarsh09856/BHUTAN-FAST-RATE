/**
 * Bhutan Fast Rate Tours — Theme-Preserving Shared Site Shell
 * Hydrates canonical company metadata, license (#TR/2018/9882), contact details,
 * WhatsApp links, and optional portal navigation without altering page styling.
 */
(function (global) {
  'use strict';

  const DEFAULT_PUBLIC_SETTINGS = {
    company_name: 'Bhutan Fast Rate Tours',
    company_license: 'TR/2018/9882',
    company_tagline: 'Royal Government of Bhutan Tourism Certified',
    company_phone: '+975 17 654 321',
    company_whatsapp: '+97517654321',
    company_email: 'reservations@bhutanfastratetours.bt',
    company_address: 'Norzin Lam, Opposite Clock Tower Square, Thimphu, Bhutan'
  };

  let cachedSettings = null;
  let pendingPromise = null;

  function escapeHtml(value) {
    if (value === undefined || value === null) return '';
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function formatCurrency(amount, currency = 'USD', options = {}) {
    if (global.ApiClient && typeof global.ApiClient.formatCurrency === 'function') {
      return global.ApiClient.formatCurrency(amount, currency, options);
    }
    const curr = String(currency || 'USD').trim().toUpperCase() === 'INR' ? 'INR' : 'USD';
    const num = Number(amount);
    const safeNum = Number.isFinite(num) ? num : 0;
    const sign = safeNum < 0 ? '-' : '';
    const symbol = curr === 'INR' ? '₹' : '$';
    const formatted = `${sign}${symbol}${Math.round(Math.abs(safeNum)).toLocaleString('en-US')}`;
    return options.withCode ? `${formatted} ${curr}` : formatted;
  }

  function formatDate(value) {
    if (!value) return '';
    const str = String(value).trim();
    const isoMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
    const dt = isoMatch
      ? new Date(Date.UTC(Number(isoMatch[1]), Number(isoMatch[2]) - 1, Number(isoMatch[3])))
      : new Date(str);
    if (Number.isNaN(dt.getTime())) return str;
    return dt.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      timeZone: 'UTC'
    });
  }

  function getQueryParam(name) {
    try {
      const search = (global.location && global.location.search) || '';
      return new URLSearchParams(search).get(name);
    } catch (_) {
      return null;
    }
  }

  function formatLicense(rawLicense) {
    const clean = String(rawLicense || DEFAULT_PUBLIC_SETTINGS.company_license).trim();
    return clean.startsWith('#') ? clean : `#${clean}`;
  }

  function normalizePhoneDigits(phone) {
    return String(phone || DEFAULT_PUBLIC_SETTINGS.company_whatsapp).replace(/\D+/g, '');
  }

  function buildWhatsAppHref(phone, existingHref, customText) {
    const digits = normalizePhoneDigits(phone);
    let textParam = customText || '';
    if (!textParam && existingHref && existingHref.includes('?')) {
      try {
        const q = new URLSearchParams(existingHref.split('?')[1]);
        textParam = q.get('text') || '';
      } catch (_) {
        textParam = '';
      }
    }
    const base = `https://wa.me/${digits}`;
    return textParam ? `${base}?text=${encodeURIComponent(textParam)}` : base;
  }

  function toast(message, type = 'success') {
    const doc = global.document;
    if (!doc || !doc.body) return;
    const existing = doc.getElementById('bfrSiteToast');
    if (existing && typeof existing.remove === 'function') existing.remove();

    const el = doc.createElement('div');
    el.id = 'bfrSiteToast';
    const bg = type === 'error' ? '#b91c1c' : (type === 'warning' ? '#b45309' : '#0f766e');
    el.style.position = 'fixed';
    el.style.bottom = '20px';
    el.style.right = '20px';
    el.style.zIndex = '9999';
    el.style.backgroundColor = bg;
    el.style.color = '#ffffff';
    el.style.padding = '12px 18px';
    el.style.borderRadius = '10px';
    el.style.fontSize = '13px';
    el.style.fontWeight = '700';
    el.style.boxShadow = '0 10px 25px rgba(0,0,0,0.22)';
    el.style.maxWidth = '360px';
    el.textContent = String(message || '');
    doc.body.appendChild(el);

    setTimeout(() => {
      try {
        if (typeof el.remove === 'function') el.remove();
      } catch (_) {}
    }, 3600);
  }

  async function getPublicSettings(forceRefresh = false) {
    if (cachedSettings && !forceRefresh) {
      return cachedSettings;
    }
    if (pendingPromise && !forceRefresh) {
      return pendingPromise;
    }

    pendingPromise = (async () => {
      try {
        if (global.ApiClient && typeof global.ApiClient.getPublicSettings === 'function') {
          const res = await global.ApiClient.getPublicSettings();
          const data = res && res.data ? res.data : res;
          if (data && typeof data === 'object') {
            cachedSettings = { ...DEFAULT_PUBLIC_SETTINGS, ...data };
            return cachedSettings;
          }
        }
      } catch (_) {
        // Non-blocking fallback for static shell display fields
      } finally {
        pendingPromise = null;
      }
      cachedSettings = { ...DEFAULT_PUBLIC_SETTINGS };
      return cachedSettings;
    })();

    return pendingPromise;
  }

  function hydrateDeclarativeNodes(doc, settings) {
    const license = formatLicense(settings.company_license);
    const companyName = settings.company_name || DEFAULT_PUBLIC_SETTINGS.company_name;
    const tagline = settings.company_tagline || DEFAULT_PUBLIC_SETTINGS.company_tagline;
    const phone = settings.company_phone || DEFAULT_PUBLIC_SETTINGS.company_phone;
    const email = settings.company_email || DEFAULT_PUBLIC_SETTINGS.company_email;
    const whatsapp = settings.company_whatsapp || DEFAULT_PUBLIC_SETTINGS.company_whatsapp;
    const address = settings.company_address || DEFAULT_PUBLIC_SETTINGS.company_address;

    for (const el of doc.querySelectorAll('[data-bfr-license]')) {
      el.textContent = license;
    }
    for (const el of doc.querySelectorAll('[data-bfr-company]')) {
      el.textContent = companyName;
    }
    for (const el of doc.querySelectorAll('[data-bfr-tagline]')) {
      el.textContent = tagline;
    }
    for (const el of doc.querySelectorAll('[data-bfr-address]')) {
      el.textContent = address;
    }
    for (const el of doc.querySelectorAll('[data-bfr-phone]')) {
      el.textContent = phone;
      if (el.tagName === 'A') {
        el.setAttribute('href', `tel:${phone.replace(/[^\d+]/g, '')}`);
      }
    }
    for (const el of doc.querySelectorAll('[data-bfr-email]')) {
      el.textContent = email;
      if (el.tagName === 'A') {
        el.setAttribute('href', `mailto:${email}`);
      }
    }
    for (const el of doc.querySelectorAll('[data-bfr-whatsapp]')) {
      const customText = typeof el.getAttribute === 'function' ? el.getAttribute('data-bfr-whatsapp-text') : '';
      const existingHref = typeof el.getAttribute === 'function' ? el.getAttribute('href') : '';
      if (el.tagName === 'A') {
        el.setAttribute('href', buildWhatsAppHref(whatsapp, existingHref, customText));
      }
      if (typeof el.hasAttribute === 'function' && el.hasAttribute('data-bfr-whatsapp-display')) {
        el.textContent = whatsapp;
      }
    }

    // Safe fallback sync on existing mailto/WhatsApp anchors without touching CSS
    for (const link of doc.querySelectorAll('a[href^="mailto:"]')) {
      if (typeof link.hasAttribute === 'function' && link.hasAttribute('data-bfr-preserve-href')) continue;
      const hrefVal = (link.getAttribute('href') || '').toLowerCase();
      if (hrefVal.includes('bhutanfastratetours.bt')) {
        link.setAttribute('href', `mailto:${email}`);
        if ((link.textContent || '').toLowerCase().includes('@bhutanfastratetours.bt')) {
          link.textContent = email;
        }
      }
    }

    for (const link of doc.querySelectorAll('a[href*="wa.me/"]')) {
      if (typeof link.hasAttribute === 'function' && link.hasAttribute('data-bfr-preserve-href')) continue;
      const existing = link.getAttribute('href') || '';
      link.setAttribute('href', buildWhatsAppHref(whatsapp, existing));
    }
  }

  function syncPortalLinks(doc) {
    const containers = doc.querySelectorAll('[data-bfr-portal-links]');
    for (const container of containers) {
      const existingLinks = typeof container.querySelectorAll === 'function' ? container.querySelectorAll('a') : [];
      const hasHref = (target) => {
        for (const a of existingLinks) {
          const href = (typeof a.getAttribute === 'function' ? a.getAttribute('href') : a.href) || '';
          if (href.includes(target)) return true;
        }
        for (const child of (container.children || [])) {
          const href = child.href || '';
          if (href.includes(target)) return true;
        }
        return false;
      };

      const customClass = typeof container.getAttribute === 'function'
        ? container.getAttribute('data-bfr-portal-link-class')
        : '';
      const siblingClass = existingLinks.length > 0 && existingLinks[0].className ? existingLinks[0].className : '';
      const linkClass = customClass || siblingClass || '';

      const portalItems = [
        { href: 'track-visa.html', label: 'Track Visa' },
        { href: 'client/login.html', label: 'Client Portal' }
      ];

      for (const item of portalItems) {
        if (hasHref(item.href)) continue;
        const a = doc.createElement('a');
        a.setAttribute('href', item.href);
        a.href = item.href;
        if (linkClass) a.className = linkClass;
        a.textContent = item.label;
        container.appendChild(a);
      }
    }
  }

  function bindMobileMenus(doc) {
    const tourBtn = doc.getElementById('tourMobileBtn');
    const tourMenu = doc.getElementById('tourMobileMenu');
    if (tourBtn && tourMenu && !tourBtn.dataset.bfrBound) {
      tourBtn.dataset.bfrBound = '1';
      tourBtn.addEventListener('click', () => {
        if (tourMenu.classList) tourMenu.classList.toggle('hidden');
      });
    }

    const mobileBtn = doc.getElementById('mobileMenuBtn');
    const closeBtn = doc.getElementById('closeDrawerBtn');
    const drawer = doc.getElementById('mobileDrawer');
    if (mobileBtn && drawer && !mobileBtn.dataset.bfrBound) {
      mobileBtn.dataset.bfrBound = '1';
      mobileBtn.addEventListener('click', () => {
        if (drawer.classList) drawer.classList.remove('hidden');
      });
      if (closeBtn) {
        closeBtn.addEventListener('click', () => {
          if (drawer.classList) drawer.classList.add('hidden');
        });
      }
    }
  }

  async function init(options = {}) {
    const doc = global.document;
    const settings = await getPublicSettings(Boolean(options.forceRefresh));
    if (doc) {
      hydrateDeclarativeNodes(doc, settings);
      syncPortalLinks(doc);
      bindMobileMenus(doc);
    }
    return settings;
  }

  const SiteShell = {
    init,
    getPublicSettings,
    escapeHtml,
    formatCurrency,
    formatDate,
    getQueryParam,
    toast,
    formatLicense
  };

  global.SiteShell = SiteShell;

  if (!global.__BFR_DISABLE_AUTO_INIT__ && global.document && typeof global.document.addEventListener === 'function') {
    if (global.document.readyState === 'loading') {
      global.document.addEventListener('DOMContentLoaded', () => {
        init();
      });
    } else {
      init();
    }
  }
})(typeof window !== 'undefined' ? window : globalThis);
