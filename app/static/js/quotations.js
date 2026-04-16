/**
 * quotations.js — Quotation upload, listing, AI compare card render
 * Exposes: window.Quotations
 */

const Quotations = (() => {

  let _all = [];

  /* ─────────────────────────────────────────────
     LOAD & RENDER
  ───────────────────────────────────────────── */
  async function load() {
    const grid = document.getElementById('quot-grid');
    if (grid) grid.innerHTML = Utils.loadingState();

    const r = await API.Quotations.list();
    if (!r.success) {
      if (grid) grid.innerHTML = Utils.emptyState('⚠', 'Could not load quotations.');
      return;
    }
    _all = r.data || [];
    if (grid) _render(_all);

    /* Also refresh AI compare cards if on that page */
    if (typeof AICompare !== 'undefined') AICompare.renderCards(_all);
  }

  function getAll() { return _all; }

  function _render(quots) {
    const grid = document.getElementById('quot-grid');
    if (!grid) return;
    if (!quots.length) {
      grid.innerHTML = Utils.emptyState('📎', 'No quotations uploaded yet. Upload your first document.');
      return;
    }
    grid.innerHTML = quots.map(_card).join('');
  }

  function _card(q) {
    const score    = _score(q, Math.min(..._all.map(x => x.total_amount)));
    const scoreCls = score >= 75 ? 'high' : score >= 55 ? 'medium' : 'low';
    const scoreClr = score >= 75 ? 'var(--green)' : score >= 55 ? 'var(--amber)' : 'var(--red)';

    return `
      <div class="quot-card">
        <div class="quot-card-hd">
          <div>
            <div class="quot-vendor">${Utils.esc(q.vendor_name)}</div>
            <div class="quot-ref">${Utils.esc(q.ref_number || '—')} · ${Utils.esc(q.doc_date || '—')}</div>
          </div>
          <span class="badge ${q.doc_type === 'Quotation' ? 'badge-blue' : 'badge-purple'}">
            ${Utils.esc(q.doc_type)}
          </span>
        </div>
        <div class="quot-card-bd">
          <div class="quot-row">
            <span class="quot-k">Grand Total</span>
            <span class="quot-v">${Utils.fmtCurrency(q.total_amount)}</span>
          </div>
          <div class="quot-row">
            <span class="quot-k">GST %</span>
            <span class="quot-v">${q.gst_pct}%</span>
          </div>
          <div class="quot-row">
            <span class="quot-k">GSTIN</span>
            <span class="quot-v ${q.vendor_gst ? '' : 'quot-missing'}">
              ${q.vendor_gst ? Utils.esc(q.vendor_gst) : '⚠ MISSING'}
            </span>
          </div>
          <div class="quot-row">
            <span class="quot-k">Delivery</span>
            <span class="quot-v text">${Utils.truncate(q.delivery_days || '—', 28)}</span>
          </div>
          <div class="quot-row">
            <span class="quot-k">Warranty</span>
            <span class="quot-v text">${Utils.truncate(q.warranty || '—', 28)}</span>
          </div>
          <div class="quot-row">
            <span class="quot-k">Payment</span>
            <span class="quot-v text">${Utils.truncate(q.payment_terms || '—', 28)}</span>
          </div>
          ${q.file_name
            ? `<div class="quot-file-link">📎 ${Utils.esc(q.file_name)}</div>`
            : ''}
          <div class="quot-desc">${Utils.truncate(q.description || '', 100)}</div>

          <div class="score-bar-wrap">
            <div class="score-bar-track">
              <div class="score-bar-fill ${scoreCls}" style="width:${score}%"></div>
            </div>
            <div class="score-label" style="color:${scoreClr};">Score: ${score}/100</div>
          </div>

          <div class="quot-card-actions">
            <button class="btn btn-sm"
                    onclick="window.location.href='${window.location.origin}/ai-compare'">
              ✦ AI Compare
            </button>
            ${window.PROCUREIQ && window.PROCUREIQ.userRole === 'coo' ? `
            <button class="btn btn-sm btn-green"
                    onclick="Quotations.approveAndCreatePO('${Utils.esc(q.id)}')">
              ✓ Approve &amp; Create PO
            </button>` : ''}
            <button class="btn btn-sm btn-red"
                    onclick="Quotations.remove('${Utils.esc(q.id)}')">
              Remove
            </button>
          </div>
        </div>
      </div>`;
  }

  function _score(q, lowestTotal) {
    if (!_all.length || !lowestTotal) return 75;
    if (q.total_amount === lowestTotal) return 88;
    return Math.max(40, 88 - Math.round((q.total_amount - lowestTotal) / lowestTotal * 60));
  }

  /* ─────────────────────────────────────────────
     UPLOAD MODAL
  ───────────────────────────────────────────── */
  function openUploadModal() {
    _clearUploadForm();
    Modal.open('upload-modal');
  }

  function _clearUploadForm() {
    ['up-vendor','up-ref','up-delivery','up-warranty','up-payterms','up-vgst','up-desc']
      .forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
    const total = document.getElementById('up-total');
    if (total) total.value = '';
    const gst   = document.getElementById('up-gst');
    if (gst)   gst.value = '18';
    const date  = document.getElementById('up-date');
    if (date)  date.value = Utils.today();
    const file  = document.getElementById('up-file');
    if (file)  file.value = '';
    const pw    = document.getElementById('up-preview-wrap');
    if (pw)    pw.style.display = 'none';
  }

  /* File input change handler */
  function handleFile(inp) {
    const f = inp.files[0];
    if (!f) return;
    document.getElementById('up-fname').textContent =
      f.name + ' (' + Math.round(f.size / 1024) + ' KB)';
    const wrap = document.getElementById('up-preview-wrap');
    const prev = document.getElementById('up-preview');
    if (f.type.startsWith('image/')) {
      const rd = new FileReader();
      rd.onload = e => {
        prev.src = e.target.result;
        prev.style.display = 'block';
        wrap.style.display = 'block';
      };
      rd.readAsDataURL(f);
    } else {
      if (prev) prev.style.display = 'none';
      if (wrap) wrap.style.display = 'block';
    }
  }

  /* Drag & drop handlers */
  function dragOver(e)  { e.preventDefault(); document.getElementById('upzone')?.classList.add('drag'); }
  function dragLeave(e) { document.getElementById('upzone')?.classList.remove('drag'); }
  function drop(e) {
    e.preventDefault();
    document.getElementById('upzone')?.classList.remove('drag');
    const dt  = e.dataTransfer;
    const inp = document.getElementById('up-file');
    if (dt && inp) {
      inp.files = dt.files;
      handleFile(inp);
    }
  }

  /* Save (multipart POST) */
  async function save() {
    const vendor = document.getElementById('up-vendor')?.value.trim();
    if (!vendor) { Utils.toast('Vendor name is required.'); return; }

    const fd = new FormData();
    fd.append('vendor_name',   vendor);
    fd.append('doc_type',      document.getElementById('up-type')?.value    || 'Quotation');
    fd.append('ref_number',    document.getElementById('up-ref')?.value     || '');
    fd.append('doc_date',      document.getElementById('up-date')?.value    || '');
    fd.append('total_amount',  document.getElementById('up-total')?.value   || '0');
    fd.append('gst_pct',       document.getElementById('up-gst')?.value     || '18');
    fd.append('delivery_days', document.getElementById('up-delivery')?.value|| '');
    fd.append('warranty',      document.getElementById('up-warranty')?.value|| '');
    fd.append('payment_terms', document.getElementById('up-payterms')?.value|| '');
    fd.append('vendor_gst',    (document.getElementById('up-vgst')?.value   || '').toUpperCase());
    fd.append('description',   document.getElementById('up-desc')?.value    || '');

    const file = document.getElementById('up-file')?.files[0];
    if (file) fd.append('file', file);

    const r = await API.Quotations.create(fd);
    if (r.success) {
      Utils.toastSuccess(`Quotation from "${vendor}" saved.`);
      Modal.close('upload-modal');
      await load();
    } else {
      Utils.toastError(r.message);
    }
  }

  /* Delete */
  async function remove(id) {
    if (!confirm('Remove this quotation?')) return;
    const r = await API.Quotations.remove(id);
    if (r.success) {
      Utils.toastSuccess('Quotation removed.');
      await load();
    } else {
      Utils.toastError(r.message);
    }
  }

  /* ─────────────────────────────────────────────
     APPROVE & CREATE PO FROM QUOTATION
  ───────────────────────────────────────────── */
  async function approveAndCreatePO(id) {
    const r = await API.Quotations.get(id);
    if (!r.success) { Utils.toastError('Could not load quotation.'); return; }
    const q = r.data;
    if (typeof PO === 'undefined') {
      Utils.toastError('PO module not available on this page.');
      return;
    }
    await PO.openFromQuotation(q);
  }

  return {
    load, getAll,
    openUploadModal, handleFile, dragOver, dragLeave, drop, save,
    remove, approveAndCreatePO,
  };
})();

window.Quotations = Quotations;

document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('quot-grid') ||
      document.getElementById('ai-vc-cards')) {
    Quotations.load();
  }
});