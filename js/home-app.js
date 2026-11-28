/**
 * Bhutan Fast Rate Tours — Live Luxury Storefront Application
 * Preserves the exact #FFF8EC / #0B2A22 / #C9A24B design system & CSS classes
 * while hydrating all catalog, festival, destination, review, and license data
 * from live Express APIs with direct navigation to dedicated Tour & Booking pages.
 */
(function (global) {
  'use strict';

  const FALLBACK_IMAGES = {
    tiger: 'assets/images/tigers-nest.webp',
    punakha: 'assets/images/punakha-dzong.webp',
    festival: 'assets/images/thimphu-festival.webp',
    cranes: 'assets/images/phobjikha-cranes.webp',
    dochula: 'assets/images/dochula-pass.webp',
    thimphuDzong: 'assets/images/thimphu-dzong.jpg',
    lodge: 'assets/images/bhutan-lodge.jpg'
  };

  const HERO_SLIDES = [
    {
      img: FALLBACK_IMAGES.tiger,
      kicker: 'PARO · THE ICON',
      title: 'Stand above the clouds at Tiger’s Nest.',
      sub: 'A cliff monastery, a mountain trail, and a journey you will remember for life.',
      defaultPrice: 1950,
      tourSlug: 'essential-bhutan-7d',
      layout: 'left'
    },
    {
      img: FALLBACK_IMAGES.punakha,
      kicker: 'PUNAKHA · RIVER VALLEY',
      title: 'Where two rivers meet a golden dzong.',
      sub: 'Slow valley mornings, riverside picnics and Bhutan’s most beautiful fortress.',
      defaultPrice: 1520,
      tourSlug: 'punakha-escape',
      layout: 'center'
    },
    {
      img: FALLBACK_IMAGES.festival,
      kicker: 'FESTIVALS · 2027 SEASON',
      title: 'Dance, colour and blessing in Thimphu.',
      sub: 'Front-row festival days, local storytellers and moments of pure joy.',
      defaultPrice: 2280,
      tourSlug: 'thimphu-tshechu',
      layout: 'split'
    },
    {
      img: FALLBACK_IMAGES.dochula,
      kicker: 'DOCHULA · HIMALAYAN PANORAMA',
      title: '108 chortens. One endless horizon.',
      sub: 'A sunrise pass, high mountain air and the quiet of the Himalaya.',
      defaultPrice: 2299,
      tourSlug: 'druk-path-trek',
      layout: 'left'
    }
  ];

  const SPECIALTY_CARDS = [
    {
      name: 'Wellness & Meditation Retreat',
      dur: '7 days · Film preview 1:40',
      img: FALLBACK_IMAGES.lodge,
      desc: 'Guided meditation, monastery mornings and traditional hot-stone baths.',
      href: 'tours.html?cat=Luxury',
      tourSlug: 'luxury-amankora'
    },
    {
      name: 'Photography Expedition',
      dur: '9 days · Film preview 2:10',
      img: FALLBACK_IMAGES.tiger,
      desc: 'Golden-hour access, festival portraits and crisp Himalayan mountain light.',
      href: 'tours.html?cat=Festival',
      tourSlug: 'thimphu-tshechu'
    },
    {
      name: 'Textile & Craft Trail',
      dur: '6 days · Film preview 1:35',
      img: FALLBACK_IMAGES.festival,
      desc: 'Weavers, natural dyers and valley markets with Bhutanese master artisans.',
      href: 'tours.html?cat=Classic',
      tourSlug: 'bumthang-heritage'
    },
    {
      name: 'Monastery Stay',
      dur: '5 days · Film preview 1:25',
      img: FALLBACK_IMAGES.thimphuDzong,
      desc: 'Stay beside working mountain monasteries and join serene dawn prayers.',
      href: 'tours.html?cat=Classic',
      tourSlug: 'essential-bhutan-7d'
    }
  ];

  const SERVICES_GRID = [
    { n: 'Visa & SDF Handling', d: 'Paperwork, SDF and approvals handled end-to-end.', img: FALLBACK_IMAGES.punakha, pos: 'center 25%', href: 'services.html' },
    { n: 'Flight Booking — Paro', d: 'Drukair / Bhutan Airlines seats, checked in advance.', img: FALLBACK_IMAGES.dochula, pos: 'center 45%', href: 'services.html' },
    { n: 'Hotels & Farmstay', d: 'Hand-checked stays from boutique lodges to family homes.', img: FALLBACK_IMAGES.lodge, pos: 'center 50%', href: 'services.html' },
    { n: 'Private Guide & Driver', d: 'Licensed English-speaking guide and comfortable private vehicle.', img: FALLBACK_IMAGES.thimphuDzong, pos: 'center 45%', href: 'about.html' },
    { n: 'Trek Permits', d: 'Route permits, camping crew and safety planning.', img: FALLBACK_IMAGES.cranes, pos: 'center 50%', href: 'tours.html?cat=Trek' },
    { n: 'SDF Tax Calculator', d: 'Instant USD & INR pricing with DoI child exemptions.', img: FALLBACK_IMAGES.tiger, pos: 'center 50%', href: 'sdf-calculator.html' },
    { n: 'Travel Insurance Help', d: 'Clear guidance on cover for altitude, trekking and delays.', img: FALLBACK_IMAGES.punakha, pos: 'center 60%', href: 'visa-guide.html' },
    { n: 'Group / MICE', d: 'Incentive groups, retreats and celebrations, planned in detail.', img: FALLBACK_IMAGES.festival, pos: 'center 35%', href: 'contact.html' }
  ];

  const CATEGORIES = ['All', 'Classic', 'Festival', 'Luxury', 'Honeymoon', 'Trek', 'Family', 'Birding', 'Adventure'];
  const TRENDING_TAGS = [
    'bhutan tour packages',
    'tigers nest hike',
    'festival tour 2027',
    'paro thimphu punakha',
    'druk path trek',
    'luxury retreat'
  ];

  const MEGA_CONFIG = {
    Tours: {
      title: 'Tours',
      href: 'tours.html',
      links: [
        { label: 'Classic Bhutan Discovery', href: 'tour-essential-bhutan-7d.html' },
        { label: 'Festival Tours 2027', href: 'tours.html?cat=Festival' },
        { label: 'Luxury & Private Stays', href: 'tours.html?cat=Luxury' },
        { label: 'Himalayan Trekking', href: 'tours.html?cat=Trek' },
        { label: 'Start Direct Booking', href: 'book.html' }
      ],
      img: FALLBACK_IMAGES.tiger,
      feature: 'Essential 7D · SDF included'
    },
    Destinations: {
      title: 'Destinations',
      href: 'destinations.html',
      links: [
        { label: 'Paro Valley', href: 'destination-paro.html' },
        { label: 'Thimphu Capital', href: 'destination-thimphu.html' },
        { label: 'Punakha River Valley', href: 'destination-punakha.html' },
        { label: 'Phobjikha & Gangtey', href: 'destination-phobjikha.html' },
        { label: 'Bumthang Heartland', href: 'destination-bumthang.html' },
        { label: 'Haa Alpine Valley', href: 'destination-haa.html' }
      ],
      img: FALLBACK_IMAGES.punakha,
      feature: 'Punakha Dzong · Best in Feb–Apr'
    },
    Festivals: {
      title: 'Festivals',
      href: 'festivals.html',
      links: [
        { label: 'Thimphu Tshechu', href: 'festival-thimphu-tshechu.html' },
        { label: 'Paro Tshechu', href: 'festival-paro-tshechu.html' },
        { label: 'Punakha Drubchen', href: 'festival-punakha-drubchen.html' },
        { label: 'Jambay Lhakhang Drup', href: 'festival-jambay-lhakhang.html' }
      ],
      img: FALLBACK_IMAGES.festival,
      feature: 'Sacred Tshechus · 2027'
    },
    Services: {
      title: 'Services',
      href: 'services.html',
      links: [
        { label: 'Visa & SDF Rules', href: 'visa-guide.html' },
        { label: 'SDF Cost Calculator', href: 'sdf-calculator.html' },
        { label: 'Track Live Visa Status', href: 'track-visa.html' },
        { label: 'Client Document Portal', href: 'client/login.html' },
        { label: 'Guest Reviews', href: 'reviews.html' }
      ],
      img: FALLBACK_IMAGES.dochula,
      feature: 'Licensed Operator #TR/2018/9882'
    }
  };

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

  function safeUrl(raw, fallback) {
    const s = String(raw || '').trim();
    if (!s) return fallback || '#';
    if (/^(https?:\/\/|\/|#|tour-|destination-|festival-|book\.html|tours\.html|contact\.html|services\.html|destinations\.html|festivals\.html|sdf-calculator\.html|track-visa\.html|visa-guide\.html|reviews\.html|about\.html|faq\.html|client\/|guide\/|admin\/|assets\/)/i.test(s)) {
      if (s.startsWith('//')) return fallback || '#';
      return s;
    }
    return fallback || '#';
  }

  function safeWhatsAppUrl(rawPhone, text) {
    if (global.ApiClient && typeof global.ApiClient.buildWhatsAppUrl === 'function') {
      return global.ApiClient.buildWhatsAppUrl(rawPhone || '97517654321', text || '');
    }
    const digits = String(rawPhone || '97517654321').replace(/\D/g, '');
    return `https://wa.me/${digits}?text=${encodeURIComponent(text || '')}`;
  }

  function svgIcon(name, size = 18, cls = '') {
    const common = `width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="${esc(cls)}" aria-hidden="true"`;
    const paths = {
      menu: '<line x1="4" x2="20" y1="12" y2="12"/><line x1="4" x2="20" y1="6" y2="6"/><line x1="4" x2="20" y1="18" y2="18"/>',
      x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
      sparkles: '<path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/><path d="M20 3v4"/><path d="M22 5h-4"/>',
      search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
      mapPin: '<path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/>',
      users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
      user: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
      star: '<path d="M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z"/>',
      heart: '<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>',
      eye: '<path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"/><circle cx="12" cy="12" r="3"/>',
      arrowRight: '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
      arrowUpRight: '<path d="M7 7h10v10"/><path d="M7 17 17 7"/>',
      shieldCheck: '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/>',
      badgeCheck: '<path d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z"/><path d="m9 12 2 2 4-4"/>',
      check: '<path d="M20 6 9 17l-5-5"/>',
      clock: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
      send: '<path d="M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z"/><path d="m21.854 2.147-10.94 10.939"/>',
      sliders: '<line x1="21" x2="14" y1="4" y2="4"/><line x1="10" x2="3" y1="4" y2="4"/><line x1="21" x2="12" y1="12" y2="12"/><line x1="8" x2="3" y1="12" y2="12"/><line x1="21" x2="16" y1="20" y2="20"/><line x1="12" x2="3" y1="20" y2="20"/>',
      play: '<polygon points="6 3 20 12 6 21 6 3"/>',
      video: '<path d="m16 13 5.223 3.482a.5.5 0 0 0 .777-.416V7.87a.5.5 0 0 0-.752-.432L16 10.5"/><rect x="2" y="6" width="14" height="12" rx="2"/>',
      briefcase: '<path d="M16 20V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/><rect width="20" height="14" x="2" y="6" rx="2"/>',
      minus: '<path d="M5 12h14"/>',
      plus: '<path d="M5 12h14"/><path d="M12 5v14"/>',
      chevronDown: '<path d="m6 9 6 6 6-6"/>',
      compass: '<circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/>'
    };
    return `<svg ${common}>${paths[name] || ''}</svg>`;
  }

  function resolveTourPageHref(tour) {
    if (!tour) return 'tours.html';
    const rawSlug = String(tour.slug || tour.id || '').trim();
    if (/\.html$/i.test(rawSlug)) return safeUrl(rawSlug, 'tours.html');
    if (rawSlug) return `tour-${encodeURIComponent(rawSlug)}.html`;
    return 'tours.html';
  }

  function resolveBookHref(tour, nightsOverride) {
    if (!tour) return 'book.html';
    const slug = String(tour.id || tour.slug || '').replace(/^tour-/i, '').replace(/\.html$/i, '');
    if (global.ApiClient && typeof global.ApiClient.buildBookUrl === 'function') {
      return global.ApiClient.buildBookUrl({
        tour: slug,
        nights: nightsOverride || tour.duration_nights || Math.max(1, (Number(tour.duration_days) || 6) - 1)
      });
    }
    return `book.html?tour=${encodeURIComponent(slug)}`;
  }

  function resolveFestivalPageHref(fest) {
    const slug = String((fest && (fest.slug || fest.id)) || '').trim();
    if (!slug) return 'festivals.html';
    if (/\.html$/i.test(slug)) return safeUrl(slug, 'festivals.html');
    if (slug.startsWith('festival-')) return `${slug}.html`;
    return `festival-${slug}.html`;
  }

  function resolveDestPageHref(dest) {
    const slug = String((dest && (dest.slug || dest.id)) || '').trim();
    if (!slug) return 'destinations.html';
    if (/\.html$/i.test(slug)) return safeUrl(slug, 'destinations.html');
    if (slug.startsWith('destination-')) return `${slug}.html`;
    return `destination-${slug}.html`;
  }

  const state = {
    mobileMenuOpen: false,
    megaMenu: null,
    heroIdx: 0,
    heroPaused: false,
    heroTimer: null,
    searchQuery: '',
    searchDropdownOpen: false,
    category: 'All',
    savedIds: [],
    compareIds: [],
    tripPlan: (() => {
      try {
        const raw = typeof localStorage !== 'undefined' && localStorage.getItem('bfr_trip_plan');
        const parsed = raw ? JSON.parse(raw) : [];
        return Array.isArray(parsed) ? parsed : [];
      } catch (_) {
        return [];
      }
    })(),
    planDrawerOpen: false,
    compareModalOpen: false,
    activeTourModal: null,
    modalGuests: 2,
    modalDayOpen: 0,
    activeFestModal: null,
    activeDestModal: null,
    activeFilmModal: null,
    toastMsg: '',
    chatOpen: false,
    chatInput: '',
    chatMessages: [
      {
        who: 'ai',
        text: 'Kuzu Zangpo La! Ask me about any Bhutan package, 2027 Tshechu dates, SDF tax (USD / INR), or trek difficulty — I pull live schedules directly from our booking desk.'
      }
    ],
    tours: [],
    festivals: [],
    destinations: [],
    reviews: [],
    avgRating: 4.9,
    reviewsCount: 0,
    settings: {
      company_name: 'Bhutan Fast Rate Tours',
      company_license: 'TR/2018/9882',
      company_phone: '+975 17 654 321',
      company_whatsapp: '+97517654321',
      company_email: 'reservations@bhutanfastratetours.bt',
      sdf_rate_international: '100',
      sdf_rate_india: '1200'
    },
    customForm: {
      name: '',
      email: '',
      phone: '',
      dates: '',
      travellers: '2 Adults',
      budget: 2400,
      interests: ['Culture'],
      pace: 'Balanced',
      message: ''
    },
    customSubmitting: false,
    customError: '',
    customResult: null,
    newsletterEmail: '',
    newsletterBusy: false,
    newsletterMsg: '',
    newsletterErr: '',
    loadingCatalog: true,
    catalogError: ''
  };

  const SEARCH_STOPWORDS = new Set([
    'bhutan', 'tour', 'tours', 'package', 'packages', 'trip', 'trips', 'holiday', 'holidays',
    '2026', '2027', 'best', 'time', 'to', 'visit', 'the', 'and', 'with', 'for', 'in', 'on', 'of',
    'a', 'an', 'under', 'below', 'less', 'than', 'budget', 'max', 'days', 'day', 'nights', 'night', 'eg'
  ]);

  const SEARCH_SYNONYMS = {
    tiger: ['tiger', 'tigers', 'taktsang', 'nest', 'paro'],
    tigers: ['tiger', 'tigers', 'taktsang', 'nest', 'paro'],
    nest: ['nest', 'taktsang', 'tiger', 'paro'],
    hike: ['hike', 'trek', 'trekking', 'excursion', 'trail', 'tiger'],
    hikes: ['hike', 'trek', 'trekking', 'excursion', 'trail', 'tiger'],
    retreat: ['retreat', 'luxury', 'escape', 'wellness', 'amankora', 'punakha'],
    honeymoon: ['honeymoon', 'romantic', 'luxury', 'escape', 'punakha', 'amankora'],
    festival: ['festival', 'festivals', 'tshechu', 'cham'],
    festivals: ['festival', 'festivals', 'tshechu', 'cham'],
    trek: ['trek', 'trekking', 'expedition', 'alpine', 'snowman', 'druk'],
    trekking: ['trek', 'trekking', 'expedition', 'alpine', 'snowman', 'druk'],
    family: ['family', 'easy', 'short', 'essential', 'cultural', 'paro', 'punakha'],
    birding: ['bird', 'birding', 'crane', 'cranes', 'phobjikha', 'gangtey'],
    crane: ['crane', 'cranes', 'phobjikha', 'gangtey'],
    spiritual: ['spiritual', 'pilgrimage', 'bumthang', 'sacred', 'monastery', 'tshechu'],
    craft: ['craft', 'textile', 'textiles', 'eastern', 'bumthang'],
    luxury: ['luxury', 'escape', 'amankora', 'five', '5']
  };

  function normSearchText(val) {
    return String(val || '')
      .toLowerCase()
      .replace(/['’‘`]/g, '')
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  }

  function tourMatchesQuery(tour, rawQuery) {
    const raw = String(rawQuery || '').trim().toLowerCase();
    if (!raw) return true;

    let work = raw.replace(/['’‘`]/g, '');
    let maxPrice = null;
    const priceMatch = work.match(/(?:under|below|less than|max|budget|<)\s*\$?\s*(\d{3,5})/);
    if (priceMatch) {
      maxPrice = Number(priceMatch[1]);
      work = work.replace(priceMatch[0], ' ');
    }
    const bareCurrency = work.match(/\$\s*(\d{3,5})/);
    if (bareCurrency && !maxPrice) {
      maxPrice = Number(bareCurrency[1]);
      work = work.replace(bareCurrency[0], ' ');
    }

    let targetDays = null;
    const daysMatch = work.match(/\b(\d{1,2})\s*(?:days?|nights?|d)\b/);
    if (daysMatch) {
      targetDays = Number(daysMatch[1]);
      work = work.replace(daysMatch[0], ' ');
    }

    const tourPrice = Number(tour.price_3star_usd || tour.price_usd || 0);
    if (maxPrice !== null && tourPrice > maxPrice) return false;

    const tourDays = Number(tour.duration_days || 6);
    if (targetDays !== null && Math.abs(tourDays - targetDays) > 2) return false;

    const hay = normSearchText(
      `${tour.title || ''} ${tour.valleys || ''} ${tour.subtitle || ''} ${tour.highlight_text || ''} ${tour.category || ''} ${tour.difficulty || ''} ${tour.slug || ''}`
    );

    const tokens = normSearchText(work)
      .split(/\s+/)
      .filter((tok) => tok && !SEARCH_STOPWORDS.has(tok) && !/^\d+$/.test(tok));

    if (tokens.length === 0) return true;

    return tokens.every((tok) => {
      const variants = SEARCH_SYNONYMS[tok] || [tok, tok.replace(/s$/, '')];
      return variants.some((v) => v && hay.includes(v));
    });
  }

  function getFilteredTours() {
    const q = state.searchQuery.trim();
    return state.tours.filter((t) => {
      const catStr = normSearchText(t.category || '');
      const hayAll = normSearchText(`${t.title || ''} ${t.valleys || ''} ${t.subtitle || ''} ${t.highlight_text || ''} ${t.category || ''} ${t.difficulty || ''}`);
      const sel = state.category.toLowerCase();
      const catOk =
        state.category === 'All' ||
        catStr.includes(sel) ||
        hayAll.includes(sel) ||
        (sel === 'classic' && (catStr.includes('classic') || catStr.includes('cultural') || catStr.includes('heritage') || catStr.includes('short'))) ||
        (sel === 'luxury' && (catStr.includes('luxury') || catStr.includes('escape') || catStr.includes('wellness'))) ||
        (sel === 'honeymoon' && (hayAll.includes('honeymoon') || hayAll.includes('romantic') || catStr.includes('luxury') || catStr.includes('escape') || hayAll.includes('punakha'))) ||
        (sel === 'family' && (hayAll.includes('family') || hayAll.includes('easy') || catStr.includes('short') || catStr.includes('cultural') || catStr.includes('classic'))) ||
        (sel === 'birding' && (hayAll.includes('bird') || hayAll.includes('phobjikha') || hayAll.includes('crane'))) ||
        (sel === 'trek' && (catStr.includes('trek') || catStr.includes('expedition'))) ||
        (sel === 'adventure' && (catStr.includes('adventure') || catStr.includes('trek') || catStr.includes('expedition')));
      if (!catOk) return false;
      return tourMatchesQuery(t, q);
    });
  }

  function renderHeroSection() {
    const slidesHtml = HERO_SLIDES.map((s, idx) => {
      const matchedTour = state.tours.find((t) => (t.id || '').includes(s.tourSlug) || (t.slug || '').includes(s.tourSlug)) || state.tours[idx];
      const livePrice = matchedTour ? Number(matchedTour.price_3star_usd || matchedTour.price_usd || s.defaultPrice) : s.defaultPrice;
      const tourHref = matchedTour ? resolveTourPageHref(matchedTour) : `tour-${s.tourSlug}.html`;
      const bookHref = matchedTour ? resolveBookHref(matchedTour) : `book.html?tour=${encodeURIComponent(s.tourSlug)}`;
      const isActive = idx === state.heroIdx;
      const wrapJustify = s.layout === 'center' ? 'justify-center text-center' : s.layout === 'split' ? 'justify-end' : '';
      const boxCls =
        s.layout === 'center'
          ? 'mx-auto'
          : s.layout === 'split'
            ? 'backdrop-blur-md p-6 sm:p-8 rounded-[28px] border border-white/20'
            : '';
      const boxStyle = s.layout === 'split' ? 'background-color:rgba(11,42,34,0.72);' : '';

      return `
        <div class="absolute inset-0 transition-opacity duration-500 ${isActive ? 'opacity-100 z-10' : 'opacity-0 pointer-events-none z-0'}" data-hero-slide="${idx}">
          <img src="${esc(s.img)}" alt="${esc(s.title)}" loading="eager" decoding="async" class="absolute inset-0 w-full h-full object-cover ${isActive ? 'kenburns' : ''}">
          <div class="absolute inset-0 pointer-events-none" style="background:linear-gradient(to right, rgba(0,0,0,0.72), rgba(0,0,0,0.35), rgba(0,0,0,0));"></div>
          <div class="relative z-10 h-full max-w-[1360px] mx-auto px-4 sm:px-6 flex items-center ${wrapJustify}">
            <div class="splash-in max-w-[680px] text-white ${boxCls}" style="${boxStyle}">
              <span class="inline-flex items-center gap-2 bg-[#C9A24B] text-[#0B2A22] px-3 py-1.5 rounded-full text-xs font-extrabold tracking-widest">${esc(s.kicker)}</span>
              <h1 class="font-serif text-[42px] leading-[0.98] sm:text-[68px] lg:text-[78px] font-semibold mt-4 drop-shadow">${esc(s.title)}</h1>
              <p class="text-[17px] sm:text-lg text-white/90 mt-4 max-w-[560px]">${esc(s.sub)}</p>
              <div class="flex flex-wrap items-center gap-3 mt-6">
                <a href="${esc(tourHref)}" class="bg-[#C9A24B] hover:bg-[#E4C87E] text-[#0B2A22] px-6 py-3.5 rounded-full font-extrabold transition inline-flex items-center gap-2">
                  Explore this journey ${svgIcon('arrowRight', 16)}
                </a>
                <a href="#tours" class="border border-white/60 hover:bg-white/15 text-white px-6 py-3.5 rounded-full font-bold transition">
                  All tours
                </a>
                <span class="font-serif text-xl text-white">from <b class="text-[28px]">$${livePrice.toLocaleString('en-US')}</b> <span class="text-sm">/ person</span></span>
              </div>
            </div>
          </div>
        </div>
      `;
    }).join('');

    const dotsHtml = HERO_SLIDES.map((s, idx) => `
      <button type="button" data-action="hero-dot" data-idx="${idx}" aria-label="Go to slide ${idx + 1}" class="flex-1 text-left">
        <span class="text-white text-xs font-bold block mb-2 drop-shadow">${String(idx + 1).padStart(2, '0')} · ${esc(s.kicker)}</span>
        <span class="block h-[4px] bg-white/30 rounded-full overflow-hidden" data-hero-dot-bar="${idx}">
          ${idx === state.heroIdx ? '<span class="block h-full bg-[#C9A24B] progress-run"></span>' : idx < state.heroIdx ? '<span class="block h-full bg-white w-full"></span>' : ''}
        </span>
      </button>
    `).join('');

    return `
      <section id="hero" class="relative h-[620px] sm:h-[640px] overflow-hidden bg-[#0B2A22]" style="min-height:600px;">
        <div class="relative h-full" style="min-height:600px;">
          ${slidesHtml}
          <div class="absolute bottom-5 left-0 right-0 z-20">
            <div class="max-w-[1360px] mx-auto px-4 sm:px-6 flex gap-2">
              ${dotsHtml}
            </div>
          </div>
        </div>
      </section>
    `;
  }

  function renderMegaMenuHtml() {
    if (!state.megaMenu || !MEGA_CONFIG[state.megaMenu]) return '';
    return `
      <div class="hidden lg:block absolute left-0 right-0 top-full bg-white text-[#101613] shadow-2xl border-t border-[#E7DCC4] z-40" id="homeMegaPanel">
        <div class="max-w-[1360px] mx-auto px-6 py-7 grid grid-cols-4 gap-7">
          <div>
            <p class="text-xs tracking-[0.2em] text-[#C9A24B] font-extrabold">EXPLORE ${esc(state.megaMenu.toUpperCase())}</p>
            <div class="flex items-baseline justify-between mt-2 gap-2">
              <h3 class="font-serif text-3xl text-[#0B2A22]">${esc(MEGA_CONFIG[state.megaMenu].title)} in Bhutan</h3>
              <a href="${esc(MEGA_CONFIG[state.megaMenu].href)}" class="text-xs font-bold text-[#C9A24B] hover:underline whitespace-nowrap">View Page →</a>
            </div>
            <p class="text-sm text-[#66706A] mt-2">Hand-checked routes, licensed guides and SDF included.</p>
            <div class="flex flex-wrap gap-2 mt-4">
              ${['bhutan tour packages', 'best time to visit', 'tigers nest'].map((tag) => `
                <button type="button" data-action="quick-tag" data-tag="${esc(tag)}" class="text-xs bg-[#FFF8EC] text-[#0B2A22] border border-[#E7DCC4] px-3 py-1.5 rounded-full font-bold">${esc(tag)}</button>
              `).join('')}
            </div>
          </div>
          <div class="space-y-1">
            ${MEGA_CONFIG[state.megaMenu].links.map((lk) => `
              <a href="${esc(lk.href)}" class="w-full text-left px-3 py-2.5 rounded-xl hover:bg-[#FFF8EC] font-semibold flex justify-between items-center text-[#101613]">
                <span>${esc(lk.label)}</span>
                <span class="text-[#C9A24B]">→</span>
              </a>
            `).join('')}
          </div>
          <div class="bg-[#FFF8EC] text-[#101613] rounded-2xl p-4 flex flex-col justify-between border border-[#E7DCC4]">
            <div>
              <p class="text-xs font-extrabold text-[#C9A24B] tracking-widest">DIRECT CONCIERGE</p>
              <p class="font-serif text-xl mt-1 text-[#0B2A22]">Need tailor-made dates or Regional INR pricing?</p>
              <p class="text-sm text-[#66706A] mt-2">Use our instant SDF calculator or speak directly with our Paro booking desk.</p>
            </div>
            <a href="book.html" class="mt-4 inline-flex items-center gap-2 bg-[#0B2A22] text-white px-4 py-2.5 rounded-full text-sm font-bold w-fit whitespace-nowrap">
              Start Booking ${svgIcon('arrowRight', 15)}
            </a>
          </div>
          <div class="relative rounded-2xl overflow-hidden bg-[#0B2A22]" style="height:210px;min-height:200px;">
            <img src="${esc(MEGA_CONFIG[state.megaMenu].img)}" alt="${esc(MEGA_CONFIG[state.megaMenu].feature)}" class="absolute inset-0 w-full h-full object-cover" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;">
            <div class="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent pointer-events-none"></div>
            <div class="absolute bottom-3 left-3 right-3 text-white z-10">
              <span class="text-[11px] font-bold text-[#E4C87E] uppercase">HIGHLIGHT</span>
              <p class="font-serif text-lg drop-shadow">${esc(MEGA_CONFIG[state.megaMenu].feature)}</p>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function renderHeaderSection() {
    const lic = state.settings.company_license || 'TR/2018/9882';
    const cleanLic = String(lic).replace(/^#/, '');
    const avg = Number(state.avgRating || 4.9).toFixed(1);
    const totalReviews = state.reviewsCount > 0 ? `${state.reviewsCount} verified reviews` : '2,400+ happy travellers';

    return `
      <div class="bg-[#0B2A22] text-white text-[12px] sm:text-[13px]" id="top">
        <div class="max-w-[1360px] mx-auto px-4 sm:px-6 py-2 flex flex-wrap gap-x-5 gap-y-1 items-center justify-between">
          <span class="font-semibold sm:whitespace-nowrap">✓ SDF fee included · Licensed Bhutan operator <span data-bfr-license>#${esc(cleanLic)}</span></span>
          <span class="hidden md:block whitespace-nowrap">USD &amp; INR · English · Live help 9am–7pm Bhutan time</span>
          <span class="text-[#E4C87E] font-bold whitespace-nowrap">★ ${esc(avg)} · ${esc(totalReviews)}</span>
        </div>
      </div>

      <header id="siteHeader" class="sticky top-0 z-40 bg-[#FFF8EC]/95 backdrop-blur border-b border-[#E7DCC4]" style="top:0;background-color:rgba(255,248,236,0.97);">
        <div class="max-w-[1360px] mx-auto px-3 sm:px-6 h-[68px] sm:h-[72px] flex items-center gap-1.5 sm:gap-2">
          <button type="button" id="homeMobileOpenBtn" class="lg:hidden p-1.5 sm:p-2 rounded-xl text-[#0B2A22] hover:bg-[#F7EDD8] shrink-0" aria-label="Open menu">
            ${svgIcon('menu', 22)}
          </button>

          <a href="#top" class="flex items-center gap-2 shrink-0 min-w-0 whitespace-nowrap">
            <span class="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-[#0B2A22] text-[#C9A24B] grid place-items-center font-serif text-base sm:text-xl font-bold shrink-0">B</span>
            <span class="leading-none">
              <span class="block font-serif text-[14px] sm:text-[18px] lg:text-[17px] xl:text-[22px] font-bold tracking-tight text-[#0B2A22] whitespace-nowrap">BHUTAN FAST RATE</span>
              <span class="block text-[9px] sm:text-[10px] tracking-[0.16em] sm:tracking-[0.2em] xl:tracking-[0.24em] text-[#C9A24B] font-extrabold whitespace-nowrap">TOURS · EST. PARO</span>
            </span>
          </a>

          <nav class="hidden lg:flex items-center ml-1 xl:ml-5 gap-0.5 text-[13px] xl:text-[15px] font-semibold text-[#101613] whitespace-nowrap">
            <a href="index.html" class="px-2.5 xl:px-3 py-1.5 xl:py-2 rounded-full bg-[#0B2A22] text-white font-bold whitespace-nowrap shrink-0">Home</a>
            <a href="tours.html" data-mega="Tours" class="px-2 xl:px-2.5 py-1.5 xl:py-2 rounded-full text-[#101613] hover:bg-[#F7EDD8] transition-colors whitespace-nowrap shrink-0">Tours</a>
            <a href="destinations.html" data-mega="Destinations" class="px-2 xl:px-2.5 py-1.5 xl:py-2 rounded-full text-[#101613] hover:bg-[#F7EDD8] transition-colors whitespace-nowrap shrink-0">Destinations</a>
            <a href="festivals.html" data-mega="Festivals" class="px-2 xl:px-2.5 py-1.5 xl:py-2 rounded-full text-[#101613] hover:bg-[#F7EDD8] transition-colors whitespace-nowrap shrink-0">Festivals</a>
            <a href="services.html" data-mega="Services" class="px-2 xl:px-2.5 py-1.5 xl:py-2 rounded-full text-[#101613] hover:bg-[#F7EDD8] transition-colors whitespace-nowrap shrink-0">Visa &amp; SDF</a>
            <a href="about.html" class="px-2 xl:px-2.5 py-1.5 xl:py-2 rounded-full text-[#101613] hover:bg-[#F7EDD8] transition-colors whitespace-nowrap shrink-0">About Us</a>
            <a href="contact.html" class="px-2 xl:px-2.5 py-1.5 xl:py-2 rounded-full text-[#101613] hover:bg-[#F7EDD8] transition-colors whitespace-nowrap shrink-0">Contact</a>
          </nav>

          <div class="ml-auto flex items-center gap-1.5 shrink-0" data-bfr-portal-links data-bfr-skip-portal-inject="1">
            <a href="client/login.html" class="inline-flex items-center gap-1 border border-[#E7DCC4] bg-white hover:bg-[#F7EDD8] text-[#0B2A22] px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-full text-[11px] sm:text-xs xl:text-sm font-bold shadow-sm whitespace-nowrap shrink-0 transition" title="User / Traveler Sign In">
              ${svgIcon('user', 14, 'text-[#C9A24B] shrink-0')}
              <span>Sign In</span>
            </a>
            <button type="button" id="homePlanDrawerBtn" class="relative inline-flex items-center gap-1.5 bg-[#0B2A22] hover:bg-[#123A30] text-white px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-full text-xs xl:text-sm font-bold shadow-sm whitespace-nowrap shrink-0 transition">
              ${svgIcon('briefcase', 15)}
              <span class="hidden sm:inline lg:hidden xl:inline">Trip Plan</span>
              ${state.tripPlan.length > 0 ? `<span class="absolute -top-1 -right-1 w-5 h-5 bg-[#C9A24B] text-[#0B2A22] rounded-full text-[11px] grid place-items-center font-extrabold">${state.tripPlan.reduce((acc, item) => acc + (item.qty || 1), 0)}</span>` : ''}
            </button>
            <a href="book.html" class="hidden sm:inline-flex items-center gap-1.5 bg-[#C9A24B] hover:bg-[#E4C87E] text-[#0B2A22] px-3 xl:px-3.5 py-1.5 sm:py-2 rounded-full text-xs xl:text-sm font-extrabold shadow-sm whitespace-nowrap shrink-0 transition">
              <span>Book Now</span>
              ${svgIcon('arrowRight', 14)}
            </a>
            <button type="button" id="homeAiHeaderBtn" class="hidden xl:inline-flex items-center gap-1.5 border border-[#E7DCC4] px-3 py-2 rounded-full text-xs xl:text-sm font-bold bg-white text-[#0B2A22] hover:bg-[#F7EDD8] whitespace-nowrap shrink-0 transition">
              ${svgIcon('sparkles', 15, 'text-[#C9A24B]')} AI Help
            </button>
          </div>
        </div>
        <div id="homeMegaSlot">${renderMegaMenuHtml()}</div>
      </header>
    `;
  }

  function renderMobileDrawer() {
    if (!state.mobileMenuOpen) return '';
    return `
      <div id="homeMobileBackdrop" class="fixed inset-0 z-50 bg-black/50">
        <div id="homeMobilePanel" class="h-full w-[300px] max-w-[85vw] bg-[var(--cream)] p-5 overflow-y-auto shadow-2xl">
          <div class="flex items-center justify-between pb-4 border-b border-[var(--line)]">
            <span class="font-serif font-bold text-lg text-[#0B2A22]">BHUTAN FAST RATE</span>
            <button type="button" id="homeMobileCloseBtn" aria-label="Close menu" class="p-2 rounded-xl hover:bg-[#F7EDD8]">${svgIcon('x', 20)}</button>
          </div>
          <div class="mt-5 space-y-1 font-semibold">
            <a href="index.html" class="block px-3 py-2.5 rounded-xl bg-[#0B2A22] text-white">Home</a>
            <a href="tours.html" class="block px-3 py-2.5 rounded-xl hover:bg-[#F7EDD8]">Tours &amp; Packages</a>
            <a href="book.html" class="block px-3 py-2.5 rounded-xl hover:bg-[#F7EDD8] font-bold text-[#0B2A22]">Book a Tour Online</a>
            <a href="destinations.html" class="block px-3 py-2.5 rounded-xl hover:bg-[#F7EDD8]">Destinations</a>
            <a href="festivals.html" class="block px-3 py-2.5 rounded-xl hover:bg-[#F7EDD8]">Festivals 2027</a>
            <a href="services.html" class="block px-3 py-2.5 rounded-xl hover:bg-[#F7EDD8]">Visa &amp; SDF</a>
            <a href="sdf-calculator.html" class="block px-3 py-2.5 rounded-xl hover:bg-[#F7EDD8]">SDF Calculator</a>
            <a href="track-visa.html" class="block px-3 py-2.5 rounded-xl hover:bg-[#F7EDD8]">Track Visa Status</a>
            <a href="client/login.html" class="block px-3 py-2.5 rounded-xl bg-white border border-[#E7DCC4] font-bold text-[#0B2A22] hover:bg-[#F7EDD8]">User Sign In (Client Portal)</a>
            <a href="contact.html" class="block px-3 py-2.5 rounded-xl hover:bg-[#F7EDD8]">Contact &amp; Custom Quotes</a>
          </div>
          <a href="#custom" id="mobileCustomLink" class="mt-6 block text-center bg-[#C9A24B] text-[#0B2A22] py-3 rounded-full font-extrabold text-sm">
            Plan Custom Itinerary
          </a>
        </div>
      </div>
    `;
  }

  function renderSearchDropdownHtml() {
    if (!state.searchDropdownOpen || !state.searchQuery.trim()) return '';
    const qNorm = normSearchText(state.searchQuery);
    const qTokens = qNorm.split(/\s+/).filter(Boolean);
    const tagSuggestions = TRENDING_TAGS.filter((t) => {
      const tNorm = normSearchText(t);
      return tNorm.includes(qNorm) || qTokens.some((tok) => tok.length >= 2 && tNorm.includes(tok));
    }).slice(0, 4);
    const tourMatches = state.tours.filter((t) => tourMatchesQuery(t, state.searchQuery)).slice(0, 4);

    return `
      <div class="absolute left-0 right-0 top-full mt-2 bg-white text-[#101613] border border-[#E7DCC4] rounded-2xl shadow-xl overflow-hidden z-30">
        ${tagSuggestions.map((tag) => `
          <button type="button" data-action="quick-tag" data-tag="${esc(tag)}" class="w-full text-left px-4 py-2.5 hover:bg-[#FFF8EC] text-[#0B2A22] text-sm font-semibold flex items-center gap-2 border-b border-[#E7DCC4]/50">
            ${svgIcon('sparkles', 15, 'text-[#C9A24B] shrink-0')}
            <span>${esc(tag)}</span>
            <span class="ml-auto text-[11px] font-bold text-[#66706A]">Tag</span>
          </button>
        `).join('')}
        ${tourMatches.map((t) => `
          <button type="button" data-action="dropdown-tour" data-id="${esc(t.id)}" class="w-full text-left px-4 py-2.5 hover:bg-[#FFF8EC] text-[#0B2A22] text-sm font-semibold flex items-center justify-between gap-2 border-b border-[#E7DCC4]/50">
            <span class="truncate">${esc(t.title)}</span>
            <span class="text-xs font-extrabold text-[#C9A24B] shrink-0">${Number(t.duration_days) || 6}D · $${Number(t.price_3star_usd || t.price_usd || 1899).toLocaleString('en-US')}</span>
          </button>
        `).join('')}
        <button type="button" id="homeSearchDirectGo" class="w-full text-left px-4 py-3 bg-[#FFF8EC]/70 hover:bg-[#F7EDD8] text-[#0B2A22] text-xs font-extrabold flex items-center justify-between">
          <span>Show all matching packages (${state.tours.filter((t) => tourMatchesQuery(t, state.searchQuery)).length}) for "${esc(state.searchQuery)}"</span>
          <span>→</span>
        </button>
      </div>
    `;
  }

  function renderSearchAndTrust() {
    const trustBadges = [
      ['Licensed operator', `Bhutan Tourism approved #${String(state.settings.company_license || 'TR/2018/9882').replace(/^#/, '')}`],
      ['SDF included', 'No hidden fees · USD & INR'],
      ['Private guides', 'English-speaking experts'],
      ['Flexible dates', 'Departures all year']
    ];

    return `
      <section class="max-w-[1100px] mx-auto px-4 sm:px-6 -mt-8 relative z-30">
        <div class="bg-white text-[#101613] rounded-[26px] shadow-2xl p-4 sm:p-5 border border-[#E7DCC4]">
          <div class="flex items-center gap-2 text-[#0B2A22] font-extrabold">
            ${svgIcon('sparkles', 18, 'text-[#C9A24B]')}
            <span>AI Trip Search</span>
            <span class="hidden sm:inline text-xs bg-[#FFF8EC] border border-[#E7DCC4] px-2.5 py-1 rounded-full font-bold">SDF INCLUDED</span>
            <span class="hidden md:inline text-xs text-[#66706A] font-semibold ml-auto">Live catalog synced with Paro desk</span>
          </div>
          <div class="relative mt-3">
            <div class="flex items-center gap-2 bg-[#FFF8EC] border-2 border-[#0B2A22] rounded-full pl-5 pr-2 py-2">
              ${svgIcon('search', 18, 'text-[#0B2A22]')}
              <input id="homeSearchInput" type="text" value="${esc(state.searchQuery)}" placeholder="Ask AI: e.g. 7 days festival + Tiger’s Nest under $2500" class="flex-1 min-w-0 bg-transparent outline-none py-1.5 text-[15px] sm:text-base text-[#101613]" style="color-scheme:light;color:#101613;">
              <button type="button" id="homeSearchBtn" class="bg-[#0B2A22] hover:bg-[#123A30] text-white px-5 py-2.5 rounded-full font-bold shrink-0">Search</button>
            </div>
            <div id="homeSearchDropdownSlot">${renderSearchDropdownHtml()}</div>
          </div>
          <div class="flex flex-wrap gap-2 mt-3" id="homeTrendingTagsRow">
            <span class="text-xs font-bold pt-1.5 text-[#66706A]">Trending:</span>
            ${TRENDING_TAGS.map((tag) => {
              const activeTag = normSearchText(state.searchQuery) === normSearchText(tag);
              return `<button type="button" data-action="quick-tag" data-tag="${esc(tag)}" class="text-xs border px-3 py-1.5 rounded-full font-bold transition ${activeTag ? 'bg-[#0B2A22] text-white border-[#0B2A22]' : 'border-[#E7DCC4] bg-white hover:border-[#C9A24B] text-[#0B2A22]'}">${esc(tag)}</button>`;
            }).join('')}
          </div>
        </div>

        <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4 text-center">
          ${trustBadges.map(([t, sub]) => `
            <div class="bg-white/95 text-[#101613] border border-[#E7DCC4] rounded-2xl p-3 shadow-sm">
              <p class="font-extrabold text-sm text-[#0B2A22]">${esc(t)}</p>
              <p class="text-xs text-[#66706A] mt-0.5">${esc(sub)}</p>
            </div>
          `).join('')}
        </div>
      </section>
    `;
  }

  function renderToursSection() {
    const filtered = getFilteredTours();
    const compareBar = state.compareIds.length > 0
      ? `<div class="mb-4 bg-white border border-[var(--line)] rounded-2xl p-4 flex flex-wrap gap-3 items-center justify-between shadow-sm">
          <span class="font-bold text-sm text-[#0B2A22]">Compare: ${state.compareIds.map((id) => {
            const t = state.tours.find((x) => x.id === id);
            return esc(t ? t.title : id);
          }).join('  vs  ')}</span>
          <div class="flex items-center gap-3">
            ${state.compareIds.length >= 2 ? `<button type="button" id="openCompareModalBtn" class="bg-[#0B2A22] text-white px-4 py-1.5 rounded-full text-xs font-bold">Compare Side-by-Side</button>` : ''}
            <a href="tours.html" class="text-sm font-bold text-[#C9A24B] hover:underline">Full Catalog →</a>
            <button type="button" id="clearCompareBtn" class="text-sm font-bold underline">Clear</button>
          </div>
        </div>`
      : '';

    const toastBanner = state.toastMsg
      ? `<div class="mb-4 bg-[#0B2A22] text-white px-4 py-3 rounded-xl text-sm font-bold flex items-center gap-2">${svgIcon('check', 16, 'text-[#C9A24B]')} <span>${esc(state.toastMsg)}</span></div>`
      : '';

    const activeQueryBar = state.searchQuery.trim()
      ? `<div class="mb-4 bg-white border border-[var(--line)] rounded-2xl px-4 py-3 flex flex-wrap gap-3 items-center justify-between text-sm shadow-sm">
          <span class="font-semibold text-[#0B2A22]">Showing <strong>${filtered.length}</strong> ${filtered.length === 1 ? 'package' : 'packages'} for “${esc(state.searchQuery.trim())}”</span>
          <button type="button" id="clearSearchQueryBtn" class="text-xs font-extrabold text-[#C9A24B] hover:underline">Clear search ✕</button>
        </div>`
      : '';

    let gridBody = '';
    if (state.loadingCatalog) {
      gridBody = `<div class="col-span-full bg-white border border-[var(--line)] rounded-2xl p-10 text-center text-[var(--muted)] font-semibold">Loading live Bhutan journeys from Paro desk…</div>`;
    } else if (state.catalogError) {
      gridBody = `<div class="col-span-full bg-white border border-red-200 rounded-2xl p-8 text-center">
        <p class="font-serif text-2xl text-[#0B2A22]">Could not load live tour catalog</p>
        <p class="text-sm text-red-700 mt-2">${esc(state.catalogError)}</p>
      </div>`;
    } else if (filtered.length === 0) {
      gridBody = `<div class="col-span-full bg-white border border-[var(--line)] rounded-2xl p-8 text-center">
        <p class="font-serif text-2xl">No exact match — try Festival, Luxury, Trek or Classic.</p>
        <button type="button" id="resetTourFilterBtn" class="mt-3 bg-[#0B2A22] text-white px-5 py-2.5 rounded-full font-bold text-sm">Show all tours</button>
      </div>`;
    } else {
      gridBody = filtered.slice(0, 8).map((t) => {
        const price = Number(t.price_3star_usd || t.price_usd || 1899);
        const days = Number(t.duration_days) || 6;
        const cat = String(t.category || 'Classic');
        const rating = Number(t.rating || 4.9).toFixed(1);
        const img = safeUrl(t.cover_image, FALLBACK_IMAGES.tiger);
        const tourHref = resolveTourPageHref(t);
        const bookHref = resolveBookHref(t);
        const isSaved = state.savedIds.includes(t.id);
        const isCmp = state.compareIds.includes(t.id);
        return `
          <article class="group bg-white text-[#101613] rounded-[24px] overflow-hidden border border-[#E7DCC4] card-lift flex flex-col">
            <button type="button" data-action="quick-tour" data-id="${esc(t.id)}" class="relative block w-full text-left overflow-hidden h-[230px]">
              <img src="${esc(img)}" alt="${esc(t.title)}" class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110">
              <span class="absolute top-3 left-3 bg-white/95 px-3 py-1 rounded-full text-xs font-extrabold text-[#0B2A22]">${days} DAYS · ${esc(cat.toUpperCase())}</span>
              <span class="absolute top-3 right-3 bg-[#0B2A22] text-white px-2.5 py-1 rounded-full text-xs font-bold flex items-center gap-1">${svgIcon('star', 13, 'fill-[#C9A24B] text-[#C9A24B]')} ${esc(rating)}</span>
              <span class="absolute inset-x-3 bottom-3 bg-[#0B2A22]/90 text-white text-center py-2.5 rounded-full text-sm font-bold opacity-0 group-hover:opacity-100 transition">Quick view →</span>
            </button>
            <div class="p-4 flex-1 flex flex-col">
              <a href="${esc(tourHref)}" class="text-left">
                <h3 class="font-serif text-[22px] leading-tight gold-line inline text-[#0B2A22]">${esc(t.title)}</h3>
              </a>
              <p class="text-sm text-[#66706A] mt-2 flex gap-1">${svgIcon('mapPin', 15, 'shrink-0 mt-0.5')} <span>${esc(t.valleys || 'Paro • Thimphu • Punakha')}</span></p>
              <p class="text-sm text-[#101613] mt-2 flex-1">${esc(t.subtitle || t.highlight_text || 'Private licensed Bhutanese guide, SDF included, and curated boutique stays.')}</p>
              <p class="text-xs text-[#66706A] mt-3 flex items-center gap-1">${svgIcon('users', 14)} <span>${esc(t.difficulty || 'Easy to Moderate')} · SDF Included</span></p>
              <div class="flex items-end justify-between mt-4 pt-4 border-t border-[#E7DCC4]">
                <div>
                  <span class="text-xs text-[#66706A] block">From</span>
                  <span class="font-serif text-[26px] font-bold text-[#0B2A22]">$${price.toLocaleString('en-US')}</span>
                </div>
                <div class="flex gap-1.5">
                  <button type="button" data-action="save-tour" data-id="${esc(t.id)}" aria-label="Save tour" class="w-10 h-10 rounded-full grid place-items-center border ${isSaved ? 'bg-[#C9A24B] text-white border-[#C9A24B]' : 'bg-white text-[#0B2A22] border-[#E7DCC4]'}">
                    ${svgIcon('heart', 16, isSaved ? 'fill-white' : '')}
                  </button>
                  <button type="button" data-action="compare-tour" data-id="${esc(t.id)}" aria-label="Compare tour" class="px-3 h-10 rounded-full text-xs font-extrabold border ${isCmp ? 'bg-[#0B2A22] text-white border-[#0B2A22]' : 'bg-white text-[#0B2A22] border-[#E7DCC4]'}">
                    Compare
                  </button>
                </div>
              </div>
              <div class="flex gap-2 mt-3">
                <a href="${esc(tourHref)}" class="flex-1 text-center bg-[#0B2A22] hover:bg-[#123A30] text-white py-3 rounded-full font-bold text-sm transition">View details</a>
                <a href="${esc(bookHref)}" class="flex-1 text-center border border-[#0B2A22] bg-white hover:bg-[#FFF8EC] text-[#0B2A22] py-3 rounded-full font-bold text-sm transition">Book Now</a>
              </div>
            </div>
          </article>
        `;
      }).join('');
    }

    return `
      <main id="tours" class="max-w-[1360px] mx-auto px-4 sm:px-6 pt-14">
        <div class="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p class="text-[#C9A24B] font-extrabold tracking-[0.22em] text-xs">CURATED COLLECTION</p>
            <h2 class="font-serif text-[36px] sm:text-[54px] leading-none mt-2 text-[#0B2A22]">Journeys people<br>remember for life.</h2>
          </div>
          <div class="max-w-[400px]">
            <p class="text-[#66706A]">Explore full day-by-day itineraries, transparent 3★/4★/5★ tier rates with SDF included, and instant online booking.</p>
            <a href="tours.html" class="inline-flex items-center gap-1.5 text-sm font-extrabold text-[#0B2A22] hover:text-[#C9A24B] mt-2">
              Browse all ${state.tours.length || ''} packages ${svgIcon('arrowRight', 15)}
            </a>
          </div>
        </div>

        <div class="flex gap-2 overflow-x-auto no-scrollbar py-5">
          ${CATEGORIES.map((c) => `
            <button type="button" data-action="cat-filter" data-cat="${esc(c)}" class="px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap ${state.category === c ? 'bg-[#0B2A22] text-white' : 'bg-white text-[#0B2A22] border border-[#E7DCC4] hover:bg-[#F7EDD8]'}">
              ${esc(c)}
            </button>
          `).join('')}
        </div>

        ${toastBanner}
        ${activeQueryBar}
        ${compareBar}
        <div class="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          ${gridBody}
        </div>
      </main>
    `;
  }

  function renderFestivalsSection() {
    const fests = state.festivals.slice(0, 4);
    return `
      <section class="max-w-[1360px] mx-auto px-4 sm:px-6 pt-20">
        <div class="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p class="text-[#C9A24B] font-extrabold tracking-[0.22em] text-xs">FESTIVAL DEPARTURES · 2027</p>
            <h2 class="font-serif text-[36px] sm:text-[54px] mt-2 text-[#0B2A22]">Move your cursor.<br>Look closer.</h2>
            <p class="text-[#66706A] mt-2 max-w-[620px]">Hover any festival image to use the magnifying glass. Click for the quick festival briefing or open the full calendar.</p>
          </div>
          <a href="festivals.html" class="text-sm font-extrabold text-[#0B2A22] hover:text-[#C9A24B]">View All Festival Dates →</a>
        </div>

        <div class="grid sm:grid-cols-2 lg:grid-cols-4 gap-5 mt-7">
          ${fests.map((f, idx) => {
            const img = safeUrl(f.cover_image, FALLBACK_IMAGES.festival);
            const festName = f.name || f.title || 'Bhutan Tshechu Festival';
            const festHref = resolveFestivalPageHref(f);
            const bookHref = f.related_tour_id ? `book.html?tour=${encodeURIComponent(f.related_tour_id)}` : 'festivals.html';
            return `
              <article class="bg-white text-[#101613] rounded-[24px] overflow-hidden border border-[#E7DCC4] card-lift flex flex-col">
                <button type="button" data-action="quick-fest" data-idx="${idx}" class="block w-full text-left relative overflow-hidden cursor-crosshair h-[240px] sm:h-[260px] bfr-lens-box" data-img="${esc(img)}">
                  <div role="img" aria-label="${esc(festName)}" class="w-full h-full bg-cover bg-center" style="background-image:url('${esc(img)}')"></div>
                  <div class="bfr-lens-circle hidden pointer-events-none absolute z-10 w-[150px] h-[150px] rounded-full border-4 border-white shadow-2xl" style="transform:translate(-50%,-50%);background-image:url('${esc(img)}');background-size:420% 420%"></div>
                  <div class="bfr-lens-pill hidden absolute bottom-3 left-3 bg-[#0B2A22]/90 text-white text-xs font-bold px-3 py-2 rounded-full items-center gap-1">
                    ${svgIcon('eye', 14)} Magnifying glass
                  </div>
                </button>
                <div class="p-4 flex-1 flex flex-col">
                  <span class="text-xs font-extrabold text-[#C9A24B]">${esc(f.dates_label || f.best_months || f.season || '2027 Season')}</span>
                  <h3 class="font-serif text-2xl mt-1 text-[#0B2A22]"><a href="${esc(festHref)}" class="hover:text-[#C9A24B]">${esc(festName)}</a></h3>
                  <p class="text-sm text-[#66706A] mt-1 flex items-center gap-1">${svgIcon('mapPin', 14)} ${esc(f.venue || f.dzongkhag || 'Bhutan')}</p>
                  <p class="text-sm text-[#101613] mt-2 flex-1">${esc(f.summary || '')}</p>
                  <div class="flex justify-between items-center mt-4 pt-3 border-t border-[#E7DCC4]">
                    <a href="${esc(festHref)}" class="bg-[#0B2A22] text-white px-4 py-2 rounded-full text-sm font-bold">View festival</a>
                    <a href="${esc(bookHref)}" class="text-xs font-extrabold text-[#C9A24B] hover:underline">Book Tour →</a>
                  </div>
                </div>
              </article>
            `;
          }).join('')}
        </div>
      </section>
    `;
  }

  function renderSpecialtySection() {
    return `
      <section class="mt-20 bg-[#0B2A22] text-white py-16">
        <div class="max-w-[1360px] mx-auto px-4 sm:px-6">
          <div class="flex flex-wrap justify-between gap-4 items-end">
            <div>
              <p class="text-[#C9A24B] font-extrabold tracking-[0.22em] text-xs">SPECIALTY TOURS</p>
              <h2 class="font-serif text-[36px] sm:text-[54px] leading-none mt-2">Made for the way<br>you travel.</h2>
            </div>
            <p class="max-w-[420px] text-white/75">Watch a short film briefing preview, then inspect the full curated route or customise your departure.</p>
          </div>
          <div class="grid sm:grid-cols-2 lg:grid-cols-4 gap-5 mt-8">
            ${SPECIALTY_CARDS.map((card, idx) => `
              <article class="group bg-white text-[var(--ink)] rounded-[24px] overflow-hidden card-lift flex flex-col">
                <button type="button" data-action="open-film" data-idx="${idx}" class="relative block w-full h-[220px] overflow-hidden">
                  <img src="${esc(card.img)}" alt="${esc(card.name)}" class="w-full h-full object-cover group-hover:scale-110 transition duration-500">
                  <span class="absolute inset-0 grid place-items-center">
                    <span class="w-16 h-16 rounded-full bg-[#C9A24B] text-[#0B2A22] grid place-items-center shadow-2xl" style="animation:floaty 2.5s infinite">
                      ${svgIcon('play', 24, 'fill-[#0B2A22] ml-0.5')}
                    </span>
                  </span>
                  <span class="absolute bottom-3 right-3 bg-black/75 text-white text-xs px-2.5 py-1 rounded-full flex items-center gap-1 font-semibold">
                    ${svgIcon('video', 13)} ${esc(card.dur)}
                  </span>
                </button>
                <div class="p-4 flex-1 flex flex-col">
                  <h3 class="font-serif text-[22px] leading-tight text-[#0B2A22]">${esc(card.name)}</h3>
                  <p class="text-sm text-[var(--muted)] mt-2 flex-1">${esc(card.desc)}</p>
                  <div class="mt-4 flex items-center justify-between">
                    <button type="button" data-action="open-film" data-idx="${idx}" class="font-bold text-sm text-[#0B2A22] flex items-center gap-1 hover:text-[#C9A24B]">
                      Watch &amp; explore ${svgIcon('arrowUpRight', 16)}
                    </button>
                    <a href="${esc(card.href)}" class="text-xs font-extrabold text-[#C9A24B] hover:underline">Packages →</a>
                  </div>
                </div>
              </article>
            `).join('')}
          </div>
        </div>
      </section>
    `;
  }

  function renderServicesMosaic() {
    return `
      <section class="max-w-[1360px] mx-auto px-4 sm:px-6 pt-20">
        <div class="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p class="text-[#C9A24B] font-extrabold tracking-[0.22em] text-xs">ALL SERVICES · ONE TEAM</p>
            <h2 class="font-serif text-[36px] sm:text-[54px] mt-2 text-[#0B2A22]">Everything, handled.</h2>
          </div>
          <a href="services.html" class="text-sm font-extrabold text-[#0B2A22] hover:text-[#C9A24B]">Visa, SDF &amp; Flight Services →</a>
        </div>
        <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-7">
          ${SERVICES_GRID.map((svc) => `
            <a href="${esc(svc.href)}" class="group bg-white text-[#101613] border border-[#E7DCC4] rounded-[22px] overflow-hidden card-lift block">
              <div class="h-[150px] sm:h-[170px] overflow-hidden">
                <img src="${esc(svc.img)}" alt="${esc(svc.n)}" class="w-full h-full object-cover group-hover:scale-110 transition duration-500" style="object-position:${esc(svc.pos)}">
              </div>
              <div class="p-4">
                <h3 class="font-bold text-[17px] leading-tight text-[#0B2A22]">${esc(svc.n)}</h3>
                <p class="text-sm text-[#66706A] mt-1.5">${esc(svc.d)}</p>
              </div>
            </a>
          `).join('')}
        </div>
      </section>
    `;
  }

  function renderDestinationsSection() {
    const dests = state.destinations.slice(0, 6);
    return `
      <section class="mt-20 bg-[#F7EDD8] py-14">
        <div class="max-w-[1360px] mx-auto px-4 sm:px-6">
          <div class="flex justify-between items-end gap-4">
            <div>
              <p class="text-[#C9A24B] font-extrabold tracking-[0.22em] text-xs">BEST PLACES TO VISIT</p>
              <h2 class="font-serif text-[36px] sm:text-[54px] text-[#0B2A22]">The looking glass.</h2>
            </div>
            <div class="flex items-center gap-4">
              <span class="hidden sm:flex items-center gap-2 text-sm font-bold text-[#0B2A22]">Scroll → ${svgIcon('compass', 16)}</span>
              <a href="destinations.html" class="text-sm font-extrabold text-[#0B2A22] hover:text-[#C9A24B]">All Valleys →</a>
            </div>
          </div>
          <p class="text-[#66706A] mt-2">Hover to magnify. Click for the story behind each valley.</p>
        </div>

        <div class="max-w-[1360px] mx-auto px-4 sm:px-6 mt-6 flex gap-5 overflow-x-auto no-scrollbar snap-x pb-2">
          ${dests.map((d, idx) => {
            const img = safeUrl(d.cover_image, FALLBACK_IMAGES.punakha);
            const destHref = resolveDestPageHref(d);
            return `
              <article class="min-w-[300px] sm:min-w-[350px] snap-start bg-white text-[#101613] border border-[#E7DCC4] rounded-[24px] overflow-hidden card-lift flex flex-col">
                <button type="button" data-action="quick-dest" data-idx="${idx}" class="block w-full text-left relative overflow-hidden cursor-crosshair h-[240px] sm:h-[270px] bfr-lens-box" data-img="${esc(img)}">
                  <div role="img" aria-label="${esc(d.name)}" class="w-full h-full bg-cover bg-center" style="background-image:url('${esc(img)}')"></div>
                  <div class="bfr-lens-circle hidden pointer-events-none absolute z-10 w-[150px] h-[150px] rounded-full border-4 border-white shadow-2xl" style="transform:translate(-50%,-50%);background-image:url('${esc(img)}');background-size:420% 420%"></div>
                  <div class="bfr-lens-pill hidden absolute bottom-3 left-3 bg-[#0B2A22]/90 text-white text-xs font-bold px-3 py-2 rounded-full items-center gap-1">
                    ${svgIcon('eye', 14)} Magnifying glass
                  </div>
                </button>
                <div class="p-4 flex-1 flex flex-col">
                  <h3 class="font-serif text-2xl text-[#0B2A22]"><a href="${esc(destHref)}" class="hover:text-[#C9A24B]">${esc(d.name)}</a></h3>
                  <p class="text-xs font-extrabold text-[#C9A24B] mt-1">BEST · ${esc(d.best_months || d.tagline || 'Year-round')}</p>
                  <p class="text-sm text-[#66706A] mt-2 flex-1">${esc(d.tagline || d.description || '')}</p>
                  <div class="flex items-center justify-between mt-3 pt-3 border-t border-[#E7DCC4]">
                    <button type="button" data-action="quick-dest" data-idx="${idx}" class="font-bold text-sm text-[#0B2A22] hover:text-[#C9A24B]">Open place →</button>
                    <a href="${esc(destHref)}" class="text-xs font-bold text-[#66706A] hover:text-[#0B2A22]">Full Guide</a>
                  </div>
                </div>
              </article>
            `;
          }).join('')}
        </div>
      </section>
    `;
  }

  function renderCustomBuilderSection() {
    const f = state.customForm;
    const interestOpts = ['Festival', 'Trek', 'Luxury', 'Culture', 'Honeymoon', 'Birding'];
    const paceOpts = ['Relaxed', 'Balanced', 'Active'];
    const waUrl = safeWhatsAppUrl(
      state.settings.company_whatsapp,
      `Kuzu Zangpo! Custom Bhutan Inquiry (${f.dates || 'Flexible dates'}, ${f.travellers}, budget $${f.budget}/person).`
    );

    const formPanel = state.customResult
      ? `
        <div class="space-y-4">
          <div class="flex items-center gap-2 text-[#0B2A22] font-extrabold text-sm">
            ${svgIcon('badgeCheck', 20, 'text-[#C9A24B]')}
            <span>Inquiry Saved · Reference ${esc(state.customResult.reference || 'INQ-CONFIRMED')}</span>
          </div>
          <h3 class="font-serif text-3xl text-[#0B2A22]">Tailored plan for ${esc(f.name || 'your group')}</h3>
          <p class="text-sm text-[var(--muted)]">Budget $${Number(f.budget).toLocaleString('en-US')}/person · ${esc(f.travellers)} · ${esc(f.pace)} · ${esc(f.interests.join(', ') || 'Culture')} · ${esc(f.dates || 'Flexible dates')}</p>
          <div class="space-y-3 mt-4">
            <div class="bg-[var(--cream)] rounded-2xl p-4"><strong>Day 1 · Arrive Paro:</strong> Meet your private guide, river valley walk and welcome Bhutanese dinner.</div>
            <div class="bg-[var(--cream)] rounded-2xl p-4"><strong>Day 2 · ${esc(f.interests[0] || 'Culture')} &amp; Thimphu:</strong> Bespoke sightseeing shaped by ${esc(f.interests.join(' + ') || 'Culture')} — viewpoints, markets &amp; dzong heritage.</div>
            <div class="bg-[var(--cream)] rounded-2xl p-4"><strong>Day 3 · Dochula &amp; Punakha:</strong> 108 chortens over the Himalayan ridge, riverside Punakha Dzong and hot-stone bath option.</div>
          </div>
          <div class="flex flex-wrap gap-3 pt-2">
            <a href="${esc(safeWhatsAppUrl(state.settings.company_whatsapp, `Hi! Checking custom inquiry ${state.customResult.reference} (${f.name}).`))}" target="_blank" rel="noopener noreferrer" class="bg-[#0B2A22] text-white px-5 py-3 rounded-full font-bold text-sm">Continue on WhatsApp</a>
            <a href="book.html?custom=1&nights=6" class="bg-[#C9A24B] text-[#0B2A22] px-5 py-3 rounded-full font-extrabold text-sm">Reserve Custom Dates →</a>
            <button type="button" id="customEditAgainBtn" class="border border-[var(--line)] px-4 py-3 rounded-full font-bold text-sm">Send Another Request</button>
          </div>
        </div>
      `
      : `
        <form id="homeCustomForm" class="space-y-4">
          ${state.customError ? `<div class="bg-red-50 border border-red-200 text-red-700 text-sm font-semibold px-4 py-3 rounded-xl">${esc(state.customError)}</div>` : ''}
          <div class="grid sm:grid-cols-2 gap-3">
            <label class="block">
              <span class="text-sm font-bold">Full Name *</span>
              <input id="custName" required value="${esc(f.name)}" placeholder="e.g. Elena Rostova" class="w-full mt-1 border border-[var(--line)] rounded-xl px-3 py-2.5 bg-[var(--cream)] outline-none" style="color-scheme:light;color:#101613;">
            </label>
            <label class="block">
              <span class="text-sm font-bold">Email Address *</span>
              <input id="custEmail" required type="email" value="${esc(f.email)}" placeholder="you@example.com" class="w-full mt-1 border border-[var(--line)] rounded-xl px-3 py-2.5 bg-[var(--cream)] outline-none" style="color-scheme:light;color:#101613;">
            </label>
          </div>
          <div class="grid sm:grid-cols-2 gap-3">
            <label class="block">
              <span class="text-sm font-bold">WhatsApp / Phone</span>
              <input id="custPhone" value="${esc(f.phone)}" placeholder="+1 555 234 5678" class="w-full mt-1 border border-[var(--line)] rounded-xl px-3 py-2.5 bg-[var(--cream)] outline-none" style="color-scheme:light;color:#101613;">
            </label>
            <label class="block">
              <span class="text-sm font-bold">Preferred Month / Dates</span>
              <input id="custDates" value="${esc(f.dates)}" placeholder="e.g. October 2027 (7 nights)" class="w-full mt-1 border border-[var(--line)] rounded-xl px-3 py-2.5 bg-[var(--cream)] outline-none" style="color-scheme:light;color:#101613;">
            </label>
          </div>
          <div class="grid sm:grid-cols-2 gap-3 items-center">
            <label class="block">
              <span class="text-sm font-bold">Travellers</span>
              <select id="custTravellers" class="w-full mt-1 border border-[var(--line)] rounded-xl px-3 py-2.5 bg-[var(--cream)] outline-none" style="color-scheme:light;color:#101613;">
                ${['1 Solo', '2 Adults', '3–4 Guests', 'Family w/ Kids', 'Group (5+)'].map((opt) => `<option ${f.travellers === opt ? 'selected' : ''}>${esc(opt)}</option>`).join('')}
              </select>
            </label>
            <div>
              <div class="flex justify-between text-sm font-bold"><span>Budget per person</span><span id="custBudgetVal" class="text-[#0B2A22]">$${Number(f.budget).toLocaleString('en-US')}</span></div>
              <input id="custBudget" type="range" min="1200" max="6000" step="100" value="${Number(f.budget)}" class="w-full mt-2 accent-[#0B2A22]">
              <div class="flex justify-between text-xs text-[#66706A]"><span>$1,200</span><span>$6,000</span></div>
            </div>
          </div>
          <div>
            <span class="text-sm font-bold block mb-1.5 text-[#0B2A22]">Interests</span>
            <div class="flex flex-wrap gap-2">
              ${interestOpts.map((tag) => `<button type="button" data-action="toggle-interest" data-interest="${esc(tag)}" class="px-3.5 py-1.5 rounded-full text-xs font-bold border border-[#E7DCC4] ${f.interests.includes(tag) ? 'bg-[#0B2A22] text-white' : 'bg-[#FFF8EC] text-[#0B2A22]'}">${esc(tag)}</button>`).join('')}
            </div>
          </div>
          <div>
            <span class="text-sm font-bold block mb-1.5 text-[#0B2A22]">Travel Pace</span>
            <div class="flex gap-2">
              ${paceOpts.map((p) => `<button type="button" data-action="set-pace" data-pace="${esc(p)}" class="px-4 py-1.5 rounded-full text-xs font-bold border border-[#E7DCC4] ${f.pace === p ? 'bg-[#C9A24B] text-[#0B2A22]' : 'bg-[#FFF8EC] text-[#0B2A22]'}">${esc(p)}</button>`).join('')}
            </div>
          </div>
          <label class="block">
            <span class="text-sm font-bold">Tell us more</span>
            <textarea id="custMessage" rows="3" placeholder="Festival dates, dietary needs, India permit inquiry, celebration notes…" class="w-full mt-1 border border-[var(--line)] rounded-xl px-3 py-3 bg-[var(--cream)] outline-none" style="color-scheme:light;color:#101613;">${esc(f.message)}</textarea>
          </label>
          <button type="submit" ${state.customSubmitting ? 'disabled' : ''} class="w-full bg-[#0B2A22] hover:bg-[#123A30] text-white py-4 rounded-full font-extrabold transition">
            ${state.customSubmitting ? 'Submitting to Paro Desk…' : 'Send Custom Itinerary Request →'}
          </button>
          <p class="text-xs text-center text-[var(--muted)]">Prefer WhatsApp? <a href="${esc(waUrl)}" target="_blank" rel="noopener noreferrer" class="font-bold text-[#0B2A22] underline">Chat with Paro Concierge directly</a></p>
        </form>
      `;

    return `
      <section id="custom" class="max-w-[1360px] mx-auto px-4 sm:px-6 pt-20">
        <div class="grid grid-cols-1 lg:grid-cols-[1fr_1.15fr] gap-8 items-start">
          <div>
            <p class="text-[#C9A24B] font-extrabold tracking-[0.22em] text-xs">CUSTOMISED ITINERARY REQUEST</p>
            <h2 class="font-serif text-[40px] sm:text-[54px] leading-[0.98] mt-2 text-[#0B2A22]">Tell us the trip<br>in your head.</h2>
            <p class="text-[#66706A] mt-4 max-w-[480px]">Share dates, budget and interests. Receive an instant tailored draft AND send directly to our licensed Paro travel concierges.</p>
            <div class="space-y-3 mt-6">
              ${[
                ['1', 'Share your idea', 'Dates, valley preferences & international USD or India INR pricing.'],
                ['2', 'See a draft & live Paro quote', 'Our team computes exact SDF & boutique lodging tiers in 2 hours.'],
                ['3', 'Refine it with an expert', 'Approve your custom plan and step straight into visa clearance.']
              ].map(([num, h, desc]) => `
                <div class="flex gap-3 bg-white text-[#101613] border border-[#E7DCC4] rounded-2xl p-4">
                  <span class="w-8 h-8 rounded-full bg-[#0B2A22] text-[#C9A24B] grid place-items-center font-bold shrink-0">${num}</span>
                  <div><strong class="block text-sm text-[#0B2A22]">${esc(h)}</strong><span class="text-xs text-[#66706A]">${esc(desc)}</span></div>
                </div>
              `).join('')}
            </div>
            <img src="${FALLBACK_IMAGES.festival}" alt="Festival dancers in Bhutan" class="w-full h-[240px] object-cover rounded-[24px] mt-6 border border-[#E7DCC4]">
          </div>

          <div class="bg-white text-[#101613] border border-[#E7DCC4] rounded-[28px] p-6 sm:p-8 shadow-sm">
            ${formPanel}
          </div>
        </div>
      </section>
    `;
  }

  function renderReviewsAndTrust() {
    const revs = state.reviews.slice(0, 3);
    return `
      <section class="max-w-[1360px] mx-auto px-4 sm:px-6 pt-20 pb-16">
        <div class="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p class="text-[#C9A24B] font-extrabold tracking-[0.22em] text-xs">VERIFIED GUEST STORIES</p>
            <h2 class="font-serif text-[36px] sm:text-[48px] mt-2 text-[#0B2A22]">Travellers, in their words.</h2>
          </div>
          <a href="reviews.html" class="text-sm font-extrabold text-[#0B2A22] hover:text-[#C9A24B]">Read all verified reviews →</a>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-5 mt-8">
          ${revs.map((r) => {
            const guestName = r.author_name || r.reviewer_name || r.guest_name || 'Verified Guest';
            const tourInfo = [r.tour_taken || r.tour_title, r.author_country].filter(Boolean).join(' · ') || 'Bhutan Journey';
            return `
            <blockquote class="bg-white text-[#101613] border border-[#E7DCC4] rounded-[24px] p-6 flex flex-col justify-between">
              <div>
                <div class="text-[#C9A24B] text-base font-bold">${'★'.repeat(Math.max(1, Math.min(5, Number(r.rating) || 5)))}</div>
                <p class="font-serif text-xl leading-snug mt-3 text-[#0B2A22]">“${esc(r.comment || r.review_text || '')}”</p>
              </div>
              <footer class="mt-4 pt-3 border-t border-[#E7DCC4] text-xs">
                <strong class="block text-sm text-[#0B2A22]">${esc(guestName)}</strong>
                <span class="text-[#66706A]">${esc(tourInfo)}</span>
              </footer>
            </blockquote>
          `;
          }).join('')}
        </div>

        <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mt-8">
          ${[
            ['Royally Licensed #TR/2018/9882', 'badgeCheck'],
            ['SDF Tax Included', 'shieldCheck'],
            ['English-Speaking Guides', 'compass'],
            ['Secure Visa Planning', 'shieldCheck']
          ].map(([label, ic]) => `
            <div class="bg-[#0B2A22] text-white rounded-2xl p-4 flex flex-col items-center gap-2 text-center">
              ${svgIcon(ic, 22, 'text-[#C9A24B]')}
              <b class="text-sm">${esc(label)}</b>
            </div>
          `).join('')}
        </div>
      </section>
    `;
  }

  function renderFooter() {
    const lic = String(state.settings.company_license || 'TR/2018/9882').replace(/^#/, '');
    const phone = state.settings.company_phone || '+975 17 654 321';
    const email = state.settings.company_email || 'reservations@bhutanfastratetours.bt';
    const waHref = safeWhatsAppUrl(state.settings.company_whatsapp, 'Kuzu Zangpo La! Interested in planning a Bhutan tour.');
    return `
      <footer class="bg-[#0B2A22] text-white">
        <div class="max-w-[1360px] mx-auto px-4 sm:px-6 py-14 grid lg:grid-cols-[1.2fr_.8fr_1fr] gap-10">
          <div>
            <h3 class="font-serif text-3xl">Bhutan, beautifully planned.</h3>
            <p class="text-white/70 mt-3 max-w-[420px]">Festival dates, mountain light and quiet valley stays — curated by a licensed local team in Paro &amp; Thimphu.</p>
            <form id="homeNewsletterForm" class="mt-5 flex gap-2 max-w-[440px]">
              <input id="homeNewsletterEmail" type="email" required value="${esc(state.newsletterEmail)}" placeholder="Email for Bhutan travel notes" class="flex-1 min-w-0 bg-white/10 border border-white/20 rounded-full px-4 py-3 outline-none text-white placeholder:text-white/50">
              <button type="submit" ${state.newsletterBusy ? 'disabled' : ''} class="bg-[#C9A24B] text-[#0B2A22] px-5 py-3 rounded-full font-extrabold shrink-0">${state.newsletterBusy ? 'Joining…' : 'Join'}</button>
            </form>
            ${state.newsletterMsg ? `<p class="text-[#E4C87E] text-sm mt-2 font-bold">${esc(state.newsletterMsg)}</p>` : ''}
            ${state.newsletterErr ? `<p class="text-red-300 text-sm mt-2 font-bold">${esc(state.newsletterErr)}</p>` : ''}
          </div>

          <div>
            <h4 class="font-bold">Explore &amp; Portals</h4>
            <ul class="mt-3 space-y-2 text-white/75 text-sm">
              <li><a href="tours.html" class="hover:text-white">All Tour Packages</a></li>
              <li><a href="book.html" class="hover:text-white">Online Booking Checkout</a></li>
              <li><a href="festivals.html" class="hover:text-white">Festivals 2027</a></li>
              <li><a href="sdf-calculator.html" class="hover:text-white">SDF Tax Calculator</a></li>
              <li><a href="track-visa.html" class="hover:text-white">Track Live Visa Status</a></li>
              <li><a href="client/login.html" class="hover:text-white">Client Portal</a></li>
              <li><a href="guide/login.html" class="hover:text-white">Guide Portal</a></li>
              <li><a href="admin/login.html" class="hover:text-white">Staff Operations</a></li>
            </ul>
          </div>

          <div>
            <h4 class="font-bold" data-bfr-company>${esc(state.settings.company_name || 'Bhutan Fast Rate Tours')}</h4>
            <p class="text-white/75 text-sm mt-3">
              Paro &amp; Thimphu, Kingdom of Bhutan<br>
              Hotline: <span data-bfr-phone>${esc(phone)}</span><br>
              Email: <span data-bfr-email>${esc(email)}</span>
            </p>
            <a href="${esc(waHref)}" target="_blank" rel="noopener noreferrer" data-bfr-whatsapp class="inline-block mt-3 text-xs font-extrabold text-[#E4C87E] hover:underline">Open WhatsApp Desk →</a>
            <p class="text-xs text-white/55 mt-4">SDF included · Licensed operator <span data-bfr-license>#${esc(lic)}</span></p>
          </div>
        </div>
        <div class="border-t border-white/10 py-5 text-center text-xs text-white/50">
          © ${new Date().getFullYear()} Bhutan Fast Rate Tours. Royal Government Licensed Operator #${esc(lic)}.
        </div>
      </footer>
    `;
  }

  function saveTripPlanStorage() {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('bfr_trip_plan', JSON.stringify(state.tripPlan));
      }
    } catch (_) {}
  }

  function addTourToPlan(tour) {
    if (!tour) return;
    const price = Number(tour.price_3star_usd || tour.price_usd || 1899);
    const idx = state.tripPlan.findIndex((p) => p.id === tour.id);
    if (idx >= 0) {
      state.tripPlan[idx].qty = (state.tripPlan[idx].qty || 1) + 1;
    } else {
      state.tripPlan.push({
        id: tour.id,
        slug: tour.slug || tour.id,
        title: tour.title,
        price,
        days: Number(tour.duration_days) || 6,
        img: safeUrl(tour.cover_image, FALLBACK_IMAGES.tiger),
        qty: Math.max(1, Number(state.modalGuests) || 2)
      });
    }
    if (!state.savedIds.includes(tour.id)) {
      state.savedIds.push(tour.id);
    }
    saveTripPlanStorage();
    state.toastMsg = `${tour.title} saved to your Trip Plan.`;
  }

  function parseTourDaysPlan(tour) {
    if (!tour) return [];
    let arr = tour.itinerary_json || tour.itinerary || tour.highlights;
    if (typeof arr === 'string') {
      try { arr = JSON.parse(arr); } catch (_) { arr = arr.split('\n').filter(Boolean); }
    }
    if (Array.isArray(arr) && arr.length > 0) {
      return arr.map((d, idx) => typeof d === 'string'
        ? { day: idx + 1, title: d, summary: 'Private licensed Bhutanese guide, unhurried valley sightseeing, boutique lodging and SDF fees included.' }
        : { day: d.day || idx + 1, title: d.title || d.heading || `Day ${idx + 1}`, summary: d.description || d.summary || 'Guided visits, scenic mountain passes, local dining and private transfers.' });
    }
    return [
      { day: 1, title: 'Arrive Paro & River Valley Walk', summary: 'VIP airport meet & greet, heritage valley stroll and Bhutanese welcome dinner.' },
      { day: 2, title: 'Thimphu & Cultural Landmarks', summary: 'National Memorial Chorten, Buddha Dordenma panoramic overlook and Tashichho Dzong.' },
      { day: 3, title: 'Dochula Pass & Punakha Dzong', summary: 'Cross the 3,100m 108-chorten ridge before descending into lush Punakha Valley.' },
      { day: 4, title: 'Tiger’s Nest (Taktsang) Ascent', summary: 'Guided sunrise hike up pine trails to Bhutan’s sacred cliffside sanctuary.' }
    ];
  }

  function renderInteractiveOverlays() {
    let html = '';

    // 1. Trip Plan Slide-Over Drawer
    if (state.planDrawerOpen) {
      const estTotal = state.tripPlan.reduce((sum, item) => sum + (Number(item.price) || 0) * (item.qty || 1), 0);
      const firstTourHref = state.tripPlan[0] ? `book.html?tour=${encodeURIComponent(state.tripPlan[0].slug || state.tripPlan[0].id)}` : 'book.html';
      html += `
        <div id="homePlanBackdrop" class="fixed inset-0 z-50 bg-black/50 bfr-trip-drawer-backdrop">
          <div id="homePlanPanel" class="bfr-trip-drawer absolute right-0 top-0 h-full w-[92%] max-w-[420px] bg-[var(--cream)] p-5 overflow-y-auto shadow-2xl">
            <div class="flex justify-between items-center pb-3 border-b border-[var(--line)]">
              <h3 class="font-serif text-2xl text-[#0B2A22]">Your Trip Plan</h3>
              <button type="button" id="closePlanDrawerBtn" aria-label="Close trip plan" class="p-2 rounded-xl hover:bg-[#F7EDD8]">${svgIcon('x', 20)}</button>
            </div>
            <p class="text-sm text-[var(--muted)] mt-2">Shortlisted Bhutan journeys &amp; estimated multi-traveller pricing (SDF included).</p>
            <div class="mt-5 space-y-3">
              ${state.tripPlan.length === 0
                ? `<div class="bg-white border border-[var(--line)] rounded-2xl p-5 text-sm text-[#66706A]">Your Trip Plan shortlist is empty. Heart or Quick View any package below to build your route.</div>`
                : state.tripPlan.map((item) => `
                  <div class="bg-white border border-[var(--line)] rounded-2xl p-3 flex gap-3 items-center">
                    <img src="${esc(safeUrl(item.img, FALLBACK_IMAGES.tiger))}" alt="${esc(item.title)}" class="w-20 h-20 object-cover rounded-xl shrink-0" style="width:80px;height:80px;min-width:80px;display:block;">
                    <div class="flex-1 min-w-0">
                      <b class="text-sm leading-tight block text-[#0B2A22]">${esc(item.title)}</b>
                      <span class="text-sm text-[#66706A]">$${Number(item.price).toLocaleString('en-US')} × ${item.qty} guest(s)</span>
                      <div class="flex items-center gap-2 mt-2">
                        <button type="button" data-action="plan-qty" data-id="${esc(item.id)}" data-delta="-1" aria-label="Decrease" class="w-7 h-7 border border-[var(--line)] rounded-full grid place-items-center">${svgIcon('minus', 13)}</button>
                        <button type="button" data-action="plan-qty" data-id="${esc(item.id)}" data-delta="1" aria-label="Increase" class="w-7 h-7 border border-[var(--line)] rounded-full grid place-items-center">${svgIcon('plus', 13)}</button>
                        <button type="button" data-action="plan-remove" data-id="${esc(item.id)}" class="text-xs font-bold text-red-600 ml-auto">Remove</button>
                      </div>
                    </div>
                  </div>
                `).join('')}
            </div>
            ${state.tripPlan.length > 0 ? `
              <div class="mt-5 bg-white border border-[var(--line)] rounded-2xl p-4">
                <div class="flex justify-between items-center">
                  <span class="text-sm font-bold text-[#66706A]">Estimated Total</span>
                  <b class="font-serif text-2xl text-[#0B2A22]">$${estTotal.toLocaleString('en-US')}</b>
                </div>
                <p class="text-xs text-[#66706A] mt-1">Includes $100/night SDF &amp; guiding. Choose 3★/4★/5★ tier at checkout.</p>
                <a href="${esc(firstTourHref)}" class="block text-center w-full mt-3 bg-[#0B2A22] text-white py-3 rounded-full font-bold text-sm">Proceed to Online Booking →</a>
                <button type="button" id="planToCustomBtn" class="w-full mt-2 border border-[#0B2A22] text-[#0B2A22] py-2.5 rounded-full font-bold text-sm">Customise in Request Form</button>
              </div>
            ` : ''}
          </div>
        </div>
      `;
    }

    // 2. Tour Quick View Modal
    if (state.activeTourModal) {
      const t = state.activeTourModal;
      const price = Number(t.price_3star_usd || t.price_usd || 1899);
      const days = Number(t.duration_days) || 6;
      const img = safeUrl(t.cover_image, FALLBACK_IMAGES.tiger);
      const daysPlan = parseTourDaysPlan(t);
      const tourHref = resolveTourPageHref(t);
      const bookHref = resolveBookHref(t);
      html += `
        <div id="homeTourModalBackdrop" class="fixed inset-0 z-50 bg-black/60 p-3 sm:p-6 overflow-y-auto">
          <div id="homeTourModalCard" class="max-w-[920px] mx-auto bg-[var(--cream)] rounded-[28px] overflow-hidden my-4 shadow-2xl">
            <div class="relative h-[280px] sm:h-[340px]">
              <img src="${esc(img)}" alt="${esc(t.title)}" class="w-full h-full object-cover">
              <div class="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-black/20"></div>
              <button type="button" id="closeTourModalBtn" aria-label="Close tour" class="absolute top-4 right-4 w-10 h-10 bg-white text-[#0B2A22] rounded-full grid place-items-center shadow">${svgIcon('x', 20)}</button>
              <div class="absolute bottom-4 left-5 right-5 text-white">
                <span class="bg-[#C9A24B] text-[#0B2A22] px-3 py-1 rounded-full text-xs font-extrabold">${days} DAYS · ${esc(String(t.category || 'CLASSIC').toUpperCase())}</span>
                <h3 class="font-serif text-[32px] sm:text-[42px] leading-none mt-2 drop-shadow">${esc(t.title)}</h3>
              </div>
            </div>
            <div class="p-5 sm:p-7 grid md:grid-cols-[1.3fr_.7fr] gap-6">
              <div>
                <p class="text-[var(--muted)]">${esc(t.subtitle || t.highlight_text || 'Private Bhutan cultural & mountain itinerary')} · ${esc(t.valleys || 'Paro · Thimphu · Punakha')}</p>
                <div class="grid grid-cols-3 gap-2 mt-4">
                  ${[FALLBACK_IMAGES.tiger, FALLBACK_IMAGES.punakha, FALLBACK_IMAGES.festival].map((gImg, gi) => `<img src="${esc(gImg)}" alt="Gallery ${gi + 1}" class="h-[86px] w-full object-cover rounded-xl">`).join('')}
                </div>
                <h4 class="font-serif text-2xl mt-6 text-[#0B2A22]">Day-by-day itinerary</h4>
                <div class="mt-3 divide-y divide-[var(--line)] border-y border-[var(--line)]">
                  ${daysPlan.slice(0, 6).map((dp, bi) => `
                    <div>
                      <button type="button" data-action="modal-day" data-idx="${bi}" class="w-full flex justify-between items-center py-3 font-bold text-left text-[#0B2A22]">
                        <span>Day ${dp.day} — ${esc(dp.title)}</span>
                        ${svgIcon('chevronDown', 16, state.modalDayOpen === bi ? 'rotate-180 transition-transform' : 'transition-transform')}
                      </button>
                      ${state.modalDayOpen === bi ? `<p class="pb-3 text-sm text-[var(--muted)]">${esc(dp.summary)}</p>` : ''}
                    </div>
                  `).join('')}
                </div>
                <h4 class="font-serif text-2xl mt-6 text-[#0B2A22]">Included</h4>
                <ul class="text-sm mt-2 space-y-1 text-[#101613]">
                  <li>✓ SDF, visa clearance &amp; government fees</li>
                  <li>✓ Licensed English-speaking guide, driver &amp; private SUV</li>
                  <li>✓ Hand-checked 3★/4★/5★ hotels &amp; daily meals</li>
                </ul>
              </div>
              <div class="bg-white border border-[var(--line)] rounded-2xl p-4 h-fit">
                <p class="text-xs font-extrabold tracking-widest text-[#C9A24B]">LIVE PRICE ESTIMATE</p>
                <div class="flex justify-between mt-3 text-sm items-center">
                  <span>Travellers</span>
                  <div class="flex gap-2 items-center">
                    <button type="button" id="modalGuestMinusBtn" aria-label="Fewer travellers" class="w-7 h-7 border border-[var(--line)] rounded-full grid place-items-center">${svgIcon('minus', 13)}</button>
                    <b>${state.modalGuests}</b>
                    <button type="button" id="modalGuestPlusBtn" aria-label="More travellers" class="w-7 h-7 border border-[var(--line)] rounded-full grid place-items-center">${svgIcon('plus', 13)}</button>
                  </div>
                </div>
                <div class="flex justify-between mt-3 text-sm"><span>Per person (3★)</span><b>$${price.toLocaleString('en-US')}</b></div>
                <div class="flex justify-between mt-3 pt-3 border-t border-[var(--line)]"><span>Total estimate</span><b class="font-serif text-2xl text-[#0B2A22]">$${(price * state.modalGuests).toLocaleString('en-US')}</b></div>
                <a href="${esc(bookHref)}" class="block text-center w-full mt-4 bg-[#0B2A22] text-white py-3.5 rounded-full font-bold text-sm">Book This Tour Now →</a>
                <button type="button" id="modalShortlistBtn" class="w-full mt-2 bg-[#C9A24B] text-[#0B2A22] py-3 rounded-full font-extrabold text-sm">Save to Trip Plan</button>
                <a href="${esc(tourHref)}" class="block text-center w-full mt-2 border border-[#0B2A22] text-[#0B2A22] py-3 rounded-full font-bold text-sm">Full Itinerary Page</a>
              </div>
            </div>
          </div>
        </div>
      `;
    }

    // 3. Compare Side-by-Side Modal
    if (state.compareModalOpen && state.compareIds.length >= 2) {
      const cmpTours = state.compareIds.map((id) => state.tours.find((t) => t.id === id)).filter(Boolean);
      if (cmpTours.length >= 2) {
        html += `
          <div id="homeCompareBackdrop" class="fixed inset-0 z-50 bg-black/60 p-4 overflow-y-auto flex items-center justify-center">
            <div id="homeCompareCard" class="max-w-[780px] w-full bg-[var(--cream)] rounded-[28px] p-6 shadow-2xl border border-[var(--line)]">
              <div class="flex justify-between items-center pb-3 border-b border-[var(--line)]">
                <h3 class="font-serif text-2xl text-[#0B2A22]">Compare Bhutan Packages</h3>
                <button type="button" id="closeCompareModalBtn" class="p-2 rounded-xl hover:bg-[#F7EDD8]">${svgIcon('x', 20)}</button>
              </div>
              <div class="grid sm:grid-cols-2 gap-4 mt-5">
                ${cmpTours.map((t) => `
                  <div class="bg-white border border-[var(--line)] rounded-2xl p-4 space-y-2">
                    <img src="${esc(safeUrl(t.cover_image, FALLBACK_IMAGES.tiger))}" alt="${esc(t.title)}" class="w-full h-[150px] object-cover rounded-xl">
                    <h4 class="font-serif text-xl text-[#0B2A22]">${esc(t.title)}</h4>
                    <div class="text-xs font-extrabold text-[#C9A24B]">${Number(t.duration_days) || 6} DAYS · ${esc(t.category || 'Classic')}</div>
                    <p class="text-sm text-[#66706A]">${esc(t.valleys || 'Paro · Thimphu · Punakha')}</p>
                    <div class="text-sm"><strong>3★ Price:</strong> $${Number(t.price_3star_usd || t.price_usd || 1899).toLocaleString('en-US')}</div>
                    <div class="text-sm"><strong>4★ / 5★:</strong> $${Number(t.price_4star_usd || 0).toLocaleString('en-US')} / $${Number(t.price_5star_usd || 0).toLocaleString('en-US')}</div>
                    <div class="flex gap-2 pt-2">
                      <a href="${esc(resolveTourPageHref(t))}" class="flex-1 text-center bg-[#0B2A22] text-white py-2.5 rounded-full text-xs font-bold">Details</a>
                      <a href="${esc(resolveBookHref(t))}" class="flex-1 text-center bg-[#C9A24B] text-[#0B2A22] py-2.5 rounded-full text-xs font-extrabold">Book Now</a>
                    </div>
                  </div>
                `).join('')}
              </div>
            </div>
          </div>
        `;
      }
    }

    // 4. Festival / Destination / Film Story Modal
    const modalItem = state.activeFestModal || state.activeDestModal || state.activeFilmModal;
    if (modalItem) {
      const mImg = safeUrl(modalItem.cover_image || modalItem.img, FALLBACK_IMAGES.festival);
      const mTitle = modalItem.name || modalItem.title || 'Bhutan Experience';
      const mDesc = modalItem.summary || modalItem.description || modalItem.tagline || modalItem.desc || '';
      const fullHref = state.activeFestModal
        ? resolveFestivalPageHref(state.activeFestModal)
        : state.activeDestModal
          ? resolveDestPageHref(state.activeDestModal)
          : (state.activeFilmModal.href || 'tours.html');
      const fullLabel = state.activeFestModal ? 'Full Festival Schedule →' : state.activeDestModal ? 'Read Valley Guide →' : 'Browse Curated Packages →';

      html += `
        <div id="homeStoryBackdrop" class="fixed inset-0 z-50 bg-black/60 p-4 overflow-y-auto flex items-start justify-center">
          <div id="homeStoryCard" class="max-w-[680px] w-full bg-[var(--cream)] rounded-[28px] overflow-hidden my-6 shadow-2xl">
            <img src="${esc(mImg)}" alt="${esc(mTitle)}" class="w-full h-[280px] object-cover">
            <div class="p-6">
              <div class="flex justify-between gap-3 items-start">
                <h3 class="font-serif text-3xl text-[#0B2A22]">${esc(mTitle)}</h3>
                <button type="button" id="closeStoryModalBtn" aria-label="Close details" class="p-2 rounded-xl hover:bg-[#F7EDD8]">${svgIcon('x', 20)}</button>
              </div>
              <p class="text-[var(--muted)] mt-2">${esc(mDesc)}</p>
              ${state.activeFestModal ? `<p class="mt-3 font-bold text-[#0B2A22]">${esc(state.activeFestModal.dates_label || state.activeFestModal.season || '2027 Season')} · ${esc(state.activeFestModal.venue || state.activeFestModal.dzongkhag || 'Bhutan')}</p>` : ''}
              ${state.activeDestModal ? `<p class="mt-3 font-bold text-[#0B2A22]">Best season: ${esc(state.activeDestModal.best_months || 'Year-round')}</p>` : ''}
              ${state.activeFilmModal ? `
                <div class="mt-4 bg-[#0B2A22] text-white rounded-2xl p-4 flex gap-3 items-center">
                  <span class="w-12 h-12 bg-[#C9A24B] rounded-full grid place-items-center shrink-0">${svgIcon('play', 20, 'fill-[#0B2A22] ml-0.5')}</span>
                  <div>
                    <b class="block">Curated Expedition Briefing</b>
                    <p class="text-sm text-white/75">${esc(state.activeFilmModal.dur)} · Includes private licensed Bhutanese cultural guide, valley passes, and DoI permit coordination.</p>
                  </div>
                </div>
              ` : ''}
              <div class="flex flex-wrap gap-2 mt-5">
                <a href="${esc(fullHref)}" class="flex-1 text-center bg-[#0B2A22] text-white py-3 px-4 rounded-full font-bold text-sm">${esc(fullLabel)}</a>
                <button type="button" id="storyToCustomBtn" class="flex-1 border border-[#0B2A22] text-[#0B2A22] py-3 px-4 rounded-full font-bold text-sm">Plan This Experience</button>
              </div>
            </div>
          </div>
        </div>
      `;
    }

    return html;
  }

  function renderChatWidget() {
    const box = state.chatOpen
      ? `
        <div class="fixed bottom-[84px] right-4 sm:right-5 z-50 w-[calc(100vw-32px)] max-w-[380px] bg-white text-[#101613] rounded-[24px] shadow-2xl border border-[#E7DCC4] overflow-hidden flex flex-col max-h-[560px]">
          <div class="bg-[#0B2A22] text-white p-4 flex justify-between items-center">
            <div>
              <b>Bhutan Concierge</b>
              <p class="text-xs text-white/70">Ask about dates, SDF, India permits &amp; packages</p>
            </div>
            <button type="button" id="homeChatCloseBtn" aria-label="Close chat">${svgIcon('x', 18)}</button>
          </div>
          <div id="homeChatBody" class="flex-1 overflow-y-auto p-4 space-y-3 bg-white">
            ${state.chatMessages.map((m) => `
              <div class="max-w-[85%] p-3 rounded-2xl text-sm ${m.who === 'ai' ? 'bg-[#FFF8EC] text-[#101613]' : 'bg-[#0B2A22] text-white ml-auto'}">
                <p>${esc(m.text)}</p>
                ${m.linkHref ? `<a href="${esc(m.linkHref)}" class="inline-block mt-2 text-xs font-extrabold text-[#C9A24B] underline">${esc(m.linkLabel || 'View details →')}</a>` : ''}
              </div>
            `).join('')}
          </div>
          <form id="homeChatForm" class="p-3 border-t border-[#E7DCC4] bg-white flex gap-2">
            <input id="homeChatInput" value="${esc(state.chatInput)}" placeholder="e.g. 7 days festival, India permit, trek" class="flex-1 min-w-0 border border-[#E7DCC4] bg-[#FFF8EC] rounded-full px-3 py-2.5 text-sm outline-none text-[#101613]" style="color-scheme:light;color:#101613;">
            <button type="submit" aria-label="Send message" class="w-10 h-10 rounded-full bg-[#C9A24B] text-[#0B2A22] grid place-items-center shrink-0">${svgIcon('send', 16)}</button>
          </form>
        </div>
      `
      : '';

    return `
      <button type="button" id="homeChatToggleBtn" class="fixed bottom-5 right-5 z-40 bg-[#0B2A22] text-white pl-4 pr-5 py-3 rounded-full shadow-2xl flex items-center gap-2 font-bold border-2 border-[#C9A24B]">
        <span class="w-8 h-8 bg-[#C9A24B] text-[#0B2A22] rounded-full grid place-items-center">${svgIcon('sparkles', 18)}</span>
        Concierge
      </button>
      ${box}
    `;
  }

  function attachLensListeners(root) {
    root.querySelectorAll('.bfr-lens-box').forEach((box) => {
      const circle = box.querySelector('.bfr-lens-circle');
      const pill = box.querySelector('.bfr-lens-pill');
      box.addEventListener('mousemove', (e) => {
        const rect = box.getBoundingClientRect();
        if (!rect.width || !rect.height) return;
        const x = ((e.clientX - rect.left) / rect.width) * 100;
        const y = ((e.clientY - rect.top) / rect.height) * 100;
        if (circle) {
          circle.classList.remove('hidden');
          circle.style.left = `${x}%`;
          circle.style.top = `${y}%`;
          circle.style.backgroundPosition = `${x}% ${y}%`;
        }
        if (pill) {
          pill.classList.remove('hidden');
          pill.classList.add('flex');
        }
      });
      box.addEventListener('mouseleave', () => {
        if (circle) circle.classList.add('hidden');
        if (pill) {
          pill.classList.add('hidden');
          pill.classList.remove('flex');
        }
      });
    });
  }

  function getRoot() {
    return global.document && global.document.getElementById('root');
  }

  function applyQuickTag(tag) {
    state.searchQuery = tag || '';
    state.category = 'All';
    state.searchDropdownOpen = false;
    state.megaMenu = null;
    updateMegaSlot();
    syncSearchInputVal();
    updateTrendingTagsUi();
    updateSearchDropdownSlot();
    updateToursMount();
    global.document.getElementById('tours')?.scrollIntoView({ behavior: 'smooth' });
  }

  function updateTrendingTagsUi() {
    const row = global.document && global.document.getElementById('homeTrendingTagsRow');
    if (!row) return;
    row.querySelectorAll('[data-action="quick-tag"]').forEach((btn) => {
      const tag = btn.getAttribute('data-tag') || '';
      const active = state.searchQuery && normSearchText(state.searchQuery) === normSearchText(tag);
      btn.className = `text-xs border px-3 py-1.5 rounded-full font-bold transition ${active ? 'bg-[#0B2A22] text-white border-[#0B2A22]' : 'border-[#E7DCC4] bg-white hover:border-[#C9A24B] text-[#0B2A22]'}`;
    });
  }

  function bindMegaSlotEvents(scope) {
    if (!scope) return;
    scope.querySelectorAll('[data-action="quick-tag"]').forEach((btn) => {
      btn.addEventListener('click', () => applyQuickTag(btn.getAttribute('data-tag') || ''));
    });
  }

  function updateMegaSlot() {
    const slot = global.document && global.document.getElementById('homeMegaSlot');
    if (!slot) return;
    slot.innerHTML = renderMegaMenuHtml();
    bindMegaSlotEvents(slot);
  }

  function syncSearchInputVal() {
    const inp = global.document && global.document.getElementById('homeSearchInput');
    if (inp && inp.value !== state.searchQuery) inp.value = state.searchQuery;
  }

  function bindSearchDropdownEvents(scope) {
    if (!scope) return;
    scope.querySelectorAll('[data-action="quick-tag"]').forEach((btn) => {
      btn.addEventListener('click', () => applyQuickTag(btn.getAttribute('data-tag') || ''));
    });
    scope.querySelectorAll('[data-action="dropdown-tour"]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        const tour = state.tours.find((t) => t.id === id);
        state.searchDropdownOpen = false;
        updateSearchDropdownSlot();
        if (tour) {
          state.activeTourModal = tour;
          state.modalGuests = 2;
          state.modalDayOpen = 0;
          updateOverlaysMount();
        }
      });
    });
    scope.querySelector('#homeSearchDirectGo')?.addEventListener('click', () => {
      state.searchDropdownOpen = false;
      updateSearchDropdownSlot();
      updateToursMount();
      global.document.getElementById('tours')?.scrollIntoView({ behavior: 'smooth' });
    });
  }

  function updateSearchDropdownSlot() {
    const slot = global.document && global.document.getElementById('homeSearchDropdownSlot');
    if (!slot) return;
    slot.innerHTML = renderSearchDropdownHtml();
    bindSearchDropdownEvents(slot);
  }

  function updateHeroSlideUi() {
    const hero = global.document && global.document.getElementById('hero');
    if (!hero) return;
    hero.querySelectorAll('[data-hero-slide]').forEach((el) => {
      const idx = Number(el.getAttribute('data-hero-slide'));
      const active = idx === state.heroIdx;
      el.classList.toggle('opacity-100', active);
      el.classList.toggle('z-10', active);
      el.classList.toggle('opacity-0', !active);
      el.classList.toggle('pointer-events-none', !active);
      el.classList.toggle('z-0', !active);
      const img = el.querySelector('img');
      if (img) img.classList.toggle('kenburns', active);
    });
    hero.querySelectorAll('[data-hero-dot-bar]').forEach((bar) => {
      const idx = Number(bar.getAttribute('data-hero-dot-bar'));
      bar.innerHTML = idx === state.heroIdx
        ? '<span class="block h-full bg-[#C9A24B] progress-run"></span>'
        : (idx < state.heroIdx ? '<span class="block h-full bg-white w-full"></span>' : '');
    });
  }

  function updatePlanBadge() {
    const btn = global.document && global.document.getElementById('homePlanDrawerBtn');
    if (!btn) return;
    const totalQty = state.tripPlan.reduce((acc, item) => acc + (item.qty || 1), 0);
    let badge = btn.querySelector('.bfr-plan-badge');
    if (totalQty > 0) {
      if (!badge) {
        badge = global.document.createElement('span');
        badge.className = 'bfr-plan-badge absolute -top-1 -right-1 w-5 h-5 bg-[#C9A24B] text-[#0B2A22] rounded-full text-[11px] grid place-items-center font-extrabold';
        btn.appendChild(badge);
      }
      badge.textContent = String(totalQty);
    } else if (badge) {
      badge.remove();
    }
  }

  function bindToursEvents(scope) {
    if (!scope) return;
    scope.querySelectorAll('[data-action="cat-filter"]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const nextCat = btn.getAttribute('data-cat') || 'All';
        if (nextCat === 'All' && state.searchQuery) {
          state.searchQuery = '';
          syncSearchInputVal();
          updateTrendingTagsUi();
          updateSearchDropdownSlot();
        }
        state.category = nextCat;
        updateToursMount();
      });
    });

    scope.querySelector('#resetTourFilterBtn')?.addEventListener('click', () => {
      state.searchQuery = '';
      state.category = 'All';
      syncSearchInputVal();
      updateTrendingTagsUi();
      updateSearchDropdownSlot();
      updateToursMount();
    });

    scope.querySelector('#clearSearchQueryBtn')?.addEventListener('click', () => {
      state.searchQuery = '';
      syncSearchInputVal();
      updateTrendingTagsUi();
      updateSearchDropdownSlot();
      updateToursMount();
    });

    scope.querySelectorAll('[data-action="quick-tour"]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        const tour = state.tours.find((t) => t.id === id);
        if (tour) {
          state.activeTourModal = tour;
          state.modalGuests = 2;
          state.modalDayOpen = 0;
          updateOverlaysMount();
        }
      });
    });

    scope.querySelectorAll('[data-action="save-tour"]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        if (!id) return;
        const tour = state.tours.find((t) => t.id === id);
        if (state.savedIds.includes(id)) {
          state.savedIds = state.savedIds.filter((x) => x !== id);
          state.tripPlan = state.tripPlan.filter((x) => x.id !== id);
          saveTripPlanStorage();
          state.toastMsg = 'Removed from shortlist & Trip Plan.';
        } else if (tour) {
          addTourToPlan(tour);
        }
        updatePlanBadge();
        updateToursMount();
      });
    });

    scope.querySelectorAll('[data-action="compare-tour"]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        if (!id) return;
        if (state.compareIds.includes(id)) {
          state.compareIds = state.compareIds.filter((x) => x !== id);
        } else {
          state.compareIds = [...state.compareIds.slice(-1), id];
        }
        updateToursMount();
      });
    });

    scope.querySelector('#clearCompareBtn')?.addEventListener('click', () => {
      state.compareIds = [];
      updateToursMount();
    });
    scope.querySelector('#openCompareModalBtn')?.addEventListener('click', () => {
      state.compareModalOpen = true;
      updateOverlaysMount();
    });
  }

  function updateToursMount() {
    const el = global.document && global.document.getElementById('bfr-tours');
    if (!el) return;
    el.innerHTML = renderToursSection();
    bindToursEvents(el);
  }

  function bindOverlaysEvents(scope) {
    if (!scope) return;
    scope.querySelector('#homeMobileCloseBtn')?.addEventListener('click', () => { state.mobileMenuOpen = false; updateOverlaysMount(); });
    scope.querySelector('#homeMobileBackdrop')?.addEventListener('click', (e) => {
      if (e.target.id === 'homeMobileBackdrop') { state.mobileMenuOpen = false; updateOverlaysMount(); }
    });
    scope.querySelector('#mobileCustomLink')?.addEventListener('click', () => { state.mobileMenuOpen = false; updateOverlaysMount(); });

    scope.querySelector('#closePlanDrawerBtn')?.addEventListener('click', () => { state.planDrawerOpen = false; updateOverlaysMount(); });
    scope.querySelector('#homePlanBackdrop')?.addEventListener('click', (e) => { if (e.target.id === 'homePlanBackdrop') { state.planDrawerOpen = false; updateOverlaysMount(); } });
    scope.querySelector('#planToCustomBtn')?.addEventListener('click', () => {
      state.planDrawerOpen = false;
      updateOverlaysMount();
      global.document.getElementById('custom')?.scrollIntoView({ behavior: 'smooth' });
    });
    scope.querySelectorAll('[data-action="plan-qty"]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        const delta = Number(btn.getAttribute('data-delta')) || 0;
        state.tripPlan = state.tripPlan.map((it) => it.id === id ? { ...it, qty: Math.max(1, (it.qty || 1) + delta) } : it);
        saveTripPlanStorage();
        updatePlanBadge();
        updateOverlaysMount();
      });
    });
    scope.querySelectorAll('[data-action="plan-remove"]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        state.tripPlan = state.tripPlan.filter((it) => it.id !== id);
        state.savedIds = state.savedIds.filter((x) => x !== id);
        saveTripPlanStorage();
        updatePlanBadge();
        updateToursMount();
        updateOverlaysMount();
      });
    });

    scope.querySelector('#closeTourModalBtn')?.addEventListener('click', () => { state.activeTourModal = null; updateOverlaysMount(); });
    scope.querySelector('#homeTourModalBackdrop')?.addEventListener('click', (e) => { if (e.target.id === 'homeTourModalBackdrop') { state.activeTourModal = null; updateOverlaysMount(); } });
    scope.querySelector('#modalGuestMinusBtn')?.addEventListener('click', () => { state.modalGuests = Math.max(1, state.modalGuests - 1); updateOverlaysMount(); });
    scope.querySelector('#modalGuestPlusBtn')?.addEventListener('click', () => { state.modalGuests += 1; updateOverlaysMount(); });
    scope.querySelector('#modalShortlistBtn')?.addEventListener('click', () => {
      if (state.activeTourModal) {
        addTourToPlan(state.activeTourModal);
        state.activeTourModal = null;
        state.planDrawerOpen = true;
        updatePlanBadge();
        updateToursMount();
        updateOverlaysMount();
      }
    });
    scope.querySelectorAll('[data-action="modal-day"]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const idx = Number(btn.getAttribute('data-idx'));
        state.modalDayOpen = state.modalDayOpen === idx ? -1 : idx;
        updateOverlaysMount();
      });
    });

    scope.querySelector('#closeCompareModalBtn')?.addEventListener('click', () => { state.compareModalOpen = false; updateOverlaysMount(); });
    scope.querySelector('#homeCompareBackdrop')?.addEventListener('click', (e) => { if (e.target.id === 'homeCompareBackdrop') { state.compareModalOpen = false; updateOverlaysMount(); } });

    scope.querySelector('#closeStoryModalBtn')?.addEventListener('click', () => {
      state.activeFestModal = null;
      state.activeDestModal = null;
      state.activeFilmModal = null;
      updateOverlaysMount();
    });
    scope.querySelector('#homeStoryBackdrop')?.addEventListener('click', (e) => {
      if (e.target.id === 'homeStoryBackdrop') {
        state.activeFestModal = null;
        state.activeDestModal = null;
        state.activeFilmModal = null;
        updateOverlaysMount();
      }
    });
    scope.querySelector('#storyToCustomBtn')?.addEventListener('click', () => {
      const m = state.activeFestModal || state.activeDestModal || state.activeFilmModal;
      if (m) state.customForm.message = `Interested in: ${m.name || m.title}. `;
      state.activeFestModal = null;
      state.activeDestModal = null;
      state.activeFilmModal = null;
      updateOverlaysMount();
      updateCustomMount();
      global.document.getElementById('custom')?.scrollIntoView({ behavior: 'smooth' });
    });
  }

  function updateOverlaysMount() {
    const el = global.document && global.document.getElementById('bfr-overlays');
    if (!el) return;
    el.innerHTML = `${renderMobileDrawer()}${renderInteractiveOverlays()}`;
    bindOverlaysEvents(el);
  }

  function bindCustomEvents(scope) {
    if (!scope) return;
    scope.querySelector('#custName')?.addEventListener('input', (e) => { state.customForm.name = e.target.value; });
    scope.querySelector('#custEmail')?.addEventListener('input', (e) => { state.customForm.email = e.target.value; });
    scope.querySelector('#custPhone')?.addEventListener('input', (e) => { state.customForm.phone = e.target.value; });
    scope.querySelector('#custDates')?.addEventListener('input', (e) => { state.customForm.dates = e.target.value; });
    scope.querySelector('#custTravellers')?.addEventListener('change', (e) => { state.customForm.travellers = e.target.value; });
    scope.querySelector('#custMessage')?.addEventListener('input', (e) => { state.customForm.message = e.target.value; });
    scope.querySelector('#custBudget')?.addEventListener('input', (e) => {
      state.customForm.budget = Number(e.target.value) || 2400;
      const lbl = scope.querySelector('#custBudgetVal');
      if (lbl) lbl.textContent = `$${state.customForm.budget.toLocaleString('en-US')}`;
    });
    scope.querySelectorAll('[data-action="toggle-interest"]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const tag = btn.getAttribute('data-interest');
        if (!tag) return;
        state.customForm.interests = state.customForm.interests.includes(tag)
          ? state.customForm.interests.filter((x) => x !== tag)
          : [...state.customForm.interests, tag];
        updateCustomMount();
      });
    });
    scope.querySelectorAll('[data-action="set-pace"]').forEach((btn) => {
      btn.addEventListener('click', () => {
        state.customForm.pace = btn.getAttribute('data-pace') || 'Balanced';
        updateCustomMount();
      });
    });
    scope.querySelector('#homeCustomForm')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      state.customError = '';
      state.customSubmitting = true;
      updateCustomMount();
      try {
        const res = await global.ApiClient.submitInquiry({
          source: 'website_custom_builder',
          inquiry_type: 'custom_itinerary',
          name: state.customForm.name.trim(),
          email: state.customForm.email.trim(),
          phone: state.customForm.phone.trim(),
          preferred_dates: state.customForm.dates.trim(),
          travelers_count: parseInt(state.customForm.travellers, 10) || 2,
          budget_range: `$${Number(state.customForm.budget || 2400).toLocaleString('en-US')}/person (${state.customForm.pace})`,
          interests: state.customForm.interests.join(', '),
          message: state.customForm.message.trim() || `Custom trip inquiry (${state.customForm.interests.join(', ')})`
        });
        state.customResult = res;
      } catch (err) {
        state.customError = err.message || 'Unable to submit custom inquiry. Please try WhatsApp or try again.';
      } finally {
        state.customSubmitting = false;
        updateCustomMount();
      }
    });
    scope.querySelector('#customEditAgainBtn')?.addEventListener('click', () => { state.customResult = null; updateCustomMount(); });
  }

  function updateCustomMount() {
    const el = global.document && global.document.getElementById('bfr-custom');
    if (!el) return;
    el.innerHTML = renderCustomBuilderSection();
    bindCustomEvents(el);
  }

  function bindFooterEvents(scope) {
    if (!scope) return;
    scope.querySelector('#homeNewsletterEmail')?.addEventListener('input', (e) => { state.newsletterEmail = e.target.value; });
    scope.querySelector('#homeNewsletterForm')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = state.newsletterEmail.trim();
      if (!email) return;
      state.newsletterBusy = true;
      state.newsletterMsg = '';
      state.newsletterErr = '';
      updateFooterMount();
      try {
        const res = await global.ApiClient.submitInquiry({
          inquiry_type: 'newsletter',
          name: email.split('@')[0],
          email,
          message: 'Subscribed to Bhutan Travel Notes dispatch via homepage footer.'
        });
        state.newsletterMsg = `Subscribed to Paro Travel Notes (Ref: ${res.reference || 'Saved'}).`;
        state.newsletterEmail = '';
      } catch (err) {
        state.newsletterErr = err.message || 'Subscription could not be saved right now.';
      } finally {
        state.newsletterBusy = false;
        updateFooterMount();
      }
    });
  }

  function updateFooterMount() {
    const el = global.document && global.document.getElementById('bfr-footer');
    if (!el) return;
    el.innerHTML = renderFooter();
    bindFooterEvents(el);
  }

  function bindChatEvents(scope) {
    if (!scope) return;
    scope.querySelector('#homeChatToggleBtn')?.addEventListener('click', () => { state.chatOpen = !state.chatOpen; updateChatMount(); });
    scope.querySelector('#homeChatCloseBtn')?.addEventListener('click', () => { state.chatOpen = false; updateChatMount(); });
    scope.querySelector('#homeChatInput')?.addEventListener('input', (e) => { state.chatInput = e.target.value; });
    scope.querySelector('#homeChatForm')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const txt = state.chatInput.trim();
      if (!txt) return;
      state.chatMessages.push({ who: 'you', text: txt });
      state.chatInput = '';
      const q = txt.toLowerCase();
      let reply = {
        who: 'ai',
        text: 'Our classic Paro · Thimphu · Punakha itineraries cover Tiger’s Nest, Dochula Pass, and private licensed guiding with DoI visa clearance included.',
        linkHref: 'tours.html',
        linkLabel: 'Compare all Bhutan packages →'
      };
      if (q.includes('india') || q.includes('inr') || q.includes('rupee')) {
        reply = {
          who: 'ai',
          text: 'Indian passport & Voter ID travellers pay ₹1,200/night SDF with ₹0 visa fee and Entry Permit issued cleanly at Phuentsholing or Paro.',
          linkHref: 'sdf-calculator.html',
          linkLabel: 'Calculate exact INR SDF →'
        };
      } else if (q.includes('festival') || q.includes('tshechu')) {
        reply = {
          who: 'ai',
          text: 'Thimphu Tshechu and Paro Tshechu are our flagship festival journeys with priority monastery courtyard access.',
          linkHref: 'festivals.html',
          linkLabel: 'Explore 2027 Festivals →'
        };
      } else if (q.includes('trek') || q.includes('snowman') || q.includes('druk')) {
        reply = {
          who: 'ai',
          text: 'Our Druk Path Trek and Snowman Expeditions include certified trekking guides, mountain cooks, ponies, and alpine route permits.',
          linkHref: 'tour-druk-path-trek.html',
          linkLabel: 'View Druk Path Trek →'
        };
      } else if (q.includes('book') || q.includes('price') || q.includes('cost') || q.includes('sdf')) {
        reply = {
          who: 'ai',
          text: 'International visitors pay $100/night SDF (50% off ages 6–12, free under 6) + $40 one-time visa fee. You can reserve online with a 30% deposit.',
          linkHref: 'book.html',
          linkLabel: 'Start 4-Step Booking →'
        };
      }
      state.chatMessages.push(reply);
      updateChatMount();
      const body = global.document && global.document.getElementById('homeChatBody');
      if (body) body.scrollTop = body.scrollHeight;
    });
  }

  function updateChatMount() {
    const el = global.document && global.document.getElementById('bfr-chat');
    if (!el) return;
    el.innerHTML = renderChatWidget();
    bindChatEvents(el);
  }

  function bindEvents(root) {
    root.querySelectorAll('[data-mega]').forEach((el) => {
      el.addEventListener('mouseenter', () => {
        const next = el.getAttribute('data-mega');
        if (state.megaMenu !== next) {
          state.megaMenu = next;
          updateMegaSlot();
        }
      });
    });
    const header = root.querySelector('#siteHeader');
    header?.addEventListener('mouseleave', () => {
      if (state.megaMenu) {
        state.megaMenu = null;
        updateMegaSlot();
      }
    });
    bindMegaSlotEvents(root.querySelector('#homeMegaSlot'));

    const hero = root.querySelector('#hero');
    hero?.addEventListener('mouseenter', () => { state.heroPaused = true; });
    hero?.addEventListener('mouseleave', () => { state.heroPaused = false; });

    root.querySelectorAll('[data-action="hero-dot"]').forEach((btn) => {
      btn.addEventListener('click', () => {
        state.heroIdx = Number(btn.getAttribute('data-idx')) || 0;
        updateHeroSlideUi();
      });
    });

    root.querySelector('#homeMobileOpenBtn')?.addEventListener('click', () => { state.mobileMenuOpen = true; updateOverlaysMount(); });
    root.querySelector('#homePlanDrawerBtn')?.addEventListener('click', () => { state.planDrawerOpen = true; updateOverlaysMount(); });
    root.querySelector('#homeAiHeaderBtn')?.addEventListener('click', () => { state.chatOpen = true; updateChatMount(); });

    const searchInput = root.querySelector('#homeSearchInput');
    searchInput?.addEventListener('input', (e) => {
      state.searchQuery = e.target.value;
      state.searchDropdownOpen = true;
      updateTrendingTagsUi();
      updateSearchDropdownSlot();
      updateToursMount();
    });
    searchInput?.addEventListener('focus', () => {
      state.searchDropdownOpen = true;
      updateSearchDropdownSlot();
    });
    searchInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        state.searchDropdownOpen = false;
        updateSearchDropdownSlot();
        updateToursMount();
        global.document.getElementById('tours')?.scrollIntoView({ behavior: 'smooth' });
      } else if (e.key === 'Escape') {
        state.searchDropdownOpen = false;
        updateSearchDropdownSlot();
      }
    });
    root.querySelector('#homeSearchBtn')?.addEventListener('click', () => {
      state.searchDropdownOpen = false;
      updateSearchDropdownSlot();
      updateToursMount();
      global.document.getElementById('tours')?.scrollIntoView({ behavior: 'smooth' });
    });
    root.querySelectorAll('#bfr-search [data-action="quick-tag"]').forEach((btn) => {
      btn.addEventListener('click', () => applyQuickTag(btn.getAttribute('data-tag') || ''));
    });
    if (!global.__bfrOutsideSearchClickBound && global.document) {
      global.__bfrOutsideSearchClickBound = true;
      global.document.addEventListener('click', (e) => {
        if (state.searchDropdownOpen && !e.target.closest('#bfr-search')) {
          state.searchDropdownOpen = false;
          updateSearchDropdownSlot();
        }
      });
    }
    bindSearchDropdownEvents(root.querySelector('#homeSearchDropdownSlot'));

    bindToursEvents(root.querySelector('#bfr-tours'));
    bindOverlaysEvents(root.querySelector('#bfr-overlays'));
    bindCustomEvents(root.querySelector('#bfr-custom'));
    bindFooterEvents(root.querySelector('#bfr-footer'));
    bindChatEvents(root.querySelector('#bfr-chat'));

    root.querySelectorAll('[data-action="quick-fest"]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const idx = Number(btn.getAttribute('data-idx'));
        state.activeFestModal = state.festivals[idx] || null;
        updateOverlaysMount();
      });
    });
    root.querySelectorAll('[data-action="quick-dest"]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const idx = Number(btn.getAttribute('data-idx'));
        state.activeDestModal = state.destinations[idx] || null;
        updateOverlaysMount();
      });
    });
    root.querySelectorAll('[data-action="open-film"]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const idx = Number(btn.getAttribute('data-idx'));
        state.activeFilmModal = SPECIALTY_CARDS[idx] || null;
        updateOverlaysMount();
      });
    });

    attachLensListeners(root);
  }

  function render() {
    const root = getRoot();
    if (!root) return;
    root.innerHTML = `
      <div class="min-h-screen bg-[var(--cream)] text-[var(--ink)] overflow-x-clip">
        <div id="bfr-header">${renderHeaderSection()}</div>
        <div id="bfr-hero">${renderHeroSection()}</div>
        <div id="bfr-search">${renderSearchAndTrust()}</div>
        <div id="bfr-tours">${renderToursSection()}</div>
        <div id="bfr-festivals">${renderFestivalsSection()}</div>
        <div id="bfr-specialty">${renderSpecialtySection()}</div>
        <div id="bfr-services">${renderServicesMosaic()}</div>
        <div id="bfr-destinations">${renderDestinationsSection()}</div>
        <div id="bfr-custom">${renderCustomBuilderSection()}</div>
        <div id="bfr-reviews">${renderReviewsAndTrust()}</div>
        <div id="bfr-footer">${renderFooter()}</div>
        <div id="bfr-overlays">${renderMobileDrawer()}${renderInteractiveOverlays()}</div>
        <div id="bfr-chat">${renderChatWidget()}</div>
      </div>
    `;
    updatePlanBadge();
    bindEvents(root);
  }

  async function init() {
    if (typeof global.Image === 'function') {
      Object.values(FALLBACK_IMAGES).forEach((src) => {
        const im = new global.Image();
        im.src = src;
      });
    }
    render();
    if (!state.heroTimer) {
      state.heroTimer = global.setInterval(() => {
        const busyModal = state.planDrawerOpen || state.activeTourModal || state.activeFestModal || state.activeDestModal || state.activeFilmModal || state.compareModalOpen;
        if (!state.heroPaused && !state.megaMenu && !state.searchDropdownOpen && !busyModal) {
          state.heroIdx = (state.heroIdx + 1) % HERO_SLIDES.length;
          updateHeroSlideUi();
        }
      }, 6500);
    }

    if (!global.ApiClient) return;
    try {
      const [toursRes, festsRes, destsRes, reviewsRes, settingsRes] = await Promise.allSettled([
        global.ApiClient.getTours(),
        global.ApiClient.getFestivals(),
        global.ApiClient.getDestinations(),
        global.ApiClient.getReviews(),
        global.ApiClient.getPublicSettings()
      ]);

      if (toursRes.status === 'fulfilled') {
        state.tours = Array.isArray(toursRes.value) ? toursRes.value : (toursRes.value && toursRes.value.data) || [];
      } else {
        state.catalogError = (toursRes.reason && toursRes.reason.message) || 'Could not reach booking catalog API.';
      }
      if (festsRes.status === 'fulfilled') {
        state.festivals = (festsRes.value && festsRes.value.data) || [];
      }
      if (destsRes.status === 'fulfilled') {
        state.destinations = (destsRes.value && destsRes.value.data) || [];
      }
      if (reviewsRes.status === 'fulfilled' && reviewsRes.value) {
        state.reviews = reviewsRes.value.data || [];
        state.avgRating = Number(reviewsRes.value.average_rating || 4.9);
        state.reviewsCount = Number(reviewsRes.value.count || state.reviews.length || 0);
      }
      if (settingsRes.status === 'fulfilled' && settingsRes.value && settingsRes.value.data) {
        state.settings = { ...state.settings, ...settingsRes.value.data };
      }
    } catch (err) {
      state.catalogError = err.message || 'Unable to load storefront data.';
    } finally {
      state.loadingCatalog = false;
      render();
      if (global.SiteShell && typeof global.SiteShell.init === 'function') {
        global.SiteShell.init();
      }
    }
  }

  global.HomeApp = { init, render };
  if (global.document && !global.__BFR_DISABLE_AUTO_INIT__) {
    global.document.addEventListener('DOMContentLoaded', init);
  }
})(typeof window !== 'undefined' ? window : globalThis);
