/**
 * tc.js — Terms & Conditions library picker
 * Exposes: window.TC
 */

const TC = (() => {

  // ── T&C Library ─────────────────────────────────────────────
  // Edit this array to add / remove / reorder terms
  const LIBRARY = [
    {
      id: 'definition',
      label: 'Definition',
      text: 'Definition: "Seller" refers to the vendor/supplier and "Buyer" refers to Cutis Hospital — Academy of Cutaneous Sciences.',
    },
    {
      id: 'contract',
      label: 'Contract & Order Acceptance',
      text: 'Contract: All orders are accepted subject to these Terms and Conditions. No representations or warranties not contained in the PO shall be binding. Alterations require written agreement by both parties.',
    },
    {
      id: 'validity',
      label: 'Validity & Pricing',
      text: 'Validity: Prices are firm for the delivery period stated and are inclusive of all applicable taxes. Prices are C&F inclusive of freight, insurance, and handling.',
    },
    {
      id: 'payment_rtgs',
      label: 'Payment via RTGS/NEFT',
      text: 'Payment: Payment shall be made via RTGS/NEFT as per the agreed payment terms. Bank details to be confirmed by the vendor in writing prior to transfer.',
    },
    {
      id: 'advance_100',
      label: '100% Advance Payment',
      text: 'Payment: 100% advance payment is required before dispatch/delivery of goods.',
    },
    {
      id: 'delivery_weeks',
      label: 'Delivery Timeline (4–6 weeks)',
      text: 'Delivery: Goods shall be delivered within 4–6 weeks from the date of receipt of payment/confirmed PO.',
    },
    {
      id: 'warranty_3yr',
      label: 'Warranty — 3 Year Comprehensive',
      text: 'Warranty: 3-year comprehensive warranty covering the machine with standard accessories, from the date of installation. All software upgrades are free during the warranty period.',
    },
    {
      id: 'amc',
      label: 'Preventive Maintenance & Calibration',
      text: 'Preventive Maintenance: Preventive maintenance and calibration as per schedule is included during the warranty period.',
    },
    {
      id: 'consumables',
      label: 'Initial Consumable Starter Kit',
      text: 'Consumables: An initial consumable starter kit shall be provided along with the equipment.',
    },
    {
      id: 'installation',
      label: 'Free Installation & Calibration',
      text: 'Installation: Free installation and calibration at Cutis Academy of Cutaneous Sciences, Vijayanagar, Bangalore – 560 040.',
    },
    {
      id: 'training',
      label: 'On-Site Training',
      text: 'Training: On-site training for the entire team of technicians at the installation site (Initial + Refresher after 3 months + Advanced session). Training certificates shall be provided for all clinicians.',
    },
    {
      id: 'manuals',
      label: 'Protocol Manuals & Learning Resources',
      text: 'Documentation: Vendor shall provide protocol manuals, video learning resources, user manual, and a maintenance log book.',
    },
    {
      id: 'service_response',
      label: 'Service Response — 48 Hours',
      text: 'Service: Maximum 48-hour response commitment for service calls. Stand-by handpiece arrangement if repair exceeds 7 days.',
    },
    {
      id: 'warranty_cert',
      label: 'Warranty Certificate',
      text: 'Warranty Certificate: Warranty certificate with machine serial number and handpiece serial numbers clearly mentioned shall be provided at delivery.',
    },
    {
      id: 'penalty',
      label: 'Penalty Clause — Delayed Supply',
      text: 'Penalty: Delay in supply of goods will attract a penalty clause of up to 2% of the billing amount for every 1-week delay beyond the agreed delivery date.',
    },
    {
      id: 'gst_compliance',
      label: 'GST Compliance',
      text: 'GST: The vendor shall issue a valid GST invoice and ensure timely filing of returns so that input tax credit is available to Cutis Hospital.',
    },
    {
      id: 'rejection',
      label: 'Goods Inspection & Rejection',
      text: 'Inspection: Goods not conforming to specifications mentioned in this PO are liable to be rejected and returned at the vendor\'s cost.',
    },
    {
      id: 'dispute',
      label: 'Dispute Resolution',
      text: 'Disputes: Any disputes arising out of this purchase order shall be subject to the jurisdiction of courts in Bengaluru, Karnataka.',
    },
  ];

  // Tracks per-term edited text (keyed by term id). Populated on first expand.
  const _edits = {};

  let _rendered = false;

  // Get the current text for a term (edited version if changed, else original)
  function _getText(id) {
    const term = LIBRARY.find(t => t.id === id);
    if (!term) return '';
    return _edits[id] !== undefined ? _edits[id] : term.text;
  }

  function _render() {
    if (_rendered) return;
    const list = document.getElementById('tc-list');
    if (!list) return;

    list.innerHTML = LIBRARY.map(t => `
      <div style="border-bottom:1px solid var(--border);">

        <!-- Header row: checkbox + label + edit toggle -->
        <div style="display:grid;grid-template-columns:18px 1fr auto;gap:8px;
                    align-items:start;padding:6px 4px;cursor:pointer;"
             onclick="document.getElementById('tc-${t.id}').click()">
          <input type="checkbox" id="tc-${t.id}"
                 style="margin-top:3px;cursor:pointer;"
                 onclick="event.stopPropagation()"
                 onchange="TC.onCheck('${t.id}')">
          <div>
            <div style="font-size:12px;font-weight:600;color:var(--text);">${t.label}</div>
            <div style="font-size:11px;color:var(--text-muted);margin-top:2px;
                        line-height:1.4;word-break:break-word;">
              ${t.text.substring(0, 100)}…
            </div>
          </div>
          <!-- Edit button — stops row click so checkbox isn't toggled -->
          <button
            onclick="event.stopPropagation(); TC.toggleEdit('${t.id}')"
            id="tc-edit-btn-${t.id}"
            title="Edit this term"
            style="font-size:11px;padding:2px 7px;border-radius:5px;
                   border:1px solid var(--border);background:var(--surface2);
                   color:var(--text2);cursor:pointer;white-space:nowrap;
                   align-self:center;">
            ✏ Edit
          </button>
        </div>

        <!-- Inline edit panel (hidden by default) -->
        <div id="tc-edit-panel-${t.id}"
             style="display:none;padding:4px 8px 10px 26px;">
          <textarea
            id="tc-edit-ta-${t.id}"
            rows="4"
            style="width:100%;font-size:11.5px;line-height:1.5;
                   border:1px solid var(--border);border-radius:6px;
                   padding:6px 8px;resize:vertical;
                   background:var(--surface);color:var(--text);
                   box-sizing:border-box;"
            oninput="TC._onEditInput('${t.id}', this.value)"
          ></textarea>
          <div style="display:flex;gap:6px;margin-top:5px;">
            <button onclick="TC.applyEdit('${t.id}')"
                    style="font-size:11px;padding:3px 10px;border-radius:5px;
                           border:none;background:var(--blue,#1a56db);
                           color:#fff;cursor:pointer;">
              ✓ Apply
            </button>
            <button onclick="TC.resetEdit('${t.id}')"
                    style="font-size:11px;padding:3px 10px;border-radius:5px;
                           border:1px solid var(--border);background:var(--surface2);
                           color:var(--text2);cursor:pointer;">
              Reset to default
            </button>
          </div>
        </div>

      </div>
    `).join('');

    _rendered = true;
  }

  /* Open / close the inline edit panel for a term */
  function toggleEdit(id) {
    const panel = document.getElementById(`tc-edit-panel-${id}`);
    const btn   = document.getElementById(`tc-edit-btn-${id}`);
    const ta    = document.getElementById(`tc-edit-ta-${id}`);
    if (!panel) return;

    const isOpen = panel.style.display !== 'none';
    if (isOpen) {
      panel.style.display = 'none';
      btn.textContent = '✏ Edit';
    } else {
      // Populate textarea with current text (edited or original)
      ta.value = _getText(id);
      panel.style.display = 'block';
      btn.textContent = '✕ Close';
      ta.focus();
    }
  }

  /* Live-save edits to _edits map as the user types */
  function _onEditInput(id, value) {
    _edits[id] = value;
  }

  /* Apply: if term is already checked, update the notes field with the new text */
  function applyEdit(id) {
    const cb = document.getElementById(`tc-${id}`);
    if (cb && cb.checked) {
      // Replace the old version in the notes field with the new one
      const term   = LIBRARY.find(t => t.id === id);
      const oldTxt = term ? term.text : '';
      const newTxt = _getText(id);
      const notes  = document.getElementById('f-notes');
      if (notes) {
        // Try to replace the old text (original or previous edit)
        if (notes.value.includes(oldTxt)) {
          notes.value = notes.value.replace(oldTxt, newTxt);
        } else {
          // Already replaced once — just append if not present
          if (!notes.value.includes(newTxt)) {
            notes.value = notes.value.trim() + '\n\n' + newTxt;
          }
        }
      }
    }
    // Close the panel
    toggleEdit(id);
  }

  /* Reset a term's text back to the library default */
  function resetEdit(id) {
    delete _edits[id];
    const ta = document.getElementById(`tc-edit-ta-${id}`);
    if (ta) ta.value = _getText(id);
  }

  function toggle() {
    _render();
    const panel = document.getElementById('tc-panel');
    const btn   = document.getElementById('tc-toggle-btn');
    if (!panel) return;
    const open = panel.style.display === 'none';
    panel.style.display = open ? 'block' : 'none';
    btn.textContent = open ? '✕ Close library' : '＋ Select from library';
  }

  function onCheck(id) {
    const cb    = document.getElementById(`tc-${id}`);
    const notes = document.getElementById('f-notes');
    if (!notes) return;

    const text = _getText(id);   // use edited version if available

    if (cb.checked) {
      const current = notes.value.trim();
      notes.value = current ? current + '\n\n' + text : text;
    } else {
      // Remove this term's text from notes (handles edited version too)
      const term    = LIBRARY.find(t => t.id === id);
      const origTxt = term ? term.text : '';
      // Try to remove edited version first, then original
      notes.value = notes.value
        .replace(text, '')
        .replace(origTxt, '')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
    }
  }

  function selectAll() {
    _render();
    LIBRARY.forEach(t => {
      const cb = document.getElementById(`tc-${t.id}`);
      if (cb && !cb.checked) {
        cb.checked = true;
        onCheck(t.id);
      }
    });
  }

  function clearAll() {
    LIBRARY.forEach(t => {
      const cb = document.getElementById(`tc-${t.id}`);
      if (cb && cb.checked) {
        cb.checked = false;
      }
    });
    const notes = document.getElementById('f-notes');
    if (notes) notes.value = '';
  }

  // Reset checkboxes + edits when the PO modal is opened fresh
  function reset() {
    _rendered = false;
    // Clear all pending edits
    Object.keys(_edits).forEach(k => delete _edits[k]);
    const panel = document.getElementById('tc-panel');
    const btn   = document.getElementById('tc-toggle-btn');
    if (panel) panel.style.display = 'none';
    if (btn)   btn.textContent = '＋ Select from library';
  }

  return { toggle, onCheck, selectAll, clearAll, reset, toggleEdit, _onEditInput, applyEdit, resetEdit };
})();

window.TC = TC;