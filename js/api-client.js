/**
 * Bhutan Fast Rate Tours — Dual-Engine API Client
 * Automatically connects to Express backend (/api/*) when online,
 * or gracefully runs offline in-browser using LocalStorage & Seed data.
 */

const ApiClient = (function () {
  let isServerOnline = false;
  let hasCheckedServer = false;

  async function checkServer() {
    if (hasCheckedServer) return isServerOnline;
    try {
      const res = await fetch('/api/health', { method: 'GET', signal: AbortSignal.timeout(1200) });
      if (res.ok) {
        const data = await res.json();
        isServerOnline = (data.status === 'online');
      } else {
        isServerOnline = false;
      }
    } catch (e) {
      isServerOnline = false;
    }
    hasCheckedServer = true;
    console.log(`[ApiClient] Mode: ${isServerOnline ? 'Live Express REST API' : 'In-Browser LocalStorage Engine'}`);
    return isServerOnline;
  }

  // --- Local Storage Fallback Store ---
  function getLocalStore(key, defaultData) {
    try {
      const stored = localStorage.getItem(`bfr_${key}`);
      if (stored) return JSON.parse(stored);
      if (defaultData) {
        localStorage.setItem(`bfr_${key}`, JSON.stringify(defaultData));
        return defaultData;
      }
    } catch (e) {
      console.warn('LocalStorage error:', e);
    }
    return defaultData || [];
  }

  function setLocalStore(key, data) {
    try {
      localStorage.setItem(`bfr_${key}`, JSON.stringify(data));
    } catch (e) {
      console.warn('LocalStorage set error:', e);
    }
  }

  // Default seed for client-side offline use
  const defaultTours = [
    { id: 'essential-bhutan-7d', title: 'Essential Bhutan Heritage & Tiger’s Nest', slug: 'tour-essential-bhutan-7d.html', duration_days: 7, duration_nights: 6, category: 'Cultural Heritage', difficulty: 'Easy to Moderate', price_usd: 1950, valleys: 'Paro, Thimphu, Punakha', cover_image: 'assets/images/tigers-nest.webp', highlight_text: 'Includes Dochula pass, Punakha Dzong, and Tiger’s Nest.' },
    { id: 'druk-path-trek-9d', title: 'Druk Path High Alpine Wilderness Trek', slug: 'tour-druk-path-trek.html', duration_days: 9, duration_nights: 8, category: 'Alpine Trekking', difficulty: 'Moderate', price_usd: 2480, valleys: 'Paro, Jili Dzong, Jimilangtsho, Thimphu', cover_image: 'assets/images/dochula-pass.webp', highlight_text: 'Alpine lakes and panoramic Himalayan peak views above 4,000m.' },
    { id: 'thimphu-tshechu-8d', title: 'Thimphu Tshechu Sacred Religious Festival Tour', slug: 'tour-thimphu-tshechu.html', duration_days: 8, duration_nights: 7, category: 'Festival Special', difficulty: 'Easy', price_usd: 2280, valleys: 'Thimphu, Punakha, Paro', cover_image: 'assets/images/thimphu-festival.webp', highlight_text: 'VIP access to sacred Cham dances and Atsara blessings.' },
    { id: 'snowman-trek-25d', title: 'The Legendary Snowman Trek', slug: 'tour-snowman-trek.html', duration_days: 25, duration_nights: 24, category: 'Expedition', difficulty: 'Strenuous', price_usd: 6800, valleys: 'Paro, Lingshi, Laya, Lunana, Bumthang', cover_image: 'assets/images/dochula-pass.webp', highlight_text: 'Cross 11 mountain passes over 4,500m in remote Lunana.' },
    { id: 'punakha-luxury-escape-5d', title: 'Punakha Valley Subtropical Luxury Escape', slug: 'tour-punakha-escape.html', duration_days: 5, duration_nights: 4, category: 'Luxury Escape', difficulty: 'Easy', price_usd: 1520, valleys: 'Paro, Thimphu, Punakha', cover_image: 'assets/images/punakha-dzong.webp', highlight_text: 'Stay in luxury boutique river retreats and farm tastings.' },
    { id: 'bumthang-spiritual-pilgrimage-10d', title: 'Bumthang Spiritual Pilgrimage & Central Bhutan', slug: 'tour-bumthang-pilgrimage.html', duration_days: 10, duration_nights: 9, category: 'Cultural Heritage', difficulty: 'Easy to Moderate', price_usd: 2890, valleys: 'Paro, Thimphu, Punakha, Phobjikha, Bumthang', cover_image: 'assets/images/dochula-pass.webp', highlight_text: 'Visit Bhutan’s oldest temples (659 AD) and Burning Lake.' },
    { id: 'tigers-nest-day-excursion-3d', title: 'Tiger’s Nest Iconic Day Excursion & Paro Highlights', slug: 'tour-tigers-nest-day.html', duration_days: 3, duration_nights: 2, category: 'Short Break', difficulty: 'Moderate', price_usd: 980, valleys: 'Paro Valley', cover_image: 'assets/images/tigers-nest.webp', highlight_text: 'Ideal weekend break: Paro Rinpung Dzong and Tiger’s Nest.' },
    { id: 'eastern-bhutan-textiles-14d', title: 'Eastern Bhutan Remote Frontiers & Textiles', slug: 'tour-eastern-bhutan.html', duration_days: 14, duration_nights: 13, category: 'Cultural Heritage', difficulty: 'Moderate', price_usd: 3950, valleys: 'Paro, Bumthang, Mongar, Trashigang', cover_image: 'assets/images/dochula-pass.webp', highlight_text: 'Visit Radhi raw silk weavers and nomadic Merak-Sakteng.' },
    { id: 'gangtey-crane-valley-6d', title: 'Phobjikha Valley & Black-Necked Crane Festival', slug: 'tour-gangtey-crane-valley.html', duration_days: 6, duration_nights: 5, category: 'Festival Special', difficulty: 'Easy', price_usd: 1780, valleys: 'Paro, Thimphu, Gangtey, Punakha', cover_image: 'assets/images/phobjikha-cranes.webp', highlight_text: 'Spot Black-Necked Cranes and hike Gangtey nature trails.' },
    { id: 'paro-spring-festival-8d', title: 'Paro Tshechu Spring Festival & Sacred Thongdrel', slug: 'tour-paro-spring-festival.html', duration_days: 8, duration_nights: 7, category: 'Festival Special', difficulty: 'Easy', price_usd: 2350, valleys: 'Paro, Thimphu, Punakha', cover_image: 'assets/images/tigers-nest.webp', highlight_text: 'Witness the dawn unfurling of the 400-year-old Guru silk thangka.' }
  ];

  return {
    async getTours(params = {}) {
      const online = await checkServer();
      if (online) {
        const query = new URLSearchParams(params).toString();
        const res = await fetch(`/api/tours?${query}`);
        const data = await res.json();
        return data.data || [];
      }
      // Offline fallback
      let list = getLocalStore('tours', defaultTours);
      if (params.category && params.category !== 'All') {
        list = list.filter(t => t.category.toLowerCase().includes(params.category.toLowerCase()));
      }
      if (params.search) {
        const s = params.search.toLowerCase();
        list = list.filter(t => t.title.toLowerCase().includes(s) || t.valleys.toLowerCase().includes(s));
      }
      return list;
    },

    async calculateSDF(data) {
      const online = await checkServer();
      if (online) {
        const res = await fetch('/api/calculate-sdf', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
        const json = await res.json();
        return json.data;
      }
      // Local SDF Math
      const nights = parseInt(data.nights, 10) || 1;
      const adults = parseInt(data.adults, 10) || 1;
      const c1 = parseInt(data.children_6_12, 10) || 0;
      const isIndia = data.nationality_type === 'india';
      const rate = isIndia ? 1200 : 100;
      const currency = isIndia ? 'INR' : 'USD';
      const adultTotal = adults * nights * rate;
      const childTotal = c1 * nights * (rate * 0.5);
      const totalSdf = adultTotal + childTotal;
      const visaFee = isIndia ? 0 : (adults + c1) * 40;
      return {
        nights,
        currency,
        total_sdf: totalSdf,
        total_visa_fee: visaFee,
        grand_government_dues: totalSdf + visaFee,
        breakdown: {
          adults: { count: adults, subtotal: adultTotal },
          children_6_12: { count: c1, subtotal: childTotal }
        }
      };
    },

    async submitBooking(bookingData) {
      const online = await checkServer();
      if (online) {
        const res = await fetch('/api/bookings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(bookingData)
        });
        return await res.json();
      }
      // Offline storage
      const bookings = getLocalStore('bookings', []);
      const ref = `BFR-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
      const newBooking = {
        id: ref,
        ...bookingData,
        booking_status: 'inquiry',
        visa_status: 'not_started',
        created_at: new Date().toISOString()
      };
      bookings.unshift(newBooking);
      setLocalStore('bookings', bookings);
      return {
        success: true,
        booking: {
          id: ref,
          tour_title: bookingData.tour_title,
          tracking_url: `track-visa.html?ref=${ref}&email=${encodeURIComponent(bookingData.lead_email)}`
        }
      };
    },

    async trackBooking(ref, email) {
      const online = await checkServer();
      if (online) {
        const query = email ? `?email=${encodeURIComponent(email)}` : '';
        const res = await fetch(`/api/bookings/track/${encodeURIComponent(ref)}${query}`);
        return await res.json();
      }
      // Offline check
      const bookings = getLocalStore('bookings', [
        {
          id: 'BFR-2026-8841',
          tour_title: 'Essential Bhutan Heritage & Tiger’s Nest',
          lead_name: 'Dr. Evelyn Martinez',
          travel_dates: '2026-10-15 to 2026-10-21',
          total_nights: 6,
          total_travelers: 2,
          hotel_tier: '4-Star Premium',
          booking_status: 'visa_approved',
          visa_status: 'clearance_letter_issued',
          visa_clearance_number: 'VCL-2026-8841-BFR',
          total_price_usd: 5180,
          deposit_paid_usd: 5180,
          balance_due_usd: 0,
          guide: { name: 'Kinley Tshering', phone: '+975 77 123 456', vehicle: 'Toyota Land Cruiser (BP-1-A8921)' }
        }
      ]);
      const match = bookings.find(b => b.id.toLowerCase() === ref.toLowerCase());
      if (match) return { success: true, booking: match };
      return { success: false, error: 'Booking reference not found in offline storage.' };
    },

    async submitInquiry(data) {
      const online = await checkServer();
      if (online) {
        const res = await fetch('/api/inquiries', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
        return await res.json();
      }
      const inquiries = getLocalStore('inquiries', []);
      const ref = `INQ-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
      inquiries.unshift({ ref_code: ref, ...data, status: 'new', created_at: new Date().toISOString() });
      setLocalStore('inquiries', inquiries);
      return { success: true, ref_code: ref, message: 'Inquiry received. A certified Bhutan specialist will contact you.' };
    },

    async adminLogin(email, password) {
      const online = await checkServer();
      if (online) {
        const res = await fetch('/api/admin/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password })
        });
        return await res.json();
      }
      // Demo credentials offline
      if (email === 'admin@bhutanfastratetours.bt' && password === 'admin123') {
        return {
          success: true,
          token: 'demo_token_admin',
          user: { name: 'Sonam Dorji (Managing Director)', email, role: 'super_admin' }
        };
      }
      return { success: false, error: 'Invalid demo credentials. Use admin@bhutanfastratetours.bt / admin123' };
    },

    async getAdminStats() {
      const online = await checkServer();
      if (online) {
        const res = await fetch('/api/admin/stats');
        return await res.json();
      }
      return {
        success: true,
        stats: {
          total_bookings: 24,
          active_trips: 4,
          pending_visas: 3,
          new_inquiries: 7,
          total_revenue_usd: 84600,
          collected_revenue_usd: 72100,
          outstanding_balance_usd: 12500,
          pipeline: [
            { booking_status: 'inquiry', count: 6 },
            { booking_status: 'payment_pending', count: 4 },
            { booking_status: 'visa_submitted', count: 3 },
            { booking_status: 'visa_approved', count: 7 },
            { booking_status: 'active_trip', count: 4 }
          ]
        }
      };
    },

    async getAdminBookings(params = {}) {
      const online = await checkServer();
      if (online) {
        const query = new URLSearchParams(params).toString();
        const res = await fetch(`/api/admin/bookings?${query}`);
        return await res.json();
      }
      let list = getLocalStore('bookings', []);
      if (params.status && params.status !== 'All') {
        list = list.filter(b => b.booking_status === params.status);
      }
      if (params.search) {
        const s = params.search.toLowerCase();
        list = list.filter(b => (b.lead_name || '').toLowerCase().includes(s) || (b.id || '').toLowerCase().includes(s) || (b.tour_title || '').toLowerCase().includes(s));
      }
      return { success: true, count: list.length, data: list };
    },

    async getAdminBooking(id) {
      const online = await checkServer();
      if (online) {
        const res = await fetch(`/api/admin/bookings/${encodeURIComponent(id)}`);
        return await res.json();
      }
      const list = getLocalStore('bookings', []);
      const found = list.find(b => b.id === id);
      if (found) return { success: true, booking: found };
      return { success: false, error: 'Booking not found' };
    },

    async updateBookingStatus(id, status, userName = 'Staff Concierge') {
      const online = await checkServer();
      if (online) {
        const res = await fetch(`/api/admin/bookings/${encodeURIComponent(id)}/status`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status, user_name: userName })
        });
        return await res.json();
      }
      const list = getLocalStore('bookings', []);
      const item = list.find(b => b.id === id);
      if (item) {
        item.booking_status = status;
        setLocalStore('bookings', list);
        return { success: true, message: `Status updated to ${status}` };
      }
      return { success: false, error: 'Booking not found' };
    },

    async updateVisaStatus(id, visa_status, visa_clearance_number = '', userName = 'Visa Desk Officer') {
      const online = await checkServer();
      if (online) {
        const res = await fetch(`/api/admin/bookings/${encodeURIComponent(id)}/visa`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ visa_status, visa_clearance_number, user_name: userName })
        });
        return await res.json();
      }
      const list = getLocalStore('bookings', []);
      const item = list.find(b => b.id === id);
      if (item) {
        item.visa_status = visa_status;
        if (visa_clearance_number) item.visa_clearance_number = visa_clearance_number;
        else if (visa_status === 'approved' || visa_status === 'clearance_letter_issued') {
          item.visa_clearance_number = `VCL-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}-BFR`;
        }
        setLocalStore('bookings', list);
        return { success: true, message: `Visa updated to ${visa_status}`, visa_clearance_number: item.visa_clearance_number };
      }
      return { success: false, error: 'Booking not found' };
    },

    async assignGuide(bookingId, guideId, vehiclePlate = '', userName = 'Operations Manager') {
      const online = await checkServer();
      if (online) {
        const res = await fetch(`/api/admin/bookings/${encodeURIComponent(bookingId)}/assign-guide`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ guide_id: guideId, vehicle_plate: vehiclePlate, user_name: userName })
        });
        return await res.json();
      }
      return { success: true, message: 'Guide assigned successfully (offline mode)' };
    },

    async recordPayment(bookingId, paymentData) {
      const online = await checkServer();
      if (online) {
        const res = await fetch(`/api/admin/bookings/${encodeURIComponent(bookingId)}/payments`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(paymentData)
        });
        return await res.json();
      }
      return { success: true, message: 'Payment recorded (offline mode)' };
    },

    // --- Tour Packages Admin Catalog CRUD ---
    async getAdminTours(params = {}) {
      const online = await checkServer();
      if (online) {
        const query = new URLSearchParams(params).toString();
        const res = await fetch(`/api/admin/tours?${query}`);
        return await res.json();
      }
      let list = getLocalStore('tours', defaultTours);
      if (params.category && params.category !== 'All') {
        list = list.filter(t => (t.category || '').toLowerCase().includes(params.category.toLowerCase()));
      }
      if (params.search) {
        const s = params.search.toLowerCase();
        list = list.filter(t => (t.title || '').toLowerCase().includes(s) || (t.valleys || '').toLowerCase().includes(s));
      }
      return {
        success: true,
        count: list.length,
        total_count: list.length,
        active_count: list.filter(t => t.is_active !== 0).length,
        inactive_count: list.filter(t => t.is_active === 0).length,
        data: list
      };
    },

    async getAdminTour(id) {
      const online = await checkServer();
      if (online) {
        const res = await fetch(`/api/admin/tours/${encodeURIComponent(id)}`);
        return await res.json();
      }
      const list = getLocalStore('tours', defaultTours);
      const found = list.find(t => t.id === id || t.slug === id);
      if (found) return { success: true, data: found };
      return { success: false, error: 'Tour not found' };
    },

    async createAdminTour(tourData) {
      const online = await checkServer();
      if (online) {
        const res = await fetch('/api/admin/tours', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(tourData)
        });
        return await res.json();
      }
      const list = getLocalStore('tours', defaultTours);
      const cleanSlug = (tourData.slug || tourData.title).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      const tourSlug = cleanSlug.endsWith('.html') ? cleanSlug : `tour-${cleanSlug}.html`;
      const tourId = cleanSlug.replace(/^tour-/, '').replace(/\.html$/, '');
      const newTour = {
        id: tourId,
        slug: tourSlug,
        ...tourData,
        is_active: 1
      };
      list.unshift(newTour);
      setLocalStore('tours', list);
      return { success: true, message: `Tour "${tourData.title}" created`, tour: newTour };
    },

    async updateAdminTour(id, tourData) {
      const online = await checkServer();
      if (online) {
        const res = await fetch(`/api/admin/tours/${encodeURIComponent(id)}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(tourData)
        });
        return await res.json();
      }
      const list = getLocalStore('tours', defaultTours);
      const idx = list.findIndex(t => t.id === id);
      if (idx !== -1) {
        list[idx] = { ...list[idx], ...tourData };
        setLocalStore('tours', list);
        return { success: true, message: `Tour updated`, tour_id: id };
      }
      return { success: false, error: 'Tour not found' };
    },

    async toggleAdminTour(id, userName = 'Admin') {
      const online = await checkServer();
      if (online) {
        const res = await fetch(`/api/admin/tours/${encodeURIComponent(id)}/toggle`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_name: userName })
        });
        return await res.json();
      }
      const list = getLocalStore('tours', defaultTours);
      const item = list.find(t => t.id === id);
      if (item) {
        item.is_active = item.is_active === 0 ? 1 : 0;
        setLocalStore('tours', list);
        return { success: true, message: `Status updated`, is_active: item.is_active };
      }
      return { success: false, error: 'Tour not found' };
    },

    async deleteAdminTour(id, userName = 'Admin') {
      const online = await checkServer();
      if (online) {
        const res = await fetch(`/api/admin/tours/${encodeURIComponent(id)}`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_name: userName })
        });
        return await res.json();
      }
      let list = getLocalStore('tours', defaultTours);
      list = list.filter(t => t.id !== id);
      setLocalStore('tours', list);
      return { success: true, message: 'Tour deleted from catalog' };
    },

    // --- CRM Inquiries ---
    async getAdminInquiries() {
      const online = await checkServer();
      if (online) {
        const res = await fetch('/api/admin/inquiries');
        return await res.json();
      }
      const list = getLocalStore('inquiries', []);
      return { success: true, count: list.length, data: list };
    },

    async updateInquiry(id, status, notes = '') {
      const online = await checkServer();
      if (online) {
        const res = await fetch(`/api/admin/inquiries/${encodeURIComponent(id)}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status, internal_notes: notes })
        });
        return await res.json();
      }
      return { success: true, message: 'Inquiry updated' };
    },

    // --- Staff Guides & Operations ---
    async getAdminGuides() {
      const online = await checkServer();
      if (online) {
        const res = await fetch('/api/admin/guides');
        return await res.json();
      }
      return {
        success: true,
        data: [
          { id: 3, full_name: 'Kinley Tshering', email: 'guide@bhutanfastratetours.bt', phone: '+975 17 889 012', role: 'guide' },
          { id: 4, full_name: 'Dorji Penjor', email: 'dorji@bhutanfastratetours.bt', phone: '+975 17 554 321', role: 'guide' }
        ]
      };
    },

    // --- Settings Synchronization ---
    async getSettings() {
      const online = await checkServer();
      if (online) {
        const res = await fetch('/api/admin/settings');
        return await res.json();
      }
      return { success: true, data: [] };
    },

    async updateSettings(settingsObj) {
      const online = await checkServer();
      if (online) {
        const res = await fetch('/api/admin/settings', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(settingsObj)
        });
        return await res.json();
      }
      return { success: true, message: 'Settings saved (offline)' };
    },

    async getPublicSettings() {
      const online = await checkServer();
      if (online) {
        const res = await fetch('/api/settings/public');
        return await res.json();
      }
      return {
        success: true,
        data: {
          sdf_usd_adult: '100',
          sdf_inr_adult: '1200',
          visa_fee_usd: '40',
          contact_email: 'contact@bhutanfastratetours.bt',
          contact_phone: '+975 2 334 567',
          contact_whatsapp: '+975 17 123 456'
        }
      };
    },

    // --- Audit Log & Notifications ---
    async getAuditLogs() {
      const online = await checkServer();
      if (online) {
        const res = await fetch('/api/admin/audit-log');
        return await res.json();
      }
      return { success: true, data: [] };
    },

    async getNotifications() {
      const online = await checkServer();
      if (online) {
        const res = await fetch('/api/admin/notifications');
        return await res.json();
      }
      return { success: true, data: [] };
    }
  };
})();

window.ApiClient = ApiClient;
