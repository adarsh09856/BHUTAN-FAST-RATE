const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const WORKTREE_ROOT = path.resolve(__dirname, '..');
const JS_DIR = path.join(WORKTREE_ROOT, 'js');

function createStorage(initial = {}) {
  const store = new Map(Object.entries(initial).map(([k, v]) => [k, String(v)]));
  return {
    getItem(k) {
      return store.has(k) ? store.get(k) : null;
    },
    setItem(k, v) {
      store.set(String(k), String(v));
    },
    removeItem(k) {
      store.delete(String(k));
    },
    clear() {
      store.clear();
    },
    _dump() {
      return Object.fromEntries(store.entries());
    }
  };
}

class MockFormData {
  constructor() {
    this._fields = [];
  }
  append(k, v) {
    this._fields.push([k, v]);
  }
}

function createMockElement(tagName = 'div', attrs = {}) {
  const el = {
    tagName: tagName.toUpperCase(),
    id: attrs.id || '',
    className: attrs.className || '',
    _innerHTML: '',
    _textContent: '',
    value: attrs.value || '',
    href: attrs.href || '',
    src: attrs.src || '',
    alt: attrs.alt || '',
    style: {},
    dataset: {},
    children: [],
    _attrs: { ...attrs },
    _listeners: {},
    classList: {
      _set: new Set(String(attrs.className || '').split(/\s+/).filter(Boolean)),
      add(...cls) { cls.forEach(c => this._set.add(c)); },
      remove(...cls) { cls.forEach(c => this._set.delete(c)); },
      toggle(c) { if (this._set.has(c)) this._set.delete(c); else this._set.add(c); },
      contains(c) { return this._set.has(c); }
    },
    getAttribute(name) {
      if (name === 'href') return this.href || this._attrs.href || null;
      return Object.prototype.hasOwnProperty.call(this._attrs, name) ? this._attrs[name] : null;
    },
    setAttribute(name, val) {
      this._attrs[name] = String(val);
      if (name === 'href') this.href = String(val);
      if (name === 'src') this.src = String(val);
      if (name === 'id') this.id = String(val);
    },
    hasAttribute(name) {
      return Object.prototype.hasOwnProperty.call(this._attrs, name);
    },
    appendChild(child) {
      this.children.push(child);
      return child;
    },
    addEventListener(type, fn) {
      if (!this._listeners[type]) this._listeners[type] = [];
      this._listeners[type].push(fn);
    },
    dispatchEvent(evt) {
      const list = this._listeners[evt.type] || [];
      for (const fn of list) fn(evt);
    },
    querySelector() { return null; },
    querySelectorAll() { return []; }
  };
  Object.defineProperty(el, 'innerHTML', {
    get() { return this._innerHTML; },
    set(val) { this._innerHTML = String(val); }
  });
  Object.defineProperty(el, 'innerText', {
    get() { return this._textContent; },
    set(val) { this._textContent = String(val); }
  });
  Object.defineProperty(el, 'textContent', {
    get() { return this._textContent; },
    set(val) { this._textContent = String(val); }
  });
  return el;
}

function loadScriptsInSandbox(scriptFiles, options = {}) {
  const localStorage = options.localStorage || createStorage();
  const location = {
    protocol: options.protocol || 'http:',
    pathname: options.pathname || '/index.html',
    search: options.search || '',
    href: options.href || 'http://127.0.0.1:3000/index.html',
    origin: 'http://127.0.0.1:3000'
  };

  const elementsById = options.elementsById || {};
  const selectorAllMap = options.selectorAllMap || {};
  const selectorOneMap = options.selectorOneMap || {};

  const document = {
    title: options.title || 'Bhutan Fast Rate Tours',
    body: createMockElement('body'),
    readyState: 'complete',
    createElement(tag) {
      return createMockElement(tag);
    },
    getElementById(id) {
      return elementsById[id] || null;
    },
    querySelector(sel) {
      if (Object.prototype.hasOwnProperty.call(selectorOneMap, sel)) {
        return selectorOneMap[sel];
      }
      if (sel.startsWith('#')) {
        return elementsById[sel.slice(1)] || null;
      }
      const list = selectorAllMap[sel];
      return Array.isArray(list) && list.length > 0 ? list[0] : null;
    },
    querySelectorAll(sel) {
      return selectorAllMap[sel] || [];
    },
    addEventListener() {}
  };

  const windowObj = {
    __BFR_DISABLE_AUTO_INIT__: true,
    location,
    localStorage,
    document,
    FormData: MockFormData,
    URLSearchParams,
    AbortSignal: global.AbortSignal,
    console
  };
  windowObj.window = windowObj;

  const sandbox = {
    window: windowObj,
    document,
    location,
    localStorage,
    fetch: options.fetch || (async () => { throw new Error('fetch not mocked'); }),
    FormData: MockFormData,
    URLSearchParams,
    AbortSignal: global.AbortSignal,
    setTimeout,
    clearTimeout,
    console
  };

  const context = vm.createContext(sandbox);
  for (const relPath of scriptFiles) {
    const absPath = path.join(WORKTREE_ROOT, relPath);
    const code = fs.readFileSync(absPath, 'utf8');
    new vm.Script(code, { filename: relPath }).runInContext(context);
  }
  return { window: windowObj, document, location, localStorage, context };
}

async function runTests() {
  console.log('1. Verifying syntax and zero hardcoded credentials across js/*.js...');
  const requiredModules = [
    'js/api-client.js',
    'js/site-shell.js',
    'js/booking-widget.js',
    'js/tour-detail.js'
  ];

  for (const mod of requiredModules) {
    const full = path.join(WORKTREE_ROOT, mod);
    assert.ok(fs.existsSync(full), `Missing required module: ${mod}`);
    const code = fs.readFileSync(full, 'utf8');
    new vm.Script(code, { filename: mod });
  }

  const jsFiles = fs.readdirSync(JS_DIR).filter(f => f.endsWith('.js'));
  for (const file of jsFiles) {
    const content = fs.readFileSync(path.join(JS_DIR, file), 'utf8');
    assert.strictEqual(content.includes('admin123'), false, `Hardcoded credential 'admin123' found in js/${file}`);
    assert.strictEqual(content.includes('demo_token_admin'), false, `Hardcoded demo token found in js/${file}`);
    assert.strictEqual(content.includes('concierge123'), false, `Hardcoded credential 'concierge123' found in js/${file}`);
    assert.strictEqual(content.includes('guide123'), false, `Hardcoded credential 'guide123' found in js/${file}`);
  }

  console.log('2. Testing HTTP purity: network & HTTP errors propagate without localStorage fallback...');
  {
    const storage = createStorage();
    const { window } = loadScriptsInSandbox(['js/api-client.js'], {
      protocol: 'http:',
      localStorage: storage,
      fetch: async () => {
        throw new Error('ECONNREFUSED');
      }
    });

    await assert.rejects(
      () => window.ApiClient.submitBooking({
        tour_id: 'essential-bhutan-7d',
        lead_name: 'Alice',
        lead_email: 'alice@example.com',
        lead_phone: '+15550100',
        travel_date_start: '2026-10-15'
      }),
      /ECONNREFUSED|reach|server/i,
      'submitBooking must propagate error when HTTP server is unreachable'
    );
    assert.strictEqual(storage.getItem('bfr_bookings'), null, 'Must NEVER write fake bookings into localStorage over HTTP');

    await assert.rejects(
      () => window.ApiClient.adminLogin('admin@bhutanfastratetours.bt', 'secret'),
      /ECONNREFUSED|reach|server/i,
      'adminLogin must propagate error when HTTP server is unreachable'
    );
  }

  {
    const { window } = loadScriptsInSandbox(['js/api-client.js'], {
      protocol: 'https:',
      fetch: async () => ({
        ok: false,
        status: 500,
        headers: { get: () => 'application/json' },
        json: async () => ({ success: false, error: 'Database unavailable' }),
        text: async () => JSON.stringify({ success: false, error: 'Database unavailable' })
      })
    });

    await assert.rejects(
      () => window.ApiClient.getTours(),
      (err) => err && err.status === 500 && /Database unavailable/i.test(err.message),
      'getTours must propagate HTTP 500 errors cleanly'
    );
  }

  console.log('3. Testing portal-scoped Bearer token routing, FormData upload, and document URLs...');
  {
    const calls = [];
    const storage = createStorage({
      bfr_admin_token: 'adm_jwt_111',
      bfr_client_token: 'cli_jwt_222',
      bfr_guide_token: 'gui_jwt_333'
    });

    const { window } = loadScriptsInSandbox(['js/api-client.js'], {
      protocol: 'http:',
      localStorage: storage,
      fetch: async (url, init = {}) => {
        calls.push({ url, init });
        return {
          ok: true,
          status: 200,
          headers: { get: () => 'application/json' },
          json: async () => ({ success: true, data: [] }),
          text: async () => JSON.stringify({ success: true, data: [] })
        };
      }
    });

    await window.ApiClient.getTours();
    await window.ApiClient.getAdminBookings({ status: 'inquiry' });
    await window.ApiClient.getNotifications({ unread: 1 });
    await window.ApiClient.getClientBookingProfile();
    await window.ApiClient.getGuideAssignments();

    const fd = new MockFormData();
    fd.append('passport_number', 'P1234567');
    await window.ApiClient.uploadTravelerDocuments(42, fd);

    assert.strictEqual(calls.length, 6);

    // Public tours call: no Authorization header
    const pubHeaders = calls[0].init.headers || {};
    assert.strictEqual(pubHeaders.Authorization, undefined);

    // Admin bookings & notifications: admin token
    assert.strictEqual(calls[1].init.headers.Authorization, 'Bearer adm_jwt_111');
    assert.ok(calls[2].url.startsWith('/api/notifications'), `Expected /api/notifications, got ${calls[2].url}`);
    assert.strictEqual(calls[2].init.headers.Authorization, 'Bearer adm_jwt_111');

    // Client booking: client token
    assert.strictEqual(calls[3].url, '/api/client/booking');
    assert.strictEqual(calls[3].init.headers.Authorization, 'Bearer cli_jwt_222');

    // Guide assignments: guide token
    assert.strictEqual(calls[4].url, '/api/guide/assignments');
    assert.strictEqual(calls[4].init.headers.Authorization, 'Bearer gui_jwt_333');

    // FormData upload: client token attached, Content-Type MUST NOT be set!
    const uploadCall = calls[5];
    assert.strictEqual(uploadCall.url, '/api/client/travelers/42/documents');
    assert.strictEqual(uploadCall.init.method, 'POST');
    assert.strictEqual(uploadCall.init.body, fd);
    assert.strictEqual(uploadCall.init.headers.Authorization, 'Bearer cli_jwt_222');
    const headerKeysLower = Object.keys(uploadCall.init.headers).map(k => k.toLowerCase());
    assert.strictEqual(headerKeysLower.includes('content-type'), false, 'FormData request must NOT manually set Content-Type');

    // buildDocumentUrl allowlist & query-token behavior
    const invUrl = window.ApiClient.buildDocumentUrl('/api/bookings/BFR-2026-8841/invoice-view');
    assert.strictEqual(invUrl, '/api/bookings/BFR-2026-8841/invoice-view?token=adm_jwt_111');
    const explicitClrUrl = window.ApiClient.buildDocumentUrl('/api/bookings/BFR-2026-8841/clearance-view', 'cli_jwt_222');
    assert.strictEqual(explicitClrUrl, '/api/bookings/BFR-2026-8841/clearance-view?token=cli_jwt_222');
    const clientDocUrl = window.ApiClient.buildDocumentUrl('/api/client/documents/42/passport_scan');
    assert.strictEqual(clientDocUrl, '/api/client/documents/42/passport_scan?token=cli_jwt_222');
    const adminReceiptUrl = window.ApiClient.buildDocumentUrl('/api/admin/payments/9/receipt');
    assert.strictEqual(adminReceiptUrl, '/api/admin/payments/9/receipt?token=adm_jwt_111');

    // Non-document API routes and external URLs MUST NEVER receive ?token=
    assert.strictEqual(
      window.ApiClient.buildDocumentUrl('/api/admin/users'),
      '/api/admin/users',
      'Non-document API path must NOT append ?token='
    );
    assert.strictEqual(
      window.ApiClient.buildDocumentUrl('https://evil.example/steal'),
      'https://evil.example/steal',
      'External URL must NOT append ?token='
    );
    assert.strictEqual(
      window.ApiClient.buildDocumentUrl('https://evil.example/api/bookings/BFR-1/invoice-view'),
      'https://evil.example/api/bookings/BFR-1/invoice-view',
      'External URL with matching path suffix must NOT append ?token='
    );
  }

  console.log('3b. Testing non-JSON 502 HTML response parsing without stream lock...');
  {
    let bodyRead = false;
    const { window } = loadScriptsInSandbox(['js/api-client.js'], {
      protocol: 'http:',
      fetch: async () => ({
        ok: false,
        status: 502,
        headers: { get: () => 'text/html; charset=utf-8' },
        async text() {
          if (bodyRead) throw new TypeError('Body has already been read');
          bodyRead = true;
          return '<html><body>502 Bad Gateway</body></html>';
        },
        async json() {
          if (bodyRead) throw new TypeError('Body has already been read');
          bodyRead = true;
          throw new SyntaxError('Unexpected token < in JSON');
        }
      })
    });

    await assert.rejects(
      () => window.ApiClient.getTours(),
      (err) => err && err.status === 502 && !/Body has already been read/i.test(err.message),
      'Non-JSON 502 HTML response must preserve status 502 without stream-lock TypeError'
    );
  }

  console.log('4. Testing 401 unauthorized hook & portal login redirect (and no loop on login.html)...');
  {
    const storage = createStorage({
      bfr_admin_token: 'expired_adm_token',
      bfr_admin_user: '{"name":"Old"}'
    });
    let unauthEvent = null;
    const { window, location } = loadScriptsInSandbox(['js/api-client.js'], {
      protocol: 'http:',
      pathname: '/admin/bookings.html',
      href: 'http://127.0.0.1:3000/admin/bookings.html',
      localStorage: storage,
      fetch: async () => ({
        ok: false,
        status: 401,
        headers: { get: () => 'application/json' },
        json: async () => ({ success: false, error: 'Token expired' }),
        text: async () => JSON.stringify({ success: false, error: 'Token expired' })
      })
    });

    window.ApiClient.onUnauthorized = (info) => { unauthEvent = info; };
    await assert.rejects(() => window.ApiClient.getAdminBookings(), /Token expired|Unauthorized/i);
    assert.ok(unauthEvent && unauthEvent.portal === 'admin' && unauthEvent.status === 401);
    assert.strictEqual(storage.getItem('bfr_admin_token'), null, 'Expired token must be cleared on 401');
    assert.strictEqual(location.href, 'login.html', 'Must redirect to portal login.html on 401');
  }

  {
    // On login.html, 401 from /auth/login must NOT redirect
    const { window, location } = loadScriptsInSandbox(['js/api-client.js'], {
      protocol: 'http:',
      pathname: '/admin/login.html',
      href: 'http://127.0.0.1:3000/admin/login.html',
      fetch: async () => ({
        ok: false,
        status: 401,
        headers: { get: () => 'application/json' },
        json: async () => ({ success: false, error: 'Invalid staff credentials' }),
        text: async () => JSON.stringify({ success: false, error: 'Invalid staff credentials' })
      })
    });

    await assert.rejects(() => window.ApiClient.adminLogin('a@b.com', 'wrong'), /Invalid staff credentials/);
    assert.strictEqual(location.href, 'http://127.0.0.1:3000/admin/login.html');
  }

  console.log('5. Testing formatCurrency & buildBookUrl helpers...');
  {
    const { window } = loadScriptsInSandbox(['js/api-client.js']);
    assert.strictEqual(window.ApiClient.formatCurrency(2480, 'USD'), '$2,480');
    assert.strictEqual(window.ApiClient.formatCurrency(12000, 'INR'), '₹12,000');
    assert.strictEqual(window.ApiClient.formatCurrency(0, 'USD'), '$0');

    const bookUrl = window.ApiClient.buildBookUrl({
      tour: 'druk-path-trek',
      date: '2026-10-15',
      nights: 8,
      tier: '4-star',
      nationality: 'india',
      adults: 2,
      children_6_12: 1,
      children_under_6: 0
    });
    assert.ok(bookUrl.startsWith('book.html?'), `Expected book.html?..., got ${bookUrl}`);
    const qs = new URLSearchParams(bookUrl.split('?')[1]);
    assert.strictEqual(qs.get('tour'), 'druk-path-trek');
    assert.strictEqual(qs.get('date'), '2026-10-15');
    assert.strictEqual(qs.get('nights'), '8');
    assert.strictEqual(qs.get('tier'), '4-star');
    assert.strictEqual(qs.get('nationality'), 'india');
    assert.strictEqual(qs.get('adults'), '2');
    assert.strictEqual(qs.get('children_6_12'), '1');
    assert.strictEqual(qs.get('children_under_6'), '0');
  }

  console.log('6. Testing SiteShell public settings hydration & XSS escaping...');
  {
    const licenseEl = createMockElement('span');
    const phoneEl = createMockElement('a');
    const emailEl = createMockElement('a');
    const waEl = createMockElement('a');
    const companyEl = createMockElement('span');
    const portalNavEl = createMockElement('nav');

    const { window } = loadScriptsInSandbox(['js/api-client.js', 'js/site-shell.js'], {
      selectorAllMap: {
        '[data-bfr-license]': [licenseEl],
        '[data-bfr-phone]': [phoneEl],
        '[data-bfr-email]': [emailEl],
        '[data-bfr-whatsapp]': [waEl],
        '[data-bfr-company]': [companyEl],
        '[data-bfr-portal-links]': [portalNavEl],
        'a[href^="mailto:"]': [],
        'a[href*="wa.me/"]': []
      },
      fetch: async (url) => {
        if (url === '/api/settings/public') {
          return {
            ok: true,
            status: 200,
            headers: { get: () => 'application/json' },
            json: async () => ({
              success: true,
              data: {
                company_name: 'Bhutan Fast Rate Tours',
                company_license: 'TR/2018/9882',
                company_phone: '+975 17 654 321',
                company_whatsapp: '+97517654321',
                company_email: 'reservations@bhutanfastratetours.bt'
              }
            })
          };
        }
        throw new Error(`Unexpected fetch ${url}`);
      }
    });

    await window.SiteShell.init();
    assert.strictEqual(licenseEl.textContent, '#TR/2018/9882');
    assert.strictEqual(companyEl.textContent, 'Bhutan Fast Rate Tours');
    assert.strictEqual(phoneEl.textContent, '+975 17 654 321');
    assert.strictEqual(emailEl.href, 'mailto:reservations@bhutanfastratetours.bt');
    assert.ok(waEl.href.includes('https://wa.me/97517654321'));
    assert.strictEqual(
      window.SiteShell.escapeHtml('<script>"test"&\'x\'</script>'),
      '&lt;script&gt;&quot;test&quot;&amp;&#39;x&#39;&lt;/script&gt;'
    );
    assert.ok(portalNavEl.children.some(c => c.href === 'client/login.html'));
    assert.ok(portalNavEl.children.some(c => c.href === 'track-visa.html'));
  }

  console.log('7. Testing BookingWidget live tier pricing, multi-currency SDF quote & book.html routing...');
  {
    const container = createMockElement('div', { id: 'tourBookingWidget' });
    const mockTour = {
      id: 'druk-path-trek',
      slug: 'tour-druk-path-trek.html',
      title: 'Druk Path High Alpine Wilderness Trek',
      duration_days: 9,
      duration_nights: 8,
      price_usd: 2480,
      price_3star_usd: 2480,
      price_4star_usd: 3100,
      price_5star_usd: 4200
    };

    let lastCalcPayload = null;
    const { window } = loadScriptsInSandbox(
      ['js/api-client.js', 'js/site-shell.js', 'js/booking-widget.js'],
      {
        elementsById: { tourBookingWidget: container },
        fetch: async (url, init = {}) => {
          if (url.startsWith('/api/tours/')) {
            return {
              ok: true,
              status: 200,
              headers: { get: () => 'application/json' },
              json: async () => ({ success: true, data: mockTour })
            };
          }
          if (url === '/api/calculate-sdf') {
            lastCalcPayload = JSON.parse(init.body);
            const isIndia = lastCalcPayload.nationality_type === 'india';
            return {
              ok: true,
              status: 200,
              headers: { get: () => 'application/json' },
              json: async () => ({
                success: true,
                data: {
                  currency: isIndia ? 'INR' : 'USD',
                  nationality_type: isIndia ? 'india' : 'international',
                  nights: 8,
                  package_total_local: isIndia ? 527000 : 6200,
                  total_sdf_local: isIndia ? 19200 : 1600,
                  visa_fee_local: isIndia ? 0 : 80,
                  total_price_local: isIndia ? 546200 : 7880,
                  deposit_amount_local: isIndia ? 163860 : 2364,
                  deposit_percent: 0.3
                }
              })
            };
          }
          if (url === '/api/settings/public') {
            return {
              ok: true,
              status: 200,
              headers: { get: () => 'application/json' },
              json: async () => ({ success: true, data: { company_whatsapp: '+97517654321' } })
            };
          }
          throw new Error(`Unexpected URL ${url}`);
        }
      }
    );

    const widget = await window.BookingWidget.mount({
      container,
      tourSlug: 'druk-path-trek'
    });

    assert.ok(container.innerHTML.includes('#14231E'));
    assert.ok(container.innerHTML.includes('#E05A47'));
    assert.ok(container.innerHTML.includes('color-scheme: light !important'));
    assert.ok(lastCalcPayload && lastCalcPayload.tour_slug === 'druk-path-trek');
    const url = widget.getBookUrl();
    assert.ok(url.startsWith('book.html?'), `Expected book.html URL, got ${url}`);
  }

  console.log('8. Testing TourDetailHydrator slug resolution & DOM hydration...');
  {
    const titleEl = createMockElement('h1');
    const catEl = createMockElement('span');
    const durEl = createMockElement('span');
    const priceEl = createMockElement('div');
    const itinEl = createMockElement('div');
    const incEl = createMockElement('div');

    const { window } = loadScriptsInSandbox(
      ['js/api-client.js', 'js/site-shell.js', 'js/booking-widget.js', 'js/tour-detail.js'],
      {
        selectorOneMap: {
          '[data-tour-title]': titleEl,
          '[data-tour-category]': catEl,
          '[data-tour-duration]': durEl,
          '[data-tour-price]': priceEl,
          '[data-tour-itinerary]': itinEl,
          '[data-tour-inclusions]': incEl
        }
      }
    );

    assert.strictEqual(
      window.TourDetailHydrator.resolveTourSlug({ pathname: '/tour.html', search: '?slug=custom-pkg' }),
      'custom-pkg'
    );
    assert.strictEqual(
      window.TourDetailHydrator.resolveTourSlug({ pathname: '/tour-druk-path-trek.html', search: '' }),
      'druk-path-trek'
    );
    assert.strictEqual(
      window.TourDetailHydrator.resolveTourSlug({ pathname: '/tour.html', search: '' }),
      null
    );

    window.TourDetailHydrator.hydrate({
      id: 'custom-pkg',
      slug: 'tour-custom-pkg.html',
      title: 'Custom Himalayan Retreat',
      category: 'Luxury Escape',
      difficulty: 'Easy',
      duration_days: 5,
      duration_nights: 4,
      price_usd: 1850,
      price_3star_usd: 1850,
      price_4star_usd: 2300,
      price_5star_usd: 3400,
      valleys: 'Paro, Punakha',
      itinerary: [
        { day: 1, title: 'Arrive Paro', description: 'Welcome transfer' },
        'Day 2: Punakha Dzong visit'
      ],
      inclusions: ['Licensed Guide', 'SDF Included']
    });

    assert.strictEqual(titleEl.textContent, 'Custom Himalayan Retreat');
    assert.strictEqual(catEl.textContent, 'Luxury Escape');
    assert.ok(durEl.textContent.includes('5 Days / 4 Nights'));
    assert.ok(priceEl.textContent.includes('$1,850'));
    assert.ok(itinEl.innerHTML.includes('Arrive Paro') && itinEl.innerHTML.includes('Punakha Dzong visit'));
    assert.ok(incEl.innerHTML.includes('Licensed Guide') && incEl.innerHTML.includes('SDF Included'));
  }

  console.log('9. Testing Client/Guide 401 redirects, FormData receipt upload & Admin/CMS wrapper routes...');
  {
    const storage = createStorage({
      bfr_client_token: 'old_cli',
      bfr_client_booking: '{"id":"BFR-2026-1000"}'
    });
    const { window, location } = loadScriptsInSandbox(['js/api-client.js'], {
      protocol: 'http:',
      pathname: '/client/dashboard.html',
      href: 'http://127.0.0.1:3000/client/dashboard.html',
      localStorage: storage,
      fetch: async () => ({
        ok: false,
        status: 401,
        headers: { get: () => 'application/json' },
        json: async () => ({ success: false, error: 'Client session expired' })
      })
    });

    await assert.rejects(() => window.ApiClient.getClientPayments(), /Client session expired/);
    assert.strictEqual(storage.getItem('bfr_client_token'), null);
    assert.strictEqual(location.href, 'login.html');
  }

  {
    const requests = [];
    const storage = createStorage({
      bfr_admin_token: 'adm_tok',
      bfr_client_token: 'cli_tok'
    });
    const { window } = loadScriptsInSandbox(['js/api-client.js'], {
      protocol: 'http:',
      localStorage: storage,
      fetch: async (url, init = {}) => {
        requests.push({ url, method: init.method || 'GET', headers: init.headers || {}, body: init.body });
        return {
          ok: true,
          status: 200,
          headers: { get: () => 'application/json' },
          json: async () => ({ success: true, data: {} })
        };
      }
    });

    const receiptFd = new MockFormData();
    receiptFd.append('amount', '500');
    await window.ApiClient.uploadPaymentReceipt(receiptFd);
    await window.ApiClient.createAdminBooking({ lead_name: 'Bob', lead_email: 'bob@example.com', lead_phone: '+1555', travel_date_start: '2026-11-01' });
    await window.ApiClient.updateVisaStatus('BFR-2026-1001', 'rejected', '', { rejection_reason: 'Blurry passport scan' });
    await window.ApiClient.verifyPayment(7, 'verified', 'Confirmed wire');
    await window.ApiClient.remitBookingSdf('BFR-2026-1001', { sdf_remittance_ref: 'RMA-1' });
    await window.ApiClient.convertInquiry(5, { travel_date_start: '2026-12-01' });
    await window.ApiClient.createAdminGuide({ full_name: 'Tashi', email: 'tashi@bt', password: 'pw' });
    await window.ApiClient.createAdminDestination({ name: 'Paro', description: 'Valley' });
    await window.ApiClient.createAdminFestival({ name: 'Paro Tshechu', summary: 'Spring' });
    await window.ApiClient.moderateAdminReview(3, { is_published: true });
    await window.ApiClient.sendTestNotification({ channel: 'in_app' });
    await window.ApiClient.getAdminUsers();
    await window.ApiClient.getAuditLogs({ entity_type: 'booking' });

    assert.strictEqual(requests[0].url, '/api/client/payments/receipt');
    assert.strictEqual(requests[0].headers.Authorization, 'Bearer cli_tok');
    assert.strictEqual(Object.keys(requests[0].headers).some(k => k.toLowerCase() === 'content-type'), false);

    assert.strictEqual(requests[1].url, '/api/admin/bookings');
    assert.strictEqual(requests[1].method, 'POST');
    assert.strictEqual(requests[1].headers.Authorization, 'Bearer adm_tok');

    assert.strictEqual(requests[2].url, '/api/admin/bookings/BFR-2026-1001/visa');
    assert.strictEqual(requests[2].method, 'PATCH');
    assert.strictEqual(JSON.parse(requests[2].body).rejection_reason, 'Blurry passport scan');

    assert.strictEqual(requests[3].url, '/api/admin/payments/7/verify');
    assert.strictEqual(requests[4].url, '/api/admin/bookings/BFR-2026-1001/sdf-remit');
    assert.strictEqual(requests[5].url, '/api/admin/inquiries/5/convert');
    assert.strictEqual(requests[6].url, '/api/admin/guides');
    assert.strictEqual(requests[7].url, '/api/admin/destinations');
    assert.strictEqual(requests[8].url, '/api/admin/festivals');
    assert.strictEqual(requests[9].url, '/api/admin/reviews/3');
    assert.strictEqual(requests[10].url, '/api/admin/settings/test-notification');
    assert.strictEqual(requests[11].url, '/api/admin/users');
    assert.strictEqual(requests[12].url, '/api/admin/audit-log?entity_type=booking');
  }

  console.log('10. Testing synchronous __BFR_DEFER_WIDGET_MOUNT__, bfrMountSeq race guard & cover_image sanitization...');
  {
    // Load tour-detail.js with auto-init ENABLED (not disabled) on a tour detail page
    const { window } = loadScriptsInSandbox(['js/api-client.js', 'js/site-shell.js', 'js/tour-detail.js'], {
      protocol: 'http:',
      pathname: '/tour-druk-path-trek.html',
      search: ''
    });
    // Override __BFR_DISABLE_AUTO_INIT__ via fresh context where it's false
    const storage = createStorage();
    const doc = {
      title: 'Tour',
      body: createMockElement('body'),
      readyState: 'loading',
      createElement: (tag) => createMockElement(tag),
      getElementById: () => null,
      querySelector: () => null,
      querySelectorAll: () => [],
      addEventListener() {}
    };
    const winSync = {
      __BFR_DISABLE_AUTO_INIT__: false,
      location: { protocol: 'http:', pathname: '/tour-druk-path-trek.html', search: '' },
      localStorage: storage,
      document: doc,
      URLSearchParams,
      console
    };
    winSync.window = winSync;
    const ctxSync = vm.createContext({
      window: winSync,
      document: doc,
      location: winSync.location,
      localStorage: storage,
      URLSearchParams,
      setTimeout,
      clearTimeout,
      console
    });
    const tdCode = fs.readFileSync(path.join(WORKTREE_ROOT, 'js/tour-detail.js'), 'utf8');
    new vm.Script(tdCode, { filename: 'js/tour-detail.js' }).runInContext(ctxSync);
    assert.strictEqual(
      winSync.__BFR_DEFER_WIDGET_MOUNT__,
      true,
      'tour-detail.js must set __BFR_DEFER_WIDGET_MOUNT__ synchronously before DOMContentLoaded'
    );
    assert.ok(window.TourDetailHydrator);
  }

  {
    // Superseded BookingWidget instance must NEVER overwrite a newer mount on same container
    const container = createMockElement('div', { id: 'tourBookingWidget' });
    let resolveSlowQuote;
    let quoteCallCount = 0;

    const { window } = loadScriptsInSandbox(
      ['js/api-client.js', 'js/site-shell.js', 'js/booking-widget.js'],
      {
        elementsById: { tourBookingWidget: container },
        fetch: async (url) => {
          if (url === '/api/settings/public') {
            return {
              ok: true,
              status: 200,
              headers: { get: () => 'application/json' },
              text: async () => JSON.stringify({ success: true, data: { company_whatsapp: '+97517654321' } })
            };
          }
          if (url === '/api/calculate-sdf') {
            quoteCallCount += 1;
            const callIdx = quoteCallCount;
            if (callIdx === 1) {
              return new Promise((resolve) => {
                resolveSlowQuote = () => resolve({
                  ok: true,
                  status: 200,
                  headers: { get: () => 'application/json' },
                  text: async () => JSON.stringify({
                    success: true,
                    data: {
                      currency: 'USD',
                      package_total_local: 1111,
                      total_sdf_local: 111,
                      visa_fee_local: 40,
                      total_price_local: 1262,
                      deposit_amount_local: 379,
                      deposit_percent: 0.3
                    }
                  })
                });
              });
            }
            return {
              ok: true,
              status: 200,
              headers: { get: () => 'application/json' },
              text: async () => JSON.stringify({
                success: true,
                data: {
                  currency: 'USD',
                  package_total_local: 9999,
                  total_sdf_local: 800,
                  visa_fee_local: 80,
                  total_price_local: 10879,
                  deposit_amount_local: 3264,
                  deposit_percent: 0.3
                }
              })
            };
          }
          throw new Error(`Unexpected URL ${url}`);
        }
      }
    );

    const w1Promise = window.BookingWidget.mount({
      container,
      tour: { id: 'old-tour', title: 'Old Tour', duration_nights: 4, price_3star_usd: 1111 }
    });
    const w2 = await window.BookingWidget.mount({
      container,
      tour: { id: 'new-tour', title: 'New Tour', duration_nights: 8, price_3star_usd: 9999 }
    });
    assert.ok(container.dataset.bfrMountSeq, 'Container must record bfrMountSeq');
    resolveSlowQuote();
    const w1 = await w1Promise;
    assert.strictEqual(w1.quote, null, 'Superseded BookingWidget instance must abort without storing stale quote');
    assert.strictEqual(w2.quote.total_price_local, 10879, 'Newer BookingWidget mount must retain its quote');
  }

  {
    // cover_image XSS validation in TourDetailHydrator.hydrate
    const unsafeImgEl = createMockElement('img');
    const safeImgEl = createMockElement('img');

    const { window: wUnsafe } = loadScriptsInSandbox(
      ['js/api-client.js', 'js/site-shell.js', 'js/tour-detail.js'],
      { selectorOneMap: { '[data-tour-image]': unsafeImgEl } }
    );
    wUnsafe.TourDetailHydrator.hydrate({
      id: 't1',
      title: 'T1',
      duration_days: 3,
      duration_nights: 2,
      price_usd: 500,
      cover_image: 'javascript:alert(1)'
    });
    assert.strictEqual(unsafeImgEl.src, '', 'Unsafe javascript: cover_image must be rejected');

    wUnsafe.TourDetailHydrator.hydrate({
      id: 't2',
      title: 'T2',
      duration_days: 3,
      duration_nights: 2,
      price_usd: 500,
      cover_image: 'data:text/html,<script>alert(1)</script>'
    });
    assert.strictEqual(unsafeImgEl.src, '', 'Unsafe data:text/html cover_image must be rejected');

    const { window: wSafe } = loadScriptsInSandbox(
      ['js/api-client.js', 'js/site-shell.js', 'js/tour-detail.js'],
      { selectorOneMap: { '[data-tour-image]': safeImgEl } }
    );
    wSafe.TourDetailHydrator.hydrate({
      id: 't3',
      title: 'T3',
      duration_days: 3,
      duration_nights: 2,
      price_usd: 500,
      cover_image: 'assets/images/tigers-nest.webp'
    });
    assert.strictEqual(safeImgEl.src, 'assets/images/tigers-nest.webp');
  }

  console.log('\nALL FRONTEND SHARED MODULE TESTS PASSED!');
}

runTests().catch((err) => {
  console.error('\nFRONTEND TEST FAILED:', err);
  process.exit(1);
});
