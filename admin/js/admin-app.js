/**
 * Bhutan Fast Rate Tours - Admin Operations Application Core
 * Handles JWT session verification via /api/admin/auth/me, RBAC UI enforcement,
 * XSS escaping, sidebar & header unread notification badges, and shared formatters.
 */

const AdminApp = (function () {
  const pathname = (window.location && window.location.pathname) ? window.location.pathname.toLowerCase() : '';
  const isLoginPage = pathname.endsWith('/login.html') || pathname.endsWith('login.html');

  let activeSidebarKey = '';
  let sessionVerifiedPromise = null;
  let lastUnreadCount = null;

  function esc(value) {
    if (value === null || value === undefined) return '';
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function getStaffUser() {
    if (window.ApiClient && typeof window.ApiClient.getAdminUser === 'function') {
      return window.ApiClient.getAdminUser();
    }
    try {
      const raw = localStorage.getItem('bfr_admin_user');
      return raw ? JSON.parse(raw) : null;
    } catch (_) {
      return null;
    }
  }

  function getToken() {
    if (window.ApiClient && typeof window.ApiClient.getToken === 'function') {
      return window.ApiClient.getToken('admin');
    }
    try {
      return localStorage.getItem('bfr_admin_token');
    } catch (_) {
      return null;
    }
  }

  function hasRole(...roles) {
    const user = getStaffUser();
    if (!user || !user.role) return false;
    return roles.includes(String(user.role).toLowerCase());
  }

  function isSuperAdmin() {
    return hasRole('super_admin');
  }

  function canFinance() {
    return hasRole('super_admin', 'admin', 'finance');
  }

  function canOps() {
    return hasRole('super_admin', 'admin', 'concierge');
  }

  function applyRoleVisibility(userOverride) {
    const user = userOverride || getStaffUser();
    const role = user && user.role ? String(user.role).toLowerCase() : '';

    document.querySelectorAll('[data-roles]').forEach((el) => {
      const allowed = String(el.getAttribute('data-roles') || '')
        .split(',')
        .map((r) => r.trim().toLowerCase())
        .filter(Boolean);
      if (allowed.length === 0) return;
      if (!role || !allowed.includes(role)) {
        el.classList.add('role-hidden');
      } else {
        el.classList.remove('role-hidden');
      }
    });
  }

  function verifySession() {
    if (isLoginPage) return Promise.resolve(null);
    const token = getToken();
    if (!token) {
      window.location.href = 'login.html';
      return Promise.resolve(null);
    }

    if (sessionVerifiedPromise) return sessionVerifiedPromise;

    sessionVerifiedPromise = (async () => {
      if (!window.ApiClient || typeof window.ApiClient.getAdminMe !== 'function') {
        return getStaffUser();
      }
      try {
        const res = await window.ApiClient.getAdminMe();
        if (res && res.success && res.user) {
          window.ApiClient.setAdminSession(token, res.user);
          if (activeSidebarKey) {
            renderSidebar(activeSidebarKey, { skipVerify: true });
          } else {
            applyRoleVisibility(res.user);
          }
          return res.user;
        }
      } catch (err) {
        if (err && err.status === 401) {
          logout();
          return null;
        }
        // Keep cached user if server is momentarily unreachable; callers still surface API errors
      }
      return getStaffUser();
    })();

    return sessionVerifiedPromise;
  }

  function requireAuth() {
    if (isLoginPage) return false;
    const token = getToken();
    const user = getStaffUser();
    if (!token || !user) {
      if (window.ApiClient && typeof window.ApiClient.clearPortalSession === 'function') {
        window.ApiClient.clearPortalSession('admin');
      }
      window.location.href = 'login.html';
      return false;
    }
    verifySession();
    return true;
  }

  function logout() {
    if (window.ApiClient && typeof window.ApiClient.clearPortalSession === 'function') {
      window.ApiClient.clearPortalSession('admin');
    } else {
      try {
        localStorage.removeItem('bfr_admin_user');
        localStorage.removeItem('bfr_admin_token');
      } catch (_) {}
    }
    window.location.href = 'login.html';
  }

  function updateUnreadBadge(count) {
    const num = Math.max(0, Number(count) || 0);
    lastUnreadCount = num;

    const sideBadge = document.getElementById('sidebarNotifBadge');
    if (sideBadge) {
      sideBadge.textContent = num > 99 ? '99+' : String(num);
      sideBadge.classList.toggle('hidden', num <= 0);
    }

    document.querySelectorAll('.admin-header a[href="notifications.html"]').forEach((bell) => {
      bell.classList.add('notif-bell-btn');
      let pill = bell.querySelector('.notif-badge');
      if (!pill) {
        pill = document.createElement('span');
        pill.className = 'notif-badge hidden';
        bell.appendChild(pill);
      }
      pill.textContent = num > 99 ? '99+' : String(num);
      pill.classList.toggle('hidden', num <= 0);
      bell.title = num > 0 ? `${num} unread notification(s)` : 'Notifications';
    });
  }

  async function refreshUnreadCount() {
    if (isLoginPage || !getToken()) return 0;
    if (!window.ApiClient || typeof window.ApiClient.getNotifications !== 'function') return 0;
    try {
      const res = await window.ApiClient.getNotifications({ unread: 1, limit: 1 });
      if (res && res.success) {
        const count = Number(res.unread_count ?? res.count ?? 0);
        updateUnreadBadge(count);
        return count;
      }
    } catch (_) {
      // Non-blocking badge refresh
    }
    return 0;
  }

  function wireSidebarToggle() {
    const toggle = document.getElementById('sidebarToggle');
    const sidebar = document.getElementById('adminSidebar');
    if (toggle && sidebar && !toggle.dataset.bfrBound) {
      toggle.dataset.bfrBound = '1';
      toggle.addEventListener('click', (e) => {
        e.stopPropagation();
        sidebar.classList.toggle('open');
      });
      document.addEventListener('click', (e) => {
        if (window.innerWidth <= 1024 && sidebar.classList.contains('open')) {
          if (!sidebar.contains(e.target) && !toggle.contains(e.target)) {
            sidebar.classList.remove('open');
          }
        }
      });
      sidebar.addEventListener('click', (e) => {
        if (window.innerWidth <= 1024 && e.target.closest('a')) {
          sidebar.classList.remove('open');
        }
      });
    }
  }

  function renderSidebar(activeItem, options = {}) {
    activeSidebarKey = activeItem || activeSidebarKey;
    const sidebarEl = document.getElementById('adminSidebar');
    if (!sidebarEl) return;

    const user = getStaffUser() || { name: 'Staff Member', role: 'concierge' };
    const displayName = user.name || user.full_name || 'Staff Member';
    const displayRole = String(user.role || 'concierge');
    const initial = displayName.trim().charAt(0).toUpperCase() || 'S';

    const showFinance = ['super_admin', 'admin', 'finance'].includes(displayRole);
    const isSuper = displayRole === 'super_admin';

    sidebarEl.innerHTML = `
      <div class="p-6 border-b border-[#1C4539] flex items-center gap-3">
        <div class="w-9 h-9 rounded-full bg-[#C9A24B] text-[#0B2A22] font-serif font-black flex items-center justify-center text-lg shrink-0 shadow">B</div>
        <div class="min-w-0">
          <div class="font-serif font-extrabold text-sm text-[#FFF8EC] leading-tight truncate">BHUTAN FAST RATE</div>
          <div class="text-[9px] font-bold text-[#C9A24B] tracking-widest uppercase">OPERATIONS CENTER</div>
        </div>
      </div>

      <div class="p-4 flex-1 overflow-y-auto space-y-1">
        <div class="text-[10px] font-bold text-zinc-500 uppercase px-3 py-1">Operations</div>
        <a href="dashboard.html" class="sidebar-link ${activeItem === 'dashboard' ? 'active' : ''}">
          <span class="sidebar-link-main"><span>📊</span><span>Dashboard</span></span>
        </a>
        <a href="bookings.html" class="sidebar-link ${activeItem === 'bookings' ? 'active' : ''}">
          <span class="sidebar-link-main"><span>🧳</span><span>Bookings Pipeline</span></span>
        </a>
        <a href="visa-desk.html" class="sidebar-link ${activeItem === 'visa' ? 'active' : ''}">
          <span class="sidebar-link-main"><span>🛂</span><span>Visa Clearance Desk</span></span>
        </a>
        <a href="inquiries.html" class="sidebar-link ${activeItem === 'inquiries' ? 'active' : ''}">
          <span class="sidebar-link-main"><span>💬</span><span>Inquiries CRM</span></span>
        </a>
        <a href="guides.html" class="sidebar-link ${activeItem === 'guides' ? 'active' : ''}">
          <span class="sidebar-link-main"><span>🏔️</span><span>Guide Roster</span></span>
        </a>

        <div class="text-[10px] font-bold text-zinc-500 uppercase px-3 pt-4 py-1">Catalog &amp; Finance</div>
        <a href="tours-manager.html" class="sidebar-link ${activeItem === 'tours' ? 'active' : ''}">
          <span class="sidebar-link-main"><span>🗺️</span><span>Tour Packages</span></span>
        </a>
        <a href="content-cms.html" class="sidebar-link ${activeItem === 'cms' || activeItem === 'content-cms' ? 'active' : ''}">
          <span class="sidebar-link-main"><span>✨</span><span>Content CMS</span></span>
        </a>
        ${showFinance ? `
          <a href="finance.html" class="sidebar-link ${activeItem === 'finance' ? 'active' : ''}" data-roles="super_admin,admin,finance">
            <span class="sidebar-link-main"><span>💰</span><span>Finance &amp; SDF</span></span>
          </a>
        ` : ''}
        <a href="notifications.html" class="sidebar-link ${activeItem === 'notifications' ? 'active' : ''}">
          <span class="sidebar-link-main"><span>🔔</span><span>Notifications</span></span>
          <span id="sidebarNotifBadge" class="notif-badge ${lastUnreadCount > 0 ? '' : 'hidden'}">${lastUnreadCount > 99 ? '99+' : (lastUnreadCount || 0)}</span>
        </a>

        <div class="text-[10px] font-bold text-zinc-500 uppercase px-3 pt-4 py-1">System</div>
        <a href="settings.html" class="sidebar-link ${activeItem === 'settings' ? 'active' : ''}">
          <span class="sidebar-link-main"><span>⚙️</span><span>Platform Settings</span></span>
          ${isSuper ? '<span class="text-[9px] px-1.5 py-0.5 rounded bg-[#C9A24B]/20 text-[#E4C87E] font-bold">RBAC</span>' : ''}
        </a>
        ${isSuper ? `
          <a href="settings.html#staff-users" class="sidebar-link" data-roles="super_admin">
            <span class="sidebar-link-main"><span>🛡️</span><span>Staff Users</span></span>
          </a>
        ` : ''}
        <a href="audit-log.html" class="sidebar-link ${activeItem === 'audit' ? 'active' : ''}">
          <span class="sidebar-link-main"><span>📜</span><span>Audit Trail</span></span>
        </a>
        <a href="../index.html" target="_blank" rel="noopener" class="sidebar-link">
          <span class="sidebar-link-main"><span>🌐</span><span>View Public Site ↗</span></span>
        </a>
      </div>

      <div class="p-4 border-t border-[#334155] flex items-center justify-between gap-2">
        <div class="flex items-center gap-2 overflow-hidden min-w-0">
          <div class="w-8 h-8 rounded-full bg-zinc-700 flex items-center justify-center font-bold text-xs text-zinc-200 shrink-0">
            ${esc(initial)}
          </div>
          <div class="overflow-hidden min-w-0">
            <div class="text-xs font-bold text-white truncate">${esc(displayName)}</div>
            <div class="text-[10px] text-emerald-400 capitalize truncate">${esc(displayRole.replace(/_/g, ' '))}</div>
          </div>
        </div>
        <button type="button" onclick="AdminApp.logout()" title="Sign Out" class="p-1.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-white shrink-0">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/></svg>
        </button>
      </div>
    `;

    wireSidebarToggle();
    applyRoleVisibility(user);
    if (lastUnreadCount !== null) {
      updateUnreadBadge(lastUnreadCount);
    }
    if (!options.skipVerify && !isLoginPage) {
      verifySession();
    }
    if (!options.skipNotifFetch && !isLoginPage) {
      refreshUnreadCount();
    }
  }

  function showToast(message, type = 'success') {
    const existing = document.getElementById('adminToast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.id = 'adminToast';
    const bg = type === 'error'
      ? 'bg-red-600 border border-red-400/40'
      : (type === 'warn' ? 'bg-amber-600 border border-amber-400/40' : 'bg-emerald-600 border border-emerald-400/40');
    toast.className = `fixed bottom-6 right-6 ${bg} text-white px-5 py-3 rounded-xl shadow-2xl text-xs font-bold z-50 transition-all duration-300 max-w-md`;
    toast.textContent = String(message || '');
    document.body.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }

  function humanize(str) {
    if (!str) return '';
    return String(str)
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (ch) => ch.toUpperCase());
  }

  function formatMoney(amount, currency = 'USD', options = {}) {
    if (window.ApiClient && typeof window.ApiClient.formatCurrency === 'function') {
      return window.ApiClient.formatCurrency(amount, currency, options);
    }
    const curr = String(currency || 'USD').toUpperCase() === 'INR' ? 'INR' : 'USD';
    const num = Math.round(Math.abs(Number(amount) || 0)).toLocaleString('en-US');
    const sign = Number(amount) < 0 ? '-' : '';
    const sym = curr === 'INR' ? '₹' : '$';
    return options.withCode ? `${sign}${sym}${num} ${curr}` : `${sign}${sym}${num}`;
  }

  function formatDateShort(ts) {
    if (!ts) return '—';
    const str = String(ts).trim();
    const isoMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
    const d = isoMatch
      ? new Date(Date.UTC(Number(isoMatch[1]), Number(isoMatch[2]) - 1, Number(isoMatch[3])))
      : new Date(str);
    if (Number.isNaN(d.getTime())) return str.slice(0, 10);
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      timeZone: 'UTC'
    });
  }

  function formatDateTime(ts) {
    if (!ts) return '—';
    const d = new Date(ts);
    if (Number.isNaN(d.getTime())) return String(ts);
    return d.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  function bookingStatusBadge(status) {
    const s = String(status || 'inquiry').toLowerCase();
    if (s === 'confirmed' || s === 'fully_paid' || s === 'completed') {
      return `<span class="badge badge-green">${esc(humanize(s))}</span>`;
    }
    if (s === 'active_trip') {
      return `<span class="badge badge-purple">${esc(humanize(s))}</span>`;
    }
    if (s === 'visa_approved') {
      return `<span class="badge badge-blue">${esc(humanize(s))}</span>`;
    }
    if (s === 'deposit_paid' || s === 'documents_complete') {
      return `<span class="badge badge-amber">${esc(humanize(s))}</span>`;
    }
    if (s === 'cancelled') {
      return `<span class="badge badge-red">Cancelled</span>`;
    }
    return `<span class="badge badge-zinc">${esc(humanize(s))}</span>`;
  }

  function visaStatusBadge(visaStatus) {
    const s = String(visaStatus || 'not_started').toLowerCase();
    if (s === 'approved' || s === 'clearance_letter_issued') {
      const label = s === 'clearance_letter_issued' ? 'Clearance Issued' : 'DoI Approved';
      return `<span class="badge badge-green">${esc(label)}</span>`;
    }
    if (s === 'submitted_to_doi') {
      return `<span class="badge badge-amber">Submitted to DoI</span>`;
    }
    if (s === 'under_review' || s === 'documents_complete' || s === 'payment_verified' || s === 'docs_received') {
      return `<span class="badge badge-blue">${esc(humanize(s))}</span>`;
    }
    if (s === 'rejected') {
      return `<span class="badge badge-red">Rejected</span>`;
    }
    return `<span class="badge badge-zinc">${esc(humanize(s))}</span>`;
  }

  return {
    esc,
    requireAuth,
    verifySession,
    getStaffUser,
    getToken,
    hasRole,
    isSuperAdmin,
    canFinance,
    canOps,
    applyRoleVisibility,
    logout,
    renderSidebar,
    updateUnreadBadge,
    refreshUnreadCount,
    showToast,
    humanize,
    formatMoney,
    formatDateShort,
    formatDateTime,
    bookingStatusBadge,
    visaStatusBadge
  };
})();

window.AdminApp = AdminApp;
