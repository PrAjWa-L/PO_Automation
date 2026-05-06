/**
 * pdf_generator.js — jsPDF-based PO PDF export
 * Depends on: jsPDF + jsPDF-autotable CDN scripts, utils.js
 * Exposes: window.PDFGen
 */

const PDFGen = (() => {

  const ORG = {
    name:        'CUTIS\u2122 Academy of Cutaneous Sciences',
    affiliation: 'Affiliated to Rajiv Gandhi University of Health Sciences, Karnataka (RGUHS)',
    addr:        '5/1, 4th Main, MRCR Layout, Vijayanagar, (Near Veeresh Theatre), Magadi Main Road, BENGALURU - 560 040',
    gstin:       '29AAHFC6018K1Z8',
    tel:         '080 4115 9049 / 51, 080 2340 1200 / 300',
    mob:         '8296110020',
    email:       'askcutis@gmail.com',
    web:         'www.cutis.org.in',
    signer:      'COO',
    director1:   { name: 'Dr. B.S. Chandrashekar', qual: 'M.D., D.N.B.', title: 'Chairman' },
    director2:   { name: 'Dr. Manjula C.N.',       qual: 'M.D. (OBG)',   title: 'Chief Executive Officer' },
    logoUrl:     '/static/images/logo.png',
  };

  const C = {
    teal:      [0,   128, 128],
    darkTeal:  [0,   100, 100],
    red:       [180, 0,   0  ],
    black:     [17,  24,  39 ],
    grey:      [107, 114, 128],
    lightGrey: [209, 213, 219],
    bgLight:   [232, 245, 245],
    bgRow:     [249, 250, 251],
    white:     [255, 255, 255],
  };

  const M        = 14;
  const PW       = 210;
  const CW       = PW - M * 2;
  const PAGE_H   = 297;
  const FOOTER_H = 14;

  // Active entity for current generation — set at start of generate()
  let _activeOrg = ORG;

  function _drawLetterhead(doc, y, org) {
    org = org || _activeOrg;
    doc.setFillColor(...C.teal);
    doc.rect(M, y, CW, 2, 'F');
    y += 5;

    try { doc.addImage(org.logoUrl, 'PNG', M, y, 32, 11); } catch(e) {}

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(...C.darkTeal);
    doc.text(org.name, PW / 2, y + 5, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(80, 80, 80);
    if (org.affiliation) {
      doc.text(org.affiliation, PW / 2, y + 9.5, { align: 'center' });
    }
    const aLines = doc.splitTextToSize(org.addr, CW * 0.55);
    const addrY  = org.affiliation ? y + 13.5 : y + 10;
    aLines.forEach((l, i) => doc.text(l, PW / 2, addrY + i * 3.5, { align: 'center' }));

    const rx = PW - M;
    doc.setFont('helvetica', 'bold');   doc.setFontSize(8.5); doc.setTextColor(...C.darkTeal);
    doc.text(org.director1.name,  rx, y + 3,    { align: 'right' });
    doc.setFont('helvetica', 'bold');   doc.setFontSize(7.5); doc.setTextColor(...C.red);
    doc.text(org.director1.qual,  rx, y + 7,    { align: 'right' });
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7);   doc.setTextColor(80, 80, 80);
    doc.text(org.director1.title, rx, y + 10.5, { align: 'right' });
    doc.setFont('helvetica', 'bold');   doc.setFontSize(8.5); doc.setTextColor(...C.darkTeal);
    doc.text(org.director2.name,  rx, y + 16,   { align: 'right' });
    doc.setFont('helvetica', 'bold');   doc.setFontSize(7.5); doc.setTextColor(...C.red);
    doc.text(org.director2.qual,  rx, y + 20,   { align: 'right' });
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7);   doc.setTextColor(80, 80, 80);
    doc.text(org.director2.title, rx, y + 23.5, { align: 'right' });

    y += 28;
    doc.setDrawColor(...C.red);
    doc.setLineWidth(0.6);
    doc.line(M, y, PW - M, y);
    return y + 4;
  }

  function _drawFooter(doc, org) {
    org = org || _activeOrg;
    const fy = PAGE_H - 10;
    doc.setDrawColor(...C.teal);
    doc.setLineWidth(0.4);
    doc.line(M, fy - 3, PW - M, fy - 3);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(80, 80, 80);
    const mobPart = org.mob ? `  |  Mob: ${org.mob}` : '';
    doc.text(
      `Tel: ${org.tel}${mobPart}  |  Email: ${org.email}  |  ${org.web}`,
      PW / 2, fy, { align: 'center' }
    );
  }

  function _checkPage(doc, y, needed) {
    if (y + needed > PAGE_H - FOOTER_H - 5) {
      _drawFooter(doc);
      doc.addPage();
      y = _drawLetterhead(doc, M);
      y += 4;
    }
    return y;
  }

  function _numberTC(text) {
    if (!text) return text;
    let counter = 1;
    return text.split('\n').map(line => {
      const trimmed = line.trim();
      if (!trimmed) return '';
      if (/^\d+[\.\)]/.test(trimmed)) return trimmed;
      return `${counter++}. ${trimmed}`;
    }).join('\n');
  }

  function generate(po) {
    if (!window.jspdf) {
      Utils.toast('PDF library not loaded. Check internet connection.');
      return;
    }
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });

    // Resolve entity
    const entityKey = document.getElementById('f-entity')?.value || 'cutis';
    _activeOrg = (window.PO_ENTITIES && window.PO_ENTITIES[entityKey]) || ORG;

    const intra = (po.vendor_gst || '').toUpperCase().startsWith('29');

    let y = _drawLetterhead(doc, M);

    // Order label + PO number
    doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(...C.black);
    doc.text((po.order_type || 'Purchase Order').toUpperCase(), PW / 2, y + 5, { align: 'center' });
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...C.grey);
    doc.text(po.id || 'PO-DRAFT',               PW - M, y + 2,  { align: 'right' });
    doc.text('Date: ' + (po.po_date || '—'),     PW - M, y + 7,  { align: 'right' });
    y += 18;

    // Vendor block
    y = _checkPage(doc, y, 24);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(7); doc.setTextColor(...C.grey);
    doc.text('VENDOR', M, y); y += 5;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(...C.black);
    const vnL = doc.splitTextToSize(po.vendor_name || '—', CW);
    doc.text(vnL, M, y); y += vnL.length * 5 + 1.5;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(...C.grey);
    if (po.vendor_addr) { const l = doc.splitTextToSize(po.vendor_addr, CW); doc.text(l, M, y); y += l.length * 4 + 1; }
    if (po.vendor_gst)  { doc.text('GSTIN: ' + po.vendor_gst, M, y); y += 4; }
    if (po.vendor_bank) { const l = doc.splitTextToSize('Bank: ' + po.vendor_bank, CW); doc.text(l, M, y); y += l.length * 4 + 1; }
    y += 4;

    // Bill To / Vendor
    y = _checkPage(doc, y, 36);
    const halfW    = CW / 2;
    const billLines = [
      _activeOrg.name,
      _activeOrg.addr,
      'GSTIN: ' + _activeOrg.gstin,
      'Tel: '   + _activeOrg.tel,
      'Email: ' + _activeOrg.email,
    ];
    const shipLines = [
      po.vendor_name || '—',
      po.vendor_addr || '',
      po.vendor_gst  ? 'GSTIN: ' + po.vendor_gst  : '',
      po.vendor_bank ? 'Bank: '  + po.vendor_bank  : '',
    ].filter(l => l.trim());

    doc.setFillColor(...C.teal);
    doc.rect(M,               y, halfW - 0.5, 7, 'F');
    doc.rect(M + halfW + 0.5, y, halfW - 0.5, 7, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(...C.white);
    doc.text('Bill To:', M + 3,           y + 4.8);
    doc.text('Vendor:',  M + halfW + 3.5, y + 4.8);
    y += 9;

    let billH = 0, shipH = 0;
    billLines.forEach(l => { billH += doc.splitTextToSize(l, halfW - 10).length * 3.8; });
    shipLines.forEach(l => { shipH += doc.splitTextToSize(l, halfW - 10).length * 3.8; });
    const blockH = Math.max(billH, shipH) + 6;

    doc.setFillColor(...C.bgLight);
    doc.rect(M,               y, halfW - 0.5, blockH, 'F');
    doc.rect(M + halfW + 0.5, y, halfW - 0.5, blockH, 'F');

    let by = y + 4;
    billLines.forEach((line, idx) => {
      const ls = doc.splitTextToSize(line, halfW - 10);
      if (idx === 0) { doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(...C.black); }
      else           { doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(...C.grey); }
      doc.text(ls, M + 3, by); by += ls.length * 3.8;
    });

    by = y + 4;
    shipLines.forEach((line, idx) => {
      const ls = doc.splitTextToSize(line, halfW - 10);
      if (idx === 0) { doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(...C.black); }
      else           { doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(...C.grey); }
      doc.text(ls, M + halfW + 3.5, by); by += ls.length * 3.8;
    });

    doc.setDrawColor(...C.lightGrey); doc.setLineWidth(0.3);
    doc.rect(M,               y - 9, halfW - 0.5, blockH + 9, 'S');
    doc.rect(M + halfW + 0.5, y - 9, halfW - 0.5, blockH + 9, 'S');
    y += blockH + 5;

    // Line items table
    y = _checkPage(doc, y, 30);
    const heads = intra
      ? [['#', 'Product Name', 'HSN', 'Qty', 'Unit', 'Rate', 'Tax%', 'CGST', 'SGST', 'Total']]
      : [['#', 'Product Name', 'HSN', 'Qty', 'Unit', 'Rate', 'Tax%', 'Total']];

    const tableRows = (po.line_items || []).map((li, idx) => {
      const qty    = parseFloat(li.qty          || 1);
      const price  = parseFloat(li.unit_price   || 0);
      const disc   = parseFloat(li.discount_pct || 0);
      const gstPct = parseFloat(li.gst_pct      || 18);
      const base   = qty * price * (1 - disc / 100);
      const cgst   = li.cgst       != null ? parseFloat(li.cgst)       : base * gstPct / 200;
      const sgst   = li.sgst       != null ? parseFloat(li.sgst)       : base * gstPct / 200;
      const igst   = li.igst       != null ? parseFloat(li.igst)       : base * gstPct / 100;
      const total  = li.line_total != null ? parseFloat(li.line_total)  : base + (intra ? cgst + sgst : igst);
      const row = [idx + 1, li.item_name || '—', li.hsn_code || '—',
                   qty % 1 === 0 ? qty : qty.toFixed(2), 'nos',
                   price.toFixed(2), gstPct + '%'];
      if (intra) row.push(cgst.toFixed(2), sgst.toFixed(2));
      row.push(total.toFixed(2));
      return row;
    });

    const cws = intra
      ? [8, 52, 18, 14, 10, 20, 12, 16, 16, 16]
      : [8, 70, 20, 14, 10, 24, 12, 24];

    const colStyles = {};
    cws.forEach((w, i) => { colStyles[i] = { cellWidth: w, halign: 'right' }; });
    colStyles[0] = { cellWidth: cws[0], halign: 'center' };
    colStyles[1] = { cellWidth: cws[1], halign: 'left', overflow: 'linebreak' };
    colStyles[2] = { cellWidth: cws[2], halign: 'center' };

    doc.autoTable({
      head: heads,
      body: tableRows,
      startY: y,
      margin: { left: M, right: M },
      tableWidth: CW,
      styles: { fontSize: 8, cellPadding: 3, textColor: C.black, overflow: 'linebreak', valign: 'middle' },
      headStyles: { fillColor: C.teal, textColor: C.white, fontStyle: 'bold', fontSize: 8, halign: 'center' },
      alternateRowStyles: { fillColor: C.bgRow },
      columnStyles: colStyles,
      didDrawPage: (data) => {
        if (data.pageNumber > 1) _drawLetterhead(doc, M);
        _drawFooter(doc);
      },
    });
    y = doc.lastAutoTable.finalY + 6;

    // Totals
    y = _checkPage(doc, y, 40);
    const boxW = 80;
    const boxX = PW - M - boxW;
    const lH   = 6;
    const totRows = [
      ['Subtotal',   po.subtotal  || 0],
      ['Discounts', -(po.discount || 0)],
      [intra ? 'GST (CGST+SGST)' : 'GST (IGST)', po.gst_total || 0],
    ];
    if (po.order_type === 'Work Order' && parseFloat(po.tds_amt || 0) > 0)
      totRows.push([`TDS (${po.tds_pct || 0}%)`, -(po.tds_amt || 0)]);

    doc.setFillColor(...C.bgLight);
    doc.roundedRect(boxX - 4, y - 2, boxW + 8, totRows.length * lH + 3, 1.5, 1.5, 'F');
    doc.setDrawColor(...C.lightGrey); doc.setLineWidth(0.3);
    doc.roundedRect(boxX - 4, y - 2, boxW + 8, totRows.length * lH + 3, 1.5, 1.5, 'S');
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5);
    totRows.forEach(([label, val]) => {
      doc.setTextColor(...C.grey);  doc.text(label, boxX, y + 3.5);
      doc.setTextColor(...C.black);
      const v = parseFloat(val);
      doc.text((v < 0 ? '-' : '') + 'Rs.' + Math.abs(v).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }), PW - M - 2, y + 3.5, { align: 'right' });
      y += lH;
    });
    y += 2;
    doc.setDrawColor(...C.teal); doc.setLineWidth(0.5);
    doc.line(boxX - 4, y, PW - M + 4, y); y += 5;
    doc.setFillColor(...C.bgLight);
    doc.roundedRect(boxX - 4, y - 3, boxW + 8, 10, 1.5, 1.5, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(...C.black);
    doc.text('Grand Total', boxX, y + 4);
    doc.setTextColor(...C.teal);
    const gt = parseFloat(po.grand_total || 0);
    doc.text('Rs.' + gt.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }), PW - M - 2, y + 4, { align: 'right' });
    y += 14;

    // Notes / T&C
    if (po.notes && po.notes.trim()) {
      y = _checkPage(doc, y, 20);
      doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5); doc.setTextColor(...C.grey);
      doc.text('NOTES / TERMS & CONDITIONS', M, y); y += 6;

      const numbered = _numberTC(po.notes);
      numbered.split('\n').forEach(line => {
        if (!line.trim()) { y += 2; return; }
        const ls = doc.splitTextToSize(line, CW);
        y = _checkPage(doc, y, ls.length * 4.5);
        doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...C.black);
        doc.text(ls, M, y);
        y += ls.length * 4.5;
      });
      y += 4;
    }

    // Signature
    y = _checkPage(doc, y, 36);
    const sigW = 75;
    const sigY = y;
    doc.setFillColor(...C.teal);
    doc.roundedRect(M, sigY, sigW, 8, 1.5, 1.5, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(...C.white);
    doc.text('For ' + _activeOrg.name.split('\u2014')[0].trim(), M + sigW / 2, sigY + 5.5, { align: 'center' });
    doc.setDrawColor(...C.lightGrey); doc.setLineWidth(0.3);
    doc.rect(M, sigY + 8, sigW, 28, 'S');

    // Choose signature based on who approved the PO
    const _sigB64COO = 'data:image/png;base64,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';
    const _sigB64Head = null; // accounts_head signature — set via ACCOUNTS_HEAD_SIG if available

    const _approvedByRole = po.approved_by_role || 'coo';
    let _sigToUse = _sigB64COO;
    if (_approvedByRole === 'accounts_head' && window.ACCOUNTS_HEAD_SIG) {
      _sigToUse = window.ACCOUNTS_HEAD_SIG;
    }

    try { doc.addImage(_sigToUse, 'PNG', M + 5, sigY + 9, sigW - 10, 18); } catch(e) {}
    doc.line(M + 5, sigY + 29, M + sigW - 5, sigY + 29);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(...C.grey);

    const _signerLabel = _approvedByRole === 'accounts_head'
      ? 'Accounts Head'
      : 'Authorised Signatory';
    doc.text(_signerLabel, M + sigW / 2, sigY + 33, { align: 'center' });
    if (po.approved_by) {
      doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(...C.black);
      doc.text(po.approved_by, M + sigW / 2, sigY + 38, { align: 'center' });
    }
        _drawFooter(doc);
    doc.save((po.id || 'PO') + '.pdf');
  }

  return { generate };
})();

window.PDFGen = PDFGen;