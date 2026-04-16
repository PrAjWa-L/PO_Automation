/**
 * reports.js — Reports & Analytics page
 * Exposes: window.Reports
 */

const Reports = (() => {

  async function load() {
    await Promise.all([_loadStats(), _loadPaymentSummary(), _loadPOBreakdown()]);
  }

  async function _loadStats() {
    const r = await API.POs.stats();
    if (!r.success || !r.data) return;
    const d = r.data;
    _set('rpt-spend', Utils.fmtCurrency(d.ytd_spend || 0));
    _set('rpt-total', d.total_pos || 0);
    _set('rpt-draft', d.draft     || 0);
    _set('rpt-pend',  d.pending   || 0);
  }

  async function _loadPaymentSummary() {
    const wrap = document.getElementById('rpt-pay-summary');
    if (!wrap) return;

    const r = await API.Payments.summary();
    if (!r.success || !r.data) {
      wrap.innerHTML = '<p style="font-size:12.5px;color:var(--text3);">No payment data available.</p>';
      return;
    }

    const data   = r.data;
    const total  = Object.values(data).reduce((a, b) => a + b, 0) || 1;
    const colors = {
      'Paid':      'var(--green)',
      'Pending':   'var(--amber)',
      'Failed':    'var(--red)',
      'Cancelled': 'var(--border2)',
    };

    wrap.innerHTML = Object.entries(data).map(([status, amt]) => `
      <div class="sb-row">
        <div class="sb-labels">
          <span>${Utils.esc(status)}</span>
          <span class="amt">${Utils.fmtCurrency(amt)}</span>
        </div>
        <div class="sb-track">
          <div class="sb-fill"
               style="width:${Math.round(amt / total * 100)}%;
                      background:${colors[status] || 'var(--blue)'}">
          </div>
        </div>
      </div>`).join('');
  }

  async function _loadPOBreakdown() {
    const wrap = document.getElementById('rpt-po-breakdown');
    if (!wrap) return;

    const r = await API.POs.stats();
    if (!r.success || !r.data) return;
    const d     = r.data;
    const total = d.total_pos || 1;

    const rows = [
      ['Draft',            d.draft    || 0, 'var(--border2)'],
      ['Pending Approval', d.pending  || 0, 'var(--amber)'],
      ['Approved',         d.approved || 0, 'var(--green)'],
    ];

    wrap.innerHTML = rows.map(([label, count, color]) => `
      <div class="sb-row">
        <div class="sb-labels">
          <span>${Utils.esc(label)}</span>
          <span class="amt">${count}</span>
        </div>
        <div class="sb-track">
          <div class="sb-fill"
               style="width:${Math.round(count / total * 100)}%;background:${color}">
          </div>
        </div>
      </div>`).join('');
  }

  function _set(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  }

  return { load };
})();

window.Reports = Reports;

document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('rpt-pay-summary')) Reports.load();
});
