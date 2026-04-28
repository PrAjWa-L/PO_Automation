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
    director1:   { name: 'Dr. B.S. Chandrashekar', qual: 'M.D., D.N.B.', title: 'Medical Director' },
    director2:   { name: 'Dr. Manjula C.N.',       qual: 'M.D. (OBG)',   title: 'Chief Executive Officer' },
    logoUrl:     '/static/img/cutis_logo.png',
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
    doc.text((po.order_type || 'Purchase Order').toUpperCase(), M, y + 5);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...C.grey);
    doc.text(po.id || 'PO-DRAFT',               PW - M, y + 2,  { align: 'right' });
    doc.text('Date: ' + (po.po_date || '—'),     PW - M, y + 7,  { align: 'right' });
    doc.text('Status: ' + (po.status || 'Draft'), PW - M, y + 12, { align: 'right' });
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
    doc.rect(M, sigY + 8, sigW, 22, 'S');
    doc.line(M + 5, sigY + 23, M + sigW - 5, sigY + 23);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(...C.grey);
    doc.text('Authorised Signatory', M + sigW / 2, sigY + 27, { align: 'center' });
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(...C.black);
    doc.text(_activeOrg.signer || 'COO', M + sigW / 2, sigY + 21, { align: 'center' });

    _drawFooter(doc);
    doc.save((po.id || 'PO') + '.pdf');
  }

  return { generate };
})();

window.PDFGen = PDFGen;