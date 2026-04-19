/**
 * api.js — Centralised HTTP client for the Flask backend
 *
 * Every route in the backend returns:
 *   { success: true/false, message: "…", data: … }
 *
 * Usage:
 *   const r = await API.get('/api/vendors');
 *   if (r.success) { ... r.data ... }
 */

const API = (() => {

  /* Base URL — set from window.PROCUREIQ.apiBase or localStorage */
  let _base = '';

  function _getBase() {
    if (_base) return _base;
    _base = (
      (window.PROCUREIQ && window.PROCUREIQ.apiBase) ||
      localStorage.getItem('procureiq_api') ||
      'http://localhost:8001'
    ).replace(/\/+$/, '');
    return '';
  }

  function setBase(url) {
    _base = url.replace(/\/+$/, '');
    localStorage.setItem('procureiq_api', _base);
  }

  /* ── Core fetch wrapper ── */
  async function _fetch(path, opts = {}) {
  const url = _getBase() + path;
  try {
    const res = await fetch(url, {
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',  // send cookies for session auth
      ...opts,
    });
      const json = await res.json();
      return json;
    } catch (e) {
      console.error('API error:', path, e);
      return { success: false, message: e.message || 'Network error' };
    }
  }

  /* ── Multipart (file upload) ── */
  async function _fetchForm(path, formData) {
  const url = _getBase() + path;
  try {
    const res = await fetch(url, { method: 'POST', body: formData, credentials: 'include' });
      return await res.json();
    } catch (e) {
      console.error('API form error:', path, e);
      return { success: false, message: e.message || 'Network error' };
    }
  }

  /* ── HTTP verbs ── */
  const get    = (path)         => _fetch(path);
  const post   = (path, body)   => _fetch(path, { method: 'POST',   body: JSON.stringify(body) });
  const put    = (path, body)   => _fetch(path, { method: 'PUT',    body: JSON.stringify(body) });
  const patch  = (path, body)   => _fetch(path, { method: 'PATCH',  body: JSON.stringify(body) });
  const del    = (path)         => _fetch(path, { method: 'DELETE' });
  const upload = (path, fd)     => _fetchForm(path, fd);

  /* ────────────────────────────────────────────
     HEALTH
  ──────────────────────────────────────────── */
  const health = () => get('/api/health');
  const Indents = {
    list:       (params = '') => get(`/api/indents${params}`),
    stats:      ()            => get('/api/indents/stats'),
    nextId:     ()            => get('/api/indents/next-id'),
    get:        (id)          => get(`/api/indents/${id}`),
    create:     (body)        => post('/api/indents', body),
    update:     (id, body)    => put(`/api/indents/${id}`, body),
    remove:     (id)          => del(`/api/indents/${id}`),
    approve:    (id)          => patch(`/api/indents/${id}/approve`, {}),
    reject:     (id, body)    => patch(`/api/indents/${id}/reject`, body),
    markRFQSent:(id)          => patch(`/api/indents/${id}/rfq-sent`, {}),
  };   

  /* ────────────────────────────────────────────
     VENDORS   /api/vendors
  ──────────────────────────────────────────── */
  const Vendors = {
    list:   ()        => get('/api/vendors'),
    get:    (id)      => get(`/api/vendors/${id}`),
    create: (body)    => post('/api/vendors', body),
    update: (id, body)=> put(`/api/vendors/${id}`, body),
    remove: (id)      => del(`/api/vendors/${id}`),
  };

  /* ────────────────────────────────────────────
     PURCHASE ORDERS   /api/purchase-orders
  ──────────────────────────────────────────── */
  const POs = {
    list:       (params = '') => get(`/api/purchase-orders${params}`),
    stats:      ()            => get('/api/purchase-orders/stats'),
    get:        (id)          => get(`/api/purchase-orders/${id}`),
    create:     (body)        => post('/api/purchase-orders', body),
    update:     (id, body)    => put(`/api/purchase-orders/${id}`, body),
    remove:     (id)          => del(`/api/purchase-orders/${id}`),
    setStatus:  (id, body)    => patch(`/api/purchase-orders/${id}/status`, body),
  };

  /* ────────────────────────────────────────────
     PAYMENTS   /api/payments
  ──────────────────────────────────────────── */
  const Payments = {
    list:       (params = '') => get(`/api/payments${params}`),
    pendingUTR: ()            => get('/api/payments/pending-utr'),
    summary:    ()            => get('/api/payments/summary'),
    get:        (id)          => get(`/api/payments/${id}`),
    create:     (body)        => post('/api/payments', body),
    update:     (id, body)    => put(`/api/payments/${id}`, body),
    recordUTR:  (id, body)    => patch(`/api/payments/${id}/utr`, body),
    approve:    (id)          => patch(`/api/payments/${id}/approve`, {}),
    reject:     (id, body)    => patch(`/api/payments/${id}/reject-payment`, body),
    remove:     (id)          => del(`/api/payments/${id}`),
  };

  /* ────────────────────────────────────────────
     QUOTATIONS   /api/quotations
  ──────────────────────────────────────────── */
  const Quotations = {
    list:   (params = '') => get(`/api/quotations${params}`),
    get:    (id)          => get(`/api/quotations/${id}`),
    create: (formData)    => upload('/api/quotations', formData),
    remove: (id)          => del(`/api/quotations/${id}`),
  };

  /* ────────────────────────────────────────────
     AI   /api/ai
  ──────────────────────────────────────────── */
  const AI = {
    compare: (body) => post('/api/ai/compare-quotations', body),
  };

  return {
    setBase,
    health,
    Vendors,
    POs,
    Payments,
    Quotations,
    AI,
    Indents
  };
})();

window.API = API;