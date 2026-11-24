const fs = require('fs');
const path = require('path');

function getSeedData() {
  const users = [
    {
      uuid: 'usr-admin-001',
      full_name: 'Sonam Dorji (Managing Director)',
      email: 'admin@bhutanfastratetours.bt',
      phone: '+975 17 654 321',
      password_hash: 'admin123', // In production hashed with bcrypt
      role: 'super_admin'
    },
    {
      uuid: 'usr-concierge-001',
      full_name: 'Dechen Wangmo (Lead Concierge)',
      email: 'dechen@bhutanfastratetours.bt',
      phone: '+975 17 888 999',
      password_hash: 'concierge123',
      role: 'concierge'
    },
    {
      uuid: 'usr-guide-001',
      full_name: 'Kinley Tshering (Senior Certified Cultural & Trekking Guide)',
      email: 'kinley@bhutanfastratetours.bt',
      phone: '+975 77 123 456',
      password_hash: 'guide123',
      role: 'guide'
    }
  ];

  const settings = [
    { key: 'company_name', value: 'Bhutan Fast Rate Tours', category: 'general', description: 'Official Business Name' },
    { key: 'company_license', value: 'TR/2018/9882', category: 'general', description: 'Department of Tourism License' },
    { key: 'company_email', value: 'reservations@bhutanfastratetours.bt', category: 'general', description: 'Central Booking Desk' },
    { key: 'company_phone', value: '+975 17 654 321', category: 'general', description: '24/7 Hotline' },
    { key: 'company_whatsapp', value: '+97517654321', category: 'general', description: 'WhatsApp Direct Connect' },
    { key: 'sdf_rate_international', value: '100', category: 'pricing', description: 'SDF per adult per night (USD)' },
    { key: 'sdf_rate_india', value: '1200', category: 'pricing', description: 'SDF per person per night (INR)' },
    { key: 'sdf_child_6_12_discount', value: '50', category: 'pricing', description: 'Percentage discount for children 6-12' },
    { key: 'sdf_child_under_6_exempt', value: '1', category: 'pricing', description: '1 = Children under 6 pay $0 SDF' },
    { key: 'sdf_waiver_active', value: '0', category: 'pricing', description: '0 = Standard, 1 = Govt promo active' },
    { key: 'sdf_waiver_percent', value: '0', category: 'pricing', description: 'Active waiver discount %' },
    { key: 'visa_fee_usd', value: '40', category: 'pricing', description: 'One-time government visa application fee' }
  ];

  const destinations = [
    {
      id: 'paro',
      name: 'Paro Valley',
      slug: 'destination-paro.html',
      tagline: 'Gateway to the Kingdom & The Sacred Tiger’s Nest',
      altitude_meters: 2280,
      region: 'Western',
      description: 'Home to Bhutan’s only international airport, historic Paro Valley is framed by golden willow trees, sacred 7th-century monasteries, and the breathtaking Paro Taktsang (Tiger’s Nest) cliffside shrine.',
      highlights_json: JSON.stringify(['Paro Taktsang (Tiger’s Nest)', 'Rinpung Dzong Fortress', 'National Museum (Ta Dzong)', 'Kyichu Lhakhang (7th Century Temple)', 'Chele La High Alpine Pass (3,988m)']),
      best_months: 'Mar - May, Sep - Nov',
      cover_image: 'assets/images/tigers-nest.webp',
      sort_order: 1
    },
    {
      id: 'thimphu',
      name: 'Thimphu Capital',
      slug: 'destination-thimphu.html',
      tagline: 'The World’s Only Traffic-Light-Free Capital City',
      altitude_meters: 2334,
      region: 'Western',
      description: 'The political and cultural heartbeat of Bhutan where ancient monastic traditions harmonize with modern Gross National Happiness governance. Overlooked by the colossal 169ft Buddha Dordenma.',
      highlights_json: JSON.stringify(['Buddha Dordenma (Giant Buddha Point)', 'Tashichho Dzong Throne Room', 'National Memorial Chorten', 'Centenary Farmers Market & Craft Bazaar', 'Royal Takin Preserve']),
      best_months: 'Year-Round (Festivals in Sep/Oct)',
      cover_image: 'assets/images/thimphu-festival.webp',
      sort_order: 2
    },
    {
      id: 'punakha',
      name: 'Punakha Valley',
      slug: 'destination-punakha.html',
      tagline: 'Subtropical Valley of Great Happiness & Ancient Emperors',
      altitude_meters: 1242,
      region: 'Western',
      description: 'Bhutan’s ancient winter capital nestled along the confluence of the Pho Chhu (father) and Mo Chhu (mother) rivers. Famous for the majestic Punakha Dzong and year-round balmy climate.',
      highlights_json: JSON.stringify(['Punakha Dzong (Palace of Great Bliss)', 'Longest Suspension Bridge in Bhutan', 'Chimi Lhakhang (Fertility Temple)', 'Khamsum Yulley Namgyal Chorten', 'Gentle River Rafting']),
      best_months: 'Sep - May',
      cover_image: 'assets/images/punakha-dzong.webp',
      sort_order: 3
    },
    {
      id: 'phobjikha',
      name: 'Phobjikha Valley (Gangtey)',
      slug: 'destination-phobjikha.html',
      tagline: 'U-Shaped Glacial Sanctuary of Black-Necked Cranes',
      altitude_meters: 3000,
      region: 'Western/Central',
      description: 'A wide, road-free glacial valley protected as an ecological sanctuary. Each winter, endangered Tibetan Black-Necked Cranes circle Gangtey Monastery three times before settling in the wetlands.',
      highlights_json: JSON.stringify(['Gangtey Gompa Monastery (17th C)', 'Black-Necked Crane Conservation Center', 'Gangtey Nature Nature Trail (Pine & Bamboo)', 'Traditional Farmhouse Homestays']),
      best_months: 'Oct - Mar (Cranes in Valley)',
      cover_image: 'assets/images/phobjikha-cranes.webp',
      sort_order: 4
    },
    {
      id: 'bumthang',
      name: 'Bumthang Valley',
      slug: 'destination-bumthang.html',
      tagline: 'The Spiritual Heartland & Cradle of Buddhism',
      altitude_meters: 2600,
      region: 'Central',
      description: 'Consisting of four sacred valleys (Choekhor, Tang, Ura, and Chhume), Bumthang contains Bhutan’s oldest temples where Guru Rinpoche cured the local king in the 8th century.',
      highlights_json: JSON.stringify(['Jambay Lhakhang (Built 659 AD)', 'Kurjey Lhakhang (Guru Body Imprint)', 'Tamshing Monastery', 'Mebar Tsho (Burning Lake)', 'Swiss Farm Cheese & Red Panda Beer']),
      best_months: 'Mar - May, Sep - Nov',
      cover_image: 'assets/images/dochula-pass.webp',
      sort_order: 5
    },
    {
      id: 'haa',
      name: 'Haa Valley',
      slug: 'destination-haa.html',
      tagline: 'The Pristine Alpine Frontier Over Chele La Pass',
      altitude_meters: 2712,
      region: 'Western',
      description: 'Only opened to international tourism in 2002, Haa remains Bhutan’s most authentic, pristine valley, famous for the sacred White and Black Temples and high altitude nomadic yaks.',
      highlights_json: JSON.stringify(['Lhakhang Karpo (White Temple)', 'Lhakhang Nagpo (Black Temple)', 'Chele La Pass (Highest Motor Road 3,988m)', 'Meri Puensum Three Sacred Hills', 'Yangthang Village Heritage Walks']),
      best_months: 'Apr - Jun, Sep - Nov',
      cover_image: 'assets/images/dochula-pass.webp',
      sort_order: 6
    }
  ];

  const tours = [
    {
      id: 'essential-bhutan-7d',
      title: 'Essential Bhutan Heritage & Tiger’s Nest',
      slug: 'tour-essential-bhutan-7d.html',
      subtitle: 'The Definitive First-Time Himalayan Experience',
      duration_days: 7,
      duration_nights: 6,
      category: 'Cultural Heritage',
      difficulty: 'Easy to Moderate',
      price_usd: 1950,
      price_3star_usd: 1950,
      price_5star_usd: 3850,
      valleys: 'Paro, Thimphu, Punakha',
      highlight_text: 'Includes Dochula 108 stupas pass, Punakha Dzong, and sacred pilgrimage to Tiger’s Nest.',
      cover_image: 'assets/images/tigers-nest.webp',
      itinerary_json: JSON.stringify([
        { day: 1, title: 'Arrival at Paro (2,280m) & Scenic Drive to Thimphu (2,334m)', description: 'Spectacular mountain flight past Everest and Kanchenjunga. Meet private guide and chauffeur. Drive through river valleys to Thimphu. Visit Tashichho Dzong at dusk.' },
        { day: 2, title: 'Thimphu Capital Exploration & Giant Buddha', description: 'Ascend to Buddha Dordenma (169ft bronze statue). Tour National Textile Museum, Simply Bhutan living museum, and Memorial Chorten.' },
        { day: 3, title: 'Dochula Pass (3,100m) to Subtropical Punakha', description: 'Cross Dochula pass with 108 chortens and Eastern Himalayan views. Descend to Punakha. Tour the legendary Punakha Dzong.' },
        { day: 4, title: 'Chimi Lhakhang & Return Drive to Paro Valley', description: 'Hike through terraced rice fields to Fertility Temple. Walk across Bhutan’s longest suspension bridge. Evening in Paro.' },
        { day: 5, title: 'Pilgrimage Hike to Taktsang (Tiger’s Nest Monastery, 3,120m)', description: 'Climb 900 meters to the cliffside monastery founded by Guru Rinpoche. Traditional Dotsho herbal hot stone bath recovery.' },
        { day: 6, title: 'Kyichu Lhakhang & Paro Heritage Bazaar', description: 'Visit 7th-century Kyichu Lhakhang for butter lamp lighting. Explore craft workshops and traditional archery range.' },
        { day: 7, title: 'Departure from Paro International Airport', description: 'Farewell breakfast and airport drop-off for homeward journey.' }
      ]),
      inclusions_json: JSON.stringify([
        'Royal Government Daily SDF Tourism Tax ($100/night)',
        'Official Bhutan Tourist Visa Clearance Letter',
        'Certified English-Speaking Bhutanese Guide',
        'Private Luxury SUV or Coaster with Professional Driver',
        'All Boutique Hotel Accommodations (Twin / Double Sharing)',
        'Three Full Gourmet Meals Daily (Breakfast, Lunch, Dinner)',
        'All Monument, Monastery & National Park Entrance Fees',
        'Complimentary Traditional Dotsho Hot Stone Bath',
        'Pure Bottled Himalayan Spring Water Daily'
      ]),
      is_featured: 1,
      sort_order: 1
    },
    {
      id: 'druk-path-trek-9d',
      title: 'Druk Path High Alpine Wilderness Trek',
      slug: 'tour-druk-path-trek.html',
      subtitle: 'Trek Ancient Ridge Trails Between Paro & Thimphu',
      duration_days: 9,
      duration_nights: 8,
      category: 'Alpine Trekking',
      difficulty: 'Moderate',
      price_usd: 2480,
      price_3star_usd: 2480,
      price_5star_usd: 4200,
      valleys: 'Paro, Jili Dzong, Jimilangtsho, Phajoding, Thimphu',
      highlight_text: 'Crystal-clear alpine lakes, rhododendron forests, and panoramic Himalayan peak views above 4,000m.',
      cover_image: 'assets/images/dochula-pass.webp',
      itinerary_json: JSON.stringify([
        { day: 'Day 1-2', title: 'Paro Arrival & Acclimatization Hike', description: 'Prepare trekking gear, test altitude readiness with gentle hikes around Paro valley.' },
        { day: 'Day 3', title: 'Ta Dzong to Jili Dzong (3,450m)', description: 'Ascend through blue pine forests to ridge campsite overlooking Paro.' },
        { day: 'Day 4', title: 'Jili Dzong to Jangchulakha (3,760m)', description: 'Walk along alpine ridges with yak herder pastures and mountain rhododendrons.' },
        { day: 'Day 5', title: 'Jangchulakha to Jimilangtsho Lake (3,870m)', description: 'Camp beside pristine sacred lake renowned for giant trout and mirrored peaks.' },
        { day: 'Day 6', title: 'Jimilangtsho to Simkotra Tsho (4,110m)', description: 'Pass multiple glacial tarns and nomadic stone huts above the tree line.' },
        { day: 'Day 7', title: 'Simkotra to Phajoding (3,750m) & Descend to Thimphu', description: 'Sunrise over Mt. Gangkar Puensum (7,570m). Descend through forest to capital.' },
        { day: 'Day 8', title: 'Tiger’s Nest Excursion & Hot Stone Bath', description: 'Celebratory climb to Tiger’s Nest monastery in Paro.' },
        { day: 'Day 9', title: 'Airport Departure', description: 'Transfer to Paro International Airport.' }
      ]),
      inclusions_json: JSON.stringify([
        'All SDF Royal Govt Taxes ($100/night)',
        'Visa Clearance & Trekking Permits',
        'Certified High-Altitude Trekking Guide & Camp Cook',
        'Luggage Transport by Pack Horses / Yaks',
        'Four-Season Mountain Tents & Foam Mattresses',
        'Hot Cooked Meals on Trek Prepared by Camp Chef',
        'Dining Tent, Table, Stools & Chemical Toilet Tent',
        'First Aid Kit, Oxygen Cylinder & Altitude Gamow Bag Backup'
      ]),
      is_featured: 1,
      sort_order: 2
    },
    {
      id: 'thimphu-tshechu-8d',
      title: 'Thimphu Tshechu Sacred Religious Festival Tour',
      slug: 'tour-thimphu-tshechu.html',
      subtitle: 'Witness the Great Masked Cham Dances of Tashichho Dzong',
      duration_days: 8,
      duration_nights: 7,
      category: 'Festival Special',
      difficulty: 'Easy',
      price_usd: 2280,
      price_3star_usd: 2280,
      price_5star_usd: 4100,
      valleys: 'Thimphu, Punakha, Paro',
      highlight_text: 'Front-row VIP access to sacred Cham dances, Atsara clown blessings, and local festival attire immersion.',
      cover_image: 'assets/images/thimphu-festival.webp',
      itinerary_json: JSON.stringify([
        { day: 1, title: 'Arrival Paro & Transfer to Festival Capital Thimphu', description: 'Arrive in the energetic atmosphere of the national autumn festival.' },
        { day: 2, title: 'Day 1 at Thimphu Tshechu: Tendrelthang Courtyard', description: 'Witness the Dance of the Four Stags (Sha Cham) and Dance of the Three Terrifying Deities.' },
        { day: 3, title: 'Day 2 at Tshechu: Sacred Cham & Atsaras Clowns', description: 'Blessings from revered Buddhist masters and sacred humorous interactions with Atsara clowns.' },
        { day: 4, title: 'Dochula Pass Crossing to Punakha Valley', description: 'Cross Dochula pass and visit the warm valley of Punakha Dzong.' },
        { day: 5, title: 'Punakha Valley River Trail & Return to Paro', description: 'Suspension bridge walk and scenic riverside drive to Paro.' },
        { day: 6, title: 'Tiger’s Nest Sacred Pilgrimage', description: 'Hike to the cliffside sanctuary of Paro Taktsang.' },
        { day: 7, title: 'Kyichu Lhakhang Blessing & Traditional Farewell Feast', description: 'Butter lamp ceremony and local farm-to-table banquet.' },
        { day: 8, title: 'Paro Airport Departure', description: 'Homeward flight departure.' }
      ]),
      inclusions_json: JSON.stringify([
        'Full SDF Tourism Tax ($100/night)',
        'Bhutan Tourist Visa Processing',
        'Reserved Festival Courtyard Seating',
        'Traditional Kira or Gho Rental for Festival Days',
        'Licensed Festival Cultural Guide',
        'Private Transport & All Meals',
        'Boutique Heritage Lodging'
      ]),
      is_featured: 1,
      sort_order: 3
    },
    {
      id: 'snowman-trek-25d',
      title: 'The Legendary Snowman Trek',
      slug: 'tour-snowman-trek.html',
      subtitle: 'The Hardest & Most Majestic Mountain Trek on Earth',
      duration_days: 25,
      duration_nights: 24,
      category: 'Expedition',
      difficulty: 'Strenuous',
      price_usd: 6800,
      price_3star_usd: 6800,
      price_5star_usd: 9500,
      valleys: 'Paro, Lingshi, Laya, Lunana, Bumthang',
      highlight_text: 'Cross 11 mountain passes over 4,500m through the isolated glacial highlands of Lunana.',
      cover_image: 'assets/images/dochula-pass.webp',
      itinerary_json: JSON.stringify([
        { day: 'Day 1-4', title: 'Paro Acclimatization & Shana Trailhead', description: 'Enter the remote northern wilderness past Mt. Jomolhari base camp (4,080m).' },
        { day: 'Day 5-9', title: 'Jomolhari Base to Lingshi Dzong (4,150m)', description: 'Cross Nyele La pass (4,830m) into remote mountain fortresses.' },
        { day: 'Day 10-14', title: 'Lingshi to Laya Highland Village (3,840m)', description: 'Cross Sinche La (5,005m) to meet the unique conical-hat nomads of Laya.' },
        { day: 'Day 15-20', title: 'Crossing into Remote Lunana Valley', description: 'Over Rinchenzoe La (5,320m) past giant glaciers and frozen lakes.' },
        { day: 'Day 21-23', title: 'Descent to Central Bhutan & Dur Hot Springs', description: 'Descend to Sephu and soak in natural healing mineral waters.' },
        { day: 'Day 24-25', title: 'Bumthang Domestic Flight to Paro & Departure', description: 'Celebratory banquet and international departure.' }
      ]),
      inclusions_json: JSON.stringify([
        'All 24 Nights SDF Royal Tax ($2,400 value)',
        'Satellite Phone & Gamow Hyperbaric Chamber Support',
        'Expedition Leader & Medical Trained Crew',
        'Pack Animals (Yaks & Horses) for all Gear',
        'Full Winter Expedition Tents & Gourmet Expedition Meals',
        'Domestic Flight Bumthang to Paro Included'
      ]),
      is_featured: 0,
      sort_order: 4
    },
    {
      id: 'punakha-luxury-escape-5d',
      title: 'Punakha Valley Subtropical Luxury Escape',
      slug: 'tour-punakha-escape.html',
      subtitle: 'Boutique River Lodges, Organic Wine & Dzongs',
      duration_days: 5,
      duration_nights: 4,
      category: 'Luxury Escape',
      difficulty: 'Easy',
      price_usd: 1520,
      price_3star_usd: 1520,
      price_5star_usd: 3400,
      valleys: 'Paro, Thimphu, Punakha',
      highlight_text: 'Stay in luxury boutique river retreats, sample private farm tastings, and gentle river drift.',
      cover_image: 'assets/images/punakha-dzong.webp',
      itinerary_json: JSON.stringify([
        { day: 1, title: 'Arrival Paro & Drive to Thimphu', description: 'Private luxury SUV transfer, visit Memorial Chorten and craft street.' },
        { day: 2, title: 'Dochula Pass Crossing to Punakha Valley', description: 'Scenic drive to warmer river valley, check in to riverfront lodge.' },
        { day: 3, title: 'Punakha Dzong & Mo Chhu River Drift', description: 'Private boat drift past royal dzong, artisanal picnic lunch on riverbank.' },
        { day: 4, title: 'Return to Paro Valley & Tiger’s Nest Viewpoint', description: 'Scenic return drive, afternoon tea at view cafe, Dotsho bath.' },
        { day: 5, title: 'Paro Airport Departure', description: 'Private transfer for outbound flight.' }
      ]),
      inclusions_json: JSON.stringify([
        'All SDF Taxes & Fast-Track Visa Clearance',
        '5-Star or Top Boutique Hotel Accommodations',
        'Private Mercedes / Land Cruiser Chauffeur',
        'Artisanal Wine & River Picnic Experience',
        'Private Dedicated Cultural Concierge'
      ]),
      is_featured: 0,
      sort_order: 5
    },
    {
      id: 'bumthang-spiritual-pilgrimage-10d',
      title: 'Bumthang Spiritual Pilgrimage & Central Bhutan',
      slug: 'tour-bumthang-pilgrimage.html',
      subtitle: 'Journey Into the Sacred Heartland of Guru Rinpoche',
      duration_days: 10,
      duration_nights: 9,
      category: 'Cultural Heritage',
      difficulty: 'Easy to Moderate',
      price_usd: 2890,
      price_3star_usd: 2890,
      price_5star_usd: 5100,
      valleys: 'Paro, Thimphu, Punakha, Phobjikha, Trongsa, Bumthang',
      highlight_text: 'Visit Bhutan’s oldest temples (659 AD), burning lake Mebar Tsho, and Trongsa ancestral fortress.',
      cover_image: 'assets/images/dochula-pass.webp',
      itinerary_json: JSON.stringify([
        { day: 'Day 1-3', title: 'Western Valleys: Paro, Thimphu, Punakha', description: 'Explore iconic highlights before venturing into the high interior.' },
        { day: 'Day 4', title: 'Phobjikha Glacial Valley & Black-Necked Cranes', description: 'Cross Pele La pass to Gangtey monastery wetlands.' },
        { day: 'Day 5-6', title: 'Trongsa Dzong to Bumthang Valley', description: 'Visit majestic Trongsa fortress and arrive in Choekhor valley.' },
        { day: 'Day 7-8', title: 'Sacred Temples of Bumthang & Burning Lake', description: 'Jambay, Kurjey, and Tamshing temples, plus Swiss cheese tasting.' },
        { day: 'Day 9', title: 'Return Flight to Paro & Tiger’s Nest', description: 'Domestic flight across Himalayas, climb to Tiger’s Nest.' },
        { day: 'Day 10', title: 'International Departure', description: 'Departure transfer.' }
      ]),
      inclusions_json: JSON.stringify([
        'All SDF Taxes ($1,000 value)',
        'Domestic Flight Bumthang to Paro Included',
        'Private Transport, Guide & Boutique Lodging',
        'Private Meditation Session with Buddhist Monk',
        'Swiss Farm & Artisanal Brewery Tasting'
      ]),
      is_featured: 0,
      sort_order: 6
    },
    {
      id: 'tigers-nest-day-excursion-3d',
      title: 'Tiger’s Nest Iconic Day Excursion & Paro Highlights',
      slug: 'tour-tigers-nest-day.html',
      subtitle: 'The Perfect Short Break Himalayan Getaway',
      duration_days: 3,
      duration_nights: 2,
      category: 'Short Break',
      difficulty: 'Moderate',
      price_usd: 980,
      price_3star_usd: 980,
      price_5star_usd: 1950,
      valleys: 'Paro Valley',
      highlight_text: 'Ideal weekend break: Paro Rinpung Dzong, Tiger’s Nest pilgrimage, and herbal hot stone relaxation.',
      cover_image: 'assets/images/tigers-nest.webp',
      itinerary_json: JSON.stringify([
        { day: 1, title: 'Arrival in Paro & Rinpung Dzong', description: 'Check in to boutique valley hotel, tour Ta Dzong and wooden cantilever bridge.' },
        { day: 2, title: 'Tiger’s Nest Pilgrimage & Dotsho Mineral Bath', description: 'Morning hike to Taktsang monastery, afternoon hot stone herbal soak.' },
        { day: 3, title: 'Kyichu Lhakhang & Flight Departure', description: 'Butter lamp blessing and international airport drop-off.' }
      ]),
      inclusions_json: JSON.stringify([
        'Full SDF Tourism Taxes ($200/person)',
        'Bhutan Tourist Visa Processing (24-48h)',
        'Private Guide & Airport Chauffeur',
        'All Meals & Boutique Heritage Hotel',
        'Complimentary Hot Stone Bath'
      ]),
      is_featured: 0,
      sort_order: 7
    },
    {
      id: 'eastern-bhutan-textiles-14d',
      title: 'Eastern Bhutan Remote Frontiers & Textiles',
      slug: 'tour-eastern-bhutan.html',
      subtitle: 'Untouched Valleys, Kishuthara Weavers & Yak Nomads',
      duration_days: 14,
      duration_nights: 13,
      category: 'Cultural Heritage',
      difficulty: 'Moderate',
      price_usd: 3950,
      price_3star_usd: 3950,
      price_5star_usd: 6800,
      valleys: 'Paro, Bumthang, Mongar, Trashigang, Trashiyangtse',
      highlight_text: 'Visit Radhi raw silk weavers, dramatic cliffs of Trashigang, and the remote nomadic realm of Merak-Sakteng.',
      cover_image: 'assets/images/dochula-pass.webp',
      itinerary_json: JSON.stringify([
        { day: 'Day 1-4', title: 'Western & Central Bhutan Highlights', description: 'Paro, Thimphu, Punakha, and Bumthang cultural treasures.' },
        { day: 'Day 5-7', title: 'Thrumshingla Pass (3,780m) to Mongar & Trashigang', description: 'Spectacular mountain shelf roads to lush Eastern cliffs.' },
        { day: 'Day 8-10', title: 'Trashiyangtse, Chorten Kora & Radhi Weavers', description: 'See master artisans weave Kishuthara brocade on backstrap looms.' },
        { day: 'Day 11-13', title: 'Merak & Sakteng High Plateau Excursion', description: 'Experience the semi-nomadic Brokpa culture.' },
        { day: 'Day 14', title: 'Domestic Return Flight & Departure', description: 'Flight from Yonphula to Paro and outbound departure.' }
      ]),
      inclusions_json: JSON.stringify([
        'All 13 Nights SDF Royal Tax ($1,300 value)',
        'Domestic Flight Yonphula to Paro Included',
        'Special Eastern Bhutan Restricted Area Permits',
        'Textile Workshops with Master Weavers',
        'Full Private 4x4 Transport, Guide & Lodging'
      ]),
      is_featured: 0,
      sort_order: 8
    },
    {
      id: 'gangtey-crane-valley-6d',
      title: 'Phobjikha Valley & Black-Necked Crane Festival',
      slug: 'tour-gangtey-crane-valley.html',
      subtitle: 'Winter Wildlife Sanctuary & Sacred Gangtey Monastery',
      duration_days: 6,
      duration_nights: 5,
      category: 'Festival Special',
      difficulty: 'Easy',
      price_usd: 1780,
      price_3star_usd: 1780,
      price_5star_usd: 3600,
      valleys: 'Paro, Thimphu, Gangtey/Phobjikha, Punakha',
      highlight_text: 'Spot Tibetan Black-Necked Cranes in high alpine wetlands, attend the Crane Festival, and hike nature trails.',
      cover_image: 'assets/images/phobjikha-cranes.webp',
      itinerary_json: JSON.stringify([
        { day: 1, title: 'Arrival Paro & Drive to Thimphu', description: 'Welcome dinner and orientation in capital.' },
        { day: 2, title: 'Dochula Pass to Glacial Phobjikha Valley', description: 'Scenic drive to wide U-shaped valley, visit Gangtey Gompa.' },
        { day: 3, title: 'Crane Festival & Nature Trail Hike', description: 'Witness local schoolchildren perform crane dances in crane costumes; birdwatching with spotting scopes.' },
        { day: 4, title: 'Drive to Warm Punakha Valley', description: 'Visit Punakha Dzong and suspension bridge.' },
        { day: 5, title: 'Return to Paro & Tiger’s Nest Hike', description: 'Climb to Tiger’s Nest, farewell traditional dinner.' },
        { day: 6, title: 'Departure Flight from Paro', description: 'Airport drop-off.' }
      ]),
      inclusions_json: JSON.stringify([
        'All SDF Taxes ($500 value)',
        'Crane Festival Courtyard Access & Spotting Equipment',
        'Private Guide & Heated Luxury Vehicle',
        'Farmhouse Dinner with Local Family in Phobjikha',
        'Boutique Valley Hotels & All Meals'
      ]),
      is_featured: 0,
      sort_order: 9
    },
    {
      id: 'paro-spring-festival-8d',
      title: 'Paro Tshechu Spring Festival & Sacred Thongdrel',
      slug: 'tour-paro-spring-festival.html',
      subtitle: 'Witness the Dawn Unfurling of the Giant Guru Silk Relic',
      duration_days: 8,
      duration_nights: 7,
      category: 'Festival Special',
      difficulty: 'Easy',
      price_usd: 2350,
      price_3star_usd: 2350,
      price_5star_usd: 4250,
      valleys: 'Paro, Thimphu, Punakha',
      highlight_text: 'Bhutan’s most popular spring festival: witness the massive 400-year-old Guru Thongdrel tapestry unfurled before dawn.',
      cover_image: 'assets/images/tigers-nest.webp',
      itinerary_json: JSON.stringify([
        { day: 1, title: 'Arrival in Paro in Spring Bloom', description: 'Apple and peach blossoms across the valley, festival excitement.' },
        { day: 2, title: 'Paro Tshechu Day 1: Rinpung Courtyard', description: 'Monk dances in silk robes and bone ornaments.' },
        { day: 3, title: 'Paro Tshechu Day 2 & Thimphu Capital Visit', description: 'Atsara blessings, drive to Thimphu to see Buddha Dordenma.' },
        { day: 4, title: 'Punakha Valley Scenic Excursion', description: 'Dochula pass crossing, Punakha Dzong tour.' },
        { day: 5, title: 'Return to Paro for Pre-Dawn Thongdrel Ceremony', description: 'Awaken at 3:00 AM to see the giant 4-story silk thangka unfurled to cleanse all sins.' },
        { day: 6, title: 'Pilgrimage to Tiger’s Nest Monastery', description: 'Ascend to Taktsang cliffside hermitage.' },
        { day: 7, title: 'Kyichu Lhakhang & Local Archery Tournament', description: 'Try Bhutan’s national sport of archery, butter lamp lighting.' },
        { day: 8, title: 'Airport Departure', description: 'Outbound flight transfer.' }
      ]),
      inclusions_json: JSON.stringify([
        'Full SDF Royal Taxes ($700 value)',
        'Bhutan Tourist Visa Guaranteed',
        'Dawn Thongdrel Ceremony Escort',
        'Traditional Bhutanese Dress Rental',
        'Private SUV, Guide & Heritage Hotels'
      ]),
      is_featured: 0,
      sort_order: 10
    }
  ];

  const sampleBookings = [
    {
      id: 'BFR-2026-8841',
      tour_id: 'essential-bhutan-7d',
      tour_title: 'Essential Bhutan Heritage & Tiger’s Nest (7 Days / 6 Nights)',
      is_custom_trip: 0,
      lead_name: 'Dr. Evelyn Martinez',
      lead_email: 'evelyn.m@example.com',
      lead_phone: '+1 415 555 2671',
      lead_country: 'United States',
      lead_passport_no: 'A92817462',
      travel_date_start: '2026-10-15',
      travel_date_end: '2026-10-21',
      total_nights: 6,
      total_travelers: 2,
      adults_count: 2,
      children_6_12: 0,
      children_under_6: 0,
      hotel_tier: '4-Star Premium',
      base_price_usd: 3900,
      sdf_total_usd: 1200,
      visa_fee_usd: 80,
      extras_usd: 0,
      total_price_usd: 5180,
      deposit_paid_usd: 5180,
      full_paid: 1,
      booking_status: 'visa_approved',
      visa_status: 'clearance_letter_issued',
      visa_clearance_number: 'VCL-2026-8841-BFR',
      visa_submitted_date: '2026-08-10',
      visa_approved_date: '2026-08-14',
      assigned_guide_id: 3,
      assigned_vehicle: 'BP-1-A8921 (Toyota Land Cruiser)',
      special_requests: 'Vegetarian meals preferred, celebration of 10th anniversary',
      internal_notes: 'VIP travelers, room upgrade arranged at Zhiwa Ling Paro',
      source: 'website'
    },
    {
      id: 'BFR-2026-8850',
      tour_id: 'druk-path-trek-9d',
      tour_title: 'Druk Path High Alpine Wilderness Trek (9 Days / 8 Nights)',
      is_custom_trip: 0,
      lead_name: 'Marcus Lindholm',
      lead_email: 'marcus.l@example.com',
      lead_phone: '+46 8 123 4567',
      lead_country: 'Sweden',
      lead_passport_no: 'SE7829104',
      travel_date_start: '2026-11-02',
      travel_date_end: '2026-11-10',
      total_nights: 8,
      total_travelers: 1,
      adults_count: 1,
      children_6_12: 0,
      children_under_6: 0,
      hotel_tier: '3-Star Heritage',
      base_price_usd: 2480,
      sdf_total_usd: 800,
      visa_fee_usd: 40,
      extras_usd: 150,
      total_price_usd: 3470,
      deposit_paid_usd: 1000,
      full_paid: 0,
      booking_status: 'documents_complete',
      visa_status: 'under_review',
      visa_submitted_date: '2026-09-01',
      assigned_guide_id: 3,
      assigned_vehicle: 'BP-1-B3302 (Hyundai H-1 Van)',
      special_requests: 'Requires size 44 trekking gaiters rental',
      source: 'whatsapp'
    },
    {
      id: 'BFR-2026-8862',
      tour_id: 'thimphu-tshechu-8d',
      tour_title: 'Thimphu Tshechu Religious Festival Tour (8 Days / 7 Nights)',
      is_custom_trip: 0,
      lead_name: 'Hiroshi Tanaka',
      lead_email: 'tanaka.h@example.jp',
      lead_phone: '+81 90 1234 5678',
      lead_country: 'Japan',
      lead_passport_no: 'TR9918231',
      travel_date_start: '2026-10-01',
      travel_date_end: '2026-10-08',
      total_nights: 7,
      total_travelers: 3,
      adults_count: 3,
      children_6_12: 0,
      children_under_6: 0,
      hotel_tier: '5-Star Luxury',
      base_price_usd: 12300,
      sdf_total_usd: 2100,
      visa_fee_usd: 120,
      extras_usd: 500,
      total_price_usd: 15020,
      deposit_paid_usd: 15020,
      full_paid: 1,
      booking_status: 'confirmed',
      visa_status: 'clearance_letter_issued',
      visa_clearance_number: 'VCL-2026-8862-BFR',
      visa_submitted_date: '2026-07-20',
      visa_approved_date: '2026-07-25',
      assigned_guide_id: 3,
      assigned_vehicle: 'BP-1-A1010 (Toyota Coaster VIP)',
      special_requests: 'Japanese speaking translator guide requested',
      source: 'agent'
    }
  ];

  const sampleInquiries = [
    {
      ref_code: 'INQ-2026-101',
      name: 'Claire Dupont',
      email: 'claire.d@example.fr',
      phone: '+33 6 12 34 56 78',
      country: 'France',
      preferred_dates: 'April 2027',
      duration_days: 10,
      travelers_count: 2,
      budget_range: '$4,000 - $6,000',
      interests: 'Cultural Heritage, Birdwatching, Local Cuisine',
      message: 'We are planning our honeymoon in Bhutan for April 2027. We would love to see blooming rhododendrons and attend a local monastery prayer. Can you customize a private itinerary?',
      source: 'website',
      status: 'proposal_sent'
    },
    {
      ref_code: 'INQ-2026-102',
      name: 'David & Rachel Miller',
      email: 'david.miller@example.co.uk',
      phone: '+44 7700 900123',
      country: 'United Kingdom',
      preferred_dates: 'October 2026',
      duration_days: 7,
      travelers_count: 4,
      budget_range: '$8,000 - $10,000',
      interests: 'Festivals, Photography, Tiger’s Nest',
      message: 'Family group of 4 looking for private tour during Thimphu or Paro festival. Need 2 twin rooms at 4-star boutique hotels. How quickly can visa clearance be arranged?',
      source: 'website',
      status: 'new'
    }
  ];

  const sampleReviews = [
    {
      author_name: 'Dr. Michael Chen',
      author_country: 'Canada',
      tour_taken: 'Essential Bhutan Heritage & Tiger’s Nest',
      travel_date: '2026-04-12',
      rating: 5,
      title: 'Flawless 7-Day Tour with Kinley!',
      comment: 'From the minute we landed in Paro, Bhutan Fast Rate Tours took care of everything. Our guide Kinley was a treasure trove of Buddhist philosophy and local folklore. The hike to Tiger’s Nest was the highlight of my traveling life. SDF visas were issued in 24 hours without a hitch.',
      is_verified: 1,
      is_featured: 1
    },
    {
      author_name: 'Sarah & Liam O’Connor',
      author_country: 'Ireland',
      tour_taken: 'Druk Path High Alpine Trek',
      travel_date: '2026-05-02',
      rating: 5,
      title: 'Incredible mountain wilderness experience',
      comment: 'Camping next to Jimilangtsho lake at almost 4,000m with mountain mist rising over crystal waters is unforgettable. The cook whipped up delicious 3-course warm meals in freezing temperatures. 10/10 service!',
      is_verified: 1,
      is_featured: 1
    },
    {
      author_name: 'Ananya Sharma',
      author_country: 'India',
      tour_taken: 'Punakha Valley Subtropical Luxury Escape',
      travel_date: '2026-03-20',
      rating: 5,
      title: 'Seamless entry permits & gorgeous river lodges',
      comment: 'As regional travelers from India, the entry permit process was handled completely by Bhutan Fast Rate Tours. We crossed Dochula pass on a crystal clear morning and Punakha Dzong took our breath away. Will visit again!',
      is_verified: 1,
      is_featured: 1
    }
  ];

  return { users, settings, destinations, tours, sampleBookings, sampleInquiries, sampleReviews };
}

module.exports = { getSeedData };
