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
    dochula: 'assets/images/dochula-pass.webp'
  };

  const HERO_SLIDES = [
    {
      img: FALLBACK_IMAGES.tiger,
      kicker: 'PARO · THE ICON',
      title: 'Stand above the clouds at Tiger’s Nest.',
      sub: 'A cliff monastery, a mountain trail, and a journey you will remember for life.',
      defaultPrice: 1899,
      tourSlug: 'essential-bhutan-7d',
      layout: 'left'
    },
    {
      img: FALLBACK_IMAGES.punakha,
      kicker: 'PUNAKHA · RIVER VALLEY',
      title: 'Where two rivers meet a golden dzong.',
      sub: 'Slow valley mornings, riverside picnics and Bhutan’s most beautiful fortress.',
      defaultPrice: 2199,
      tourSlug: 'punakha-escape',
      layout: 'center'
    },
    {
      img: FALLBACK_IMAGES.festival,
      kicker: 'FESTIVALS · 2027 SEASON',
      title: 'Dance, colour and blessing in Thimphu.',
      sub: 'Front-row festival days, local storytellers and moments of pure joy.',
      defaultPrice: 2499,
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
      dur: '7 days · Cultural & Spiritual',
      img: FALLBACK_IMAGES.dochula,
      desc: 'Guided meditation, monastery mornings and traditional hot-stone baths.',
      href: 'tours.html?cat=Luxury'
    },
    {
      name: 'Photography Expedition',
      dur: '9 days · Alpine & Heritage',
      img: FALLBACK_IMAGES.tiger,
      desc: 'Golden-hour access, festival portraits and crisp Himalayan mountain light.',
      href: 'tours.html?cat=Festival'
    },
    {
      name: 'Textile & Craft Trail',
      dur: '6 days · Artisan Immersion',
      img: FALLBACK_IMAGES.festival,
      desc: 'Weavers, natural dyers and valley markets with Bhutanese master artisans.',
      href: 'tours.html?cat=Classic'
    },
    {
      name: 'Monastery Stay',
      dur: '5 days · Sacred Retreats',
      img: FALLBACK_IMAGES.punakha,
      desc: 'Stay beside working mountain monasteries and join serene dawn prayers.',
      href: 'tours.html?cat=Classic'
    }
  ];

  const SERVICES_GRID = [
    { n: 'Visa & SDF Handling', d: 'Paperwork, SDF and approvals handled end-to-end.', img: FALLBACK_IMAGES.punakha, pos: 'center 20%', href: 'services.html' },
    { n: 'Flight Booking — Paro', d: 'Drukair / Bhutan Airlines seats, checked in advance.', img: FALLBACK_IMAGES.dochula, pos: 'center 40%', href: 'services.html' },
    { n: 'Hotels & Farmstay', d: 'Hand-checked stays from boutique lodges to family homes.', img: FALLBACK_IMAGES.tiger, pos: 'center 60%', href: 'services.html' },
    { n: 'Private Guide & Driver', d: 'Licensed English-speaking guide and comfortable private vehicle.', img: FALLBACK_IMAGES.festival, pos: 'center 30%', href: 'about.html' },
    { n: 'Trek Permits', d: 'Route permits, camping crew and safety planning.', img: FALLBACK_IMAGES.cranes, pos: 'center 50%', href: 'tours.html?cat=Trek' },
    { n: 'SDF Tax Calculator', d: 'Instant USD & INR pricing with DoI child exemptions.', img: FALLBACK_IMAGES.dochula, pos: 'center 70%', href: 'sdf-calculator.html' },
    { n: 'Travel Insurance Help', d: 'Clear guidance on cover for altitude, trekking and delays.', img: FALLBACK_IMAGES.punakha, pos: 'center 35%', href: 'visa-guide.html' },
    { n: 'Group / MICE', d: 'Incentive groups, retreats and celebrations, planned in detail.', img: FALLBACK_IMAGES.festival, pos: 'center 55%', href: 'contact.html' }
  ];

  const CATEGORIES = ['All', 'Classic', 'Festival', 'Luxury', 'Trek', 'Adventure'];
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
      sliders: '<line x1="21" x2="14" y1="4" y2="4"/><line x1="10" x2="3" y1="4" y2="4"/><line x1="21" x2="12" y1="12" y2="12"/><line x1="8" x2="3" y1="12" y2="12"/><line x1="21" x2="16" y1="20" y2="20"/><line x1="12" x2="3" y1="20" y2="20"/>'
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

  function getFilteredTours() {
    const q = state.searchQuery.trim().toLowerCase();
    return state.tours.filter((t) => {
      const catStr = String(t.category || '').toLowerCase();
      const sel = state.category.toLowerCase();
      const catOk =
        state.category === 'All' ||
        catStr.includes(sel) ||
        (sel === 'classic' && (catStr.includes('classic') || catStr.includes('cultural'))) ||
        (sel === 'luxury' && (catStr.includes('luxury') || catStr.includes('escape') || catStr.includes('wellness'))) ||
        (sel === 'trek' && (catStr.includes('trek') || catStr.includes('expedition'))) ||
        (sel === 'adventure' && (catStr.includes('adventure') || catStr.includes('birding')));
      if (!catOk) return false;
      if (!q) return true;
      const hay = `${t.title || ''} ${t.valleys || ''} ${t.subtitle || ''} ${t.highlight_text || ''} ${t.category || ''}`.toLowerCase();
      return hay.includes(q);
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
            ? 'bg-[#0B2A22]/72 backdrop-blur-md p-6 sm:p-8 rounded-[28px] border border-white/20'
            : '';

      return `
        <div class="absolute inset-0 transition-opacity duration-700 ${isActive ? 'opacity-100 z-10' : 'opacity-0 pointer-events-none z-0'}" data-hero-slide="${idx}">
          <img src="${esc(s.img)}" alt="${esc(s.title)}" class="w-full h-full object-cover ${isActive ? 'kenburns' : ''}">
          <div class="absolute inset-0 bg-gradient-to-t from-[#0B2A22]/85 via-[#0B2A22]/35 to-black/25"></div>
          <div class="relative h-full max-w-[1360px] mx-auto px-4 sm:px-6 flex items-center ${wrapJustify}">
            <div class="splash-in max-w-[680px] text-white ${boxCls}">
              <span class="inline-block bg-[#C9A24B] text-[#0B2A22] px-3 py-1 rounded-full text-xs font-extrabold tracking-[0.18em]">${esc(s.kicker)}</span>
              <h1 class="font-serif text-[38px] sm:text-[56px] lg:text-[64px] leading-[1.03] mt-3">${esc(s.title)}</h1>
              <p class="mt-3 text-white/90 text-base sm:text-lg max-w-[560px]">${esc(s.sub)}</p>
              <div class="mt-6 flex flex-wrap items-center gap-3">
                <a href="${esc(tourHref)}" class="bg-[#C9A24B] hover:bg-[#E4C87E] text-[#0B2A22] px-6 py-3.5 rounded-full font-extrabold text-sm transition inline-flex items-center gap-2">
                  Explore journey ${svgIcon('arrowRight', 16)}
                </a>
                <a href="${esc(bookHref)}" class="bg-white/15 hover:bg-white/25 backdrop-blur border border-white/30 text-white px-5 py-3.5 rounded-full font-bold text-sm transition">
                  Book Now
                </a>
                <div class="bg-[#0B2A22]/80 border border-white/20 px-4 py-2 rounded-2xl text-xs">
                  <span class="text-white/70 block">All-inclusive from</span>
                  <strong class="font-serif text-lg text-[#E4C87E]">$${livePrice.toLocaleString('en-US')}</strong>
                  <span class="text-white/70"> · SDF included</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      `;
    }).join('');

    const dotsHtml = HERO_SLIDES.map((s, idx) => `
      <button type="button" data-action="hero-dot" data-idx="${idx}" aria-label="Go to slide ${idx + 1}" class="text-left p-2.5 rounded-xl bg-black/35 backdrop-blur border ${idx === state.heroIdx ? 'border-[#C9A24B]' : 'border-white/15'} text-white hover:bg-black/50 transition">
        <div class="text-[11px] font-bold tracking-wider truncate">
          <span class="text-[#C9A24B] mr-1">${String(idx + 1).padStart(2, '0')}</span> ${esc(s.kicker.split('·')[0].trim())}
        </div>
        <div class="h-1 bg-white/20 rounded-full mt-1.5 overflow-hidden">
          ${idx === state.heroIdx ? '<div class="h-full bg-[#C9A24B]" style="width:100%"></div>' : idx < state.heroIdx ? '<div class="h-full bg-[#C9A24B]" style="width:100%"></div>' : ''}
        </div>
      </button>
    `).join('');

    return `
      <section id="hero" class="relative h-[560px] sm:h-[620px] overflow-hidden bg-[#0B2A22]">
        <div class="relative h-full">
          ${slidesHtml}
          <div class="absolute inset-x-0 bottom-4 z-20 max-w-[1360px] mx-auto px-4 sm:px-6">
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              ${dotsHtml}
            </div>
          </div>
        </div>
      </section>
    `;
  }

  function renderHeaderSection() {
    const lic = state.settings.company_license || 'TR/2018/9882';
    const cleanLic = String(lic).replace(/^#/, '');
    const avg = Number(state.avgRating || 4.9).toFixed(1);
    const totalReviews = state.reviewsCount > 0 ? `${state.reviewsCount} verified reviews` : '2,400+ happy travellers';

    const mega = state.megaMenu && MEGA_CONFIG[state.megaMenu]
      ? `
        <div class="hidden lg:block absolute left-0 right-0 top-full bg-white shadow-2xl border-t border-[var(--line)] z-40" id="homeMegaPanel">
          <div class="max-w-[1360px] mx-auto px-6 py-7 grid grid-cols-4 gap-7">
            <div>
              <p class="text-xs tracking-[0.2em] text-[#C9A24B] font-extrabold">EXPLORE ${esc(state.megaMenu.toUpperCase())}</p>
              <div class="flex items-baseline justify-between mt-2">
                <h3 class="font-serif text-3xl">${esc(MEGA_CONFIG[state.megaMenu].title)} in Bhutan</h3>
                <a href="${esc(MEGA_CONFIG[state.megaMenu].href)}" class="text-xs font-bold text-[#C9A24B] hover:underline">View Page →</a>
              </div>
              <p class="text-sm text-[var(--muted)] mt-2">Hand-checked routes, licensed guides and SDF included.</p>
              <div class="flex flex-wrap gap-2 mt-4">
                ${['bhutan tour packages', 'best time to visit', 'tigers nest'].map((tag) => `
                  <button type="button" data-action="quick-tag" data-tag="${esc(tag)}" class="text-xs bg-[#FFF8EC] border border-[var(--line)] px-3 py-1.5 rounded-full font-bold">${esc(tag)}</button>
                `).join('')}
              </div>
            </div>
            <div class="space-y-1">
              ${MEGA_CONFIG[state.megaMenu].links.map((lk) => `
                <a href="${esc(lk.href)}" class="w-full text-left px-3 py-2.5 rounded-xl hover:bg-[#FFF8EC] font-semibold flex justify-between items-center text-[var(--ink)]">
                  <span>${esc(lk.label)}</span>
                  <span class="text-[#C9A24B]">→</span>
                </a>
              `).join('')}
            </div>
            <div class="bg-[#FFF8EC] rounded-2xl p-4 flex flex-col justify-between">
              <div>
                <p class="text-xs font-extrabold text-[#C9A24B] tracking-widest">DIRECT CONCIERGE</p>
                <p class="font-serif text-xl mt-1">Need tailor-made dates or Regional INR pricing?</p>
                <p class="text-sm text-[var(--muted)] mt-2">Use our instant SDF calculator or speak directly with our Paro booking desk.</p>
              </div>
              <a href="book.html" class="mt-4 inline-flex items-center gap-2 bg-[#0B2A22] text-white px-4 py-2.5 rounded-full text-sm font-bold w-fit">
                Start Booking ${svgIcon('arrowRight', 15)}
              </a>
            </div>
            <div class="relative rounded-2xl overflow-hidden min-h-[200px]">
              <img src="${esc(MEGA_CONFIG[state.megaMenu].img)}" alt="${esc(MEGA_CONFIG[state.megaMenu].feature)}" class="w-full h-full object-cover">
              <div class="absolute inset-0 bg-gradient-to-t from-black/75 to-transparent"></div>
              <div class="absolute bottom-3 left-3 right-3 text-white">
                <span class="text-[11px] font-bold text-[#E4C87E] uppercase">HIGHLIGHT</span>
                <p class="font-serif text-lg">${esc(MEGA_CONFIG[state.megaMenu].feature)}</p>
              </div>
            </div>
          </div>
        </div>
      `
      : '';

    return `
      <div class="bg-[#0B2A22] text-white text-[12px] sm:text-[13px]" id="top">
        <div class="max-w-[1360px] mx-auto px-4 sm:px-6 py-2 flex flex-wrap gap-x-5 gap-y-1 justify-between">
          <span class="font-semibold">✓ SDF fee included · Licensed Bhutan operator <span data-bfr-license>#${esc(cleanLic)}</span></span>
          <span class="hidden md:block">USD &amp; INR · English · Live help 9am–7pm Bhutan time</span>
          <span class="text-[#E4C87E] font-bold">★ ${esc(avg)} · ${esc(totalReviews)}</span>
        </div>
      </div>

      <header id="siteHeader" class="sticky z-40 bg-[var(--cream)]/95 backdrop-blur border-b border-[var(--line)]" style="top:0">
        <div class="max-w-[1360px] mx-auto px-4 sm:px-6 h-[72px] flex items-center gap-3">
          <button type="button" id="homeMobileOpenBtn" class="lg:hidden p-2 rounded-xl hover:bg-[#F7EDD8]" aria-label="Open menu">
            ${svgIcon('menu', 22)}
          </button>

          <a href="#top" class="flex items-center gap-2 min-w-0">
            <span class="w-10 h-10 rounded-full bg-[#0B2A22] text-[#C9A24B] grid place-items-center font-serif text-xl font-bold">B</span>
            <span class="leading-none">
              <span class="block font-serif text-[18px] sm:text-[22px] font-bold tracking-tight" data-bfr-company>BHUTAN FAST RATE</span>
              <span class="block text-[10px] tracking-[0.24em] text-[#C9A24B] font-extrabold">TOURS · EST. PARO</span>
            </span>
          </a>

          <nav class="hidden lg:flex ml-6 gap-1 text-[15px] font-semibold">
            <a href="index.html" class="px-3 py-2 rounded-full bg-[#0B2A22] text-white font-bold">Home</a>
            <a href="tours.html" data-mega="Tours" class="px-3 py-2 rounded-full hover:bg-[#F7EDD8] transition-colors">Tours</a>
            <a href="destinations.html" data-mega="Destinations" class="px-3 py-2 rounded-full hover:bg-[#F7EDD8] transition-colors">Destinations</a>
            <a href="festivals.html" data-mega="Festivals" class="px-3 py-2 rounded-full hover:bg-[#F7EDD8] transition-colors">Festivals</a>
            <a href="services.html" data-mega="Services" class="px-3 py-2 rounded-full hover:bg-[#F7EDD8] transition-colors">Visa &amp; SDF</a>
            <a href="about.html" class="px-3 py-2 rounded-full hover:bg-[#F7EDD8] transition-colors">About Us</a>
            <a href="contact.html" class="px-3 py-2 rounded-full hover:bg-[#F7EDD8] transition-colors">Contact</a>
          </nav>

          <div class="ml-auto flex items-center gap-2" data-bfr-portal-links>
            <a href="client/login.html" class="hidden xl:inline-flex items-center gap-1.5 border border-[var(--line)] bg-white hover:bg-[#F7EDD8] px-3 py-2 rounded-full text-xs font-bold text-[#0B2A22] transition">
              Client Portal
            </a>
            <a href="book.html" class="flex items-center gap-2 bg-[#0B2A22] hover:bg-[#123A30] text-white px-4 py-2.5 rounded-full text-sm font-bold shadow-sm transition">
              <span>Book Now</span>
              ${svgIcon('arrowRight', 15)}
            </a>
            <button type="button" id="homeAiHeaderBtn" class="hidden md:flex items-center gap-2 border border-[var(--line)] px-3 py-2.5 rounded-full text-sm font-bold bg-white hover:bg-[#F7EDD8] transition">
              ${svgIcon('sparkles', 16, 'text-[#C9A24B]')} AI Help
            </button>
          </div>
        </div>
        ${mega}
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
            <a href="client/login.html" class="block px-3 py-2.5 rounded-xl hover:bg-[#F7EDD8]">Client Portal</a>
            <a href="contact.html" class="block px-3 py-2.5 rounded-xl hover:bg-[#F7EDD8]">Contact &amp; Custom Quotes</a>
          </div>
          <a href="#custom" id="mobileCustomLink" class="mt-6 block text-center bg-[#C9A24B] text-[#0B2A22] py-3 rounded-full font-extrabold text-sm">
            Plan Custom Itinerary
          </a>
        </div>
      </div>
    `;
  }

  function renderSearchAndTrust() {
    const q = state.searchQuery.trim().toLowerCase();
    const suggestions = q ? TRENDING_TAGS.filter((t) => t.includes(q)).slice(0, 6) : [];
    const trustBadges = [
      ['Bhutan Tourism approved', `Licensed #${String(state.settings.company_license || 'TR/2018/9882').replace(/^#/, '')}`],
      ['SDF included', 'No surprises at checkout'],
      ['No hidden fees', 'Transparent USD & INR billing'],
      ['Private guides', 'Licensed Bhutanese locals'],
      ['English-speaking experts', 'Storytellers & trek specialists'],
      ['Flexible dates', '30+ days free date changes']
    ];

    return `
      <section class="max-w-[1360px] mx-auto px-4 sm:px-6 -mt-8 relative z-30">
        <div class="bg-white rounded-[24px] p-4 sm:p-5 border border-[var(--line)] shadow-xl">
          <div class="flex flex-wrap items-center gap-2 text-xs font-extrabold text-[#C9A24B] tracking-[0.18em]">
            ${svgIcon('sparkles', 15)}
            <span>INSTANT PACKAGE &amp; VALLEY SEARCH</span>
            <span class="text-[var(--muted)] font-semibold tracking-normal ml-auto">Live catalog powered by our Paro desk</span>
          </div>
          <div class="relative mt-3">
            <div class="flex items-center gap-2 border border-[var(--line)] rounded-full px-4 py-2 bg-[var(--cream)]">
              ${svgIcon('search', 18, 'text-[var(--muted)]')}
              <input id="homeSearchInput" type="text" value="${esc(state.searchQuery)}" placeholder="Search Tiger’s Nest, Punakha, Tshechu festival, luxury..." class="flex-1 bg-transparent py-1.5 text-sm outline-none" style="color-scheme:light;color:#101613;">
              <button type="button" id="homeSearchBtn" class="bg-[#0B2A22] text-white px-5 py-2 rounded-full text-sm font-bold shrink-0">Find Trips</button>
            </div>
            ${state.searchDropdownOpen && state.searchQuery.trim()
              ? `<div class="absolute left-0 right-0 top-full mt-2 bg-white border border-[var(--line)] rounded-2xl shadow-xl p-2 z-30">
                  ${suggestions.length
                    ? suggestions.map((tag) => `<button type="button" data-action="quick-tag" data-tag="${esc(tag)}" class="w-full text-left px-3 py-2 rounded-xl hover:bg-[#FFF8EC] text-sm font-semibold flex items-center gap-2">${svgIcon('sparkles', 15, 'text-[#C9A24B]')} ${esc(tag)}</button>`).join('')
                    : `<button type="button" id="homeSearchDirectGo" class="w-full text-left px-3 py-2 rounded-xl hover:bg-[#FFF8EC] text-sm font-semibold">Search live tours for "${esc(state.searchQuery)}" →</button>`
                  }
                </div>`
              : ''}
          </div>
          <div class="flex flex-wrap items-center gap-2 mt-3">
            <span class="text-xs font-bold text-[var(--muted)]">Popular:</span>
            ${TRENDING_TAGS.map((tag) => `<button type="button" data-action="quick-tag" data-tag="${esc(tag)}" class="text-xs bg-[#FFF8EC] hover:bg-[#F7EDD8] border border-[var(--line)] px-3 py-1 rounded-full font-semibold transition">${esc(tag)}</button>`).join('')}
          </div>
        </div>

        <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 mt-4">
          ${trustBadges.map(([t, sub]) => `
            <div class="bg-white/90 border border-[var(--line)] rounded-2xl p-3">
              <div class="font-extrabold text-sm">${esc(t)}</div>
              <p class="text-xs text-[var(--muted)] mt-0.5">${esc(sub)}</p>
            </div>
          `).join('')}
        </div>
      </section>
    `;
  }

  function renderToursSection() {
    const filtered = getFilteredTours();
    const compareBar = state.compareIds.length > 0
      ? `<div class="mb-4 bg-white border border-[var(--line)] rounded-2xl p-4 flex flex-wrap gap-3 items-center justify-between">
          <span class="font-bold text-sm">Compare: ${state.compareIds.map((id) => {
            const t = state.tours.find((x) => x.id === id);
            return esc(t ? t.title : id);
          }).join('  vs  ')}</span>
          <div class="flex items-center gap-3">
            <a href="tours.html" class="text-sm font-bold text-[#C9A24B] hover:underline">Open Full Catalog →</a>
            <button type="button" id="clearCompareBtn" class="text-sm font-bold underline">Clear</button>
          </div>
        </div>`
      : '';

    const toastBanner = state.toastMsg
      ? `<div class="mb-4 bg-[#0B2A22] text-white px-4 py-3 rounded-xl text-sm font-bold flex items-center gap-2">${svgIcon('check', 16, 'text-[#C9A24B]')} <span>${esc(state.toastMsg)}</span></div>`
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
          <article class="group bg-white rounded-[24px] overflow-hidden border border-[var(--line)] card-lift flex flex-col">
            <a href="${esc(tourHref)}" class="relative block text-left overflow-hidden h-[230px]">
              <img src="${esc(img)}" alt="${esc(t.title)}" class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110">
              <span class="absolute top-3 left-3 bg-white/95 px-3 py-1 rounded-full text-xs font-extrabold text-[#0B2A22]">${days} DAYS · ${esc(cat.toUpperCase())}</span>
              <span class="absolute top-3 right-3 bg-[#0B2A22] text-white px-2.5 py-1 rounded-full text-xs font-bold flex items-center gap-1">${svgIcon('star', 13, 'fill-[#C9A24B] text-[#C9A24B]')} ${esc(rating)}</span>
              <span class="absolute inset-x-3 bottom-3 bg-[#0B2A22]/90 text-white text-center py-2.5 rounded-full text-sm font-bold opacity-0 group-hover:opacity-100 transition">View Full Itinerary →</span>
            </a>
            <div class="p-4 flex-1 flex flex-col">
              <a href="${esc(tourHref)}" class="text-left">
                <h3 class="font-serif text-[22px] leading-tight gold-line inline text-[#0B2A22]">${esc(t.title)}</h3>
              </a>
              <p class="text-sm text-[var(--muted)] mt-2 flex gap-1">${svgIcon('mapPin', 15, 'shrink-0 mt-0.5')} <span>${esc(t.valleys || 'Paro • Thimphu • Punakha')}</span></p>
              <p class="text-sm mt-2 flex-1">${esc(t.subtitle || t.highlight_text || 'Private licensed Bhutanese guide, SDF included, and curated boutique stays.')}</p>
              <p class="text-xs text-[var(--muted)] mt-3 flex items-center gap-1">${svgIcon('users', 14)} <span>${esc(t.difficulty || 'Easy to Moderate')} · SDF Included</span></p>
              <div class="flex items-end justify-between mt-4 pt-4 border-t border-[var(--line)]">
                <div>
                  <span class="text-xs text-[var(--muted)] block">From (3★)</span>
                  <span class="font-serif text-[26px] font-bold">$${price.toLocaleString('en-US')}</span>
                </div>
                <div class="flex gap-1.5">
                  <button type="button" data-action="save-tour" data-id="${esc(t.id)}" aria-label="Save tour" class="w-10 h-10 rounded-full grid place-items-center border ${isSaved ? 'bg-[#C9A24B] text-white border-[#C9A24B]' : 'border-[var(--line)]'}">
                    ${svgIcon('heart', 16, isSaved ? 'fill-white' : '')}
                  </button>
                  <button type="button" data-action="compare-tour" data-id="${esc(t.id)}" aria-label="Compare tour" class="px-3 h-10 rounded-full text-xs font-extrabold border ${isCmp ? 'bg-[#0B2A22] text-white' : 'border-[var(--line)]'}">
                    Compare
                  </button>
                </div>
              </div>
              <div class="flex gap-2 mt-3">
                <a href="${esc(tourHref)}" class="flex-1 text-center bg-[#0B2A22] hover:bg-[#123A30] text-white py-3 rounded-full font-bold text-sm transition">View Details</a>
                <a href="${esc(bookHref)}" class="flex-1 text-center border border-[#0B2A22] hover:bg-[#FFF8EC] text-[#0B2A22] py-3 rounded-full font-bold text-sm transition">Book Now</a>
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
            <h2 class="font-serif text-[36px] sm:text-[54px] leading-none mt-2">Journeys people<br>remember for life.</h2>
          </div>
          <div class="max-w-[400px]">
            <p class="text-[var(--muted)]">Explore full day-by-day itineraries, transparent 3★/4★/5★ tier rates with SDF included, and instant online booking.</p>
            <a href="tours.html" class="inline-flex items-center gap-1.5 text-sm font-extrabold text-[#0B2A22] hover:text-[#C9A24B] mt-2">
              Browse all ${state.tours.length || ''} packages ${svgIcon('arrowRight', 15)}
            </a>
          </div>
        </div>

        <div class="flex gap-2 overflow-x-auto no-scrollbar py-5">
          ${CATEGORIES.map((c) => `
            <button type="button" data-action="cat-filter" data-cat="${esc(c)}" class="px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap ${state.category === c ? 'bg-[#0B2A22] text-white' : 'bg-white border border-[var(--line)]'}">
              ${esc(c)}
            </button>
          `).join('')}
        </div>

        ${toastBanner}
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
            <h2 class="font-serif text-[36px] sm:text-[54px] mt-2">Move your cursor.<br>Look closer.</h2>
            <p class="text-[var(--muted)] mt-2 max-w-[620px]">Hover any festival image to activate the magnifying lens. Open dedicated festival schedules and reserve priority monastery seating.</p>
          </div>
          <a href="festivals.html" class="text-sm font-extrabold text-[#0B2A22] hover:text-[#C9A24B]">View All Festival Dates →</a>
        </div>

        <div class="grid sm:grid-cols-2 lg:grid-cols-4 gap-5 mt-7">
          ${fests.map((f) => {
            const img = safeUrl(f.cover_image, FALLBACK_IMAGES.festival);
            const festName = f.name || f.title || 'Bhutan Tshechu Festival';
            const festHref = resolveFestivalPageHref(f);
            const bookHref = f.related_tour_id ? `book.html?tour=${encodeURIComponent(f.related_tour_id)}` : 'festivals.html';
            return `
              <article class="bg-white rounded-[24px] overflow-hidden border border-[var(--line)] card-lift flex flex-col">
                <a href="${esc(festHref)}" class="block relative overflow-hidden cursor-crosshair h-[240px] sm:h-[260px] bfr-lens-box" data-img="${esc(img)}">
                  <div role="img" aria-label="${esc(festName)}" class="w-full h-full bg-cover bg-center" style="background-image:url('${esc(img)}')"></div>
                  <div class="bfr-lens-circle hidden pointer-events-none absolute z-10 w-[150px] h-[150px] rounded-full border-4 border-white shadow-2xl" style="transform:translate(-50%,-50%);background-image:url('${esc(img)}');background-size:420% 420%"></div>
                  <div class="bfr-lens-pill hidden absolute bottom-3 left-3 bg-[#0B2A22]/90 text-white text-xs font-bold px-3 py-2 rounded-full items-center gap-1">
                    ${svgIcon('eye', 14)} Looking glass · zoomed view
                  </div>
                </a>
                <div class="p-4 flex-1 flex flex-col">
                  <span class="text-xs font-extrabold text-[#C9A24B]">${esc(f.dates_label || f.best_months || f.season || '2027 Season')}</span>
                  <h3 class="font-serif text-2xl mt-1"><a href="${esc(festHref)}" class="hover:text-[#C9A24B]">${esc(festName)}</a></h3>
                  <p class="text-sm text-[var(--muted)] mt-1 flex items-center gap-1">${svgIcon('mapPin', 14)} ${esc(f.venue || f.dzongkhag || 'Bhutan')}</p>
                  <p class="text-sm mt-2 flex-1">${esc(f.summary || '')}</p>
                  <div class="flex justify-between items-center mt-4 pt-3 border-t border-[var(--line)]">
                    <a href="${esc(festHref)}" class="bg-[#0B2A22] text-white px-4 py-2 rounded-full text-sm font-bold">View Festival</a>
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
          <div class="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p class="text-[#C9A24B] font-extrabold tracking-[0.22em] text-xs">SPECIALTY EXPEDITIONS</p>
              <h2 class="font-serif text-[36px] sm:text-[54px] mt-2">Beyond standard routes.</h2>
            </div>
            <p class="max-w-[380px] text-white/75">Quiet monasteries, golden-hour photography, botanical valleys and artisan studios curated by Bhutanese locals.</p>
          </div>
          <div class="grid sm:grid-cols-2 lg:grid-cols-4 gap-5 mt-8">
            ${SPECIALTY_CARDS.map((card) => `
              <article class="bg-white/10 border border-white/15 rounded-[24px] overflow-hidden flex flex-col">
                <a href="${esc(card.href)}" class="relative h-[200px] overflow-hidden block group">
                  <img src="${esc(card.img)}" alt="${esc(card.name)}" class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105">
                  <span class="absolute bottom-3 left-3 bg-[#0B2A22]/90 text-white text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1">${svgIcon('clock', 13)} ${esc(card.dur)}</span>
                </a>
                <div class="p-4 flex-1 flex flex-col">
                  <h3 class="font-serif text-2xl">${esc(card.name)}</h3>
                  <p class="text-sm text-white/75 mt-2 flex-1">${esc(card.desc)}</p>
                  <a href="${esc(card.href)}" class="mt-4 inline-flex items-center gap-1.5 text-sm font-bold text-[#E4C87E] hover:underline">
                    Explore packages ${svgIcon('arrowUpRight', 15)}
                  </a>
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
        <p class="text-[#C9A24B] font-extrabold tracking-[0.22em] text-xs">FULL CONCIERGE COVERAGE</p>
        <h2 class="font-serif text-[36px] sm:text-[54px] mt-2">Everything handled before you land.</h2>
        <div class="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-7">
          ${SERVICES_GRID.map((svc) => `
            <a href="${esc(svc.href)}" class="bg-white border border-[var(--line)] rounded-[22px] overflow-hidden card-lift block">
              <div class="h-[150px] overflow-hidden">
                <img src="${esc(svc.img)}" alt="${esc(svc.n)}" class="w-full h-full object-cover" style="object-position:${esc(svc.pos)}">
              </div>
              <div class="p-4">
                <h3 class="font-serif text-xl font-bold text-[#0B2A22]">${esc(svc.n)}</h3>
                <p class="text-sm text-[var(--muted)] mt-1">${esc(svc.d)}</p>
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
      <section class="max-w-[1360px] mx-auto px-4 sm:px-6 pt-20">
        <div class="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p class="text-[#C9A24B] font-extrabold tracking-[0.22em] text-xs">SACRED VALLEYS</p>
            <h2 class="font-serif text-[36px] sm:text-[54px] mt-2">Six valleys in detail.</h2>
          </div>
          <a href="destinations.html" class="inline-flex items-center gap-1.5 text-sm font-extrabold text-[#0B2A22] hover:text-[#C9A24B]">
            Explore all destinations ${svgIcon('sliders', 16)}
          </a>
        </div>
        <p class="text-[var(--muted)] mt-2">Live valley guides synced with our Paro operations database.</p>

        <div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 mt-7">
          ${dests.map((d) => {
            const img = safeUrl(d.cover_image, FALLBACK_IMAGES.punakha);
            const destHref = resolveDestPageHref(d);
            return `
              <article class="bg-white border border-[var(--line)] rounded-[24px] overflow-hidden card-lift">
                <a href="${esc(destHref)}" class="block relative overflow-hidden cursor-crosshair h-[240px] bfr-lens-box" data-img="${esc(img)}">
                  <div role="img" aria-label="${esc(d.name)}" class="w-full h-full bg-cover bg-center" style="background-image:url('${esc(img)}')"></div>
                  <div class="bfr-lens-circle hidden pointer-events-none absolute z-10 w-[150px] h-[150px] rounded-full border-4 border-white shadow-2xl" style="transform:translate(-50%,-50%);background-image:url('${esc(img)}');background-size:420% 420%"></div>
                  <div class="bfr-lens-pill hidden absolute bottom-3 left-3 bg-[#0B2A22]/90 text-white text-xs font-bold px-3 py-2 rounded-full items-center gap-1">
                    ${svgIcon('eye', 14)} Looking glass · zoomed view
                  </div>
                </a>
                <div class="p-4">
                  <h3 class="font-serif text-2xl">${esc(d.name)}</h3>
                  <p class="text-xs font-extrabold text-[#C9A24B] mt-1">${esc(d.best_months || d.tagline || 'Year-round')}</p>
                  <p class="text-sm text-[var(--muted)] mt-2">${esc(d.tagline || d.description || '')}</p>
                  <a href="${esc(destHref)}" class="mt-3 inline-flex items-center gap-1 text-sm font-bold text-[#0B2A22] hover:text-[#C9A24B]">Explore valley →</a>
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
    const interestOpts = ['Trek', 'Luxury', 'Culture', 'Honeymoon', 'Birding'];
    const paceOpts = ['Balanced', 'Active'];
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
              <div class="flex justify-between text-sm font-bold"><span>Budget / person</span><span id="custBudgetVal" class="text-[#C9A24B]">$${Number(f.budget).toLocaleString('en-US')}</span></div>
              <input id="custBudget" type="range" min="1200" max="6000" step="100" value="${Number(f.budget)}" class="w-full mt-2 accent-[#0B2A22]">
            </div>
          </div>
          <div>
            <span class="text-sm font-bold block mb-1.5">Interests</span>
            <div class="flex flex-wrap gap-2">
              ${interestOpts.map((tag) => `<button type="button" data-action="toggle-interest" data-interest="${esc(tag)}" class="px-3.5 py-1.5 rounded-full text-xs font-bold border border-[var(--line)] ${f.interests.includes(tag) ? 'bg-[#0B2A22] text-white' : 'bg-[var(--cream)]'}">${esc(tag)}</button>`).join('')}
            </div>
          </div>
          <div>
            <span class="text-sm font-bold block mb-1.5">Travel Pace</span>
            <div class="flex gap-2">
              ${paceOpts.map((p) => `<button type="button" data-action="set-pace" data-pace="${esc(p)}" class="px-4 py-1.5 rounded-full text-xs font-bold border border-[var(--line)] ${f.pace === p ? 'bg-[#C9A24B] text-[#0B2A22]' : 'bg-[var(--cream)]'}">${esc(p)}</button>`).join('')}
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
        <div class="grid lg:grid-cols-2 gap-8 items-start">
          <div>
            <p class="text-[#C9A24B] font-extrabold tracking-[0.22em] text-xs">BESPOKE ITINERARY DESIGN</p>
            <h2 class="font-serif text-[36px] sm:text-[50px] leading-tight mt-2">Design a Bhutan trip around your dates.</h2>
            <p class="text-[var(--muted)] mt-3 max-w-[500px]">Share your travel window, group size, and hotel preference. Your inquiry goes directly to our licensed Paro travel concierges.</p>
            <div class="space-y-3 mt-6">
              ${[
                ['1', 'Share your idea', 'Dates, valley preferences & international USD or India INR pricing.'],
                ['2', 'Live concierge quote', 'Our team computes exact SDF & boutique lodging tiers in 2 hours.'],
                ['3', 'One-click conversion', 'Approve your custom plan and step straight into visa clearance.']
              ].map(([num, h, desc]) => `
                <div class="flex gap-3 bg-white border border-[var(--line)] rounded-2xl p-4">
                  <span class="w-8 h-8 rounded-full bg-[#0B2A22] text-[#C9A24B] grid place-items-center font-bold shrink-0">${num}</span>
                  <div><strong class="block text-sm">${esc(h)}</strong><span class="text-xs text-[var(--muted)]">${esc(desc)}</span></div>
                </div>
              `).join('')}
            </div>
            <img src="${FALLBACK_IMAGES.festival}" alt="Bhutan festival celebration" class="w-full h-[220px] object-cover rounded-[24px] mt-5 border border-[var(--line)]">
          </div>

          <div class="bg-white border border-[var(--line)] rounded-[28px] p-6 sm:p-8 shadow-sm">
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
            <h2 class="font-serif text-[36px] sm:text-[48px] mt-2">Trusted across 40+ countries.</h2>
          </div>
          <a href="reviews.html" class="text-sm font-extrabold text-[#0B2A22] hover:text-[#C9A24B]">Read all verified reviews →</a>
        </div>

        <div class="grid md:grid-cols-3 gap-5 mt-7">
          ${revs.map((r) => {
            const guestName = r.author_name || r.reviewer_name || r.guest_name || 'Verified Guest';
            const tourInfo = [r.tour_taken || r.tour_title, r.author_country].filter(Boolean).join(' · ') || 'Bhutan Journey';
            return `
            <blockquote class="bg-white border border-[var(--line)] rounded-[24px] p-6 flex flex-col justify-between">
              <div>
                <div class="text-[#C9A24B] text-sm font-bold">${'★'.repeat(Math.max(1, Math.min(5, Number(r.rating) || 5)))}</div>
                <p class="mt-3 text-sm leading-relaxed">“${esc(r.comment || r.review_text || '')}”</p>
              </div>
              <footer class="mt-5 pt-3 border-t border-[var(--line)] text-xs">
                <strong class="block text-sm text-[#0B2A22]">${esc(guestName)}</strong>
                <span class="text-[var(--muted)]">${esc(tourInfo)}</span>
              </footer>
            </blockquote>
          `;
          }).join('')}
        </div>

        <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mt-10">
          ${[
            ['Royally Licensed #TR/2018/9882', 'badgeCheck'],
            ['SDF Tax Included', 'shieldCheck'],
            ['Certified English Guides', 'shieldCheck'],
            ['Fast-Track 24–48h Visa', 'check']
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

  function renderChatWidget() {
    const box = state.chatOpen
      ? `
        <div class="fixed bottom-[84px] right-4 sm:right-5 z-50 w-[calc(100vw-32px)] max-w-[380px] bg-white rounded-[24px] shadow-2xl border border-[var(--line)] overflow-hidden flex flex-col max-h-[560px]">
          <div class="bg-[#0B2A22] text-white p-4 flex justify-between items-center">
            <div>
              <b>Bhutan Concierge</b>
              <p class="text-xs text-white/70">Ask about dates, SDF, India permits &amp; packages</p>
            </div>
            <button type="button" id="homeChatCloseBtn" aria-label="Close chat">${svgIcon('x', 18)}</button>
          </div>
          <div id="homeChatBody" class="flex-1 overflow-y-auto p-4 space-y-3">
            ${state.chatMessages.map((m) => `
              <div class="max-w-[85%] p-3 rounded-2xl text-sm ${m.who === 'ai' ? 'bg-[#FFF8EC]' : 'bg-[#0B2A22] text-white ml-auto'}">
                <p>${esc(m.text)}</p>
                ${m.linkHref ? `<a href="${esc(m.linkHref)}" class="inline-block mt-2 text-xs font-extrabold text-[#C9A24B] underline">${esc(m.linkLabel || 'View details →')}</a>` : ''}
              </div>
            `).join('')}
          </div>
          <form id="homeChatForm" class="p-3 border-t flex gap-2">
            <input id="homeChatInput" value="${esc(state.chatInput)}" placeholder="e.g. 7 days festival, India permit, trek" class="flex-1 min-w-0 border border-[var(--line)] rounded-full px-3 py-2.5 text-sm outline-none" style="color-scheme:light;color:#101613;">
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

  function bindEvents(root) {
    root.querySelectorAll('[data-mega]').forEach((el) => {
      el.addEventListener('mouseenter', () => {
        const next = el.getAttribute('data-mega');
        if (state.megaMenu !== next) {
          state.megaMenu = next;
          render();
        }
      });
    });
    const header = root.querySelector('#siteHeader');
    header?.addEventListener('mouseleave', () => {
      if (state.megaMenu) {
        state.megaMenu = null;
        render();
      }
    });

    const hero = root.querySelector('#hero');
    hero?.addEventListener('mouseenter', () => { state.heroPaused = true; });
    hero?.addEventListener('mouseleave', () => { state.heroPaused = false; });

    root.querySelectorAll('[data-action="hero-dot"]').forEach((btn) => {
      btn.addEventListener('click', () => {
        state.heroIdx = Number(btn.getAttribute('data-idx')) || 0;
        render();
      });
    });

    root.querySelector('#homeMobileOpenBtn')?.addEventListener('click', () => { state.mobileMenuOpen = true; render(); });
    root.querySelector('#homeMobileCloseBtn')?.addEventListener('click', () => { state.mobileMenuOpen = false; render(); });
    root.querySelector('#homeMobileBackdrop')?.addEventListener('click', (e) => {
      if (e.target.id === 'homeMobileBackdrop') { state.mobileMenuOpen = false; render(); }
    });
    root.querySelector('#mobileCustomLink')?.addEventListener('click', () => { state.mobileMenuOpen = false; render(); });

    const searchInput = root.querySelector('#homeSearchInput');
    searchInput?.addEventListener('input', (e) => {
      state.searchQuery = e.target.value;
      state.searchDropdownOpen = true;
      render();
      const refocused = root.querySelector('#homeSearchInput');
      if (refocused) {
        refocused.focus();
        refocused.setSelectionRange(refocused.value.length, refocused.value.length);
      }
    });
    searchInput?.addEventListener('focus', () => { state.searchDropdownOpen = true; });
    root.querySelector('#homeSearchBtn')?.addEventListener('click', () => {
      state.searchDropdownOpen = false;
      render();
      global.document.getElementById('tours')?.scrollIntoView({ behavior: 'smooth' });
    });
    root.querySelector('#homeSearchDirectGo')?.addEventListener('click', () => {
      state.searchDropdownOpen = false;
      render();
      global.document.getElementById('tours')?.scrollIntoView({ behavior: 'smooth' });
    });

    root.querySelectorAll('[data-action="quick-tag"]').forEach((btn) => {
      btn.addEventListener('click', () => {
        state.searchQuery = btn.getAttribute('data-tag') || '';
        state.searchDropdownOpen = false;
        state.megaMenu = null;
        render();
        global.document.getElementById('tours')?.scrollIntoView({ behavior: 'smooth' });
      });
    });

    root.querySelectorAll('[data-action="cat-filter"]').forEach((btn) => {
      btn.addEventListener('click', () => {
        state.category = btn.getAttribute('data-cat') || 'All';
        render();
      });
    });

    root.querySelector('#resetTourFilterBtn')?.addEventListener('click', () => {
      state.searchQuery = '';
      state.category = 'All';
      render();
    });

    root.querySelectorAll('[data-action="save-tour"]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        if (!id) return;
        state.savedIds = state.savedIds.includes(id)
          ? state.savedIds.filter((x) => x !== id)
          : [...state.savedIds, id];
        state.toastMsg = state.savedIds.includes(id) ? 'Saved to your shortlist.' : 'Removed from shortlist.';
        render();
      });
    });

    root.querySelectorAll('[data-action="compare-tour"]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        if (!id) return;
        if (state.compareIds.includes(id)) {
          state.compareIds = state.compareIds.filter((x) => x !== id);
        } else {
          state.compareIds = [...state.compareIds.slice(-1), id];
        }
        render();
      });
    });
    root.querySelector('#clearCompareBtn')?.addEventListener('click', () => { state.compareIds = []; render(); });

    // Custom Itinerary Form
    root.querySelector('#custName')?.addEventListener('input', (e) => { state.customForm.name = e.target.value; });
    root.querySelector('#custEmail')?.addEventListener('input', (e) => { state.customForm.email = e.target.value; });
    root.querySelector('#custPhone')?.addEventListener('input', (e) => { state.customForm.phone = e.target.value; });
    root.querySelector('#custDates')?.addEventListener('input', (e) => { state.customForm.dates = e.target.value; });
    root.querySelector('#custTravellers')?.addEventListener('change', (e) => { state.customForm.travellers = e.target.value; });
    root.querySelector('#custMessage')?.addEventListener('input', (e) => { state.customForm.message = e.target.value; });
    root.querySelector('#custBudget')?.addEventListener('input', (e) => {
      state.customForm.budget = Number(e.target.value) || 2400;
      const lbl = root.querySelector('#custBudgetVal');
      if (lbl) lbl.textContent = `$${state.customForm.budget.toLocaleString('en-US')}`;
    });
    root.querySelectorAll('[data-action="toggle-interest"]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const tag = btn.getAttribute('data-interest');
        if (!tag) return;
        state.customForm.interests = state.customForm.interests.includes(tag)
          ? state.customForm.interests.filter((x) => x !== tag)
          : [...state.customForm.interests, tag];
        render();
      });
    });
    root.querySelectorAll('[data-action="set-pace"]').forEach((btn) => {
      btn.addEventListener('click', () => {
        state.customForm.pace = btn.getAttribute('data-pace') || 'Balanced';
        render();
      });
    });
    root.querySelector('#homeCustomForm')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      state.customError = '';
      state.customSubmitting = true;
      render();
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
        render();
      }
    });
    root.querySelector('#customEditAgainBtn')?.addEventListener('click', () => { state.customResult = null; render(); });

    // Newsletter Inquiry
    root.querySelector('#homeNewsletterEmail')?.addEventListener('input', (e) => { state.newsletterEmail = e.target.value; });
    root.querySelector('#homeNewsletterForm')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = state.newsletterEmail.trim();
      if (!email) return;
      state.newsletterBusy = true;
      state.newsletterMsg = '';
      state.newsletterErr = '';
      render();
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
        render();
      }
    });

    // Concierge Assistant
    root.querySelector('#homeAiHeaderBtn')?.addEventListener('click', () => { state.chatOpen = true; render(); });
    root.querySelector('#homeChatToggleBtn')?.addEventListener('click', () => { state.chatOpen = !state.chatOpen; render(); });
    root.querySelector('#homeChatCloseBtn')?.addEventListener('click', () => { state.chatOpen = false; render(); });
    root.querySelector('#homeChatInput')?.addEventListener('input', (e) => { state.chatInput = e.target.value; });
    root.querySelector('#homeChatForm')?.addEventListener('submit', (e) => {
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
      render();
      const body = root.querySelector('#homeChatBody');
      if (body) body.scrollTop = body.scrollHeight;
    });

    attachLensListeners(root);
  }

  function render() {
    const root = global.document && global.document.getElementById('root');
    if (!root) return;
    root.innerHTML = `
      <div class="min-h-screen bg-[var(--cream)] text-[var(--ink)] overflow-x-clip">
        ${renderHeaderSection()}
        ${renderMobileDrawer()}
        ${renderHeroSection()}
        ${renderSearchAndTrust()}
        ${renderToursSection()}
        ${renderFestivalsSection()}
        ${renderSpecialtySection()}
        ${renderServicesMosaic()}
        ${renderDestinationsSection()}
        ${renderCustomBuilderSection()}
        ${renderReviewsAndTrust()}
        ${renderFooter()}
        ${renderChatWidget()}
      </div>
    `;
    bindEvents(root);
  }

  async function init() {
    render();
    if (!state.heroTimer) {
      state.heroTimer = global.setInterval(() => {
        if (!state.heroPaused && !state.megaMenu && !state.searchDropdownOpen) {
          state.heroIdx = (state.heroIdx + 1) % HERO_SLIDES.length;
          render();
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
