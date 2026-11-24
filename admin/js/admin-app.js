/**
 * Bhutan Fast Rate Tours - Admin Operations Application Core
 */

const AdminApp = (function () {
  const isLoginPage = window.location.pathname.endsWith('login.html');

  // Check auth session
  function getStaffUser() {
    try {
      const u = localStorage.getItem('bfr_admin_user');
      return u ? JSON.parse(u) : null;
    } catch (e) {
      return null;
    }
  }

  function requireAuth() {
    if (isLoginPage) return;
    const user = getStaffUser();
    if (!user) {
      window.location.href = 'login.html';
    }
  }

  function logout() {
    localStorage.removeItem('bfr_admin_user');
    localStorage.removeItem('bfr_admin_token');
    window.location.href = 'login.html';
  }

  // Sidebar navigation builder
  function renderSidebar(activeItem) {
    const sidebarEl = document.getElementById('adminSidebar');
    if (!sidebarEl) return;

    const user = getStaffUser() || { name: 'Staff Concierge', role: 'concierge' };

    sidebarEl.innerHTML = `
      <div class="p-6 border-b border-[#334155] flex items-center gap-3">
        <div class="w-9 h-9 rounded-xl bg-[#E05A47] text-white font-black flex items-center justify-center text-lg">B</div>
        <div>
          <div class="font-extrabold text-sm text-white leading-tight">BHUTAN FAST RATE</div>
          <div class="text-[9px] font-bold text-[#E05A47] tracking-widest uppercase">OPERATIONS CENTER</div>
        </div>
      </div>

      <div class="p-4 flex-1 overflow-y-auto space-y-1">
        <div class="text-[10px] font-bold text-zinc-500 uppercase px-3 py-1">Operations</div>
        <a href="dashboard.html" class="sidebar-link ${activeItem === 'dashboard' ? 'active' : ''}">
          <span>📊</span> Dashboard
        </a>
        <a href="bookings.html" class="sidebar-link ${activeItem === 'bookings' ? 'active' : ''}">
          <span>🧳</span> Bookings Pipeline
        </a>
        <a href="visa-desk.html" class="sidebar-link ${activeItem === 'visa' ? 'active' : ''}">
          <span>🛂</span> Visa Clearance Desk
        </a>
        <a href="inquiries.html" class="sidebar-link ${activeItem === 'inquiries' ? 'active' : ''}">
          <span>💬</span> Inquiries CRM
        </a>
        <a href="guides.html" class="sidebar-link ${activeItem === 'guides' ? 'active' : ''}">
          <span>🏔️</span> Guide Roster
        </a>

        <div class="text-[10px] font-bold text-zinc-500 uppercase px-3 pt-4 py-1">Catalog &amp; Finance</div>
        <a href="tours-manager.html" class="sidebar-link ${activeItem === 'tours' ? 'active' : ''}">
          <span>🗺️</span> Tour Packages
        </a>
        <a href="finance.html" class="sidebar-link ${activeItem === 'finance' ? 'active' : ''}">
          <span>💰</span> Finance &amp; SDF
        </a>
        <a href="notifications.html" class="sidebar-link ${activeItem === 'notifications' ? 'active' : ''}">
          <span>🔔</span> Notifications
        </a>

        <div class="text-[10px] font-bold text-zinc-500 uppercase px-3 pt-4 py-1">System</div>
        <a href="settings.html" class="sidebar-link ${activeItem === 'settings' ? 'active' : ''}">
          <span>⚙️</span> Platform Settings
        </a>
        <a href="audit-log.html" class="sidebar-link ${activeItem === 'audit' ? 'active' : ''}">
          <span>📜</span> Audit Trail
        </a>
        <a href="../index.html" target="_blank" class="sidebar-link">
          <span>🌐</span> View Public Site ↗
        </a>
      </div>

      <!-- Staff Profile in Footer -->
      <div class="p-4 border-t border-[#334155] flex items-center justify-between">
        <div class="flex items-center gap-2 overflow-hidden">
          <div class="w-8 h-8 rounded-full bg-zinc-700 flex items-center justify-center font-bold text-xs text-zinc-200">
            ${user.name.charAt(0)}
          </div>
          <div class="overflow-hidden">
            <div class="text-xs font-bold text-white truncate">${user.name}</div>
            <div class="text-[10px] text-emerald-400 capitalize">${user.role.replace('_', ' ')}</div>
          </div>
        </div>
        <button onclick="AdminApp.logout()" title="Logout" class="p-1.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-white">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/></svg>
        </button>
      </div>
    `;
  }

  // Toast notifications
  function showToast(message, type = 'success') {
    const existing = document.getElementById('adminToast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.id = 'adminToast';
    const bg = type === 'error' ? 'bg-red-600' : 'bg-emerald-600';
    toast.className = `fixed bottom-6 right-6 ${bg} text-white px-5 py-3 rounded-xl shadow-2xl text-xs font-bold z-50 transition-all duration-300`;
    toast.innerText = message;
    document.body.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  }

  return {
    requireAuth,
    getStaffUser,
    logout,
    renderSidebar,
    showToast
  };
})();

window.AdminApp = AdminApp;
