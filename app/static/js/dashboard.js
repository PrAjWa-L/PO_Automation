/**
 * dashboard.js — Dashboard page logic
 * Exposes: window.Dashboard (auto-runs on DOMContentLoaded)
 */

const Dashboard = (() => {

  async function load() {
    await Promise.all([_loadStats(), _loadRecentPOs(), _loadPendingUTR()]);
  }

  /* ── Stats ── */
  async function _loadStats() {
    const r = await API.POs.stats();
    if (!r.success || !r.data) return;
    const d = r.data;
    _set('ds-total',   d.total_pos || 0);
    _set('ds-pending', d.pending   || 0);
    _set('ds-approved',d.approved  || 0);
    _set('ds-spend',   Utils.fmtCurrency(d.ytd_spend || 0));

    /* Update sidebar badges */
    Utils.setNavBadge('nb-po',   (d.draft || 0) + (d.pending || 0));
    Utils.setNavBadge('nb-appr',  d.pending || 0);
  }

  /* ── Recent POs ── */
  async function _loadRecentPOs() {
    const wrap = document.getElementById('dash-recent-po');
    if (!wrap) return;

    const r = await API.POs.list('');
    if (!r.success) {
      wrap.innerHTML = Utils.emptyState('⚠', 'Backend offline.');
      return;
    }
    const pos = (r.data || []).slice(0, 5);
    if (!pos.length) {
      wrap.innerHTML = Utils.emptyState('📋', 'No POs yet. Create your first.');
      return;
    }
    wrap.innerHTML = `
      <table>
        <thead>
          <tr>
            <th>PO #</th><th>Vendor</th><th>Amount</th><th>Status</th>
          </tr>
        </thead>
        <tbody>
          ${pos.map(p => `
            <tr>
              <td class="mono">${Utils.esc(p.id)}</td>
              <td>${Utils.esc(p.vendor_name || '—')}</td>
              <td class="amt">${Utils.fmtCurrency(p.grand_total)}</td>
              <td>${Utils.statusBadge(p.status)}</td>
            </tr>`).join('')}
        </tbody>
      </table>`;
  }

  /* ── Pending UTR ── */
  async function _loadPendingUTR() {
    const wrap = document.getElementById('dash-pending-utr');
    if (!wrap) return;

    const r = await API.Payments.pendingUTR();
    if (!r.success) {
      wrap.innerHTML = Utils.emptyState('⚠', 'Could not load payment data.');
      return;
    }
    const pays = r.data || [];
    Utils.setNavBadge('nb-pay', pays.length);

    if (!pays.length) {
      wrap.innerHTML = Utils.emptyState('✅', 'No pending UTR entries.');
      return;
    }
    wrap.innerHTML = `
      <div style="padding:12px 14px;display:flex;flex-direction:column;gap:8px;">
        ${pays.map(p => `
          <div class="utr-alert-card">
            <div class="utr-alert-header">
              <div>
                <div class="utr-alert-po">
                  ${Utils.esc(p.po_id)} · ${Utils.esc(p.vendor_name || '—')}
                </div>
                <div class="utr-alert-meta">
                  ${Utils.fmtCurrency(p.amount)}
                  · ${Utils.esc(p.payment_mode || 'NEFT')}
                  · ${Utils.esc(p.payment_type)}
                </div>
              </div>
              <button class="btn btn-sm btn-primary"
                      onclick="Payments.openUTR(${p.id},'${Utils.esc(p.po_id)}','${Utils.esc(p.vendor_name || '')}',${p.amount})">
                Enter UTR →
              </button>
            </div>
          </div>`).join('')}
      </div>`;
  }

  function _set(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  }

  return { load };
})();

window.Dashboard = Dashboard;

document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('dash-stats')) Dashboard.load();
});
