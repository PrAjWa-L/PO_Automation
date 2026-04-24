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

  let _rendered = false;

  function _render() {
    if (_rendered) return;
    const list = document.getElementById('tc-list');
    if (!list) return;

    list.innerHTML = LIBRARY.map(t => `
      <div style="display:grid;grid-template-columns:18px 1fr;gap:8px;align-items:start;padding:6px 4px;border-bottom:1px solid var(--border);cursor:pointer;"
           onclick="document.getElementById('tc-${t.id}').click()">
        <input type="checkbox" id="tc-${t.id}"
               style="margin-top:3px;cursor:pointer;"
               onclick="event.stopPropagation()"
               onchange="TC.onCheck('${t.id}')">
        <div>
          <div style="font-size:12px;font-weight:600;color:var(--text);">${t.label}</div>
          <div style="font-size:11px;color:var(--text-muted);margin-top:2px;line-height:1.4;word-break:break-word;">${t.text.substring(0, 100)}…</div>
        </div>
      </div>
    `).join('');

    _rendered = true;
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
    const term  = LIBRARY.find(t => t.id === id);
    if (!term) return;
    const cb    = document.getElementById(`tc-${id}`);
    const notes = document.getElementById('f-notes');
    if (!notes) return;

    if (cb.checked) {
      // Append term to notes
      const current = notes.value.trim();
      notes.value = current ? current + '\n\n' + term.text : term.text;
    } else {
      // Remove term from notes
      notes.value = notes.value.replace(term.text, '').replace(/\n{3,}/g, '\n\n').trim();
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
    // Clear only the T&C lines, keep anything manually typed before them
    // Simple approach: just clear checkboxes, user manages notes field
    if (notes) notes.value = '';
  }

  // Reset checkboxes when the PO modal is opened fresh
  function reset() {
    _rendered = false;
    const panel = document.getElementById('tc-panel');
    const btn   = document.getElementById('tc-toggle-btn');
    if (panel) panel.style.display = 'none';
    if (btn)   btn.textContent = '＋ Select from library';
  }

  return { toggle, onCheck, selectAll, clearAll, reset };
})();

window.TC = TC;