/**
 * Bhutan Fast Rate Tours - Interactive Tour Booking Widget
 */

class BookingWidget {
  constructor(containerId, options = {}) {
    this.container = document.getElementById(containerId);
    if (!this.container) return;

    this.tourId = options.tourId || '';
    this.tourTitle = options.tourTitle || 'Bhutan Tour Package';
    this.basePrice = options.basePrice || 1950;
    this.nights = options.nights || 6;

    this.adults = 2;
    this.children = 0;
    this.hotelTier = '4-Star Premium';
    this.nationality = 'international';

    this.render();
  }

  render() {
    this.container.innerHTML = `
      <div class="bg-white p-6 sm:p-8 rounded-2xl border border-zinc-200 shadow-lg space-y-5">
        <span class="text-xs font-bold uppercase text-[#E05A47]">ROYAL GOVT LICENSED BOOKING DESK</span>
        <h3 class="text-xl font-bold text-[#14231E]">Book This Tour Package</h3>
        
        <form id="widgetBookingForm" class="space-y-4">
          <div>
            <label class="block text-xs font-bold text-zinc-700 mb-1">Departure Date</label>
            <input type="date" id="wbDate" required class="w-full px-3 py-2 rounded-lg border border-zinc-300 text-xs font-bold">
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-xs font-bold text-zinc-700 mb-1">Adults (13+)</label>
              <input type="number" id="wbAdults" value="2" min="1" max="25" class="w-full px-3 py-2 rounded-lg border border-zinc-300 text-xs font-bold">
            </div>
            <div>
              <label class="block text-xs font-bold text-zinc-700 mb-1">Children (6-12)</label>
              <input type="number" id="wbChildren" value="0" min="0" max="10" class="w-full px-3 py-2 rounded-lg border border-zinc-300 text-xs font-bold">
            </div>
          </div>

          <div>
            <label class="block text-xs font-bold text-zinc-700 mb-1">Accommodation Tier</label>
            <select id="wbTier" class="w-full px-3 py-2 rounded-lg border border-zinc-300 text-xs font-medium">
              <option value="4-Star Premium">4-Star Premium Boutique</option>
              <option value="3-Star Heritage">3-Star Heritage Lodges</option>
              <option value="5-Star Luxury">5-Star Luxury (Zhiwa Ling / Amankora)</option>
            </select>
          </div>

          <!-- Live Price Summary -->
          <div class="p-4 rounded-xl bg-orange-50/70 border border-orange-200 space-y-1.5 text-xs">
            <div class="flex justify-between">
              <span class="text-zinc-600">SDF Royal Tax Included:</span>
              <span id="wbSdf" class="font-bold text-[#14231E]">$1,200</span>
            </div>
            <div class="flex justify-between">
              <span class="text-zinc-600">Tourist Visa Clearance (24-48h):</span>
              <span id="wbVisa" class="font-bold text-[#14231E]">$80</span>
            </div>
            <div class="flex justify-between pt-2 border-t border-orange-200 text-sm font-black text-[#E05A47]">
              <span>Estimated Total:</span>
              <span id="wbTotal">$5,180</span>
            </div>
          </div>

          <!-- Contact Inputs -->
          <div class="space-y-3 pt-2">
            <div>
              <label class="block text-[11px] font-bold text-zinc-600 mb-1">Your Full Name</label>
              <input type="text" id="wbName" placeholder="e.g. Dr. Sarah Jenkins" required class="w-full px-3 py-2 rounded-lg border border-zinc-300 text-xs font-medium">
            </div>
            <div class="grid grid-cols-2 gap-2">
              <div>
                <label class="block text-[11px] font-bold text-zinc-600 mb-1">Email</label>
                <input type="email" id="wbEmail" placeholder="you@example.com" required class="w-full px-3 py-2 rounded-lg border border-zinc-300 text-xs font-medium">
              </div>
              <div>
                <label class="block text-[11px] font-bold text-zinc-600 mb-1">Phone / WhatsApp</label>
                <input type="tel" id="wbPhone" placeholder="+1 555 000 0000" required class="w-full px-3 py-2 rounded-lg border border-zinc-300 text-xs font-medium">
              </div>
            </div>
          </div>

          <button type="submit" class="w-full py-3.5 rounded-lg bg-[#E05A47] hover:bg-[#c94937] text-white font-black text-xs uppercase tracking-wider shadow transition-all">
            Instant Reserve &amp; Issue Invoice
          </button>
        </form>

        <div class="text-[11px] text-zinc-500 text-center space-y-1">
          <p>✓ 100% Refundable up to 30 days before departure.</p>
          <p>✓ Direct booking guarantee with license holder #TR/2018/9882.</p>
        </div>
      </div>
    `;

    this.attachEvents();
    this.updateCalculation();
  }

  attachEvents() {
    const update = () => this.updateCalculation();
    document.getElementById('wbAdults').addEventListener('input', update);
    document.getElementById('wbChildren').addEventListener('input', update);
    document.getElementById('wbTier').addEventListener('change', update);

    document.getElementById('widgetBookingForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const bookingData = {
        tour_id: this.tourId,
        tour_title: this.tourTitle,
        nights: this.nights,
        travel_date_start: document.getElementById('wbDate').value,
        adults_count: parseInt(document.getElementById('wbAdults').value, 10),
        children_6_12: parseInt(document.getElementById('wbChildren').value, 10),
        hotel_tier: document.getElementById('wbTier').value,
        lead_name: document.getElementById('wbName').value,
        lead_email: document.getElementById('wbEmail').value,
        lead_phone: document.getElementById('wbPhone').value
      };

      const res = await window.ApiClient.submitBooking(bookingData);
      if (res && res.success && res.booking) {
        alert(`Booking Reserved! Reference: ${res.booking.id}\\nRedirecting to live tracking desk...`);
        window.location.href = res.booking.tracking_url || `track-visa.html?ref=${res.booking.id}`;
      } else {
        alert('Could not submit booking. Please check details.');
      }
    });
  }

  updateCalculation() {
    const adults = parseInt(document.getElementById('wbAdults').value, 10) || 1;
    const children = parseInt(document.getElementById('wbChildren').value, 10) || 0;
    const tier = document.getElementById('wbTier').value;

    let tierPrice = this.basePrice;
    if (tier === '5-Star Luxury') tierPrice = Math.round(this.basePrice * 1.8);
    if (tier === '3-Star Heritage') tierPrice = Math.round(this.basePrice * 0.9);

    const sdf = (adults * this.nights * 100) + (children * this.nights * 50);
    const visa = (adults + children) * 40;
    const baseTotal = (adults * tierPrice) + Math.round(children * tierPrice * 0.6);
    const total = baseTotal + sdf + visa;

    document.getElementById('wbSdf').innerText = `$${sdf.toLocaleString()}`;
    document.getElementById('wbVisa').innerText = `$${visa.toLocaleString()}`;
    document.getElementById('wbTotal').innerText = `$${total.toLocaleString()}`;
  }
}

window.BookingWidget = BookingWidget;
