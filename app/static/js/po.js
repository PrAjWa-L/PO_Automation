/**
 * po.js — Purchase Orders module
 * Depends on: utils.js, api.js, vendors.js, pdf_generator.js, docx_generator.js
 * Exposes: window.PO
 */

const PO = (() => {

  let _all       = [];
  let _filter    = '';
  let _editId    = null;
  let _currentPO = null;   /* PO loaded in view modal */

  /* Line items state */
  let _liItems = [_blankLI()];

  function _blankLI() {
    return { name: '', desc: '', hsn: '', dept: 'IT',
             qty: 1, mrp: 0, price: 0, disc: 0, gst: 18 };
  }

  function _isIntraState() {
    const gstin = document.getElementById('f-vgst')?.value?.trim() || '';
    return gstin.startsWith('29');  // 29 = Karnataka (intra-state)
  }

  /* ─────────────────────────────────────────────
     LIST
  ───────────────────────────────────────────── */
  async function load(statusFilter) {
    if (statusFilter !== undefined) _filter = statusFilter;
    const wrap = document.getElementById('po-table-wrap');
    if (!wrap) return;
    wrap.innerHTML = Utils.loadingState();

    const params = _filter ? `?status=${encodeURIComponent(_filter)}` : '';
    const r = await API.POs.list(params);
    if (!r.success) {
      wrap.innerHTML = Utils.emptyState('⚠', 'Could not load purchase orders.');
      return;
    }
    _all = r.data || [];
    _render(_all);
  }

  function filter(status, tabEl) {
    document.querySelectorAll('#po-filter-tabs .tab').forEach(t => t.classList.remove('active'));
    if (tabEl) tabEl.classList.add('active');
    load(status);
  }

  function search(q) {
    const lq = q.toLowerCase();
    const filtered = _all.filter(p =>
      [p.id, p.vendor_name, p.department, p.created_by, p.status]
        .join(' ').toLowerCase().includes(lq)
    );
    _render(filtered);
  }

  function _render(pos) {
    const wrap = document.getElementById('po-table-wrap');
    if (!wrap) return;
    if (!pos.length) {
      wrap.innerHTML = Utils.emptyState('📋', 'No purchase orders found.');
      return;
    }
    wrap.innerHTML = `
      <table>
        <thead>
          <tr>
            <th>PO #</th>
            <th>Vendor</th>
            <th>Dept</th>
            <th>Created By</th>
            <th>PO Date</th>
            <th>Grand Total</th>
            <th>Quotations</th>
            <th>Payments</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${pos.map(_row).join('')}
        </tbody>
      </table>`;
  }

  function _row(p) {
    const qCount  = p.quotations_count || 0;
    const paid    = p.payments_summary?.paid_total || 0;
    const balance = p.payments_summary?.balance    ?? p.grand_total;
    const pCount  = p.payments_count || 0;
    const fullyPaid = balance <= 0 && p.grand_total > 0;

    return `<tr>
      <td class="mono">${Utils.esc(p.id)}</td>
      <td>${Utils.esc(p.vendor_name || '—')}</td>
      <td>${Utils.deptBadge(p.department)}</td>
      <td style="font-size:11.5px;color:var(--text2);">${Utils.esc(p.created_by || '—')}</td>
      <td style="font-size:11.5px;color:var(--text3);">${Utils.esc(p.po_date || '—')}</td>
      <td class="amt">${Utils.fmtCurrency(p.grand_total)}</td>
      <td style="text-align:center;">
        ${qCount > 0
          ? `<span style="background:var(--blue-soft,#e8f0fe);color:var(--blue,#1a73e8);
                          font-size:11px;font-weight:600;padding:2px 8px;border-radius:12px;">
               ${qCount} quot${qCount > 1 ? 's' : ''}
             </span>`
          : `<span style="color:var(--text3);font-size:11px;">—</span>`}
      </td>
      <td style="text-align:center;">
        ${pCount > 0
          ? `<div style="font-size:11px;line-height:1.5;">
               <div style="color:var(--green,#1e8a3e);font-weight:600;">${Utils.fmtCurrency(paid)} paid</div>
               ${!fullyPaid
                 ? `<div style="color:var(--text3);">bal ${Utils.fmtCurrency(balance)}</div>`
                 : '<div style="color:var(--green);font-weight:600;">✓ Settled</div>'}
             </div>`
          : `<span style="color:var(--text3);font-size:11px;">—</span>`}
      </td>
      <td>${Utils.statusBadge(p.status)}</td>
      <td>
        <div style="display:flex;gap:4px;">
          <button class="btn btn-sm" onclick="PO.view('${Utils.esc(p.id)}')">View</button>
          ${p.status === 'Draft' ? `<button class="btn btn-sm" onclick="PO.openEdit('${Utils.esc(p.id)}')">Edit</button>` : ''}
          <div class="dl-wrap">
            <button class="btn btn-sm" onclick="Modal.toggleDropdown(this)">↓</button>
            <div class="dl-menu">
              <div class="dl-item" onclick="PO.dl('pdf','${Utils.esc(p.id)}')">📄 PDF</div>
              <div class="dl-item" onclick="PO.dl('word','${Utils.esc(p.id)}')">📝 Word</div>
            </div>
          </div>
        </div>
      </td>
    </tr>`;
  }

  /* ─────────────────────────────────────────────
     NEW / EDIT PO
  ───────────────────────────────────────────── */
  /* Pre-fill PO form from an approved quotation */
  async function openFromQuotation(q) {
    _editId  = null;
    _liItems = [];
    _clearHeader();
    await _genPONum();

    if (typeof Vendors !== 'undefined') {
      if (!Vendors.getAll().length) await Vendors.load();
      _fillVendorDropdown();
    }

    // FIX: was calling bare populateTeamDropdowns() which doesn't exist —
    //      the function lives on App.populateTeamDropdowns()
    if (typeof App !== 'undefined') App.populateTeamDropdowns();

    // Pre-fill vendor by matching name or id from quotation
    const vendorSel = document.getElementById('f-vendor');
    if (vendorSel && q.vendor_id) {
      vendorSel.value = q.vendor_id;
      PO.onVendorChange();
    } else if (vendorSel && q.vendor_name) {
      // Try to match by name
      const opt = Array.from(vendorSel.options)
        .find(o => o.text.toLowerCase() === q.vendor_name.toLowerCase());
      if (opt) { vendorSel.value = opt.value; PO.onVendorChange(); }
    }

    // Payment terms — use partial/substring match so "net 30 days" still hits "Net 30"
    const payterms = document.getElementById('f-payterms');
    if (payterms && q.payment_terms) {
      const qt = q.payment_terms.toLowerCase().trim();
      const opt = Array.from(payterms.options).find(o => {
        const ot = o.text.toLowerCase().trim();
        return ot === qt || ot.startsWith(qt) || qt.startsWith(ot);
      });
      if (opt) payterms.value = opt.value;
    }

    // Status — start as Draft so the PO goes through the normal workflow
    const status = document.getElementById('f-status');
    if (status) status.value = 'Draft';

    // Notes — carry over quotation description
    const notes = document.getElementById('f-notes');
    if (notes && q.description) notes.value = q.description;

    // approved_by — leave blank; will be filled when the COO actually approves
    const approvedBy = document.getElementById('f-approvedby');
    if (approvedBy) approvedBy.value = '';

    // FIX: line item used wrong field name 'unit_price' — _blankLI and all
    //      recalc/render logic use 'price'. Setting unit_price meant the
    //      amount showed as 0 because recalc read it.price (undefined → 0).
    _liItems = [{
      ..._blankLI(),
      name: q.vendor_name ? `Goods/Services from ${q.vendor_name}` : 'Items as per quotation',
      desc: q.ref_number  ? `Ref: ${q.ref_number}` : '',
      qty:  1,
      price: parseFloat(q.total_amount) || 0,   // FIX: was unit_price
      gst:   parseFloat(q.gst_pct)      || 18,  // FIX: was gst_pct (wrong key)
    }];

    _renderLI();
    recalc();

    // Mark modal title so accounts team knows it came from a quotation
    const title = document.getElementById('po-modal-title');
    if (title) title.textContent = `Create PO — from Quotation ${q.id}`;

    // Hide "Submit for Approval" — PO from quotation must go through normal
    // draft → pending approval workflow, not skip straight to pending.
    const submitBtn = document.querySelector('#po-modal .modal-footer .btn-primary');
    if (submitBtn) submitBtn.style.display = 'none';

    Modal.open('po-modal');
  }

  async function openNew() {
    _editId  = null;
    _liItems = [_blankLI()];
    _clearHeader();
    await _genPONum();
    _renderLI();
    if (typeof Vendors !== 'undefined') {
      if (!Vendors.getAll().length) await Vendors.load();
      _fillVendorDropdown();
    }
    if (typeof App !== 'undefined') App.populateTeamDropdowns();
    // Restore Submit button in case it was hidden by openFromQuotation
    const submitBtn = document.querySelector('#po-modal .modal-footer .btn-primary');
    if (submitBtn) submitBtn.style.display = '';
    Modal.open('po-modal');
  }

  /* Open the PO form pre-filled with an existing Draft PO for editing */
  async function openEdit(poId) {
    // Fetch the full PO (with line items)
    const r = await API.POs.get(poId);
    if (!r.success) { Utils.toastError('Could not load PO for editing.'); return; }
    const po = r.data;

    if (po.status !== 'Draft') {
      Utils.toastError('Only Draft POs can be edited.');
      return;
    }

    _editId = po.id;

    // Ensure vendors and dropdowns are ready
    if (typeof Vendors !== 'undefined') {
      if (!Vendors.getAll().length) await Vendors.load();
      _fillVendorDropdown();
    }
    if (typeof App !== 'undefined') App.populateTeamDropdowns();

    // Fill header fields
    const set = (id, val) => { const el = document.getElementById(id); if (el) el.value = val ?? ''; };
    set('f-poid',       po.id);
    set('f-dept',       po.department);
    set('f-date',       po.po_date);
    set('f-delivery',   po.delivery_date || '');
    set('f-reqby',      po.requested_by  || '');
    set('f-createdby',  po.created_by    || '');
    set('f-approvedby', po.approved_by   || '');
    set('f-notes',      po.notes         || '');
    set('f-status',     po.status);
    set('f-advpct',     po.advance_pct   || 0);
    set('f-tds',        po.tds_pct       || 0);

    // Payment terms
    const payterms = document.getElementById('f-payterms');
    if (payterms && po.payment_terms) payterms.value = po.payment_terms;

    // Order type radio
    const orderTypeVal = po.order_type || 'Purchase Order';
    const otRadio = document.querySelector(`input[name="order-type"][value="${orderTypeVal}"]`);
    if (otRadio) { otRadio.checked = true; PO.onOrderTypeChange(); }

    // Vendor
    const vendorSel = document.getElementById('f-vendor');
    if (vendorSel && po.vendor_id) {
      vendorSel.value = po.vendor_id;
      PO.onVendorChange();
    }

    // Line items
    _liItems = (po.line_items || []).map(li => ({
      name:  li.item_name   || '',
      desc:  li.description || '',
      hsn:   li.hsn_code    || '',
      dept:  li.department  || '',
      qty:   li.qty         ?? 1,
      mrp:   li.mrp         ?? 0,
      price: li.unit_price  ?? 0,
      disc:  li.discount_pct ?? 0,
      gst:   li.gst_pct     ?? 18,
    }));
    if (!_liItems.length) _liItems = [_blankLI()];
    _renderLI();
    recalc();

    // Update modal title and show submit button
    const title = document.getElementById('po-modal-title');
    if (title) title.textContent = `Edit PO — ${po.id}`;
    const submitBtn = document.querySelector('#po-modal .modal-footer .btn-primary');
    if (submitBtn) submitBtn.style.display = '';

    // Close the view modal if it's open, then open the edit modal
    Modal.close('view-po-modal');
    Modal.open('po-modal');
  }

  function _clearHeader() {
    const fields = {
      'f-date': Utils.today(), 'f-delivery': '', 'f-reqby': '',
      'f-createdby': '', 'f-notes': '',
      'f-vgst': '', 'f-vbank': '', 'f-vaddr': '',
      'f-advpct': '0',
    };
    Object.entries(fields).forEach(([id, val]) => {
      const el = document.getElementById(id);
      if (el) el.value = val;
    });
    const sel = document.getElementById('f-vendor');
    if (sel) sel.value = '';
    const prev = document.getElementById('po-prev-num');
    if (prev) prev.textContent = '—';
    const badge = document.getElementById('gst-state-badge');
    if (badge) badge.style.display = 'none';
    // Reset order type to Purchase Order
    const otPO = document.getElementById('ot-po');
    if (otPO) otPO.checked = true;
    const tdsField = document.getElementById('tds-field');
    if (tdsField) tdsField.style.display = 'none';
    const tdsRow = document.getElementById('tds-row');
    if (tdsRow) tdsRow.style.display = 'none';
    const tdsEl = document.getElementById('f-tds');
    if (tdsEl) tdsEl.value = '0';
    const typeLabel = document.getElementById('po-type-label');
    if (typeLabel) typeLabel.textContent = 'PURCHASE ORDER';
  }

  async function _genPONum() {
    const yr = new Date().getFullYear();
    const r  = await API.POs.list(`?status=&limit=1`);
    let num  = 1;
    if (r.success && r.data && r.data.length) {
      const last = r.data[0];
      if (last.id && last.id.startsWith(`PO-${yr}-`)) {
        const n = parseInt(last.id.split('-')[2], 10);
        if (!isNaN(n)) num = n + 1;
      }
    }
    const id = `PO-${yr}-${String(num).padStart(3, '0')}`;
    const el = document.getElementById('f-ponum');
    if (el) el.value = id;
    const prev = document.getElementById('po-prev-num');
    if (prev) prev.textContent = id;
  }

  function _fillVendorDropdown() {
    const sel = document.getElementById('f-vendor');
    if (!sel) return;
    const vendors = Vendors.getAll();
    sel.innerHTML = '<option value="">— Select Vendor —</option>' +
      vendors.map(v =>
        `<option value="${Utils.esc(v.id)}">${Utils.esc(v.name)}</option>`
      ).join('');
  }

  /* ─────────────────────────────────────────────
     ORDER TYPE TOGGLE
  ───────────────────────────────────────────── */
  function onOrderTypeChange() {
    const isWO = document.querySelector('input[name="order-type"]:checked')?.value === 'Work Order';
    const tdsField = document.getElementById('tds-field');
    const tdsRow   = document.getElementById('tds-row');
    const label    = document.getElementById('po-type-label');
    if (tdsField) tdsField.style.display = isWO ? '' : 'none';
    if (tdsRow)   tdsRow.style.display   = isWO ? '' : 'none';
    if (label)    label.textContent      = isWO ? 'WORK ORDER' : 'PURCHASE ORDER';
    if (!isWO) {
      const tdsEl = document.getElementById('f-tds');
      if (tdsEl) tdsEl.value = '0';
    }
    recalc();
  }

    function onVendorChange() {
    const id = document.getElementById('f-vendor')?.value;
    const v  = id && typeof Vendors !== 'undefined' ? Vendors.getById(id) : null;

    if (!v) {
      ['f-vgst', 'f-vbank', 'f-vaddr'].forEach(x => {
        const el = document.getElementById(x);
        if (el) el.value = '';
      });
      const badge = document.getElementById('gst-state-badge');
      if (badge) badge.style.display = 'none';
      _renderLI();
      return;
    }

    const bankStr = [
      v.bank_name,
      v.bank_acc  ? 'A/c '  + v.bank_acc  : '',
      v.bank_ifsc ? 'IFSC ' + v.bank_ifsc : '',
    ].filter(Boolean).join(' · ');

    _setField('f-vgst',  v.gst     || '');
    _setField('f-vbank', bankStr);
    _setField('f-vaddr', v.address || '');

    /* GST state badge */
    const badge = document.getElementById('gst-state-badge');
    if (badge) {
      const gstin = (v.gst || '').trim();
      if (gstin) {
        const intra = gstin.startsWith('29');
        badge.textContent      = intra ? '⬤ Intra-state' : '⬤ Inter-state';
        badge.style.color      = intra ? 'var(--green, #2a7)'      : 'var(--blue, #27a)';
        badge.style.background = intra ? 'var(--green-bg, #efffef)': 'var(--blue-bg, #eff6ff)';
        badge.style.display    = 'inline-block';
      } else {
        badge.style.display = 'none';
      }
    }

    _renderLI();
  }

  /* ─────────────────────────────────────────────
     LINE ITEMS
  ───────────────────────────────────────────── */
  function addLI() {
    _liItems.push(_blankLI());
    _renderLI();
  }

  function removeLI(i) {
    if (_liItems.length > 1) {
      _liItems.splice(i, 1);
      _renderLI();
    }
  }

  function _renderLI() {
    const tbody = document.getElementById('li-body');
    if (!tbody) return;

    const intra = _isIntraState();

    tbody.innerHTML = _liItems.map((it, i) => {
      const base  = it.qty * it.price;
      const disc  = base * (it.disc / 100);
      const after = base - disc;
      const gstA  = after * (it.gst / 100);
      const total = after + gstA;
      const cgst  = intra ? gstA / 2 : 0;
      const sgst  = intra ? gstA / 2 : 0;
      const igst  = intra ? 0 : gstA;

      return `<tr>
        <td><input value="${Utils.esc(it.name)}" placeholder="Item name"
                   oninput="PO._updateLI(${i},'name',this.value)"></td>
        <td><input value="${Utils.esc(it.desc)}" placeholder="Description"
                   oninput="PO._updateLI(${i},'desc',this.value)"></td>
        <td><input value="${Utils.esc(it.hsn)}"  placeholder="HSN"
                   oninput="PO._updateLI(${i},'hsn',this.value)"></td>
        <td>
          <select onchange="PO._updateLI(${i},'dept',this.value)">
            ${['IT','Maintenance','Housekeeping','Accounts','Pharmacy'].map(d =>
              `<option ${d === it.dept ? 'selected' : ''}>${d}</option>`).join('')}
          </select>
        </td>
        <td><input type="number" min="1" value="${it.qty}"
                   oninput="PO._updateLI(${i},'qty',+this.value||1)"></td>
        <td><input type="number" min="0" value="${it.mrp}"
                   oninput="PO._updateLI(${i},'mrp',+this.value||0)"></td>
        <td><input type="number" min="0" value="${it.price}"
                   oninput="PO._updateLI(${i},'price',+this.value||0)"></td>
        <td><input type="number" min="0" max="100" value="${it.disc}"
                   oninput="PO._updateLI(${i},'disc',+this.value||0)"></td>
        <td><input type="number" min="0" max="100" value="${it.gst}"
                   oninput="PO._updateLI(${i},'gst',+this.value||0)"></td>
        <td><span class="ro-cell">${intra ? Utils.fmt(cgst) : '<span style="color:var(--text3)">—</span>'}</span></td>
        <td><span class="ro-cell">${intra ? Utils.fmt(sgst) : '<span style="color:var(--text3)">—</span>'}</span></td>
        <td><span class="ro-cell">${!intra ? Utils.fmt(igst) : '<span style="color:var(--text3)">—</span>'}</span></td>
        <td><span class="ro-cell" style="font-weight:600;">${Utils.fmt(total)}</span></td>
        <td><button class="del-btn" onclick="PO.removeLI(${i})">✕</button></td>
      </tr>`;
    }).join('');

    recalc();
  }

  /* Updates model and re-renders only computed cells for numeric keys,
     or full row for text keys (name/desc/hsn won't lose focus since
     oninput fires per keystroke and we only re-render ro-cells) */
  function _updateLI(i, key, val) {
    _liItems[i][key] = val;
    const numericKeys = ['qty', 'price', 'disc', 'gst', 'mrp'];
    if (numericKeys.includes(key)) {
      _updateLIRowTotals(i);
    }
    recalc();
  }

  /* Re-renders only the computed read-only cells for row i, preserving focus */
  function _updateLIRowTotals(i) {
    const tbody = document.getElementById('li-body');
    if (!tbody) return;
    const row = tbody.rows[i];
    if (!row) return;

    const it    = _liItems[i];
    const base  = it.qty * it.price;
    const disc  = base * (it.disc / 100);
    const after = base - disc;
    const gstA  = after * (it.gst / 100);
    const total = after + gstA;
    const intra = _isIntraState();

    // Cell indices: 0=name 1=desc 2=hsn 3=dept 4=qty 5=mrp 6=price 7=disc 8=gst
    //               9=CGST 10=SGST 11=IGST 12=Total 13=del
    const cgstCell  = row.cells[9]  && row.cells[9].querySelector('.ro-cell');
    const sgstCell  = row.cells[10] && row.cells[10].querySelector('.ro-cell');
    const igstCell  = row.cells[11] && row.cells[11].querySelector('.ro-cell');
    const totalCell = row.cells[12] && row.cells[12].querySelector('.ro-cell');

    if (cgstCell)  cgstCell.innerHTML  = intra ? Utils.fmt(gstA / 2) : '<span style="color:var(--text3)">—</span>';
    if (sgstCell)  sgstCell.innerHTML  = intra ? Utils.fmt(gstA / 2) : '<span style="color:var(--text3)">—</span>';
    if (igstCell)  igstCell.innerHTML  = !intra ? Utils.fmt(gstA)    : '<span style="color:var(--text3)">—</span>';
    if (totalCell) { totalCell.style.fontWeight = '600'; totalCell.textContent = Utils.fmt(total); }
  }

  function recalc() {
    let sub = 0, disc = 0, gstT = 0;
    const intra = _isIntraState();
    _liItems.forEach(it => {
      const b = it.qty * it.price;
      const d = b * (it.disc / 100);
      const a = b - d;
      sub  += b;
      disc += d;
      gstT += a * (it.gst / 100);
    });
    const grand  = sub - disc + gstT;

    const isWO   = document.querySelector('input[name="order-type"]:checked')?.value === 'Work Order';
    const tdsPct = isWO ? +(document.getElementById('f-tds')?.value || 0) : 0;
    const tdsAmt = (sub - disc) * tdsPct / 100;
    const grandFinal = grand - tdsAmt;
    const advPct2 = +(document.getElementById('f-advpct')?.value || 0);
    const advAmt2 = grandFinal * advPct2 / 100;

    _setField2('t-sub',   'Rs.' + Utils.fmt(sub));
    _setField2('t-disc',  'Rs.' + Utils.fmt(disc));
    _setField2('t-gst',   'Rs.' + Utils.fmt(gstT));
    _setField2('t-tds',   '- Rs.' + Utils.fmt(tdsAmt));
    _setField2('t-adv',   'Rs.' + Utils.fmt(advAmt2));
    _setField2('t-grand', 'Rs.' + Utils.fmt(grandFinal));

    const gstLabel = document.getElementById('t-gst-label');
    if (gstLabel) gstLabel.textContent = intra ? 'GST (CGST + SGST)' : 'GST (IGST)';
  }

  /* ─────────────────────────────────────────────
     SAVE (create or update)
  ───────────────────────────────────────────── */
  async function save(forcedStatus) {
    const vendorId = document.getElementById('f-vendor')?.value;
    const dept     = document.getElementById('f-dept')?.value;
    const date     = document.getElementById('f-date')?.value;

    if (!date) { Utils.toast('PO Date is required.');    return; }
    if (!dept) { Utils.toast('Department is required.'); return; }
    if (!_liItems.some(it => it.name.trim())) {
      Utils.toast('At least one line item name is required.');
      return;
    }

    const body = {
      vendor_id:     vendorId || null,
      department:    dept,
      po_date:       date,
      requested_by:  _val('f-reqby'),
      created_by:    _val('f-createdby'),
      approved_by:   document.getElementById('f-approvedby')?.value || '',
      delivery_date: _val('f-delivery') || null,
      payment_terms: document.getElementById('f-payterms')?.value || 'Net 30',
      status:        forcedStatus || document.getElementById('f-status')?.value || 'Draft',
      order_type:    document.querySelector('input[name="order-type"]:checked')?.value || 'Purchase Order',
      tds_pct:       +(document.getElementById('f-tds')?.value || 0),
      advance_pct:   +(document.getElementById('f-advpct')?.value || 0),
      notes:         _val('f-notes'),
      line_items:    _liItems.map((it, i) => ({
        item_name:    it.name || `Item ${i + 1}`,
        description:  it.desc,
        hsn_code:     it.hsn,
        department:   it.dept,
        qty:          it.qty,
        mrp:          it.mrp,
        unit_price:   it.price,
        discount_pct: it.disc,
        gst_pct:      it.gst,
      })),
    };

    const r = _editId
      ? await API.POs.update(_editId, body)
      : await API.POs.create(body);

    if (r.success) {
      Utils.toastSuccess('PO ' + (r.data?.id || '') + ' saved.');
      Modal.close('po-modal');
      load();
    } else {
      Utils.toastError(r.message);
    }
  }

  /* ─────────────────────────────────────────────
     VIEW PO MODAL
  ───────────────────────────────────────────── */
  async function view(id) {
    const body = document.getElementById('vpo-body');
    if (!body) return;
    body.innerHTML = Utils.loadingState();
    Modal.open('view-po-modal');

    const r = await API.POs.get(id);
    if (!r.success) {
      body.innerHTML = Utils.emptyState('⚠', 'Could not load PO.');
      return;
    }
    _currentPO = r.data;
    _renderViewModal(_currentPO);
  }

  function _renderViewModal(po) {
    const title = document.getElementById('vpo-title');
    const sub   = document.getElementById('vpo-sub');
    const body  = document.getElementById('vpo-body');

    if (title) title.textContent = `${po.id} — ${po.vendor_name || '—'}`;
    if (sub)   sub.textContent   = `${po.po_date} · ${po.department} · ${po.status}`;

    const paid = po.payments_summary?.paid_total || 0;
    const bal  = po.payments_summary?.balance    || 0;

    /* Line items table */
    const liRows = (po.line_items || []).map(li => `
      <tr>
        <td>${Utils.esc(li.item_name)}<br>
          <span style="font-size:10.5px;color:var(--text3);">${Utils.esc(li.description || '')}</span>
        </td>
        <td>${Utils.esc(li.hsn_code || '—')}</td>
        <td>${li.qty}</td>
        <td class="mono">${Utils.fmtCurrency(li.unit_price)}</td>
        <td>${li.discount_pct || 0}%</td>
        <td>${li.gst_pct}%</td>
        <td class="mono">${Utils.fmtCurrency(li.cgst)}</td>
        <td class="mono">${Utils.fmtCurrency(li.sgst)}</td>
        <td class="amt">${Utils.fmtCurrency(li.line_total)}</td>
      </tr>`).join('');

    body.innerHTML = `
      <div style="display:flex;gap:7px;margin-bottom:14px;flex-wrap:wrap;">
        ${Utils.statusBadge(po.status)}
        <span class="badge badge-blue">${Utils.fmtCurrency(po.grand_total)}</span>
        ${Utils.deptBadge(po.department)}
      </div>

      ${po.status === 'Rejected' && po.rejection_reason ? `
        <div style="background:#fff0f0;border:1px solid #e55;border-radius:8px;
                    padding:10px 14px;margin-bottom:14px;">
          <div style="font-size:10px;font-weight:700;color:#c33;
                      text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px;">
            Rejection Reason
          </div>
          <div style="font-size:13px;color:var(--text);">${Utils.esc(po.rejection_reason)}</div>
        </div>` : ''}

      <div class="fg2" style="margin-bottom:14px;">
        <div>
          <div style="font-size:10px;color:var(--text3);margin-bottom:2px;">VENDOR</div>
          <div style="font-size:13px;font-weight:600;">${Utils.esc(po.vendor_name || '—')}</div>
          ${po.vendor_gst
            ? `<div style="font-size:10.5px;color:var(--text3);font-family:var(--font-mono);">${Utils.esc(po.vendor_gst)}</div>`
            : ''}
        </div>
        <div>
          <div style="font-size:10px;color:var(--text3);margin-bottom:2px;">PAYMENT TERMS</div>
          <div style="font-size:13px;">${Utils.esc(po.payment_terms || '—')}</div>
          <div style="font-size:10.5px;color:var(--text3);">Delivery: ${Utils.esc(po.delivery_date || '—')}</div>
        </div>
      </div>

      ${po.line_items?.length ? `
        <div style="font-size:10px;color:var(--text3);text-transform:uppercase;
                    letter-spacing:.5px;margin-bottom:6px;">Line Items</div>
        <div style="overflow-x:auto;">
          <table>
            <thead>
              <tr>
                <th>Item</th><th>HSN</th><th>Qty</th>
                <th>Unit Price</th><th>Disc%</th><th>GST%</th>
                <th>CGST</th><th>SGST</th><th>Total</th>
              </tr>
            </thead>
            <tbody>${liRows}</tbody>
          </table>
        </div>` : ''}

      <div style="display:flex;justify-content:flex-end;margin-top:12px;">
        <div style="width:230px;font-size:12.5px;">
          <div class="tot-row"><span class="tot-k">Subtotal</span>
            <span class="amt">${Utils.fmtCurrency(po.subtotal)}</span></div>
          <div class="tot-row"><span class="tot-k">Discount</span>
            <span class="amt">${Utils.fmtCurrency(po.discount)}</span></div>
          <div class="tot-row"><span class="tot-k">GST</span>
            <span class="amt">${Utils.fmtCurrency(po.gst_total)}</span></div>
          <div class="tot-row tot-grand"><span>Grand Total</span>
            <span class="amt">${Utils.fmtCurrency(po.grand_total)}</span></div>
          <div class="tot-row" style="color:var(--green);"><span>Paid</span>
            <span class="amt">${Utils.fmtCurrency(paid)}</span></div>
          <div class="tot-row" style="color:${bal > 0 ? 'var(--amber)' : 'var(--green)'};">
            <span>Balance</span>
            <span class="amt">${Utils.fmtCurrency(bal)}</span></div>
        </div>
      </div>

      ${po.notes
        ? `<div style="margin-top:10px;padding:9px 12px;background:var(--surface2);
                       border-radius:7px;font-size:12px;color:var(--text2);">
             ${Utils.esc(po.notes)}</div>`
        : ''}

      <div style="font-size:10px;color:var(--text3);text-transform:uppercase;
                  letter-spacing:.5px;margin-top:14px;margin-bottom:6px;">
        Approval Trail
      </div>
      <div class="appr-trail">
        ${_approvalStep('✓', 'circ-done',
            `${po.requested_by || 'Department'} — Request`,
            `Created by ${po.created_by || 'Accounts Team'}`)}
        ${_approvalStep(
            po.status !== 'Draft' ? '✓' : '2',
            po.status !== 'Draft' ? 'circ-done' : 'circ-pnd',
            'Accounts Review',
            po.status !== 'Draft' ? 'Reviewed & forwarded' : 'Pending')}
        ${_approvalStep(
            po.status === 'Approved' || po.status === 'Closed' ? '✓' :
            po.status === 'Rejected' ? '✕' :
            po.status === 'Pending Approval' ? '→' : '3',
            po.status === 'Approved' || po.status === 'Closed' ? 'circ-done' :
            po.status === 'Rejected' ? 'circ-rej' :
            po.status === 'Pending Approval' ? 'circ-cur' : 'circ-pnd',
            `COO Approval — ${po.approved_by || 'The COO'}`,
            po.status === 'Approved' || po.status === 'Closed' ? 'Approved' :
            po.status === 'Rejected' ? 'Rejected' : 'Pending')}
      </div>`;

    /* Render role-aware action buttons in the footer */
    _renderViewActions(po);
  }

  function _approvalStep(icon, circClass, name, sub) {
    return `<div class="appr-step">
      <div class="appr-circ ${circClass}">${icon}</div>
      <div>
        <div class="appr-step-name">${Utils.esc(name)}</div>
        <div class="appr-step-sub">${Utils.esc(sub)}</div>
      </div>
    </div>`;
  }

  function _renderViewActions(po) {
    const footer = document.querySelector('#view-po-modal .modal-footer');
    if (!footer) return;
    const role   = window.PROCUREIQ?.userRole || '';
    const status = po.status;

    /* Remove any previously injected action buttons */
    footer.querySelectorAll('.po-action-btn').forEach(b => b.remove());
    /* Also clear any leftover rejection reason form */
    const rw = document.getElementById('reject-reason-wrap');
    if (rw) rw.remove();

    /* Accounts / Admin — edit draft, submit draft, or resubmit rejected */
    if (role === 'accounts' || role === 'admin') {
      if (status === 'Draft') {
        footer.insertAdjacentHTML('beforeend', `
          <button class="btn po-action-btn"
                  onclick="PO.openEdit('${po.id}')">
            ✏ Edit
          </button>
          <button class="btn btn-primary po-action-btn"
                  onclick="PO.changeStatus('${po.id}', 'Pending Approval')">
            Submit for Approval
          </button>`);
      }
      if (status === 'Rejected') {
        footer.insertAdjacentHTML('beforeend', `
          <button class="btn btn-primary po-action-btn"
                  onclick="PO.changeStatus('${po.id}', 'Draft')">
            Resubmit (Move to Draft)
          </button>`);
      }
    }

    /* COO / Admin — approve, reject, or close */
    if (role === 'coo' || role === 'admin') {
      if (status === 'Pending Approval') {
        footer.insertAdjacentHTML('beforeend', `
          <button class="btn btn-red po-action-btn"
                  onclick="PO.rejectCurrent()">
            Reject
          </button>
          <button class="btn btn-green po-action-btn"
                  onclick="PO.approveCurrent()">
            Approve
          </button>`);
      }
      if (status === 'Approved') {
        footer.insertAdjacentHTML('beforeend', `
          <button class="btn po-action-btn"
                  onclick="PO.changeStatus('${po.id}', 'Closed')">
            Mark Closed
          </button>`);
      }
    }
  }

  /* ─────────────────────────────────────────────
     APPROVE / REJECT / STATUS CHANGE
  ───────────────────────────────────────────── */
  async function approveCurrent() {
    if (!_currentPO) return;
    const r = await API.POs.setStatus(_currentPO.id, {
      status:      'Approved',
      approved_by: window.PROCUREIQ?.userName || 'COO',
    });
    if (r.success) {
      Utils.toastSuccess(`PO ${_currentPO.id} approved.`);
      Modal.close('view-po-modal');
      load();
    } else {
      Utils.toastError(r.message);
    }
  }

  async function rejectCurrent() {
    if (!_currentPO) return;
    if (document.getElementById('reject-reason-wrap')) return; // already open

    const footer = document.querySelector('#view-po-modal .modal-footer');
    footer.insertAdjacentHTML('afterbegin', `
      <div id="reject-reason-wrap"
           style="display:flex;gap:6px;align-items:center;width:100%;margin-bottom:6px;">
        <input id="reject-reason-input"
               placeholder="Reason for rejection (required)"
               style="flex:1;padding:6px 10px;border-radius:6px;
                      border:1px solid var(--border);font-size:12.5px;">
        <button class="btn btn-red"
                onclick="PO._confirmReject()">Confirm Reject</button>
        <button class="btn"
                onclick="document.getElementById('reject-reason-wrap').remove()">Cancel</button>
      </div>`);
    document.getElementById('reject-reason-input').focus();
  }

  async function _confirmReject() {
    if (!_currentPO) return;
    const reason = document.getElementById('reject-reason-input')?.value.trim();
    if (!reason) {
      Utils.toast('Please enter a reason for rejection.');
      return;
    }
    const r = await API.POs.setStatus(_currentPO.id, {
      status:           'Rejected',
      rejection_reason: reason,
    });
    if (r.success) {
      Utils.toastSuccess(`PO ${_currentPO.id} rejected.`);
      Modal.close('view-po-modal');
      load();
    } else {
      Utils.toastError(r.message);
    }
  }

  async function changeStatus(id, newStatus) {
    const r = await API.POs.setStatus(id, { status: newStatus });
    if (r.success) {
      Utils.toastSuccess(`PO ${id} moved to ${newStatus}.`);
      Modal.close('view-po-modal');
      load();
    } else {
      Utils.toastError(r.message);
    }
  }

  /* ─────────────────────────────────────────────
     DOWNLOAD
  ───────────────────────────────────────────── */
  async function dl(type, id) {
    let po = _all.find(p => p.id === id);
    if (!po || !po.line_items) {
      const r = await API.POs.get(id);
      if (!r.success) { Utils.toastError('Could not load PO data.'); return; }
      po = r.data;
    }
    type === 'pdf' ? PDFGen.generate(po) : DOCXGen.generate(po);
  }

  function dlFromView(type) {
    if (!_currentPO) return;
    type === 'pdf' ? PDFGen.generate(_currentPO) : DOCXGen.generate(_currentPO);
  }

  function generateDownload(type) {
    let sub = 0, disc = 0, gstT = 0;
    const intra = _isIntraState();
    _liItems.forEach(it => {
      const b = it.qty * it.price;
      const d = b * (it.disc / 100);
      const a = b - d;
      sub  += b;
      disc += d;
      gstT += a * (it.gst / 100);
    });
    const grand  = sub - disc + gstT;
    const advPct = +(document.getElementById('f-advpct')?.value || 0);

    const v = typeof Vendors !== 'undefined'
      ? Vendors.getById(document.getElementById('f-vendor')?.value)
      : null;

    const po = {
      id:            document.getElementById('f-ponum')?.value || 'PO-DRAFT',
      status:        document.getElementById('f-status')?.value || 'Draft',
      vendor_name:   v?.name    || '—',
      vendor_gst:    v?.gst     || '',
      vendor_addr:   v?.address || '',
      department:    document.getElementById('f-dept')?.value || '—',
      requested_by:  _val('f-reqby'),
      created_by:    _val('f-createdby'),
      approved_by:   document.getElementById('f-approvedby')?.value || 'Pending',
      po_date:       document.getElementById('f-date')?.value || '',
      delivery_date: _val('f-delivery'),
      payment_terms: document.getElementById('f-payterms')?.value || '—',
      notes:         _val('f-notes'),
      subtotal:      sub,
      discount:      disc,
      gst_total:     gstT,
      grand_total:   grand,
      advance_pct:   advPct,
      advance_amt:   grand * advPct / 100,
      line_items:    _liItems.map(it => {
        const b  = it.qty * it.price * (1 - it.disc / 100);
        const ga = b * (it.gst / 100);
        return {
          item_name:    it.name,
          description:  it.desc,
          hsn_code:     it.hsn,
          qty:          it.qty,
          unit_price:   it.price,
          discount_pct: it.disc,
          gst_pct:      it.gst,
          cgst:         intra ? ga / 2 : 0,
          sgst:         intra ? ga / 2 : 0,
          igst:         intra ? 0 : ga,
          line_total:   b + ga,
        };
      }),
    };
    type === 'pdf' ? PDFGen.generate(po) : DOCXGen.generate(po);
  }

  /* ── Private helpers ── */
  function _val(id)          { return document.getElementById(id)?.value.trim() || ''; }
  function _setField(id, v)  { const el = document.getElementById(id); if (el) el.value = v; }
  function _setField2(id, v) { const el = document.getElementById(id); if (el) el.textContent = v; }

  return {
    load, filter, search,
    openNew, openEdit, openFromQuotation, onVendorChange, onOrderTypeChange,
    addLI, removeLI, _updateLI, recalc,
    save,
    view, approveCurrent, rejectCurrent, _confirmReject, changeStatus,
    dlFromView, dl, generateDownload,
  };
})();

window.PO = PO;

document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('po-table-wrap')) PO.load();
});