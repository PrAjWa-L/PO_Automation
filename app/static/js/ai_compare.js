/**
 * ai_compare.js — AI Quotation Comparison page
 * Depends on: quotations.js (for data), api.js
 * Exposes: window.AICompare
 */

const AICompare = (() => {

  /* Render comparison cards from quotation array */
  function renderCards(quots) {
    const grid = document.getElementById('ai-vc-cards');
    if (!grid) return;

    if (!quots || !quots.length) {
      grid.style.gridTemplateColumns = '1fr';
      grid.innerHTML = `<div class="empty" style="grid-column:1/-1;">
        <div class="empty-icon">📎</div>
        <p>No quotations loaded yet. Upload at least two to compare.</p>
      </div>`;
      return;
    }

    const lowest = Math.min(...quots.map(q => q.total_amount));
    const cols   = Math.min(quots.length, 3);
    grid.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;

    grid.innerHTML = quots.map(q => {
      const isLow  = q.total_amount === lowest;
      const score  = isLow ? 88 : Math.max(40, 88 - Math.round((q.total_amount - lowest) / lowest * 60));
      const clr    = score >= 75 ? 'var(--green)' : score >= 55 ? 'var(--amber)' : 'var(--red)';

      return `
        <div class="quot-card" style="position:relative;${isLow ? 'border-color:var(--green);border-width:2px;' : ''}">
          ${isLow
            ? `<div style="position:absolute;top:-9px;left:12px;background:var(--green);color:#fff;
                          font-size:9.5px;font-weight:600;padding:2px 8px;border-radius:100px;">
                 Lowest Price
               </div>`
            : ''}
          <div class="quot-card-hd">
            <div>
              <div class="quot-vendor">${Utils.esc(q.vendor_name)}</div>
              <div class="quot-ref">${Utils.esc(q.doc_date || '—')}</div>
            </div>
            <span class="badge ${q.doc_type === 'Quotation' ? 'badge-blue' : 'badge-purple'}">
              ${Utils.esc(q.doc_type)}
            </span>
          </div>
          <div class="quot-card-bd">
            <div class="quot-row">
              <span class="quot-k">Total</span>
              <span class="quot-v" style="color:${isLow ? 'var(--green)' : ''}">
                ${Utils.fmtCurrency(q.total_amount)}
              </span>
            </div>
            <div class="quot-row">
              <span class="quot-k">GSTIN</span>
              <span class="quot-v ${q.vendor_gst ? '' : 'quot-missing'}">
                ${q.vendor_gst ? Utils.esc(q.vendor_gst) : '⚠ MISSING — ITC risk'}
              </span>
            </div>
            <div class="quot-row">
              <span class="quot-k">GST %</span>
              <span class="quot-v">${q.gst_pct}%</span>
            </div>
            <div class="quot-row">
              <span class="quot-k">Delivery</span>
              <span class="quot-v text">${Utils.truncate(q.delivery_days || '—', 26)}</span>
            </div>
            <div class="quot-row">
              <span class="quot-k">Warranty</span>
              <span class="quot-v text">${Utils.truncate(q.warranty || '—', 26)}</span>
            </div>
            <div class="quot-row">
              <span class="quot-k">Payment</span>
              <span class="quot-v text">${Utils.truncate(q.payment_terms || '—', 26)}</span>
            </div>
            <div class="score-bar-wrap">
              <div class="score-bar-track">
                <div class="score-bar-fill" style="width:${score}%;background:${clr}"></div>
              </div>
              <div class="score-label" style="color:${clr};">Score: ${score}/100</div>
            </div>
          </div>
        </div>`;
    }).join('');
  }

  /* Run AI analysis — calls backend /api/ai/compare-quotations */
  async function run() {
    const quots = typeof Quotations !== 'undefined' ? Quotations.getAll() : [];
    if (quots.length < 2) {
      Utils.toast('Upload at least 2 quotations before running analysis.');
      return;
    }

    const btn = document.getElementById('run-ai-btn');
    const btn2= document.getElementById('run-ai-btn2');
    const section = document.getElementById('ai-result-section');
    const output  = document.getElementById('ai-output');

    [btn, btn2].forEach(b => { if (b) { b.textContent = '⏳ Analysing…'; b.disabled = true; } });
    if (section) section.style.display = 'block';
    if (output)  output.innerHTML = `<span class="ai-thinking">
      ✦ Claude is analysing ${quots.length} quotations for price, risk,
      GST compliance and vendor reliability…</span>`;

    const ids = quots.map(q => q.id);
    const r   = await API.AI.compare({ quotation_ids: ids });

    if (r.success && r.data?.analysis) {
      if (output) {
        output.innerHTML = r.data.analysis
          .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
          .replace(/\n/g, '<br>');
      }
    } else {
      if (output) {
        output.innerHTML = `
          <span style="color:var(--amber);">
            AI endpoint responded: ${Utils.esc(r.message || 'error')}
          </span><br><br>
          Make sure <code>Ollama</code> is running on <code>localhost:11434</code>
          with the <code>llama3.2</code> model pulled (<code>ollama pull llama3.2</code>).`;
      }
    }

    [btn, btn2].forEach(b => { if (b) { b.textContent = '✦ Re-run Analysis'; b.disabled = false; } });
  }

  /* Copy analysis to clipboard */
  function copy() {
    const text = document.getElementById('ai-output')?.innerText || '';
    navigator.clipboard.writeText(text).then(() => Utils.toastSuccess('Analysis copied to clipboard.'));
  }

  return { renderCards, run, copy };
})();

window.AICompare = AICompare;

document.addEventListener('DOMContentLoaded', () => {
  /* quotations.js DOMContentLoaded handles Quotations.load() for this page too */
});


/* ═══════════════════════════════════════════════════════════════
   reports.js — Reports page
   Exposes: window.Reports
═══════════════════════════════════════════════════════════════ */

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
      wrap.innerHTML = '<p style="font-size:12.5px;color:var(--text3);">No payment data.</p>';
      return;
    }

    const data  = r.data;
    const total = Object.values(data).reduce((a, b) => a + b, 0) || 1;
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
    const d = r.data;
    const statuses = [
      ['Draft',            d.draft    || 0, 'var(--border2)'],
      ['Pending Approval', d.pending  || 0, 'var(--amber)'],
      ['Approved',         d.approved || 0, 'var(--green)'],
    ];
    const total = d.total_pos || 1;

    wrap.innerHTML = statuses.map(([label, count, color]) => `
      <div class="sb-row">
        <div class="sb-labels">
          <span>${label}</span>
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