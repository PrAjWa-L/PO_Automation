/**
 * utils.js — Shared utility functions
 * Available globally as window.Utils
 */

const Utils = (() => {

  /* ── Number formatting ── */
  function fmt(n) {
    return Math.round(n || 0).toLocaleString('en-IN');
  }

  function fmtNum(n) {
    if (n === null || n === undefined) return '—';
    const num = parseFloat(n);
    return isNaN(num) ? '—' : num % 1 === 0 ? num.toString() : num.toFixed(2);
  }

  function fmtDate(s) {
  if (!s) return '—';
  try {
    const d = new Date(s);
    if (isNaN(d)) return s;
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return s;
  }
} 

  function fmtDec(n, places = 2) {
    return parseFloat(n || 0).toLocaleString('en-IN', {
      minimumFractionDigits: 0,
      maximumFractionDigits: places,
    });
  }

  function fmtCurrency(n) {
    return '₹' + fmt(n);
  }

  /* ── String escaping ── */
  function esc(s) {
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /* ── Toast notifications ── */
  function toast(msg, duration = 2800) {
    const el = document.getElementById('toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(el._timer);
    el._timer = setTimeout(() => el.classList.remove('show'), duration);
  }

  function toastError(msg) {
    toast('⚠ ' + msg, 3500);
  }

  function toastSuccess(msg) {
    toast('✓ ' + msg);
  }

  /* ── Badge HTML helpers ── */
  const STATUS_CLASS = {
    'Draft':            'badge-gray',
    'Pending Approval': 'badge-amber',
    'Approved':         'badge-green',
    'Rejected':         'badge-red',
    'Closed':           'badge-teal',
    'Paid':             'badge-green',
    'Pending':          'badge-amber',
    'Failed':           'badge-red',
    'Cancelled':        'badge-gray',
  };
  const DEPT_CLASS = {
    'IT':             'badge-blue',
    'Maintenance':    'badge-purple',
    'Housekeeping':   'badge-teal',
    'Pharmacy':       'badge-green',
    'Accounts':       'badge-amber',
    'HR':             'badge-gray',
    'Administration': 'badge-gray',
  };

  function statusBadge(s) {
    const cls = STATUS_CLASS[s] || 'badge-gray';
    return `<span class="badge ${cls}">${esc(s)}</span>`;
  }

  function deptBadge(d) {
    const cls = DEPT_CLASS[d] || 'badge-gray';
    return `<span class="badge ${cls}">${esc(d)}</span>`;
  }

  function payBadge(s) {
    return statusBadge(s);
  }

  /* ── Today's date as YYYY-MM-DD ── */
  function today() {
    return new Date().toISOString().split('T')[0];
  }

  /* ── Set <input type=date> to today if empty ── */
  function setDateDefault(id) {
    const el = document.getElementById(id);
    if (el && !el.value) el.value = today();
  }

  /* ── Empty state HTML ── */
  function emptyState(icon, msg) {
    return `<div class="empty">
      <div class="empty-icon">${icon}</div>
      <p>${esc(msg)}</p>
    </div>`;
  }

  /* ── Loading state HTML ── */
  function loadingState() {
    return `<div class="empty">
      <div class="empty-icon spin">⟳</div>
      <p>Loading…</p>
    </div>`;
  }

  /* ── Truncate string ── */
  function truncate(s, n = 60) {
    const str = String(s || '');
    return str.length > n ? str.slice(0, n) + '…' : str;
  }

  /* ── Update sidebar badge ── */
  function setNavBadge(id, count) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = count > 0 ? count : '';
  }

  /* ── Mark active nav link ── */
  function setActiveNav(page) {
    document.querySelectorAll('.nav-it').forEach(link => {
      link.classList.toggle('active', link.dataset.page === page);
    });
  }

  return {
    fmt, fmtDec, fmtCurrency,fmtNum,fmtDate,
    esc,
    toast, toastError, toastSuccess,
    statusBadge, deptBadge, payBadge,
    today, setDateDefault,
    emptyState, loadingState, truncate,
    setNavBadge, setActiveNav,
  };
})();

/* Make available globally */
window.Utils = Utils;
