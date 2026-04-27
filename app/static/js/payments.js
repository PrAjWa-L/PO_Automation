/**
 * payments.js — Payments & UTR module
 * Cards are grouped per PO. Each card has a collapsible list of instalment rows.
 * Exposes: window.Payments
 */

const Payments = (() => {

  let _filter   = '';
  let _all      = [];   // grouped PO list cached for search
  let _payCtx   = {};   // context for payment modal
  let _utrPayId = null; // payment ID for UTR modal

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
    const groups = r.data || [];
    _all = groups;
    if (!groups.length) {
      wrap.innerHTML = Utils.emptyState('💳', 'No payments recorded yet.');
      return;
    }
    wrap.innerHTML = groups.map(_poCard).join('');
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
    if (!_all.length) return;

    const filtered = q
      ? _all.filter(g =>
          [g.po_id, g.vendor_name, g.department,
           ...g.payments.map(p => [p.utr_number, p.payment_mode, p.payment_type, p.status].join(' '))
          ].join(' ').toLowerCase().includes(q)
        )
      : _all;

    if (!filtered.length) {
      wrap.innerHTML = Utils.emptyState('🔍', `No payments match "${Utils.esc(q)}".`);
      return;
    }
    wrap.innerHTML = filtered.map(_poCard).join('');
  }

  /* ─────────────────────────────────────────────
     PO GROUP CARD
  ───────────────────────────────────────────── */
  function _poCard(g) {
    const bal        = g.balance || 0;
    const totalPaid  = g.total_paid || 0;
    const grandTotal = g.grand_total || 0;
    const count      = g.payments.length;

    // Overall PO payment status
    const fullyPaid  = bal <= 0.01;
    const statusCls  = fullyPaid ? 'badge-green' : (totalPaid > 0 ? 'badge-amber' : 'badge-red');
    const statusLbl  = fullyPaid ? 'Fully Paid'  : (totalPaid > 0 ? 'Partially Paid' : 'Unpaid');

    const uid = 'pg-' + g.po_id.replace(/[^a-z0-9]/gi, '-');

    return `
    <div class="po-pay-card" id="${uid}">

      <!-- Header row -->
      <div class="po-pay-hd" onclick="Payments.toggleRows('${uid}')">
        <div class="po-pay-hd-left">
          <div class="po-pay-po">${Utils.esc(g.po_id)}</div>
          <div class="po-pay-meta">
            ${Utils.esc(g.vendor_name || '—')}
            ${g.department ? ' · ' + Utils.esc(g.department) : ''}
          </div>
        </div>
        <div class="po-pay-hd-right">
          <div class="po-pay-financials">
            <div class="po-pay-fin-box">
              <div class="po-pay-fin-lbl">PO Total</div>
              <div class="po-pay-fin-val">${Utils.fmtCurrency(grandTotal)}</div>
            </div>
            <div class="po-pay-fin-box paid">
              <div class="po-pay-fin-lbl">Paid</div>
              <div class="po-pay-fin-val">${Utils.fmtCurrency(totalPaid)}</div>
            </div>
            <div class="po-pay-fin-box ${bal > 0.01 ? 'balance' : 'done'}">
              <div class="po-pay-fin-lbl">Balance</div>
              <div class="po-pay-fin-val">${Utils.fmtCurrency(bal)}</div>
            </div>
          </div>
          <div style="display:flex;align-items:center;gap:8px;margin-left:12px;">
            <span class="badge ${statusCls}">${statusLbl}</span>
            <span class="po-pay-count">${count} payment${count !== 1 ? 's' : ''}</span>
            <span class="po-pay-chevron" id="${uid}-chev">▾</span>
          </div>
        </div>
      </div>

      <!-- Collapsible payment rows -->
      <div class="po-pay-rows" id="${uid}-rows">
        <div class="po-pay-rows-inner">
          ${g.payments.map((p, i) => _payRow(p, g, i)).join('')}
          <div class="po-pay-row-actions">
            ${bal > 0.01
              ? `<button class="btn btn-sm btn-primary"
                         onclick="event.stopPropagation();Payments.openPayRemaining('${Utils.esc(g.po_id)}','${Utils.esc(g.vendor_name||'')}',${grandTotal},${bal})">
                   + Pay Remaining ${Utils.fmtCurrency(bal)}
                 </button>`
              : `<span style="font-size:12px;color:var(--green);font-weight:600;">✓ Fully settled</span>`
            }
            <button class="btn btn-sm"
                    onclick="event.stopPropagation();PO && PO.view('${Utils.esc(g.po_id)}')">
              View PO
            </button>
          </div>
        </div>
      </div>

    </div>`;
  }

  function _payRow(p, g, idx) {
    const paid           = p.status === 'Paid';
    const approvalStatus = paid ? null : (p.approval_status || 'Pending Approval');
    const approvalCls    = approvalStatus === 'Approved' ? 'badge-green'
                         : approvalStatus === 'Rejected' ? 'badge-red'
                         : 'badge-amber';

    return `
    <div class="po-pay-row ${paid ? 'row-paid' : 'row-pending'}">
      <div class="po-pay-row-idx">#${idx + 1}</div>

      <div class="po-pay-row-body">
        <div class="po-pay-row-chips">
          ${Utils.payBadge(p.status)}
          ${approvalStatus
            ? `<span class="badge ${approvalCls}" style="font-size:10px;">COO: ${approvalStatus}</span>`
            : ''}
          <span class="po-pay-chip">${Utils.esc(p.payment_type || '—')}</span>
          <span class="po-pay-chip">${Utils.esc(p.payment_mode || '—')}</span>
        </div>
        <div class="po-pay-row-details">
          <span class="po-pay-row-amt">${Utils.fmtCurrency(p.amount)}</span>
          <span class="po-pay-row-sep">·</span>
          <span>${Utils.esc(p.payment_date || '—')}</span>
          ${p.utr_number
            ? `<span class="po-pay-row-sep">·</span>
               <span style="font-family:var(--font-mono);font-size:11px;color:var(--text2);">
                 UTR: ${Utils.esc(p.utr_number)}
               </span>`
            : ''}
          ${p.remarks
            ? `<span class="po-pay-row-sep">·</span>
               <span style="font-size:11px;color:var(--text3);font-style:italic;">${Utils.esc(p.remarks)}</span>`
            : ''}
        </div>
      </div>

      <div class="po-pay-row-btns">
        ${_isCOO() && approvalStatus === 'Pending Approval'
          ? `<button class="btn btn-sm btn-green" onclick="event.stopPropagation();Payments.approve(${p.id})">✓ Approve</button>
             <button class="btn btn-sm btn-red"   onclick="event.stopPropagation();Payments.rejectPayment(${p.id})">✕ Reject</button>`
          : ''}
        ${!paid && approvalStatus === 'Approved'
          ? `<button class="btn btn-sm btn-primary"
                     onclick="event.stopPropagation();Payments.openUTR(${p.id},'${Utils.esc(p.po_id)}','${Utils.esc(g.vendor_name||'')}',${p.amount})">
               Enter UTR →
             </button>`
          : ''}
        ${!paid && approvalStatus === 'Pending Approval' && !_isCOO()
          ? `<span class="po-pay-awaiting">Awaiting COO approval</span>`
          : ''}
        ${!paid && approvalStatus !== 'Approved'
          ? `<button class="btn btn-sm" style="color:var(--red);"
                     onclick="event.stopPropagation();Payments.remove(${p.id})">Delete</button>`
          : ''}
      </div>
    </div>`;
  }

  /* ─────────────────────────────────────────────
     TOGGLE DROPDOWN
  ───────────────────────────────────────────── */
  function toggleRows(uid) {
    const rows = document.getElementById(uid + '-rows');
    const chev = document.getElementById(uid + '-chev');
    if (!rows) return;
    const open = rows.classList.toggle('open');
    if (chev) chev.textContent = open ? '▴' : '▾';
  }

  /* ─────────────────────────────────────────────
     RECORD PAYMENT MODAL
  ───────────────────────────────────────────── */
  function openModal(poId, vendor, total, due, alreadyPaid) {
    _payCtx = {
      poId:        poId       || '',
      vendor:      vendor     || '',
      total:       total      || 0,
      alreadyPaid: alreadyPaid != null ? alreadyPaid : 0,
    };

    _set('pay-modal-title',    'Record Payment' + (poId ? ' — ' + poId : ''));
    _set('pay-po-lbl',         poId   || '—');
    _set('pay-vendor-lbl',     vendor || '—');
    _set('pay-total-lbl',      Utils.fmtCurrency(total || 0));
    _set('pay-already-paid-lbl', Utils.fmtCurrency(_payCtx.alreadyPaid || 0));

    _fld('pay-po-id',   poId  || '');
    _fld('pay-amount',  due   || '');
    _fld('pay-date',    Utils.today());
    _fld('pay-utr',     '');
    _fld('pay-remarks', '');

    const initAmt   = +(due || 0);
    const remaining = Math.max(0, (_payCtx.total || 0) - _payCtx.alreadyPaid - initAmt);
    _fld('pay-balance', Utils.fmt(remaining));

    Modal.open('pay-modal');
  }

  function openPayRemaining(poId, vendor, total, balance) {
    openModal(poId, vendor, total, balance, total - balance);
    const typeEl = document.getElementById('pay-type');
    if (typeEl) typeEl.value = 'Final';
  }

  function updateBalance() {
    const amt         = +(_fldVal('pay-amount') || 0);
    const alreadyPaid = _payCtx.alreadyPaid || 0;
    _fld('pay-balance', Utils.fmt(Math.max(0, (_payCtx.total || 0) - alreadyPaid - amt)));
  }

  async function save() {
    const poId = _fldVal('pay-po-id');
    if (!poId) { Utils.toast('PO Number is required.');   return; }
    const amt  = +(_fldVal('pay-amount') || 0);
    if (!amt)  { Utils.toast('Amount is required.');      return; }
    const date = _fldVal('pay-date');
    if (!date) { Utils.toast('Payment date is required.'); return; }

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
  function _fld(id, val)  { const el = document.getElementById(id); if (el) el.value = val; }
  function _fldVal(id)    { return document.getElementById(id)?.value.trim() || ''; }
  function _set(id, txt)  { const el = document.getElementById(id); if (el) el.textContent = txt; }

  return {
    load, filter, search,
    openModal, openPayRemaining, updateBalance, save,
    openUTR, submitUTR,
    approve, rejectPayment,
    remove, toggleRows,
  };
})();

window.Payments = Payments;

document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('payments-list')) Payments.load();
});