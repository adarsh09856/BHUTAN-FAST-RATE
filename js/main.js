/**
 * BHUTAN FAST RATE TOURS - Interactive Engine
 * 100% Device-Friendly, Zero Layout Conflicts
 */

// Tour Packages Dataset
const TOURS_DATA = [
  {
    id: 1,
    name: "Classic Bhutan Discovery",
    category: "Classic",
    route: "Paro • Thimphu • Punakha",
    days: 6,
    nights: 5,
    group: "Small group · max 12",
    img: "assets/images/tigers-nest.webp",
    rating: 4.9,
    reviews: 128,
    priceUSD: 1899,
    blurb: "The essential first journey — Tiger's Nest, the Great Buddha Dordenma, Punakha Dzong, and sacred Himalayan valleys.",
    highlights: ["Hike to legendary Tiger's Nest cliffside monastery", "Visit the golden Punakha Dzong at the confluence of two rivers", "Witness Dochula Pass 108 memorial chortens", "Traditional Bhutanese hot stone bath experience"],
    itinerary: [
      { day: "Day 1", title: "Arrive in Paro & Drive to Thimphu", desc: "Scenic flight over the Himalayas into Paro. Drive along the river valley to Thimphu capital. Visit Memorial Chorten and Tashichho Dzong." },
      { day: "Day 2", title: "Thimphu Spiritual & Cultural Exploration", desc: "Marvel at the 169ft Buddha Dordenma statue overlooking Thimphu valley. Explore the National Folk Heritage Museum, traditional handmade paper factory, and Centenary Farmers Market." },
      { day: "Day 3", title: "Dochula Pass to Subtropical Punakha", desc: "Cross the magnificent Dochula Pass (3,100m) with 108 chortens and Himalayan vistas. Hike to Chimi Lhakhang (Fertility Temple) and explore Punakha Dzong." },
      { day: "Day 4", title: "Punakha Suspension Bridge & Return to Paro", desc: "Walk across Bhutan's longest suspension bridge. Drive back to Paro valley. Visit the historic Kyichu Lhakhang, one of the oldest 7th-century shrines in Bhutan." },
      { day: "Day 5", title: "Pilgrimage Hike to Taktsang (Tiger's Nest)", desc: "The iconic hike ascending through pine forests draped with Spanish moss to the dramatic cliff monastery perched 900m above Paro valley." },
      { day: "Day 6", title: "Depart Paro", desc: "Transfer to Paro International Airport for your onward international flight with Drukair / Bhutan Airlines." }
    ]
  },
  {
    id: 2,
    name: "Thimphu Tshechu Festival",
    category: "Festival",
    route: "Thimphu • Paro • Punakha",
    days: 7,
    nights: 6,
    group: "Festival group · max 14",
    img: "assets/images/thimphu-festival.webp",
    rating: 5.0,
    reviews: 94,
    priceUSD: 2499,
    blurb: "Experience Bhutan's grandest annual religious festival with sacred cham masked dances, royal blessings, and silk thongdrels.",
    highlights: ["Full VIP seating at Tashichho Dzong festival courtyard", "Sacred Cham masked dances performed by monks and laymen", "Unfurling of the giant Guru Tshengye silk thongdrel", "Tiger's Nest monastery pilgrimage hike"],
    itinerary: [
      { day: "Day 1", title: "Arrival in Paro, Transfer to Thimphu", desc: "Welcome reception at Paro airport. Scenic transfer to Thimphu. Festival briefing and evening stroll in Clock Tower Square." },
      { day: "Day 2", title: "Thimphu Tshechu Day 1", desc: "Immerse in the vibrant colors of Tashichho Dzong courtyard. Witness the Dance of the Black Hats (Shanag) and sacred purification rites." },
      { day: "Day 3", title: "Thimphu Tshechu Day 2 & Artisan Guilds", desc: "Morning festival dances including the Dance of the Eight Manifestations of Guru Rinpoche. Afternoon visit to the Zorig Chusum Institute of 13 Arts." },
      { day: "Day 4", title: "Dochula Pass & Punakha Dzong", desc: "Drive to Punakha via Dochula Pass (108 chortens). Visit Punakha Dzong, the winter palace of the Central Monastic Body." },
      { day: "Day 5", title: "Scenic Return to Paro & Farmstay Dinner", desc: "Return to Paro. Visit the National Museum (Ta Dzong). Authentic Bhutanese farmhouse dinner with local Ara liquor tasting." },
      { day: "Day 6", title: "Taktsang (Tiger's Nest) Pilgrimage", desc: "Full day pilgrimage hike to Tiger's Nest. Evening celebratory Bhutanese archery contest demonstration." },
      { day: "Day 7", title: "Paro Departure", desc: "Tashi Delek farewell and airport transfer." }
    ]
  },
  {
    id: 3,
    name: "Luxury Himalayan Escape",
    category: "Luxury",
    route: "Paro • Thimphu • Punakha • Phobjikha",
    days: 8,
    nights: 7,
    group: "Private VIP Tour · 2-6 guests",
    img: "assets/images/punakha-dzong.webp",
    rating: 5.0,
    reviews: 62,
    priceUSD: 4850,
    blurb: "Ultra-luxury five-star lodges (Amankora & Six Senses), private helicopter mountain transfers, gourmet Bhutanese dining, and master guides.",
    highlights: ["Stay at world-renowned 5-star Amankora and Six Senses lodges", "Helicopter scenic flight over Mt. Jomolhari glaciers", "Private dinner inside a 17th-century candlelit fortress courtyard", "Daily rejuvenating spa therapies and mineral hot stone baths"],
    itinerary: [
      { day: "Day 1", title: "VIP Airport Arrival & Amankora Thimphu", desc: "Private customs clearance at Paro. Luxury Mercedes transfer to Amankora Thimphu set in blue pine forests. Evening welcome spa ritual." },
      { day: "Day 2", title: "Private Audience & Cultural Heritage", desc: "Exclusive monastery tour guided by a senior Buddhist scholar. Private butter lamp lighting ceremony at Pangri Zampa astrological college." },
      { day: "Day 3", title: "Helicopter Transfer to Punakha Valley", desc: "Private helicopter flight over Dochula Pass. Check-in to Six Senses Punakha 'Flying Farmhouse' overlooking terraced rice paddies." },
      { day: "Day 4", title: "Punakha Private Dzong Tour & Mo Chhu Rafting", desc: "Private access to inner sanctums of Punakha Dzong. Gentle private river drift down the pristine turquoise Mo Chhu." },
      { day: "Day 5", title: "Phobjikha Glacial Valley", desc: "Drive across mountain passes into the high Phobjikha valley. Evening black-necked crane sanctuary private viewing and luxury lodge fireplace tasting." },
      { day: "Day 6", title: "Return to Paro Valley & Six Senses Paro", desc: "Scenic return drive to Paro. Check into Six Senses Paro 'Stone Ruins'. Traditional herb bath and sunset meditation." },
      { day: "Day 7", title: "Private Tiger's Nest Ascent with Champagne Brunch", desc: "Early morning private guided trek to Tiger's Nest. Private champagne brunch served at the scenic mountain pavilion." },
      { day: "Day 8", title: "Paro Departure", desc: "Private luxury transfer to Paro International Airport." }
    ]
  },
  {
    id: 4,
    name: "Bhutan Honeymoon Romance",
    category: "Honeymoon",
    route: "Paro • Thimphu • Punakha",
    days: 7,
    nights: 6,
    group: "Private Couple Journey",
    img: "assets/images/dochula-pass.webp",
    rating: 4.9,
    reviews: 58,
    priceUSD: 2799,
    blurb: "Romantic couple's getaway featuring private candlelit dzong dinners, couples herbal hot stone baths, and monastic union blessings.",
    highlights: ["Monk couple blessing ceremony for eternal longevity and happiness", "Private couples herbal hot stone bath with champagne", "Romantic candlelight riverside dinner in Punakha", "Private photographer for Tiger's Nest pilgrimage"],
    itinerary: [
      { day: "Day 1", title: "Arrival in Paro & Thimphu Boutique Hotel", desc: "Couple welcome with traditional khadar white scarves. Transfer to romantic boutique suite in Thimphu." },
      { day: "Day 2", title: "Thimphu Monastic Couple's Blessing", desc: "Private Buddhist union blessing performed by head lamas at Cheri Monastery. Sunset views from Buddha Dordenma." },
      { day: "Day 3", title: "Dochula 108 Chortens & Punakha Valley", desc: "Scenic journey over Dochula Pass. Evening romantic candlelight dinner by the riverside in Punakha." },
      { day: "Day 4", title: "Punakha Dzong & Chimi Lhakhang", desc: "Explore the fairytale Punakha palace fortress and hike to Chimi Lhakhang temple through emerald green paddy terraces." },
      { day: "Day 5", title: "Return to Paro & Traditional Farmhouse Spa", desc: "Return to Paro. Indulge in an authentic Bhutanese Artemisia hot-stone bath heated by river stones, followed by local Ara toast." },
      { day: "Day 6", title: "Tiger's Nest Hike with Couple Portrait Session", desc: "Ascend to Tiger's Nest with professional portrait session. Celebratory evening farewell dinner." },
      { day: "Day 7", title: "Paro Departure", desc: "Transfer to airport for departure." }
    ]
  },
  {
    id: 5,
    name: "Druk Path High Trek",
    category: "Trekking",
    route: "Paro • Jele Dzong • Jimilangtsho • Phajoding • Thimphu",
    days: 9,
    nights: 8,
    group: "Trek group · max 10",
    img: "assets/images/tigers-nest.webp",
    rating: 4.8,
    reviews: 76,
    priceUSD: 2199,
    blurb: "Bhutan's most celebrated alpine trek across virgin ridgelines, crystal mountain lakes, rhododendron forests, and ancient fortress ruins.",
    highlights: ["Camp beside crystal-clear high altitude trout lakes", "Spectacular views of Mt. Gangkar Puensum (highest unclimbed peak in the world)", "All camping gear, yaks/pack ponies, and private trekking chef included", "Hike to Tiger's Nest for acclimatization"],
    itinerary: [
      { day: "Day 1", title: "Arrive Paro & Acclimatization", desc: "Arrive in Paro valley (2,280m). Visit Paro Dzong and scenic orientation walk." },
      { day: "Day 2", title: "Tiger's Nest Acclimatization Hike", desc: "Acclimatization trek to Taktsang Monastery (3,120m)." },
      { day: "Day 3", title: "Trek Start: Paro to Jele Dzong", desc: "Ascend through alpine forests to Jele Dzong camp (3,480m) with panoramic Paro valley views." },
      { day: "Day 4", title: "Jele Dzong to Jangchulakha", desc: "Trek along high mountain ridge through rhododendron meadows to Jangchulakha (3,770m)." },
      { day: "Day 5", title: "Jangchulakha to Jimilangtsho Lake", desc: "Follow the ridgeline to the sacred alpine lake of Jimilangtsho (3,870m), famed for giant trout." },
      { day: "Day 6", title: "Jimilangtsho to Simkotra Tsho", desc: "Trail winds through dwarf rhododendrons to Simkotra Tsho lake (4,110m)." },
      { day: "Day 7", title: "Simkotra Tsho over Phume La to Phajoding", desc: "Cross Phume La pass (4,210m) with sweeping views of the Himalayan divide. Descend to Phajoding Monastery." },
      { day: "Day 8", title: "Descend to Thimphu & Celebration Dinner", desc: "Gentle morning descent through pine forests into Thimphu. Check into hotel and evening hot stone bath." },
      { day: "Day 9", title: "Thimphu to Paro Airport Departure", desc: "Transfer to Paro airport for outbound flight." }
    ]
  },
  {
    id: 6,
    name: "Family Himalayan Adventure",
    category: "Family",
    route: "Paro • Thimphu • Punakha",
    days: 6,
    nights: 5,
    group: "Family friendly · all ages",
    img: "assets/images/punakha-dzong.webp",
    rating: 4.9,
    reviews: 82,
    priceUSD: 1750,
    blurb: "Tailored for multi-generational families with gentle nature walks, interactive archery lessons, traditional mask painting, and pony rides.",
    highlights: ["Traditional archery (Dha) lessons with master archers", "Gentle family pony ride option towards Tiger's Nest view pavilion", "Hands-on Bhutanese paper and traditional mask making workshop", "Spacious family suite accommodations throughout"],
    itinerary: [
      { day: "Day 1", title: "Welcome to Bhutan & Thimphu", desc: "Gentle introduction to Bhutanese culture. Visit Takin Preserve to meet the national animal." },
      { day: "Day 2", title: "Crafts, Archery & Giant Buddha", desc: "Interactive painting and paper making workshops. Family archery contest in the park. Visit Buddha Dordenma." },
      { day: "Day 3", title: "Dochula Pass & Punakha Nature Trail", desc: "Cross Dochula Pass. Gentle nature hike to Chimi Lhakhang through rice fields." },
      { day: "Day 4", title: "Punakha Dzong & Suspension Bridge Fun", desc: "Explore the riverside palace of Punakha. Walk the long suspension bridge and picnic by the river." },
      { day: "Day 5", title: "Paro & Family Tiger's Nest Hike", desc: "Family-paced hike with pony ride option to cafeteria viewpoint. Evening celebration." },
      { day: "Day 6", title: "Paro Departure", desc: "Farewell and transfer to Paro airport." }
    ]
  },
  {
    id: 7,
    name: "Phobjikha Valley & Birding Journey",
    category: "Adventure",
    route: "Paro • Thimphu • Punakha • Phobjikha",
    days: 8,
    nights: 7,
    group: "Nature enthusiasts · max 12",
    img: "assets/images/phobjikha-cranes.webp",
    rating: 4.8,
    reviews: 51,
    priceUSD: 2250,
    blurb: "Explore the wide glacial bowl of Phobjikha, winter home to the endangered Black-necked Cranes, Gangtey Monastery, and ancient pine trails.",
    highlights: ["Observatory viewing of rare Black-necked Cranes", "Scenic Gangtey Nature Trail hike through dwarf bamboo valleys", "Visit the historic 17th-century Gangtey Goempa monastery", "Stargazing in one of Asia's darkest, most pristine night skies"],
    itinerary: [
      { day: "Day 1", title: "Arrive Paro, Transfer to Thimphu", desc: "Arrival reception and orientation. Evening birding walk near Motithang." },
      { day: "Day 2", title: "Thimphu to Punakha via Dochula", desc: "Dochula Pass birding (blood pheasants, laughingthrushes). Visit Punakha Dzong." },
      { day: "Day 3", title: "Journey into Phobjikha Valley", desc: "Ascend Pele La pass and drop into the glacial valley of Phobjikha. Visit Black-Necked Crane Education Center." },
      { day: "Day 4", title: "Gangtey Nature Trail & Village Life", desc: "Scenic 3-hour hike through flower meadows and pine woods. Evening homestay tea with local villagers." },
      { day: "Day 5", title: "Gangtey Monastery & High Pass Return to Paro", desc: "Morning prayer chanting at Gangtey Goempa. Scenic drive back to Paro valley." },
      { day: "Day 6", title: "Paro Tiger's Nest Pilgrimage", desc: "Iconic hike to Taktsang Monastery." },
      { day: "Day 7", title: "Chele La Pass (Highest Motorroad in Bhutan)", desc: "Drive to Chele La (3,988m) with panoramic views of Mt. Jomolhari and Himalayan monal pheasants." },
      { day: "Day 8", title: "Paro Departure", desc: "Airport transfer for departure flight." }
    ]
  },
  {
    id: 8,
    name: "Culture + Mo Chhu Rafting",
    category: "Adventure",
    route: "Paro • Thimphu • Punakha",
    days: 7,
    nights: 6,
    group: "Explorer group · max 12",
    img: "assets/images/punakha-dzong.webp",
    rating: 4.9,
    reviews: 67,
    priceUSD: 1999,
    blurb: "The ultimate balance of rich Buddhist culture and scenic river rafting down the emerald waters of Punakha valley.",
    highlights: ["Class II-III river rafting on the scenic Mo Chhu river passing Punakha Dzong", "Hike to Khamsum Yulley Namgyal Chorten high above the valley", "Hike to Tiger's Nest cliffside monastery", "Explore capital Thimphu's living arts and weekend markets"],
    itinerary: [
      { day: "Day 1", title: "Arrive Paro, Drive to Thimphu", desc: "Welcome to Bhutan. Drive to Thimphu, visit Tashichho Dzong." },
      { day: "Day 2", title: "Thimphu Highlights", desc: "Buddha Dordenma, Painting School, and Centenary Farmers Market." },
      { day: "Day 3", title: "Dochula to Punakha Valley", desc: "Cross Dochula Pass. Hike to Chimi Lhakhang temple." },
      { day: "Day 4", title: "Mo Chhu River Rafting & Punakha Dzong", desc: "Exciting 12km raft descent past scenic villages and beneath the towers of Punakha Dzong." },
      { day: "Day 5", title: "Khamsum Yulley Chorten & Return to Paro", desc: "Morning hike to majestic 4-story Khamsum Yulley Namgyal Chorten. Drive to Paro." },
      { day: "Day 6", title: "Taktsang (Tiger's Nest) Pilgrimage", desc: "Full day hike to Tiger's Nest monastery." },
      { day: "Day 7", title: "Paro Departure", desc: "Transfer to airport for outbound flight." }
    ]
  }
];

// Festivals Dataset
const FESTIVALS_DATA = [
  {
    name: "Thimphu Tshechu",
    dates: "Sep 2027 · 3 Festival Days",
    place: "Tashichho Dzong, Thimphu",
    img: "assets/images/thimphu-festival.webp",
    price: "$2,499",
    desc: "The capital's most celebrated masked-dance festival. Monks perform sacred Cham dances believed to cleanse sins and bestow merit."
  },
  {
    name: "Paro Tshechu",
    dates: "Mar 2027 · Spring Festival",
    place: "Rinpung Dzong, Paro",
    img: "assets/images/tigers-nest.webp",
    price: "$2,599",
    desc: "Bhutan's most popular spring festival featuring the pre-dawn unfurling of the giant 400-year-old silk Guru Thongdrel."
  },
  {
    name: "Punakha Drubchen",
    dates: "Feb 2027 · Winter Festival",
    place: "Punakha Dzong, Punakha",
    img: "assets/images/punakha-dzong.webp",
    price: "$2,299",
    desc: "A dramatic historical re-enactment of the 17th-century Tibetan invasion victory, performed by local pazaps (militiamen)."
  },
  {
    name: "Jambay Lhakhang Drup",
    dates: "Oct 2027 · Central Bhutan",
    place: "Jambay Temple, Bumthang",
    img: "assets/images/dochula-pass.webp",
    price: "$2,799",
    desc: "Famed for the sacred midnight fire dance (Mewang) and Tercham (Dance of Treasure) in the spiritual heartland of Bumthang."
  }
];

// Currency Exchange Rates (Base USD)
const CURRENCIES = {
  USD: { symbol: "$", rate: 1 },
  BTN: { symbol: "Nu. ", rate: 86.5 },
  INR: { symbol: "₹", rate: 86.5 },
  EUR: { symbol: "€", rate: 0.92 },
  GBP: { symbol: "£", rate: 0.79 }
};

let currentCurrency = 'USD';

// Format Price
function formatPrice(usdAmount) {
  const c = CURRENCIES[currentCurrency] || CURRENCIES.USD;
  const converted = Math.round(usdAmount * c.rate);
  return `${c.symbol}${converted.toLocaleString()}`;
}

// Global Toast
function showToast(message) {
  let toast = document.getElementById('tourToast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'tourToast';
    toast.className = 'tour-toast';
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => {
    toast.classList.remove('show');
  }, 3500);
}

// Hero Carousel Engine
let currentSlide = 0;
let carouselTimer = null;

function initHeroCarousel() {
  const slides = document.querySelectorAll('.carousel-slide');
  const dots = document.querySelectorAll('.slider-dot');
  if (!slides.length) return;

  function goToSlide(index) {
    slides.forEach((s, i) => {
      s.classList.toggle('active', i === index);
    });
    dots.forEach((d, i) => {
      d.classList.toggle('active', i === index);
    });
    currentSlide = index;
  }

  window.prevSlide = function() {
    let next = (currentSlide - 1 + slides.length) % slides.length;
    goToSlide(next);
  };

  window.nextSlide = function() {
    let next = (currentSlide + 1) % slides.length;
    goToSlide(next);
  };

  window.setSlide = function(index) {
    goToSlide(index);
  };

  carouselTimer = setInterval(() => {
    window.nextSlide();
  }, 6000);

  const heroWrap = document.querySelector('.hero-carousel-wrap');
  if (heroWrap) {
    heroWrap.addEventListener('mouseenter', () => clearInterval(carouselTimer));
    heroWrap.addEventListener('mouseleave', () => {
      carouselTimer = setInterval(() => window.nextSlide(), 6000);
    });
  }
}

// Render Tour Cards
function renderTourCards(category = 'All', containerId = 'toursGrid') {
  const container = document.getElementById(containerId);
  if (!container) return;

  const filtered = category === 'All' 
    ? TOURS_DATA 
    : TOURS_DATA.filter(t => t.category.toLowerCase() === category.toLowerCase());

  container.innerHTML = filtered.map(t => `
    <article class="tour-card" data-category="${t.category}">
      <div class="tour-card-thumb-wrap">
        <img src="${t.img}" alt="${t.name}" class="tour-card-thumb" loading="lazy">
        <span class="tour-badge-cat">${t.category}</span>
        <span class="tour-badge-days">⏱️ ${t.days}D / ${t.nights}N</span>
      </div>
      <div class="tour-card-body">
        <div class="tour-rating-row">
          <span>★ ${t.rating}</span>
          <span>(${t.reviews} reviews)</span>
          <span>• ${t.group}</span>
        </div>
        <h3 class="tour-card-title">${t.name}</h3>
        <p class="tour-route-line">📍 ${t.route}</p>
        <p class="tour-blurb">${t.blurb}</p>
        <div class="tour-card-footer">
          <div class="tour-price-block">
            <span class="price-sub">Starting From</span>
            <span class="price-amt" data-price-usd="${t.priceUSD}">${formatPrice(t.priceUSD)}</span>
          </div>
          <button type="button" class="btn-card-itinerary" onclick="openItineraryModal(${t.id})">
            View Itinerary &rarr;
          </button>
        </div>
      </div>
    </article>
  `).join('');
}

// Category Tabs Filter
function initCategoryFilter() {
  const buttons = document.querySelectorAll('.cat-tab-btn');
  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      buttons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const cat = btn.getAttribute('data-cat') || 'All';
      renderTourCards(cat);
    });
  });
}

// Open Itinerary Modal
window.openItineraryModal = function(tourId) {
  const tour = TOURS_DATA.find(t => t.id === tourId);
  if (!tour) return;

  const modal = document.getElementById('itineraryModal');
  if (!modal) return;

  const modalContent = document.getElementById('itineraryModalContent');
  modalContent.innerHTML = `
    <img src="${tour.img}" alt="${tour.name}" class="modal-hero-thumb">
    <div class="modal-content-body">
      <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 10px; margin-bottom: 12px;">
        <div>
          <span class="tour-badge-cat" style="position: static; display: inline-block; margin-bottom: 8px;">${tour.category} Tour</span>
          <h2 style="font-family: var(--font-serif); font-size: 1.8rem; color: var(--forest);">${tour.name}</h2>
          <p style="color: var(--muted); font-size: 0.9rem; font-weight: 600;">📍 ${tour.route} • ${tour.days} Days / ${tour.nights} Nights</p>
        </div>
        <div style="text-align: right;">
          <span style="font-size: 0.75rem; color: var(--muted); text-transform: uppercase; font-weight: 700; display: block;">All Inclusive From</span>
          <span style="font-family: var(--font-serif); font-size: 1.8rem; font-weight: 800; color: var(--forest);">${formatPrice(tour.priceUSD)}</span>
          <span style="font-size: 0.75rem; color: var(--muted); display: block;">Per Person (includes $100/day SDF)</span>
        </div>
      </div>

      <div style="margin: 20px 0; padding: 16px; background: var(--cream); border-radius: var(--radius-sm); border-left: 4px solid var(--gold);">
        <h4 style="font-size: 0.92rem; font-weight: 800; color: var(--forest); margin-bottom: 8px;">Journey Highlights</h4>
        <ul style="list-style: none; display: flex; flex-direction: column; gap: 6px; font-size: 0.86rem; color: var(--ink);">
          ${tour.highlights.map(h => `<li>✨ ${h}</li>`).join('')}
        </ul>
      </div>

      <h3 style="font-family: var(--font-serif); font-size: 1.3rem; color: var(--forest); margin-bottom: 16px;">Day-by-Day Detailed Itinerary</h3>
      <div style="display: flex; flex-direction: column; gap: 16px; margin-bottom: 30px;">
        ${tour.itinerary.map(item => `
          <div style="display: flex; gap: 14px; padding-bottom: 14px; border-bottom: 1px solid var(--line);">
            <div style="flex-shrink: 0; width: 68px; height: 32px; background: var(--forest); color: var(--gold2); border-radius: 4px; display: flex; align-items: center; justify-content: center; font-size: 0.78rem; font-weight: 800;">
              ${item.day}
            </div>
            <div>
              <h4 style="font-size: 0.95rem; font-weight: 800; color: var(--forest); margin-bottom: 4px;">${item.title}</h4>
              <p style="font-size: 0.85rem; color: #4b5563; line-height: 1.5;">${item.desc}</p>
            </div>
          </div>
        `).join('')}
      </div>

      <div style="display: flex; gap: 12px; justify-content: flex-end; flex-wrap: wrap;">
        <button type="button" class="btn-sdf-calc" onclick="closeModal('itineraryModal'); openSdfModal();">
          Calculate SDF & Fees
        </button>
        <button type="button" class="btn-gold-cta" onclick="closeModal('itineraryModal'); openBookingModal('${tour.name}', ${tour.priceUSD});">
          Book This Package Now &rarr;
        </button>
      </div>
    </div>
  `;

  modal.classList.add('open');
};

// Booking Modal
window.openBookingModal = function(tourName = 'Classic Bhutan Discovery', priceUSD = 1899) {
  const modal = document.getElementById('bookingModal');
  if (!modal) return;

  const pkgInput = document.getElementById('bookingPkgName');
  if (pkgInput) pkgInput.value = tourName;

  const priceSpan = document.getElementById('bookingEstPrice');
  if (priceSpan) priceSpan.textContent = formatPrice(priceUSD);

  modal.classList.add('open');
};

// Close Modal Helper
window.closeModal = function(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.classList.remove('open');
};

// SDF Calculator Engine
function calculateSdf() {
  const nights = parseInt(document.getElementById('sdfNights')?.value || '5', 10);
  const adults = parseInt(document.getElementById('sdfAdults')?.value || '2', 10);
  const children = parseInt(document.getElementById('sdfKids')?.value || '0', 10);
  const nationality = document.getElementById('sdfNationality')?.value || 'international';

  let adultDailyFee = 100; // USD per night
  let childDailyFee = 50;  // 50% for 6-12 years

  if (nationality === 'indian') {
    adultDailyFee = 14; // Approx USD equivalent for Nu. 1,200
    childDailyFee = 7;  // Nu. 600
  }

  const totalSdfUsd = ((adults * adultDailyFee) + (children * childDailyFee)) * nights;
  
  const resultDisplay = document.getElementById('sdfResultDisplay');
  if (resultDisplay) {
    if (nationality === 'indian') {
      const inNu = ((adults * 1200) + (children * 600)) * nights;
      resultDisplay.textContent = `Nu. ${inNu.toLocaleString()}`;
    } else {
      resultDisplay.textContent = formatPrice(totalSdfUsd);
    }
  }

  const resultNote = document.getElementById('sdfResultNote');
  if (resultNote) {
    resultNote.textContent = `${adults} adult(s), ${children} child(ren) for ${nights} nights in the Kingdom of Bhutan.`;
  }
}

// Mobile Drawer Toggle
function initMobileDrawer() {
  const toggleBtn = document.getElementById('menuToggleBtn');
  const drawer = document.getElementById('mobileDrawer');
  const overlay = document.getElementById('mobileOverlay');
  const closeBtn = document.getElementById('drawerCloseBtn');

  if (!toggleBtn || !drawer || !overlay) return;

  function openDrawer() {
    drawer.classList.add('open');
    overlay.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function closeDrawer() {
    drawer.classList.remove('open');
    overlay.classList.remove('open');
    document.body.style.overflow = '';
  }

  toggleBtn.addEventListener('click', openDrawer);
  if (closeBtn) closeBtn.addEventListener('click', closeDrawer);
  overlay.addEventListener('click', closeDrawer);

  const links = drawer.querySelectorAll('.drawer-nav-link');
  links.forEach(l => l.addEventListener('click', closeDrawer));
}

// Currency Switcher
function initCurrencySwitcher() {
  const switchers = document.querySelectorAll('.currency-picker');
  switchers.forEach(sw => {
    sw.addEventListener('change', (e) => {
      currentCurrency = e.target.value;
      // Re-render prices on page
      document.querySelectorAll('[data-price-usd]').forEach(el => {
        const usd = parseFloat(el.getAttribute('data-price-usd'));
        if (!isNaN(usd)) {
          el.textContent = formatPrice(usd);
        }
      });
      calculateSdf();
      showToast(`Currency changed to ${currentCurrency}`);
    });
  });
}

// Search Filter Form Submit
function initSearchFilter() {
  const searchForm = document.getElementById('tourSearchForm');
  if (!searchForm) return;

  searchForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const dest = document.getElementById('filterDestination')?.value || '';
    const season = document.getElementById('filterSeason')?.value || '';
    const style = document.getElementById('filterStyle')?.value || '';

    let results = TOURS_DATA;
    if (style && style !== 'all') {
      results = results.filter(t => t.category.toLowerCase() === style.toLowerCase());
    }
    if (dest && dest !== 'all') {
      results = results.filter(t => t.route.toLowerCase().includes(dest.toLowerCase()));
    }

    const container = document.getElementById('toursGrid');
    if (container) {
      if (results.length === 0) {
        container.innerHTML = `
          <div style="grid-column: 1/-1; text-align: center; padding: 60px 20px; background: #fff; border-radius: var(--radius-md); border: 1px solid var(--line);">
            <h3 style="font-family: var(--font-serif); font-size: 1.4rem; color: var(--forest);">No exact tours found</h3>
            <p style="color: var(--muted); margin: 8px 0 20px;">Try adjusting your filters, or request a custom itinerary tailored for your dates.</p>
            <button type="button" class="btn-gold-cta" onclick="renderTourCards('All');">Reset Filters</button>
          </div>
        `;
      } else {
        renderTourCards(style === 'all' ? 'All' : style);
        container.scrollIntoView({ behavior: 'smooth' });
      }
    }
    showToast(`Found ${results.length} tour(s) matching your criteria.`);
  });
}

// Booking Form Submit
function initBookingForm() {
  const form = document.getElementById('bookingModalForm');
  if (!form) return;

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = form.querySelector('[name="clientName"]')?.value;
    const email = form.querySelector('[name="clientEmail"]')?.value;
    const pkg = document.getElementById('bookingPkgName')?.value || 'Tour Package';

    closeModal('bookingModal');
    showToast(`Thank you ${name}! Your inquiry for "${pkg}" has been received. Our Paro travel specialist will contact ${email} within 2 hours.`);
    form.reset();
  });
}

// Initialize on DOM Ready
document.addEventListener('DOMContentLoaded', () => {
  initHeroCarousel();
  renderTourCards('All');
  initCategoryFilter();
  initMobileDrawer();
  initCurrencySwitcher();
  initSearchFilter();
  initBookingForm();

  // Attach SDF calculator listeners
  ['sdfNights', 'sdfAdults', 'sdfKids', 'sdfNationality'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', calculateSdf);
  });
  calculateSdf();
});
