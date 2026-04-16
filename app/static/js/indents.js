/**
 * indents.js — Indent Master module
 * Depends on: utils.js, api.js
 * Exposes: window.Indents
 */

const IndentsModule = (() => {

  let _all       = [];
  let _filter    = '';
  let _deptFilter = '';
  let _editId    = null;
  let _rejectId  = null;

  const _isCOO = () => window.PROCUREIQ && window.PROCUREIQ.userRole === 'coo';

  /* ─────────────────────────────────────────────
     LIST & RENDER
  ───────────────────────────────────────────── */
  async function load(statusFilter) {
    if (statusFilter !== undefined) _filter = statusFilter;
    const wrap = document.getElementById('indent-table-wrap');
    if (!wrap) return;
    wrap.innerHTML = Utils.loadingState();

    let params = [];
    if (_filter)      params.push(`status=${encodeURIComponent(_filter)}`);
    if (_deptFilter)  params.push(`dept=${encodeURIComponent(_deptFilter)}`);
    const qs = params.length ? '?' + params.join('&') : '';

    const r = await API.Indents.list(qs);
    if (!r.success) {
      wrap.innerHTML = Utils.emptyState('⚠', 'Could not load indents.');
      return;
    }
    _all = r.data || [];
    _render(_all);
    _loadStats();
  }

  async function _loadStats() {
    const r = await API.Indents.stats();
    if (!r.success || !r.data) return;
    const d = r.data;
    _set('ist-total',    d.total    || 0);
    _set('ist-pending',  d.pending  || 0);
    _set('ist-approved', d.approved || 0);
    _set('ist-rfq',      d.rfq_sent || 0);
    _set('ist-rejected', d.rejected || 0);

    // Update sidebar badge
    Utils.setNavBadge('nb-indent', d.pending || 0);
  }

  function filter(status, tabEl) {
    document.querySelectorAll('#indent-filter-tabs .tab')
      .forEach(t => t.classList.remove('active'));
    if (tabEl) tabEl.classList.add('active');
    load(status);
  }

  function filterDept(dept) {
    _deptFilter = dept;
    load();
  }

  function search(q) {
    const lq = q.toLowerCase();
    const filtered = _all.filter(i =>
      [i.id, i.item_name, i.department, i.raised_by, i.status, i.priority]
        .join(' ').toLowerCase().includes(lq)
    );
    _render(filtered);
  }

  function _render(indents) {
    const wrap = document.getElementById('indent-table-wrap');
    if (!wrap) return;
    if (!indents.length) {
      wrap.innerHTML = Utils.emptyState('📋', 'No indents found.');
      return;
    }

    const isCOO = _isCOO();

    wrap.innerHTML = `
      <table>
        <thead>
          <tr>
            <th>Indent #</th>
            <th>Date</th>
            <th>Department</th>
            <th>Item</th>
            <th>Qty</th>
            <th>Priority</th>
            <th>Raised By</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${indents.map(i => _row(i, isCOO)).join('')}
        </tbody>
      </table>`;
  }

  function _row(i, isCOO) {
    const priCls = {
      Low: 'pri-low', Normal: 'pri-normal',
      High: 'pri-high', Urgent: 'pri-urgent',
    }[i.priority] || 'pri-normal';

    const statusCls = {
      Pending:  'badge-amber',
      Approved: 'badge-green',
      Rejected: 'badge-red',
      'RFQ Sent': 'badge-blue',
    }[i.status] || 'badge-gray';

    const actions = _actions(i, isCOO);

    return `
      <tr>
        <td><span style="font-family:'DM Mono',monospace;font-size:12px;">${Utils.esc(i.id)}</span></td>
        <td style="white-space:nowrap;">${i.indent_date ? Utils.fmtDate(i.indent_date) : '—'}</td>
        <td>${Utils.esc(i.department)}</td>
        <td>
          <div style="font-weight:500;">${Utils.esc(i.item_name)}</div>
          ${i.remarks
            ? `<div style="font-size:11px;color:var(--text3);margin-top:2px;">${Utils.truncate(Utils.esc(i.remarks), 50)}</div>`
            : ''}
        </td>
        <td style="white-space:nowrap;">${Utils.fmtNum(i.quantity)} ${Utils.esc(i.unit || 'Nos')}</td>
        <td><span class="badge ${priCls}">${Utils.esc(i.priority)}</span></td>
        <td>${Utils.esc(i.raised_by || '—')}</td>
        <td><span class="badge ${statusCls}">${Utils.esc(i.status)}</span></td>
        <td>
          <div class="indent-actions">
            ${actions}
          </div>
        </td>
      </tr>`;
  }

  function _actions(i, isCOO) {
    const id = Utils.esc(i.id);
    let btns = [];

    if (i.status === 'Pending') {
      // Raiser can edit/delete their own pending indent
      btns.push(`<button class="btn btn-sm" onclick="Indents.openEdit('${id}')">Edit</button>`);
      btns.push(`<button class="btn btn-sm btn-red" onclick="Indents.remove('${id}')">Delete</button>`);
    }

    if (isCOO) {
      if (i.status === 'Pending') {
        btns.push(`<button class="btn btn-sm btn-green" onclick="Indents.approve('${id}')">✓ Approve</button>`);
        btns.push(`<button class="btn btn-sm btn-red" onclick="Indents.openReject('${id}')">✕ Reject</button>`);
      }
      if (i.status === 'Approved') {
        btns.push(`<button class="btn btn-sm btn-primary" onclick="Indents.markRFQ('${id}')">↗ Send RFQ</button>`);
        btns.push(`<button class="btn btn-sm btn-red" onclick="Indents.openReject('${id}')">✕ Reject</button>`);
      }
    }

    return btns.join('') || '<span style="color:var(--text3);font-size:11px;">—</span>';
  }

  /* ─────────────────────────────────────────────
     NEW MODAL
  ───────────────────────────────────────────── */
  async function openNew() {
    _editId = null;
    _clearForm();

    // Generate indent number
    const r = await API.Indents.nextId();
    if (r.success && r.data) {
      _setField('if-num', r.data.next_id);
    }

    // Set today's date
    _setField('if-date', Utils.today());

    // Pre-select user's dept if not COO
    if (!_isCOO() && window.PROCUREIQ && window.PROCUREIQ.userDept) {
      const sel = document.getElementById('if-dept');
      if (sel) sel.value = window.PROCUREIQ.userDept;
    }

    document.getElementById('indent-modal-title').textContent = 'New Indent';
    document.getElementById('indent-modal-sub').textContent   = '';
    document.querySelector('#indent-modal .modal-footer .btn-primary').textContent = 'Submit Indent';
    Modal.open('indent-modal');
    document.getElementById('if-item')?.focus();
  }

  async function openEdit(id) {
    const r = await API.Indents.get(id);
    if (!r.success) { Utils.toastError('Could not load indent.'); return; }
    const i = r.data;

    if (i.status !== 'Pending') {
      Utils.toast('Only Pending indents can be edited.');
      return;
    }

    _editId = id;
    _clearForm();
    _setField('if-num',      i.id);
    _setField('if-date',     i.indent_date || Utils.today());
    _setField('if-item',     i.item_name);
    _setField('if-qty',      i.quantity);
    _setField('if-remarks',  i.remarks || '');

    const dept = document.getElementById('if-dept');
    if (dept) dept.value = i.department;
    const unit = document.getElementById('if-unit');
    if (unit) unit.value = i.unit || 'Nos';
    const pri = document.getElementById('if-priority');
    if (pri) pri.value = i.priority || 'Normal';

    document.getElementById('indent-modal-title').textContent = `Edit Indent — ${id}`;
    document.getElementById('indent-modal-sub').textContent   = `Raised by ${i.raised_by || '—'}`;
    document.querySelector('#indent-modal .modal-footer .btn-primary').textContent = 'Save Changes';
    Modal.open('indent-modal');
    document.getElementById('if-item')?.focus();
  }

  function _clearForm() {
    ['if-num', 'if-date', 'if-item', 'if-qty', 'if-remarks'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
    const dept = document.getElementById('if-dept');
    if (dept) dept.value = '';
    const unit = document.getElementById('if-unit');
    if (unit) unit.value = 'Nos';
    const pri = document.getElementById('if-priority');
    if (pri) pri.value = 'Normal';
  }

  /* ─────────────────────────────────────────────
     SAVE (create or update)
  ───────────────────────────────────────────── */
  async function save() {
    const item = document.getElementById('if-item')?.value.trim();
    if (!item) { Utils.toast('Item name is required.'); return; }

    const dept = document.getElementById('if-dept')?.value;
    if (!dept) { Utils.toast('Department is required.'); return; }

    const qty = parseFloat(document.getElementById('if-qty')?.value);
    if (!qty || qty <= 0) { Utils.toast('Quantity must be greater than 0.'); return; }

    const body = {
      item_name:  item,
      department: dept,
      quantity:   qty,
      unit:       document.getElementById('if-unit')?.value     || 'Nos',
      priority:   document.getElementById('if-priority')?.value || 'Normal',
      remarks:    document.getElementById('if-remarks')?.value.trim() || '',
    };

    let r;
    if (_editId) {
      r = await API.Indents.update(_editId, body);
    } else {
      r = await API.Indents.create(body);
    }

    if (r.success) {
      Utils.toastSuccess(r.message || (_editId ? 'Indent updated.' : 'Indent submitted.'));
      Modal.close('indent-modal');
      await load();
    } else {
      Utils.toastError(r.message || 'Could not save indent.');
    }
  }

  /* ─────────────────────────────────────────────
     COO ACTIONS
  ───────────────────────────────────────────── */
  async function approve(id) {
    if (!confirm(`Approve indent ${id}?`)) return;
    const r = await API.Indents.approve(id);
    if (r.success) {
      Utils.toastSuccess(`Indent ${id} approved.`);
      await load();
    } else {
      Utils.toastError(r.message);
    }
  }

  function openReject(id) {
    _rejectId = id;
    const el = document.getElementById('reject-remarks');
    if (el) el.value = '';
    Modal.open('reject-modal');
  }

  async function confirmReject() {
    const remarks = document.getElementById('reject-remarks')?.value.trim() || '';
    const r = await API.Indents.reject(_rejectId, { remarks });
    if (r.success) {
      Utils.toastSuccess(`Indent ${_rejectId} rejected.`);
      Modal.close('reject-modal');
      _rejectId = null;
      await load();
    } else {
      Utils.toastError(r.message);
    }
  }

  async function markRFQ(id) {
    if (!confirm(`Mark indent ${id} as RFQ Sent?`)) return;
    const r = await API.Indents.markRFQSent(id);
    if (r.success) {
      Utils.toastSuccess(`Indent ${id} marked as RFQ Sent.`);
      await load();
    } else {
      Utils.toastError(r.message);
    }
  }

  /* ─────────────────────────────────────────────
     DELETE
  ───────────────────────────────────────────── */
  async function remove(id) {
    if (!confirm(`Delete indent ${id}? This cannot be undone.`)) return;
    const r = await API.Indents.remove(id);
    if (r.success) {
      Utils.toastSuccess(`Indent ${id} deleted.`);
      await load();
    } else {
      Utils.toastError(r.message);
    }
  }

  /* ─────────────────────────────────────────────
     HELPERS
  ───────────────────────────────────────────── */
  function _set(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  }

  function _setField(id, val) {
    const el = document.getElementById(id);
    if (el) el.value = val ?? '';
  }

  return {
    load, filter, filterDept, search,
    openNew, openEdit, save,
    approve, openReject, confirmReject, markRFQ,
    remove,
  };

})();

window.Indents = IndentsModule;

document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('indent-table-wrap')) IndentsModule.load();
});