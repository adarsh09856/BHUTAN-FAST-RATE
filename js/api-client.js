/**
 * Bhutan Fast Rate Tours — Production REST API Client
 * Strict HTTP-first client with portal-scoped Bearer JWT injection,
 * 401 session expiration handling, multipart FormData support, and multi-currency helpers.
 */
(function (global) {
  'use strict';

  const TOKEN_KEYS = {
    admin: 'bfr_admin_token',
    client: 'bfr_client_token',
    guide: 'bfr_guide_token'
  };

  const USER_KEYS = {
    admin: 'bfr_admin_user',
    client: 'bfr_client_booking',
    guide: 'bfr_guide_user'
  };

  let unauthorizedHandler = null;

  function isHttpProtocol() {
    try {
      if (global.location && global.location.protocol) {
        return global.location.protocol === 'http:' || global.location.protocol === 'https:';
      }
    } catch (_) {
      // Ignore environment access issues and default to strict HTTP mode
    }
    return true;
  }

  function safeStorageGet(key) {
    try {
      return global.localStorage ? global.localStorage.getItem(key) : null;
    } catch (_) {
      return null;
    }
  }

  function safeStorageSet(key, value) {
    try {
      if (global.localStorage) {
        global.localStorage.setItem(key, String(value));
      }
    } catch (_) {
      // Ignore storage quota / privacy mode errors
    }
  }

  function safeStorageRemove(key) {
    try {
      if (global.localStorage) {
        global.localStorage.removeItem(key);
      }
    } catch (_) {
      // Ignore storage errors
    }
  }

  function safeJsonParse(raw) {
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch (_) {
      return null;
    }
  }

  function getToken(portal) {
    const key = TOKEN_KEYS[portal];
    return key ? safeStorageGet(key) : null;
  }

  function setToken(portal, token) {
    const key = TOKEN_KEYS[portal];
    if (!key) return;
    if (token) safeStorageSet(key, token);
    else safeStorageRemove(key);
  }

  function clearPortalSession(portal) {
    if (!portal || !TOKEN_KEYS[portal]) return;
    safeStorageRemove(TOKEN_KEYS[portal]);
    safeStorageRemove(USER_KEYS[portal]);
    if (portal === 'client') safeStorageRemove('bfr_client_ref');
    if (portal === 'guide') safeStorageRemove('bfr_guide_auth');
  }

  function setAdminSession(token, user) {
    setToken('admin', token);
    if (user) safeStorageSet(USER_KEYS.admin, JSON.stringify(user));
  }

  function getAdminUser() {
    return safeJsonParse(safeStorageGet(USER_KEYS.admin));
  }

  function setClientSession(token, booking) {
    setToken('client', token);
    if (booking) {
      safeStorageSet(USER_KEYS.client, JSON.stringify(booking));
      if (booking.id) safeStorageSet('bfr_client_ref', booking.id);
    }
  }

  function getClientBooking() {
    return safeJsonParse(safeStorageGet(USER_KEYS.client));
  }

  function setGuideSession(token, guide) {
    setToken('guide', token);
    if (guide) safeStorageSet(USER_KEYS.guide, JSON.stringify(guide));
  }

  function getGuideUser() {
    return safeJsonParse(safeStorageGet(USER_KEYS.guide));
  }

  function getCurrentPagePortal() {
    try {
      const pathname = String((global.location && global.location.pathname) || '').toLowerCase();
      if (/\/admin(\/|$)/.test(pathname)) return 'admin';
      if (/\/client(\/|$)/.test(pathname)) return 'client';
      if (/\/guide(\/|$)/.test(pathname)) return 'guide';
    } catch (_) {
      // Ignore
    }
    return null;
  }

  function isOnLoginPage() {
    try {
      const pathname = String((global.location && global.location.pathname) || '').toLowerCase();
      return pathname.endsWith('/login.html') || pathname === 'login.html';
    } catch (_) {
      return false;
    }
  }

  function getPortalForApiPath(apiPath) {
    const clean = String(apiPath || '').split('?')[0].toLowerCase();
    if (clean.startsWith('/api/admin') || clean.startsWith('/api/notifications')) return 'admin';
    if (clean.startsWith('/api/client')) return 'client';
    if (clean.startsWith('/api/guide')) return 'guide';
    if (/^\/api\/bookings\/[^/]+\/(invoice-view|clearance-view)/.test(clean)) {
      const pagePortal = getCurrentPagePortal();
      if (pagePortal === 'client' && getToken('client')) return 'client';
      if (getToken('admin')) return 'admin';
      if (getToken('client')) return 'client';
    }
    return null;
  }

  function isAuthEndpoint(apiPath) {
    const clean = String(apiPath || '').split('?')[0].toLowerCase();
    return clean === '/api/admin/auth/login' || clean === '/api/client/auth' || clean === '/api/guide/auth/login';
  }

  function isFormDataBody(body) {
    if (!body || typeof body !== 'object') return false;
    if (typeof global.FormData !== 'undefined' && body instanceof global.FormData) return true;
    return typeof body.append === 'function' && body.constructor && body.constructor.name === 'FormData';
  }

  function buildQueryString(params) {
    if (!params || typeof params !== 'object') return '';
    const sp = new URLSearchParams();
    for (const [key, val] of Object.entries(params)) {
      if (val === undefined || val === null || val === '') continue;
      sp.append(key, String(val));
    }
    const qs = sp.toString();
    return qs ? `?${qs}` : '';
  }

  function buildUrl(path, params) {
    const qs = buildQueryString(params);
    if (!qs) return path;
    return path.includes('?') ? `${path}&${qs.slice(1)}` : `${path}${qs}`;
  }

  function handleUnauthorizedResponse(apiPath, errorMessage) {
    if (isAuthEndpoint(apiPath)) return;
    const portal = getPortalForApiPath(apiPath) || getCurrentPagePortal();
    if (portal) {
      clearPortalSession(portal);
    }

    let shouldRedirect = true;
    if (typeof unauthorizedHandler === 'function') {
      const handlerResult = unauthorizedHandler({
        portal,
        status: 401,
        path: apiPath,
        error: errorMessage
      });
      if (handlerResult === false) shouldRedirect = false;
    }

    const pagePortal = getCurrentPagePortal();
    if (shouldRedirect && pagePortal && !isOnLoginPage() && global.location) {
      global.location.href = 'login.html';
    }
  }

  async function parseResponseBody(res, responseType) {
    if (responseType === 'text') return res.text();
    if (responseType === 'blob') return res.blob();

    const contentType = res.headers && typeof res.headers.get === 'function'
      ? String(res.headers.get('content-type') || '').toLowerCase()
      : '';

    if (typeof res.text === 'function') {
      const raw = await res.text();
      if (!raw || !raw.trim()) return null;
      const trimmed = raw.trim();
      const looksJson = contentType.includes('application/json') || trimmed.startsWith('{') || trimmed.startsWith('[');
      if (looksJson) {
        try {
          return JSON.parse(raw);
        } catch (_) {
          return { raw };
        }
      }
      return { raw };
    }

    if (typeof res.json === 'function') {
      try {
        return await res.json();
      } catch (_) {
        return null;
      }
    }
    return null;
  }

  async function request(path, options = {}) {
    if (!isHttpProtocol()) {
      throw new Error('Live API calls require serving the platform over http:// or https://.');
    }

    const method = String(options.method || 'GET').toUpperCase();
    const url = buildUrl(path, options.params);
    const headers = Object.assign({}, options.headers || {});

    if (options.auth !== false) {
      const existingAuth = headers.Authorization || headers.authorization;
      if (!existingAuth) {
        const portal = options.portal || getPortalForApiPath(path);
        const token = options.token || (portal ? getToken(portal) : null);
        if (token) {
          headers.Authorization = `Bearer ${token}`;
        }
      }
    }

    if (options.idempotencyKey) {
      headers['Idempotency-Key'] = String(options.idempotencyKey);
    }

    const fetchInit = {
      method,
      headers
    };

    if (options.signal) {
      fetchInit.signal = options.signal;
    }

    if (options.body !== undefined && options.body !== null) {
      if (isFormDataBody(options.body)) {
        // Preserve native multipart boundary by deleting any manual Content-Type header
        for (const k of Object.keys(headers)) {
          if (k.toLowerCase() === 'content-type') {
            delete headers[k];
          }
        }
        fetchInit.body = options.body;
      } else if (typeof options.body === 'string') {
        if (!headers['Content-Type'] && !headers['content-type']) {
          headers['Content-Type'] = 'application/json';
        }
        fetchInit.body = options.body;
      } else {
        if (!headers['Content-Type'] && !headers['content-type']) {
          headers['Content-Type'] = 'application/json';
        }
        fetchInit.body = JSON.stringify(options.body);
      }
    }

    let res;
    try {
      res = await fetch(url, fetchInit);
    } catch (networkErr) {
      const err = new Error(`Network error (${networkErr.message || 'fetch failed'}): unable to reach server.`);
      err.isNetworkError = true;
      err.cause = networkErr;
      throw err;
    }

    const payload = await parseResponseBody(res, options.responseType);

    if (!res.ok) {
      const errMsg = (payload && typeof payload === 'object' && (payload.error || payload.message))
        || `HTTP ${res.status} error`;

      if (res.status === 401) {
        handleUnauthorizedResponse(path, errMsg);
      }

      const apiErr = new Error(errMsg);
      apiErr.status = res.status;
      apiErr.data = payload;
      apiErr.payload = payload;
      throw apiErr;
    }

    return payload;
  }

  // --- Shared Formatting & URL Builders ---
  function formatCurrency(amount, currency = 'USD', options = {}) {
    const curr = String(currency || 'USD').trim().toUpperCase() === 'INR' ? 'INR' : 'USD';
    const num = Number(amount);
    const safeNum = Number.isFinite(num) ? num : 0;
    const sign = safeNum < 0 ? '-' : '';
    const symbol = curr === 'INR' ? '₹' : '$';
    const formatted = `${sign}${symbol}${Math.round(Math.abs(safeNum)).toLocaleString('en-US')}`;
    return options.withCode ? `${formatted} ${curr}` : formatted;
  }

  function buildBookUrl(params = {}, basePath = 'book.html') {
    const mapped = {
      tour: params.tour ?? params.tour_slug ?? params.tour_id,
      date: params.date ?? params.travel_date_start,
      nights: params.nights ?? params.total_nights,
      tier: params.tier ?? params.hotel_tier,
      nationality: params.nationality ?? params.nationality_type,
      adults: params.adults ?? params.adults_count,
      children_6_12: params.children_6_12,
      children_under_6: params.children_under_6,
      currency: params.currency,
      custom: params.custom ?? params.is_custom_trip,
      title: params.title ?? params.tour_title,
      source: params.source
    };

    const sp = new URLSearchParams();
    for (const [key, val] of Object.entries(mapped)) {
      if (val === undefined || val === null || val === '') continue;
      sp.set(key, String(val));
    }

    const qs = sp.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  }

  const SAFE_DOCUMENT_URL_RE = /^\/api\/(?:bookings\/[^/?#]+\/(?:invoice-view|clearance-view)|client\/(?:invoice-view|clearance-view|documents\/[^/?#]+\/[^/?#]+)|admin\/(?:documents\/[^/?#]+\/[^/?#]+|payments\/[^/?#]+\/receipt))(?:\?|$)/i;

  function buildDocumentUrl(docPath, explicitToken) {
    if (!docPath) return '';
    const pathStr = String(docPath);
    if (!SAFE_DOCUMENT_URL_RE.test(pathStr)) {
      return pathStr;
    }
    let token = explicitToken;
    if (!token) {
      const portal = getPortalForApiPath(pathStr);
      token = portal ? getToken(portal) : (getToken('admin') || getToken('client') || getToken('guide'));
    }
    if (!token) return pathStr;
    const sep = pathStr.includes('?') ? '&' : '?';
    return `${pathStr}${sep}token=${encodeURIComponent(token)}`;
  }

  function buildWhatsAppUrl(phone, text = '') {
    const digits = String(phone || '+97517654321').replace(/\D+/g, '');
    const base = `https://wa.me/${digits}`;
    return text ? `${base}?text=${encodeURIComponent(String(text))}` : base;
  }

  async function downloadCsvReport(apiPath, fallbackFilename) {
    if (!isHttpProtocol()) {
      throw new Error('CSV report downloads require serving over http:// or https://.');
    }
    const token = getToken('admin');
    const headers = {};
    if (token) headers.Authorization = `Bearer ${token}`;

    let res;
    try {
      res = await fetch(apiPath, { method: 'GET', headers });
    } catch (networkErr) {
      const err = new Error(`Network error (${networkErr.message || 'fetch failed'}): unable to reach server.`);
      err.isNetworkError = true;
      err.cause = networkErr;
      throw err;
    }

    if (!res.ok) {
      const errBody = await parseResponseBody(res);
      const msg = (errBody && typeof errBody === 'object' && (errBody.error || errBody.message))
        || `Failed to export CSV (${res.status})`;
      if (res.status === 401) handleUnauthorizedResponse(apiPath, msg);
      const err = new Error(msg);
      err.status = res.status;
      err.data = errBody;
      err.payload = errBody;
      throw err;
    }

    const csvText = await res.text();
    const filename = fallbackFilename;

    if (global.document && typeof global.Blob !== 'undefined' && global.URL && typeof global.URL.createObjectURL === 'function') {
      const blob = new global.Blob([csvText], { type: 'text/csv;charset=utf-8;' });
      const blobUrl = global.URL.createObjectURL(blob);
      const a = global.document.createElement('a');
      a.href = blobUrl;
      a.download = filename;
      a.style.display = 'none';
      global.document.body.appendChild(a);
      a.click();
      if (typeof a.remove === 'function') a.remove();
      setTimeout(() => {
        try { global.URL.revokeObjectURL(blobUrl); } catch (_) {}
      }, 1000);
    }

    return { success: true, filename, text: csvText };
  }

  const ApiClient = {
    TOKEN_KEYS,
    USER_KEYS,
    isHttpProtocol,
    getToken,
    setToken,
    clearPortalSession,
    getAdminUser,
    setAdminSession,
    getClientBooking,
    setClientSession,
    getGuideUser,
    setGuideSession,
    request,
    formatCurrency,
    buildBookUrl,
    buildDocumentUrl,
    buildWhatsAppUrl,

    get onUnauthorized() {
      return unauthorizedHandler;
    },
    set onUnauthorized(fn) {
      unauthorizedHandler = typeof fn === 'function' ? fn : null;
    },
    setUnauthorizedHandler(fn) {
      unauthorizedHandler = typeof fn === 'function' ? fn : null;
    },

    // --- Health & Public Catalog ---
    async getHealth() {
      return request('/api/health');
    },

    async getTours(params = {}) {
      const json = await request('/api/tours', { params });
      return (json && json.data) || [];
    },

    async getToursResponse(params = {}) {
      return request('/api/tours', { params });
    },

    async getTour(slugOrId) {
      return request(`/api/tours/${encodeURIComponent(slugOrId)}`);
    },

    async getDestinations() {
      return request('/api/destinations');
    },

    async getDestination(idOrSlug) {
      return request(`/api/destinations/${encodeURIComponent(idOrSlug)}`);
    },

    async getFestivals(params = {}) {
      return request('/api/festivals', { params });
    },

    async getFestival(idOrSlug) {
      return request(`/api/festivals/${encodeURIComponent(idOrSlug)}`);
    },

    async getReviews() {
      return request('/api/reviews');
    },

    async getPublicSettings() {
      if (!isHttpProtocol()) {
        return {
          success: true,
          data: {
            company_name: 'Bhutan Fast Rate Tours',
            company_license: 'TR/2018/9882',
            company_phone: '+975 17 654 321',
            company_whatsapp: '+97517654321',
            company_email: 'reservations@bhutanfastratetours.bt',
            sdf_rate_international: '100',
            sdf_rate_india: '1200',
            visa_fee_usd: '40',
            usd_to_inr_rate: '85'
          }
        };
      }
      return request('/api/settings/public');
    },

    async calculateSDF(data) {
      const json = await request('/api/calculate-sdf', {
        method: 'POST',
        body: data
      });
      return json && json.data ? json.data : json;
    },

    async submitInquiry(data) {
      return request('/api/inquiries', {
        method: 'POST',
        body: data
      });
    },

    // --- Bookings & Public Tracking ---
    async submitBooking(bookingData, options = {}) {
      return request('/api/bookings', {
        method: 'POST',
        body: bookingData,
        idempotencyKey: options.idempotencyKey
      });
    },

    async trackBooking(ref, email) {
      const params = email ? { email } : undefined;
      return request(`/api/bookings/track/${encodeURIComponent(ref)}`, { params });
    },

    getInvoiceViewUrl(bookingId, token) {
      return buildDocumentUrl(`/api/bookings/${encodeURIComponent(bookingId)}/invoice-view`, token);
    },

    getClearanceViewUrl(bookingId, token) {
      return buildDocumentUrl(`/api/bookings/${encodeURIComponent(bookingId)}/clearance-view`, token);
    },

    // --- Client Portal ---
    async clientLogin(bookingRef, email) {
      const res = await request('/api/client/auth', {
        method: 'POST',
        body: { booking_ref: bookingRef, email }
      });
      if (res && res.success && res.token) {
        setClientSession(res.token, res.booking);
      }
      return res;
    },

    async getClientBookingProfile() {
      return request('/api/client/booking');
    },

    async getClientItinerary() {
      return request('/api/client/itinerary');
    },

    async getClientPayments() {
      return request('/api/client/payments');
    },

    async getClientNotifications() {
      return request('/api/client/notifications');
    },

    async markClientNotificationRead(id) {
      return request(`/api/client/notifications/${encodeURIComponent(id)}/read`, {
        method: 'PATCH'
      });
    },

    async addClientTraveler(travelerData) {
      return request('/api/client/travelers', {
        method: 'POST',
        body: travelerData
      });
    },

    async uploadTravelerDocuments(travelerId, formData) {
      return request(`/api/client/travelers/${encodeURIComponent(travelerId)}/documents`, {
        method: 'POST',
        body: formData
      });
    },

    async uploadPaymentReceipt(formData) {
      return request('/api/client/payments/receipt', {
        method: 'POST',
        body: formData
      });
    },

    async submitClientReview(reviewData) {
      return request('/api/client/reviews', {
        method: 'POST',
        body: reviewData
      });
    },

    getClientDocumentUrl(travelerId, field, token) {
      return buildDocumentUrl(`/api/client/documents/${encodeURIComponent(travelerId)}/${encodeURIComponent(field)}`, token);
    },

    getClientInvoiceUrl(token) {
      return buildDocumentUrl('/api/client/invoice-view', token);
    },

    getClientClearanceUrl(token) {
      return buildDocumentUrl('/api/client/clearance-view', token);
    },

    // --- Guide Field Portal ---
    async guideLogin(email, password) {
      const res = await request('/api/guide/auth/login', {
        method: 'POST',
        body: { email, password }
      });
      if (res && res.success && res.token) {
        setGuideSession(res.token, res.guide);
      }
      return res;
    },

    async getGuideAssignments() {
      return request('/api/guide/assignments');
    },

    async getGuideAssignment(bookingId) {
      return request(`/api/guide/assignments/${encodeURIComponent(bookingId)}`);
    },

    async submitGuideCheckin(assignmentOrBookingId, data) {
      return request(`/api/guide/assignments/${encodeURIComponent(assignmentOrBookingId)}/checkin`, {
        method: 'PATCH',
        body: data
      });
    },

    async getGuideNotifications() {
      return request('/api/guide/notifications');
    },

    async markGuideNotificationRead(id) {
      return request(`/api/guide/notifications/${encodeURIComponent(id)}/read`, {
        method: 'PATCH'
      });
    },

    // --- Admin & Operations Portal ---
    async adminLogin(email, password) {
      const res = await request('/api/admin/auth/login', {
        method: 'POST',
        body: { email, password }
      });
      if (res && res.success && res.token) {
        setAdminSession(res.token, res.user);
      }
      return res;
    },

    async getAdminMe() {
      return request('/api/admin/auth/me');
    },

    async getAdminStats() {
      return request('/api/admin/stats');
    },

    async createAdminBooking(bookingData) {
      return request('/api/admin/bookings', {
        method: 'POST',
        body: bookingData
      });
    },

    async getAdminBookings(params = {}) {
      return request('/api/admin/bookings', { params });
    },

    async getAdminBooking(id) {
      return request(`/api/admin/bookings/${encodeURIComponent(id)}`);
    },

    async updateBookingStatus(id, status, extraOrUserName) {
      const payload = typeof extraOrUserName === 'object' && extraOrUserName !== null
        ? { status, ...extraOrUserName }
        : { status, ...(extraOrUserName ? { user_name: extraOrUserName } : {}) };
      return request(`/api/admin/bookings/${encodeURIComponent(id)}/status`, {
        method: 'PATCH',
        body: payload
      });
    },

    async updateBookingNotes(id, notesData) {
      return request(`/api/admin/bookings/${encodeURIComponent(id)}/notes`, {
        method: 'PATCH',
        body: notesData
      });
    },

    async updateVisaStatus(id, visaStatusOrPayload, visaClearanceNumber = '', extraOrUserName = '') {
      let body;
      if (typeof visaStatusOrPayload === 'object' && visaStatusOrPayload !== null) {
        body = visaStatusOrPayload;
      } else {
        body = {
          visa_status: visaStatusOrPayload,
          visa_clearance_number: visaClearanceNumber
        };
        if (typeof extraOrUserName === 'object' && extraOrUserName !== null) {
          Object.assign(body, extraOrUserName);
        } else if (extraOrUserName) {
          body.user_name = extraOrUserName;
        }
      }
      return request(`/api/admin/bookings/${encodeURIComponent(id)}/visa`, {
        method: 'PATCH',
        body
      });
    },

    async assignGuide(bookingId, guideIdOrPayload, vehiclePlate = '', userName = '') {
      const body = typeof guideIdOrPayload === 'object' && guideIdOrPayload !== null
        ? guideIdOrPayload
        : {
          guide_id: guideIdOrPayload,
          vehicle_plate: vehiclePlate,
          ...(userName ? { user_name: userName } : {})
        };
      return request(`/api/admin/bookings/${encodeURIComponent(bookingId)}/assign-guide`, {
        method: 'PATCH',
        body
      });
    },

    async cancelAdminBooking(id, cancellationReason) {
      return request(`/api/admin/bookings/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        body: cancellationReason ? { cancellation_reason: cancellationReason } : undefined
      });
    },

    getAdminDocumentUrl(travelerId, field, token) {
      return buildDocumentUrl(`/api/admin/documents/${encodeURIComponent(travelerId)}/${encodeURIComponent(field)}`, token);
    },

    // --- Finance & Reports ---
    async getAdminPayments(params = {}) {
      return request('/api/admin/payments', { params });
    },

    async recordPayment(bookingId, paymentData) {
      return request(`/api/admin/bookings/${encodeURIComponent(bookingId)}/payments`, {
        method: 'POST',
        body: paymentData
      });
    },

    async verifyPayment(paymentId, statusOrPayload, notes = '') {
      const body = typeof statusOrPayload === 'object' && statusOrPayload !== null
        ? statusOrPayload
        : { status: statusOrPayload, ...(notes ? { notes } : {}) };
      return request(`/api/admin/payments/${encodeURIComponent(paymentId)}/verify`, {
        method: 'PATCH',
        body
      });
    },

    async remitBookingSdf(bookingId, data = {}) {
      return request(`/api/admin/bookings/${encodeURIComponent(bookingId)}/sdf-remit`, {
        method: 'PATCH',
        body: data
      });
    },

    getAdminPaymentReceiptUrl(paymentId, token) {
      return buildDocumentUrl(`/api/admin/payments/${encodeURIComponent(paymentId)}/receipt`, token);
    },

    async downloadFinanceCsv(filename = 'bfr-finance-report.csv') {
      return downloadCsvReport('/api/admin/reports/finance-csv', filename);
    },

    async downloadBookingsCsv(filename = 'bfr-bookings-report.csv') {
      return downloadCsvReport('/api/admin/reports/bookings-csv', filename);
    },

    // --- Inquiries CRM ---
    async getAdminInquiries(params = {}) {
      return request('/api/admin/inquiries', { params });
    },

    async updateInquiry(id, statusOrPayload, notes = '') {
      const body = typeof statusOrPayload === 'object' && statusOrPayload !== null
        ? statusOrPayload
        : { status: statusOrPayload, internal_notes: notes };
      return request(`/api/admin/inquiries/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body
      });
    },

    async convertInquiry(id, bookingData = {}) {
      return request(`/api/admin/inquiries/${encodeURIComponent(id)}/convert`, {
        method: 'POST',
        body: bookingData
      });
    },

    // --- Guides CRUD ---
    async getAdminGuides(params = {}) {
      return request('/api/admin/guides', { params });
    },

    async createAdminGuide(guideData) {
      return request('/api/admin/guides', {
        method: 'POST',
        body: guideData
      });
    },

    async updateAdminGuide(id, guideData) {
      return request(`/api/admin/guides/${encodeURIComponent(id)}`, {
        method: 'PUT',
        body: guideData
      });
    },

    async toggleAdminGuide(id) {
      return request(`/api/admin/guides/${encodeURIComponent(id)}/toggle`, {
        method: 'PATCH'
      });
    },

    // --- Tours, Destinations, Festivals & Reviews CMS ---
    async getAdminTours(params = {}) {
      return request('/api/admin/tours', { params });
    },

    async getAdminTour(id) {
      return request(`/api/admin/tours/${encodeURIComponent(id)}`);
    },

    async createAdminTour(tourData) {
      return request('/api/admin/tours', {
        method: 'POST',
        body: tourData
      });
    },

    async updateAdminTour(id, tourData) {
      return request(`/api/admin/tours/${encodeURIComponent(id)}`, {
        method: 'PUT',
        body: tourData
      });
    },

    async toggleAdminTour(id, userName) {
      return request(`/api/admin/tours/${encodeURIComponent(id)}/toggle`, {
        method: 'PATCH',
        body: userName ? { user_name: userName } : {}
      });
    },

    async deleteAdminTour(id, userName) {
      return request(`/api/admin/tours/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        body: userName ? { user_name: userName } : undefined
      });
    },

    async getAdminDestinations() {
      return request('/api/admin/destinations');
    },

    async getAdminDestination(id) {
      return request(`/api/admin/destinations/${encodeURIComponent(id)}`);
    },

    async createAdminDestination(data) {
      return request('/api/admin/destinations', {
        method: 'POST',
        body: data
      });
    },

    async updateAdminDestination(id, data) {
      return request(`/api/admin/destinations/${encodeURIComponent(id)}`, {
        method: 'PUT',
        body: data
      });
    },

    async getAdminFestivals() {
      return request('/api/admin/festivals');
    },

    async getAdminFestival(id) {
      return request(`/api/admin/festivals/${encodeURIComponent(id)}`);
    },

    async createAdminFestival(data) {
      return request('/api/admin/festivals', {
        method: 'POST',
        body: data
      });
    },

    async updateAdminFestival(id, data) {
      return request(`/api/admin/festivals/${encodeURIComponent(id)}`, {
        method: 'PUT',
        body: data
      });
    },

    async toggleAdminFestival(id) {
      return request(`/api/admin/festivals/${encodeURIComponent(id)}/toggle`, {
        method: 'PATCH'
      });
    },

    async deleteAdminFestival(id) {
      return request(`/api/admin/festivals/${encodeURIComponent(id)}`, {
        method: 'DELETE'
      });
    },

    async getAdminReviews() {
      return request('/api/admin/reviews');
    },

    async moderateAdminReview(id, data) {
      return request(`/api/admin/reviews/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: data
      });
    },

    async deleteAdminReview(id) {
      return request(`/api/admin/reviews/${encodeURIComponent(id)}`, {
        method: 'DELETE'
      });
    },

    // --- Settings, Staff Users, Audit Log & Notifications ---
    async getSettings() {
      return request('/api/admin/settings');
    },

    async updateSettings(settingsObj) {
      return request('/api/admin/settings', {
        method: 'PUT',
        body: settingsObj
      });
    },

    async sendTestNotification(data = {}) {
      return request('/api/admin/settings/test-notification', {
        method: 'POST',
        body: data
      });
    },

    async getAdminUsers() {
      return request('/api/admin/users');
    },

    async createAdminUser(userData) {
      return request('/api/admin/users', {
        method: 'POST',
        body: userData
      });
    },

    async updateAdminUser(id, userData) {
      return request(`/api/admin/users/${encodeURIComponent(id)}`, {
        method: 'PUT',
        body: userData
      });
    },

    async toggleAdminUser(id) {
      return request(`/api/admin/users/${encodeURIComponent(id)}/toggle`, {
        method: 'PATCH'
      });
    },

    async getAuditLogs(params = {}) {
      return request('/api/admin/audit-log', { params });
    },

    async getNotifications(params = {}) {
      return request('/api/notifications', { params });
    },

    async markNotificationRead(id) {
      return request(`/api/notifications/${encodeURIComponent(id)}/read`, {
        method: 'PATCH'
      });
    },

    async markAllNotificationsRead() {
      return request('/api/notifications/read-all', {
        method: 'PATCH'
      });
    },

    async markNotificationSent(id) {
      return request(`/api/notifications/${encodeURIComponent(id)}/sent`, {
        method: 'PATCH'
      });
    },

    async sendNotification(data) {
      return request('/api/notifications/send', {
        method: 'POST',
        body: data
      });
    }
  };

  global.ApiClient = ApiClient;
})(typeof window !== 'undefined' ? window : globalThis);
