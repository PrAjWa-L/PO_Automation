/**
 * vendors.js — Vendor Master page logic
 * Exposes: window.Vendors
 */

const Vendors = (() => {
  let _all = [];
  let _editId = null;

  /* ── Load & render ── */
  async function load() {
  await _fetchAll();               // always fetch data
  const grid = document.getElementById('vendor-grid');
  if (grid) {                      // only render the grid if on the vendors page
    _render(_all);
  }
  _populateDropdown();             // always populate the PO dropdown
}

  async function _fetchAll() {
  const grid = document.getElementById('vendor-grid');
  if (grid) grid.innerHTML = Utils.loadingState();

  const r = await API.Vendors.list();
  if (!r.success) {
    if (grid) grid.innerHTML = Utils.emptyState('⚠', 'Could not load vendors — check API connection.');
    return;
  }
  _all = r.data || [];
}

  function _render(vendors) {
    const grid = document.getElementById('vendor-grid');
    if (!grid) return;

    if (!vendors.length) {
      grid.innerHTML = Utils.emptyState('🏢', 'No vendors yet. Add your first vendor.');
      return;
    }

    grid.innerHTML = vendors.map(v => `
      <div class="vc-card" onclick="Vendors.edit('${Utils.esc(v.id)}')">
        <div class="vc-card-header">
          <div>
            <div class="vc-name">${Utils.esc(v.name)}</div>
            <div class="vc-id">${Utils.esc(v.id)}</div>
          </div>
          <button class="btn btn-sm"
                  onclick="event.stopPropagation(); Vendors.edit('${Utils.esc(v.id)}')">
            Edit
          </button>
        </div>
        <div class="vc-row">
          <span class="vc-lbl">GST</span>
          ${v.gst ? Utils.esc(v.gst) : '<span class="badge badge-red" style="font-size:10px;">Missing</span>'}
        </div>
        <div class="vc-row">
          <span class="vc-lbl">PAN</span>
          ${Utils.esc(v.pan || '—')}
        </div>
        <div class="vc-row">
          <span class="vc-lbl">Contact</span>
          ${Utils.esc(v.contact || '—')}
          ${v.mobile ? ' · ' + Utils.esc(v.mobile) : ''}
        </div>
        <div class="vc-row">
          <span class="vc-lbl">Bank</span>
          ${Utils.esc(v.bank_name || '—')}
          ${v.bank_acc ? ' · ****' + v.bank_acc.slice(-4) : ''}
        </div>
        <div class="vc-row">
          <span class="vc-lbl">IFSC</span>
          ${Utils.esc(v.bank_ifsc || '—')}
        </div>
      </div>
    `).join('');
  }

  /* ── Populate vendor dropdown in PO form ── */
  function _populateDropdown() {
    const sel = document.getElementById('f-vendor');
    if (!sel) return;
    const current = sel.value;
    sel.innerHTML = '<option value="">— Select Vendor —</option>' +
      _all.map(v =>
        `<option value="${Utils.esc(v.id)}">${Utils.esc(v.name)}</option>`
      ).join('');
    if (current) sel.value = current;
  }

  /* ── Filter by search ── */
  function filter() {
    const q = (document.getElementById('vendor-search')?.value || '').toLowerCase();
    _render(_all.filter(v =>
      [v.name, v.gst, v.contact, v.email, v.mobile, v.pan]
        .join(' ').toLowerCase().includes(q)
    ));
  }

  /* ── Get vendor by ID (for PO form auto-fill) ── */
  function getById(id) {
    return _all.find(v => v.id === id) || null;
  }

  /* ── All vendors array (for external use) ── */
  function getAll() { return _all; }

  /* ── Open add modal ── */
  function openAddModal() {
    _editId = null;
    _clearForm();
    document.getElementById('vendor-modal-title').textContent = 'Add Vendor';
    document.getElementById('v-id').value = '(auto-generated)';
    Modal.open('vendor-modal');
  }

  /* ── Open edit modal ── */
  function edit(id) {
    const v = _all.find(x => x.id === id);
    if (!v) return;
    _editId = id;
    document.getElementById('vendor-modal-title').textContent = 'Edit Vendor';
    _setField('v-id',      v.id);
    _setField('v-name',    v.name);
    _setField('v-contact', v.contact);
    _setField('v-mobile',  v.mobile);
    _setField('v-email',   v.email);
    _setField('v-gst',     v.gst);
    _setField('v-pan',     v.pan);
    _setField('v-addr',    v.address);
    _setField('v-bank',    v.bank_name);
    _setField('v-acc',     v.bank_acc);
    _setField('v-ifsc',    v.bank_ifsc);
    _setField('v-branch',  v.bank_branch);
    Modal.open('vendor-modal');
  }

  /* ── Save (create or update) ── */
  async function save() {
    const name = document.getElementById('v-name')?.value.trim();
    if (!name) { Utils.toast('Vendor name is required.'); return; }

    const body = {
      name,
      contact:     _val('v-contact'),
      mobile:      _val('v-mobile'),
      email:       _val('v-email'),
      gst:         _val('v-gst').toUpperCase(),
      pan:         _val('v-pan').toUpperCase(),
      address:     _val('v-addr'),
      bank_name:   _val('v-bank'),
      bank_acc:    _val('v-acc'),
      bank_ifsc:   _val('v-ifsc').toUpperCase(),
      bank_branch: _val('v-branch'),
    };

    const r = _editId
      ? await API.Vendors.update(_editId, body)
      : await API.Vendors.create(body);

    if (r.success) {
      Utils.toastSuccess(_editId ? 'Vendor updated.' : `Vendor "${name}" added.`);
      Modal.close('vendor-modal');
      await load();
    } else {
      Utils.toastError(r.message);
    }
  }

  /* ── Helpers ── */
  function _clearForm() {
    ['v-id','v-name','v-contact','v-mobile','v-email',
     'v-gst','v-pan','v-addr','v-bank','v-acc','v-ifsc','v-branch']
      .forEach(id => _setField(id, ''));
  }

  function _setField(id, val) {
    const el = document.getElementById(id);
    if (el) el.value = val || '';
  }

  function _val(id) {
    return document.getElementById(id)?.value.trim() || '';
  }

  return { load, filter, openAddModal, edit, save, getById, getAll };
})();

window.Vendors = Vendors;

/* Auto-load on this page */
document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('vendor-grid')) Vendors.load();
});
