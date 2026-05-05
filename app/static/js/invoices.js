/* Invoice Matching Module */
const Invoices = (() => {

  // ── Load & render all invoices ──────────────────────────────
  async function load() {
    const wrap = document.getElementById('invoices-wrap');
    if (!wrap) return;
    wrap.innerHTML = Utils.loadingState ? Utils.loadingState() : '<p>Loading…</p>';

    const r = await fetch('/api/invoices/').then(res => res.json());
    if (!r.success) { wrap.innerHTML = '<p>Could not load invoices.</p>'; return; }

    if (!r.data.length) {
      wrap.innerHTML = `
        <div style="text-align:center;padding:60px 20px;color:var(--c-muted);">
          <div style="font-size:40px;margin-bottom:12px;">🧾</div>
          <div style="font-size:15px;font-weight:500;margin-bottom:6px;">No invoices yet</div>
          <div style="font-size:13px;">Upload a vendor invoice to start matching against a PO.</div>
        </div>`;
      return;
    }

    wrap.innerHTML = `<div class="grid2">${r.data.map(_card).join('')}</div>`;
  }

  // ── Render a single invoice match card ──────────────────────
  function _card(inv) {
    const statusClass = inv.match_status === 'Matched'  ? 'badge-green'
                      : inv.match_status === 'Mismatch' ? 'badge-red'
                      : 'badge-amber';

    const notes = (inv.match_notes || '').split('\n').map(line => {
      const icon  = line.startsWith('✓') ? 'inv-ok'
                  : line.startsWith('✗') ? 'inv-err'
                  : 'inv-warn';
      return `<div class="inv-row">
        <div class="inv-ic ${icon}">${line.startsWith('✓') ? '✓' : line.startsWith('✗') ? '✗' : '!'}</div>
        <div><div class="inv-label">${line.replace(/^[✓✗⚠]\s*/, '')}</div></div>
      </div>`;
    }).join('');

    return `
    <div class="card">
      <div class="card-hd">
        <div class="card-title">
          ${inv.invoice_number || 'Invoice'} · ${inv.vendor_name || inv.po_vendor_name || '—'}
        </div>
        <span class="badge ${statusClass}">${inv.match_status}</span>
      </div>
      <div style="font-size:12px;color:var(--c-muted);margin-bottom:10px;">
        PO: <strong>${inv.po_id || '—'}</strong> &nbsp;·&nbsp;
        File: ${inv.file_name || '—'} &nbsp;·&nbsp;
        ${inv.invoice_date || ''}
      </div>
      ${notes}
      <div style="margin-top:12px;display:flex;gap:8px;justify-content:flex-end;">
        <button class="btn btn-sm btn-danger" onclick="Invoices.remove(${inv.id})">Delete</button>
      </div>
    </div>`;
  }

  // ── Open upload modal ────────────────────────────────────────
  async function openUploadModal() {
    // Populate PO dropdown
    const select = document.getElementById('inv-po-select');
    select.innerHTML = '<option value="">Loading…</option>';
    Modal.open('inv-upload-modal');

    const r = await fetch('/api/purchase-orders?status=Approved').then(res => res.json());
    const pos = (r.success && r.data) ? r.data : [];
    select.innerHTML = pos.length
      ? '<option value="">— Select PO —</option>' + pos.map(p =>
          `<option value="${p.id}">${p.id} — ${p.vendor_name || '—'} (₹${(p.grand_total||0).toLocaleString('en-IN')})</option>`
        ).join('')
      : '<option value="">No approved POs found</option>';

    document.getElementById('inv-upload-status').textContent = '';
    document.getElementById('inv-file-input').value = '';
  }

  // ── Submit upload ────────────────────────────────────────────
  async function submitUpload() {
    const poId  = document.getElementById('inv-po-select')?.value;
    const file  = document.getElementById('inv-file-input')?.files[0];
    const status = document.getElementById('inv-upload-status');

    if (!poId)  { if (status) status.textContent = 'Please select a PO.'; return; }
    if (!file)  { if (status) status.textContent = 'Please select a PDF file.'; return; }

    if (status) status.innerHTML = '<span style="color:var(--c-muted)">⏳ Extracting and matching… this may take a moment.</span>';

    const fd = new FormData();
    fd.append('po_id', poId);
    fd.append('file', file);

    try {
      const res  = await fetch('/api/invoices/upload', { method: 'POST', body: fd });
      const data = await res.json();

      if (data.success) {
        if (status) status.innerHTML = '<span style="color:green">✓ Invoice matched successfully!</span>';
        setTimeout(() => {
          Modal.close('inv-upload-modal');
          load();
        }, 1200);
      } else {
        if (status) status.innerHTML = `<span style="color:red">✗ ${data.message}</span>`;
      }
    } catch(e) {
      if (status) status.innerHTML = `<span style="color:red">✗ Upload failed: ${e.message}</span>`;
    }
  }

  // ── Delete invoice ───────────────────────────────────────────
  async function remove(id) {
    if (!confirm('Delete this invoice record?')) return;
    const res  = await fetch(`/api/invoices/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.success) load();
    else alert(data.message);
  }

  return { load, openUploadModal, submitUpload, remove };

})();

if (document.getElementById('invoices-wrap')) Invoices.load();