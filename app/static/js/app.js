/**
 * app.js — Global bootstrap, health check, Modal helper, dropdown manager
 * Loaded last on every page (after utils.js, api.js, and page modules).
 */

/* ─────────────────────────────────────────────────────────────
   TEAM CONFIGURATION
   Edit these arrays to match your actual staff members.
───────────────────────────────────────────────────────────── */
window.ACCOUNTS_TEAM = [
  'Srinivas Nayak',
  'Santosh R',
  'Surendra',
  'Anushree',
  'Ashrita',
  'Leelavati S',
];

window.APPROVERS = [
  'Pending',
  'COO',
];

/* ─────────────────────────────────────────────────────────────
   APP NAMESPACE — global helpers
───────────────────────────────────────────────────────────── */
const App = {

  /** Show the API config banner */
  showCfgBanner() {
    document.getElementById('cfg-banner')?.classList.add('visible');
  },

  /** Hide the API config banner */
  hideCfgBanner() {
    document.getElementById('cfg-banner')?.classList.remove('visible');
  },

  /** Populate all <select data-team="accounts"> and <select data-team="approvers"> */
  populateTeamDropdowns() {
    document.querySelectorAll('select[data-team="accounts"]').forEach(sel => {
      const current = sel.value;
      sel.innerHTML = '<option value="">— Select person —</option>' +
        window.ACCOUNTS_TEAM.map(name =>
          `<option value="${name}">${name}</option>`
        ).join('');
      if (current) sel.value = current;
    });

    document.querySelectorAll('select[data-team="approvers"]').forEach(sel => {
      const current = sel.value;
      sel.innerHTML = window.APPROVERS.map(name =>
        `<option value="${name}">${name}</option>`
      ).join('');
      if (current) sel.value = current;
    });
  },

  /** Set default dates on all date inputs that don't already have a value */
  setDefaultDates() {
    document.querySelectorAll('input[type="date"]').forEach(el => {
      if (!el.value && !el.dataset.noDefault) el.value = Utils.today();
    });
  },

  /** Initialise the API base URL input in the config banner */
  initApiBase() {
    const input = document.getElementById('api-base-input');
    if (!input) return;
    const base = (window.PROCUREIQ?.apiBase) ||
                 localStorage.getItem('procureiq_api') ||
                 'http://localhost:8001';
    input.value = base;
    API.setBase(base);
  },
};

window.App = App;

/* ─────────────────────────────────────────────────────────────
   HEALTH CHECK
───────────────────────────────────────────────────────────── */

/**
 * checkHealth — tests /api/health.
 * @param {boolean} showToastOnFail  Only show a toast if user triggered it.
 */
async function checkHealth(showToastOnFail = false) {
  const dot = document.getElementById('api-dot');
  const lbl = document.getElementById('api-status');
  if (!dot || !lbl) return;

  lbl.textContent = 'checking…';
  dot.className = 'api-dot';

  const r = await API.health();
  if (r.success) {
    dot.className   = 'api-dot ok';
    lbl.textContent = 'connected';
  } else {
    dot.className   = 'api-dot err';
    lbl.textContent = 'offline';
    if (showToastOnFail) {
      Utils.toast('⚠ Backend offline — update the API URL in the banner', 4500);
    }
  }
}

/** Called when the user types a new URL into the banner input */
function setApiBase(url) {
  API.setBase(url);
  checkHealth(true);
}

/* ─────────────────────────────────────────────────────────────
   MODAL MANAGER
───────────────────────────────────────────────────────────── */
const Modal = {
  open(id) {
    document.getElementById(id)?.classList.add('open');
  },
  close(id) {
    document.getElementById(id)?.classList.remove('open');
  },
  toggleDropdown(btn) {
    const menu = btn.nextElementSibling;
    if (!menu) return;
    // Close any other open dropdowns first
    document.querySelectorAll('.dl-menu.open').forEach(m => {
      if (m !== menu) m.classList.remove('open');
    });
    menu.classList.toggle('open');
  },
};
window.Modal = Modal;

/* Close overlays on backdrop click */
document.addEventListener('click', e => {
  if (e.target.classList.contains('overlay')) {
    e.target.classList.remove('open');
  }
  // Close dropdowns on outside click
  if (!e.target.closest('.dl-wrap')) {
    document.querySelectorAll('.dl-menu.open').forEach(m => m.classList.remove('open'));
  }
});

/* ─────────────────────────────────────────────────────────────
   NAV — BADGES & ACTIVE STATE
───────────────────────────────────────────────────────────── */
async function refreshNavBadges() {
  const [statsRes, utrRes, indentRes] = await Promise.all([
    API.POs.stats(),
    API.Payments.pendingUTR(),
    API.Indents.stats(),
  ]);

  if (statsRes.success && statsRes.data) {
    const d = statsRes.data;
    Utils.setNavBadge('nb-po',   (d.draft || 0) + (d.pending || 0));
    Utils.setNavBadge('nb-appr',  d.pending || 0);
  }
  if (utrRes.success && utrRes.data) {
    Utils.setNavBadge('nb-pay', utrRes.data.length);
  }
  if (indentRes.success && indentRes.data) {
     Utils.setNavBadge('nb-indent', indentRes.data.pending || 0);
  }
}

function markActiveNav() {
  const page = window.PROCUREIQ?.currentPage || '';
  Utils.setActiveNav(page);
}

/* ─────────────────────────────────────────────────────────────
   BOOT
───────────────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  App.initApiBase();
  App.setDefaultDates();
  App.populateTeamDropdowns();
  markActiveNav();
  checkHealth(false);
  refreshNavBadges();
  if (typeof Vendors !== 'undefined') Vendors.load();  // ← add this line
});
