// Shared API helper
const API = {
  getToken() { return localStorage.getItem('token'); },
  getUser() {
    const u = localStorage.getItem('user');
    return u ? JSON.parse(u) : null;
  },
  setAuth(token, user) {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
  },
  clearAuth() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  },

  async request(method, url, data = null) {
    const opts = {
      method,
      headers: { 'Content-Type': 'application/json' }
    };
    const token = this.getToken();
    if (token) opts.headers['Authorization'] = 'Bearer ' + token;
    if (data) opts.body = JSON.stringify(data);

    const res = await fetch(url, opts);
    const json = await res.json().catch(() => ({}));

    if (res.status === 401) {
      this.clearAuth();
      window.location.href = '/';
      return;
    }

    if (!res.ok) throw new Error(json.error || 'Unbekannter Fehler');
    return json;
  },

  get(url) { return this.request('GET', url); },
  post(url, data) { return this.request('POST', url, data); },
  put(url, data) { return this.request('PUT', url, data); },
  del(url) { return this.request('DELETE', url); },

  async upload(url, formData) {
    const token = this.getToken();
    const res = await fetch(url, {
      method: 'POST',
      headers: token ? { 'Authorization': 'Bearer ' + token } : {},
      body: formData
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error || 'Upload-Fehler');
    return json;
  }
};

// UI helpers
function showToast(msg, type = 'success') {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.className = 'toast toast-' + type;
  t.style.display = 'block';
  setTimeout(() => { t.style.display = 'none'; }, 3500);
}

function statusBadge(status) {
  const map = {
    new: ['badge-new', 'Neu'],
    contacted: ['badge-contacted', 'Kontaktiert'],
    appointment: ['badge-appointment', 'Termin'],
    closed: ['badge-closed', 'Abgeschlossen'],
    active: ['badge-active', 'Aktiv'],
    paused: ['badge-paused', 'Pausiert'],
    ended: ['badge-ended', 'Beendet'],
    draft: ['badge-draft', 'Entwurf'],
    sent: ['badge-sent', 'Gesendet'],
    paid: ['badge-paid', 'Bezahlt'],
    invoice: ['badge-invoice', 'Rechnung'],
    offer: ['badge-offer', 'Angebot'],
    high: ['badge-active', 'Hoch'],
    normal: ['badge-sent', 'Normal'],
    low: ['badge-draft', 'Niedrig'],
  };
  const [cls, label] = map[status] || ['badge-draft', status];
  return `<span class="badge ${cls}">${label}</span>`;
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatDateTime(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function formatCurrency(amount) {
  if (amount == null) return '—';
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(amount);
}

function openModal(id) {
  document.getElementById(id)?.classList.add('open');
}

function closeModal(id) {
  document.getElementById(id)?.classList.remove('open');
}

function showLoading(containerId) {
  const el = document.getElementById(containerId);
  if (el) el.innerHTML = '<div class="loading-overlay"><div class="spinner" style="border-color: var(--gray-300); border-top-color: var(--gray-600)"></div> Laden...</div>';
}

function initNav(activeKey) {
  document.querySelectorAll('.nav-item[data-key]').forEach(el => {
    el.classList.toggle('active', el.dataset.key === activeKey);
  });

  // Logout
  document.getElementById('btnLogout')?.addEventListener('click', () => {
    API.clearAuth();
    window.location.href = '/';
  });

  // Set user info in sidebar
  const user = API.getUser();
  if (user) {
    const nameEl = document.getElementById('sidebarUserName');
    const avatarEl = document.getElementById('sidebarAvatar');
    if (nameEl) nameEl.textContent = user.name;
    if (avatarEl) avatarEl.textContent = user.name?.charAt(0).toUpperCase() || '?';
  }
}

function requireAuth(requiredRole) {
  const user = API.getUser();
  const token = API.getToken();
  if (!token || !user) {
    window.location.href = '/';
    return null;
  }
  if (requiredRole && user.role !== requiredRole) {
    if (user.role === 'admin') window.location.href = '/admin/';
    else window.location.href = '/client/';
    return null;
  }
  return user;
}
