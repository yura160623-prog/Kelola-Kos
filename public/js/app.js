// KelolaKos frontend logic (Alpine.js component)
/* global Alpine */

async function api(path, options = {}) {
  const res = await fetch('/api' + path, {
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  let data = {};
  try {
    data = await res.json();
  } catch {
    /* no body */
  }
  if (!res.ok) {
    throw new Error(data.error || 'Terjadi kesalahan.');
  }
  return data;
}

function kelolaKos() {
  const now = new Date();
  return {
    // ---- state ----
    user: null,
    page: 'dashboard',
    loading: false,
    toast: '',
    modal: null,
    formError: '',

    // auth
    authMode: 'login',
    authError: '',
    registrationOpen: true,
    authForm: { name: '', username: '', phone: '', password: '' },

    // data
    dash: {},
    rooms: [],
    tenants: [],
    activeTenants: [],
    payments: [],

    // filters
    roomSearch: '',
    roomFilter: '',
    tenantSearch: '',
    tenantFilter: '',
    payMonth: now.getMonth() + 1,
    payYear: now.getFullYear(),
    payStatus: '',
    yearOptions: [now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1],

    form: {},

    // ---------- init ----------
    async init() {
      try {
        const { user } = await api('/auth/me');
        this.user = user;
        await this.loadDashboard();
      } catch {
        this.user = null;
        await this.checkRegistration();
      }
    },

    async checkRegistration() {
      try {
        const { open } = await api('/auth/registration-open');
        this.registrationOpen = open;
        if (!open && this.authMode === 'register') this.authMode = 'login';
      } catch {
        this.registrationOpen = false;
      }
    },

    // ---------- auth ----------
    async submitAuth() {
      this.authError = '';
      this.loading = true;
      try {
        const path = this.authMode === 'login' ? '/auth/login' : '/auth/register';
        const { user } = await api(path, { method: 'POST', body: this.authForm });
        this.user = user;
        this.authForm = { name: '', username: '', phone: '', password: '' };
        await this.loadDashboard();
        this.go('dashboard');
      } catch (e) {
        this.authError = e.message;
      } finally {
        this.loading = false;
      }
    },

    async logout() {
      await api('/auth/logout', { method: 'POST' }).catch(() => {});
      this.user = null;
    },

    // ---------- navigation ----------
    go(page) {
      this.page = page;
      if (page === 'dashboard') this.loadDashboard();
      if (page === 'rooms') this.loadRooms();
      if (page === 'tenants') this.loadTenants();
      if (page === 'payments') this.loadPayments();
    },

    pageTitle() {
      return {
        dashboard: 'Beranda',
        rooms: 'Kamar',
        tenants: 'Penghuni',
        payments: 'Pembayaran',
      }[this.page] || 'KelolaKos';
    },

    // ---------- loaders ----------
    async loadDashboard() {
      try {
        this.dash = await api('/dashboard');
      } catch (e) {
        this.notify(e.message);
      }
    },

    async loadRooms() {
      const params = new URLSearchParams();
      if (this.roomFilter) params.set('status', this.roomFilter);
      if (this.roomSearch) params.set('q', this.roomSearch);
      const { rooms } = await api('/rooms?' + params.toString());
      this.rooms = rooms;
    },

    async loadTenants() {
      const params = new URLSearchParams();
      if (this.tenantFilter) params.set('status', this.tenantFilter);
      if (this.tenantSearch) params.set('q', this.tenantSearch);
      const { tenants } = await api('/tenants?' + params.toString());
      this.tenants = tenants;
    },

    async loadPayments() {
      const params = new URLSearchParams();
      params.set('month', this.payMonth);
      params.set('year', this.payYear);
      if (this.payStatus) params.set('status', this.payStatus);
      const { payments } = await api('/payments?' + params.toString());
      this.payments = payments;
    },

    async ensureRoomsLoaded() {
      if (!this.rooms.length) await this.loadRooms();
    },

    async ensureActiveTenants() {
      const { tenants } = await api('/tenants?status=active');
      this.activeTenants = tenants;
    },

    // ---------- Rooms CRUD ----------
    async openRoomForm(room = null) {
      this.formError = '';
      this.form = room
        ? { ...room }
        : { room_number: '', type: 'single', price: 0, status: 'available', notes: '' };
      this.modal = 'room';
    },

    async saveRoom() {
      this.formError = '';
      this.loading = true;
      try {
        if (this.form.id) {
          await api('/rooms/' + this.form.id, { method: 'PUT', body: this.form });
        } else {
          await api('/rooms', { method: 'POST', body: this.form });
        }
        this.closeModal();
        this.notify('Kamar disimpan.');
        await this.loadRooms();
      } catch (e) {
        this.formError = e.message;
      } finally {
        this.loading = false;
      }
    },

    async deleteRoom(room) {
      if (!confirm(`Hapus Kamar ${room.room_number}?`)) return;
      try {
        await api('/rooms/' + room.id, { method: 'DELETE' });
        this.notify('Kamar dihapus.');
        await this.loadRooms();
      } catch (e) {
        this.notify(e.message);
      }
    },

    // ---------- Tenants CRUD ----------
    async openTenantForm(tenant = null) {
      this.formError = '';
      await this.ensureRoomsLoaded();
      this.form = tenant
        ? { ...tenant, room_id: tenant.room_id ?? null }
        : {
            name: '',
            phone: '',
            room_id: null,
            identity_number: '',
            start_date: new Date().toISOString().slice(0, 10),
            status: 'active',
          };
      this.modal = 'tenant';
    },

    async saveTenant() {
      this.formError = '';
      this.loading = true;
      try {
        if (this.form.id) {
          await api('/tenants/' + this.form.id, { method: 'PUT', body: this.form });
        } else {
          await api('/tenants', { method: 'POST', body: this.form });
        }
        this.closeModal();
        this.notify('Penghuni disimpan.');
        await this.loadTenants();
      } catch (e) {
        this.formError = e.message;
      } finally {
        this.loading = false;
      }
    },

    async deleteTenant(tenant) {
      if (!confirm(`Hapus penghuni ${tenant.name}? Riwayat pembayarannya juga akan terhapus.`)) return;
      try {
        await api('/tenants/' + tenant.id, { method: 'DELETE' });
        this.notify('Penghuni dihapus.');
        await this.loadTenants();
      } catch (e) {
        this.notify(e.message);
      }
    },

    // ---------- Payments CRUD ----------
    async openPaymentForm(payment = null) {
      this.formError = '';
      await this.ensureActiveTenants();
      this.form = payment
        ? { ...payment }
        : {
            tenant_id: '',
            period_month: this.payMonth,
            period_year: this.payYear,
            amount: 0,
            status: 'paid',
            payment_method: 'cash',
            paid_date: new Date().toISOString().slice(0, 10),
            notes: '',
          };
      this.modal = 'payment';
    },

    async savePayment() {
      this.formError = '';
      this.loading = true;
      try {
        if (this.form.id) {
          await api('/payments/' + this.form.id, { method: 'PUT', body: this.form });
        } else {
          if (!this.form.tenant_id) throw new Error('Pilih penghuni terlebih dahulu.');
          await api('/payments', { method: 'POST', body: this.form });
        }
        this.closeModal();
        this.notify('Pembayaran disimpan.');
        await this.loadPayments();
      } catch (e) {
        this.formError = e.message;
      } finally {
        this.loading = false;
      }
    },

    async markPaid(payment) {
      try {
        await api('/payments/' + payment.id + '/pay', { method: 'POST', body: {} });
        this.notify('Ditandai lunas.');
        await this.loadPayments();
      } catch (e) {
        this.notify(e.message);
      }
    },

    async deletePayment(payment) {
      if (!confirm('Hapus data pembayaran ini?')) return;
      try {
        await api('/payments/' + payment.id, { method: 'DELETE' });
        this.notify('Pembayaran dihapus.');
        await this.loadPayments();
      } catch (e) {
        this.notify(e.message);
      }
    },

    async generateBills() {
      if (!confirm(`Generate tagihan untuk ${this.monthName(this.payMonth)} ${this.payYear} bagi semua penghuni aktif?`))
        return;
      try {
        const r = await api('/payments/generate', {
          method: 'POST',
          body: { month: this.payMonth, year: this.payYear },
        });
        this.notify(`${r.created} tagihan dibuat, ${r.skipped} dilewati.`);
        await this.loadPayments();
      } catch (e) {
        this.notify(e.message);
      }
    },

    // ---------- helpers ----------
    closeModal() {
      this.modal = null;
      this.form = {};
      this.formError = '';
    },

    notify(msg) {
      this.toast = msg;
      clearTimeout(this._toastTimer);
      this._toastTimer = setTimeout(() => (this.toast = ''), 2600);
    },

    rupiah(n) {
      return 'Rp ' + (Number(n) || 0).toLocaleString('id-ID');
    },

    monthName(m) {
      return [
        '', 'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
        'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
      ][m] || '';
    },

    monthShort(m) {
      return ['', 'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'][m] || '';
    },

    statusLabel(s) {
      return { unpaid: 'Belum', paid: 'Lunas', late: 'Telat' }[s] || s;
    },

    roomStatusLabel(s) {
      return { available: 'Tersedia', occupied: 'Terisi', maintenance: 'Maintenance' }[s] || s;
    },

    typeLabel(t) {
      return { single: 'Single', shared: 'Shared' }[t] || t;
    },

    barHeight(total) {
      const max = Math.max(1, ...(this.dash.trend || []).map((t) => t.total));
      return Math.max(3, Math.round((total / max) * 90));
    },
  };
}

// Register the component with Alpine. Using the `alpine:init` event guarantees
// the component is defined before Alpine boots, regardless of script timing.
// (Alpine automatically calls the object's init() method on start.)
window.kelolaKos = kelolaKos;
document.addEventListener('alpine:init', () => {
  window.Alpine.data('kelolaKos', kelolaKos);
});

// Register service worker (PWA / offline-lite)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}
