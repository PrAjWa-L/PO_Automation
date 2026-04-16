/**
 * approvals.js — Approvals page logic
 * Exposes: window.Approvals
 */

const Approvals = (() => {

  async function load() {
    const wrap = document.getElementById('approvals-wrap');
    if (!wrap) return;
    wrap.innerHTML = Utils.loadingState();

    const r = await API.POs.list('?status=Pending%20Approval');
    if (!r.success) {
      wrap.innerHTML = Utils.emptyState('⚠', 'Could not load approvals.');
      return;
    }
    const pos = r.data || [];
    if (!pos.length) {
      wrap.innerHTML = Utils.emptyState('✅', 'No pending approvals. All clear!');
      return;
    }

    wrap.innerHTML = `
      <table>
        <thead>
          <tr>
            <th>PO #</th>
            <th>Vendor</th>
            <th>Dept</th>
            <th>Requested By</th>
            <th>PO Date</th>
            <th>Amount</th>
            <th>Payment Terms</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${pos.map(p => `
            <tr>
              <td class="mono">${Utils.esc(p.id)}</td>
              <td>${Utils.esc(p.vendor_name || '—')}</td>
              <td>${Utils.deptBadge(p.department)}</td>
              <td style="font-size:11.5px;">${Utils.esc(p.requested_by || '—')}</td>
              <td style="font-size:11.5px;color:var(--text3);">${Utils.esc(p.po_date || '—')}</td>
              <td class="amt">${Utils.fmtCurrency(p.grand_total)}</td>
              <td style="font-size:11.5px;">${Utils.esc(p.payment_terms || '—')}</td>
              <td>
                <div style="display:flex;gap:5px;">
                  <button class="btn btn-sm btn-primary"
                          onclick="Approvals.approve('${Utils.esc(p.id)}')">
                    Approve
                  </button>
                  <button class="btn btn-sm btn-red"
                          onclick="Approvals.reject('${Utils.esc(p.id)}')">
                    Reject
                  </button>
                  <button class="btn btn-sm"
                          onclick="PO && PO.view('${Utils.esc(p.id)}')">
                    View
                  </button>
                </div>
              </td>
            </tr>`).join('')}
        </tbody>
      </table>`;
  }

 async function approve(id) {
    const r = await API.POs.setStatus(id, {
      status:      'Approved',
      approved_by: window.CURRENT_USER_DISPLAY || 'COO',
    });
    if (r.success) {
      Utils.toastSuccess(`PO ${id} approved.`);
      load();
    } else {
      Utils.toastError(r.message);
    }
  }

  async function reject(id) {
    const reason = prompt(`Reason for rejecting PO ${id}:`);
    if (reason === null) return;          // user hit Cancel
    if (!reason.trim()) {
      Utils.toastError('A rejection reason is required.');
      return;
    }
    const r = await API.POs.setStatus(id, {
      status:           'Rejected',
      rejection_reason: reason.trim(),
    });
    if (r.success) {
      Utils.toastSuccess(`PO ${id} rejected.`);
      load();
    } else {
      Utils.toastError(r.message);
    }
  }

  return { load, approve, reject };
})();

window.Approvals = Approvals;

document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('approvals-wrap')) Approvals.load();
});