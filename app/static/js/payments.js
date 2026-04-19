/**
 * payments.js — Payments & UTR module
 * Exposes: window.Payments
 */

const Payments = (() => {

  let _filter   = '';
  let _all      = [];   /* full cached list for client-side search */
  let _payCtx   = {};   /* context for payment modal */
  let _utrPayId = null; /* payment ID for UTR modal  */

  const _isCOO = () => window.PROCUREIQ && window.PROCUREIQ.userRole === 'coo';

  /* ─────────────────────────────────────────────
     LIST
  ───────────────────────────────────────────── */
  async function load(statusFilter) {
    if (statusFilter !== undefined) _filter = statusFilter;
    const wrap = document.getElementById('payments-list');
    if (!wrap) return;
    wrap.innerHTML = Utils.loadingState();

    const params = _filter ? `?status=${encodeURIComponent(_filter)}` : '';
    const r = await API.Payments.list(params);
    if (!r.success) {
      wrap.innerHTML = Utils.emptyState('⚠', 'Could not load payments.');
      return;
    }
    const pays = r.data || [];
    _all = pays;
    if (!pays.length) {
      wrap.innerHTML = Utils.emptyState('💳', 'No payments recorded yet.');
      return;
    }
    wrap.innerHTML = pays.map(_card).join('');
  }

  function filter(status, tabEl) {
    document.querySelectorAll('#pay-filter-tabs .tab').forEach(t => t.classList.remove('active'));
    if (tabEl) tabEl.classList.add('active');
    const searchEl = document.getElementById('pay-search');
    if (searchEl) searchEl.value = '';
    load(status);
  }

  function search() {
    const q = (document.getElementById('pay-search')?.value || '').toLowerCase().trim();
    const wrap = document.getElementById('payments-list');
    if (!wrap) return;

    const source = _all;
    if (!source.length) return;

    const filtered = q
      ? source.filter(p =>
          [p.po_id, p.vendor_name, p.utr_number, p.payment_mode,
           p.payment_type, p.status, p.department, p.payment_date]
            .join(' ').toLowerCase().includes(q)
        )
      : source;

    if (!filtered.length) {
      wrap.innerHTML = Utils.emptyState('🔍', `No payments match "${Utils.esc(q)}".`);
      return;
    }
    wrap.innerHTML = filtered.map(_card).join('');
  }

  function _card(p) {
    const bal  = Math.max(0, (p.po_grand || 0) - p.amount);
    const paid = p.status === 'Paid';

    // Only show approval badge/controls when payment is NOT yet completed.
    // Paid payments have cleared the workflow — no COO badge needed.
    const needsApproval  = !paid;
    const approvalStatus = needsApproval ? (p.approval_status || 'Pending Approval') : null;
    const approvalCls    = approvalStatus === 'Approved' ? 'badge-green'
                         : approvalStatus === 'Rejected' ? 'badge-red'
                         : 'badge-amber';

    return `
      <div class="pay-card">
        <div class="pay-card-hd">
          <div>
            <div class="pay-card-po">${Utils.esc(p.po_id)}</div>
            <div class="pay-card-vendor">
              ${Utils.esc(p.vendor_name || '—')}
              ${p.department ? ' · ' + Utils.esc(p.department) : ''}
            </div>
          </div>
          <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px;">
            ${Utils.payBadge(p.status)}
            ${approvalStatus
              ? `<span class="badge ${approvalCls}" style="font-size:10px;">COO: ${approvalStatus}</span>`
              : ''}
          </div>
        </div>

        <div class="pay-amts">
          <div class="pay-amt-box">
            <div class="pay-amt-lbl">PO Total</div>
            <div class="pay-amt-val">${Utils.fmtCurrency(p.po_grand || 0)}</div>
          </div>
          <div class="pay-amt-box paid">
            <div class="pay-amt-lbl">Paid</div>
            <div class="pay-amt-val">${Utils.fmtCurrency(p.amount)}</div>
          </div>
          <div class="pay-amt-box ${bal > 0 ? 'pending' : ''}">
            <div class="pay-amt-lbl">Balance</div>
            <div class="pay-amt-val">${Utils.fmtCurrency(bal)}</div>
          </div>
        </div>

        <div class="pay-timeline">
          <div class="pay-step done">
            <div class="pay-step-lbl">UTR</div>
            <div class="pay-step-val" style="font-family:var(--font-mono);font-size:10px;">
              ${Utils.esc(p.utr_number || '—')}
            </div>
          </div>
          <div class="pay-step done">
            <div class="pay-step-lbl">Mode</div>
            <div class="pay-step-val">${Utils.esc(p.payment_mode || '—')}</div>
          </div>
          <div class="pay-step done">
            <div class="pay-step-lbl">Date</div>
            <div class="pay-step-val">${Utils.esc(p.payment_date || '—')}</div>
          </div>
          <div class="pay-step done">
            <div class="pay-step-lbl">Type</div>
            <div class="pay-step-val">${Utils.esc(p.payment_type || '—')}</div>
          </div>
          <div class="pay-step ${paid ? 'done' : 'pend'}">
            <div class="pay-step-lbl">Status</div>
            <div class="pay-step-val">${Utils.esc(p.status)}</div>
          </div>
        </div>

        <div class="pay-card-actions">
          ${_isCOO() && approvalStatus === 'Pending Approval'
            ? `<button class="btn btn-sm btn-green"
                       onclick="Payments.approve(${p.id})">
                 ✓ Approve
               </button>
               <button class="btn btn-sm btn-red"
                       onclick="Payments.rejectPayment(${p.id})">
                 ✕ Reject
               </button>`
            : ''}
          ${!paid && approvalStatus === 'Approved'
            ? `<button class="btn btn-sm btn-primary"
                       onclick="Payments.openUTR(${p.id},'${Utils.esc(p.po_id)}','${Utils.esc(p.vendor_name || '')}',${p.amount})">
                 Enter UTR →
               </button>`
            : ''}
          ${!paid && approvalStatus === 'Pending Approval' && !_isCOO()
            ? `<span style="font-size:11px;color:var(--text3);font-style:italic;">Awaiting COO approval</span>`
            : ''}
          <button class="btn btn-sm"
                  onclick="PO && PO.view('${Utils.esc(p.po_id)}')">
            View PO
          </button>
          ${!paid && approvalStatus !== 'Approved'
            ? `<button class="btn btn-sm" style="color:var(--red);"
                       onclick="Payments.remove(${p.id})">
                 Delete
               </button>`
            : ''}
        </div>
      </div>`;
  }

  /* ─────────────────────────────────────────────
     RECORD PAYMENT MODAL
  ───────────────────────────────────────────── */
  function openModal(poId, vendor, total, due) {
    _payCtx = { poId: poId || '', vendor: vendor || '', total: total || 0 };

    _set('pay-modal-title', 'Record Payment' + (poId ? ' — ' + poId : ''));
    _set('pay-po-lbl',      poId   || '—');
    _set('pay-vendor-lbl',  vendor || '—');
    _set('pay-total-lbl',   Utils.fmtCurrency(total || 0));

    _fld('pay-po-id',  poId    || '');
    _fld('pay-amount', due     || '');
    _fld('pay-date',   Utils.today());
    _fld('pay-utr',    '');
    _fld('pay-remarks','');
    _fld('pay-balance', Utils.fmt(Math.max(0, (total || 0) - (due || 0))));

    Modal.open('pay-modal');
  }

  function updateBalance() {
    const amt = +(_fldVal('pay-amount') || 0);
    _fld('pay-balance', Utils.fmt(Math.max(0, (_payCtx.total || 0) - amt)));
  }

  async function save() {
    const poId = _fldVal('pay-po-id');
    if (!poId)  { Utils.toast('PO Number is required.');     return; }
    const amt  = +(_fldVal('pay-amount') || 0);
    if (!amt)   { Utils.toast('Amount is required.');         return; }
    const date = _fldVal('pay-date');
    if (!date)  { Utils.toast('Payment date is required.');   return; }

    const body = {
      po_id:        poId,
      amount:       amt,
      payment_date: date,
      payment_mode: document.getElementById('pay-mode')?.value || 'NEFT',
      payment_type: document.getElementById('pay-type')?.value || 'Full',
      remarks:      _fldVal('pay-remarks') || null,
    };

    const r = await API.Payments.create(body);
    if (r.success) {
      Utils.toastSuccess('Payment recorded — awaiting COO approval.');
      Modal.close('pay-modal');
      load();
    } else {
      Utils.toastError(r.message);
    }
  }

  /* ─────────────────────────────────────────────
     COO APPROVE / REJECT
  ───────────────────────────────────────────── */
  async function approve(id) {
    if (!confirm('Approve this payment?')) return;
    const r = await API.Payments.approve(id);
    if (r.success) {
      Utils.toastSuccess('Payment approved — accounts can now enter UTR.');
      load();
    } else {
      Utils.toastError(r.message);
    }
  }

  async function rejectPayment(id) {
    const remarks = prompt('Reason for rejection (optional):') ?? '';
    const r = await API.Payments.reject(id, { remarks });
    if (r.success) {
      Utils.toastSuccess('Payment rejected.');
      load();
    } else {
      Utils.toastError(r.message);
    }
  }

  /* ─────────────────────────────────────────────
     UTR QUICK ENTRY
  ───────────────────────────────────────────── */
  function openUTR(payId, poId, vendor, amount) {
    _utrPayId = payId;
    _set('utr-modal-title', 'Enter UTR — ' + poId);
    document.getElementById('utr-summary').innerHTML =
      `<strong>${Utils.esc(poId)}</strong> · ${Utils.esc(vendor)} · <strong>${Utils.fmtCurrency(amount)}</strong>`;
    _fld('utr-val',     '');
    _fld('utr-remarks', '');
    Modal.open('utr-modal');
  }

  async function submitUTR() {
    const utr = (_fldVal('utr-val') || '').toUpperCase();
    if (!utr) { Utils.toast('UTR number is required.'); return; }

    const r = await API.Payments.recordUTR(_utrPayId, {
      utr_number:   utr,
      payment_mode: document.getElementById('utr-mode')?.value || 'NEFT',
      remarks:      _fldVal('utr-remarks') || null,
    });

    if (r.success) {
      Utils.toastSuccess(`UTR ${utr} recorded — payment marked Paid.`);
      Modal.close('utr-modal');
      load();
      if (typeof Dashboard !== 'undefined') Dashboard.load();
    } else {
      Utils.toastError(r.message);
    }
  }

  /* ─────────────────────────────────────────────
     DELETE
  ───────────────────────────────────────────── */
  async function remove(id) {
    if (!confirm('Delete this payment record?')) return;
    const r = await API.Payments.remove(id);
    if (r.success) { Utils.toastSuccess('Payment deleted.'); load(); }
    else Utils.toastError(r.message);
  }

  /* ── Helpers ── */
  function _fld(id, val) { const el = document.getElementById(id); if (el) el.value = val; }
  function _fldVal(id)   { return document.getElementById(id)?.value.trim() || ''; }
  function _set(id, txt) { const el = document.getElementById(id); if (el) el.textContent = txt; }

  return { load, filter, search, openModal, updateBalance, save, openUTR, submitUTR, approve, rejectPayment, remove };
})();

window.Payments = Payments;

document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('payments-list')) Payments.load();
});