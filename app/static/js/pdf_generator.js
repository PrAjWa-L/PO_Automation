/**
 * pdf_generator.js — jsPDF-based PO PDF export
 * Depends on: jsPDF + jsPDF-autotable CDN scripts, utils.js
 * Exposes: window.PDFGen
 */

const PDFGen = (() => {

  const ORG = {
    name:  'CUTIS Hospital — Academy of Cutaneous Sciences',
    addr:  '5/1, 4th Main, MRCR Layout, Vijayanagar, Bengaluru-560040',
    gstin: '29AAHFC6018K1Z8',
    email: 'care@cutis.org.in',
    web:   'www.cutis.org.in',
    tel:   '080-23401200',
    signer:'COO',
  };

  /* Helper — returns how many mm a wrapped text block will take */
  function _textHeight(doc, text, maxWidth, lineHeight) {
    const lines = doc.splitTextToSize(text, maxWidth);
    return lines.length * lineHeight;
  }

  function generate(po) {
    if (!window.jspdf) {
      Utils.toast('PDF library not loaded. Check internet connection.');
      return;
    }
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const M   = 14;        // margin
    const W   = 210;       // page width
    const cw  = W - M * 2; // content width = 182mm
    let y     = M;

    /* ── Header bar ── */
    doc.setFillColor(24, 24, 15);
    doc.rect(M, y, cw, 14, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(255, 255, 255);
    doc.text('PURCHASE ORDER', M + 4, y + 9);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(po.id || 'PO-DRAFT', W - M - 3, y + 6,  { align: 'right' });
    doc.text('Status: ' + (po.status || 'Draft'), W - M - 3, y + 11, { align: 'right' });
    y += 18;

    /* ── Two-column info block: Buyer (left) | Vendor (right) ── */
    const colL  = M;
    const colR  = M + 96;
    const colLW = 88;
    const colRW = cw - 96;
    let   yL    = y;
    let   yR    = y;

    // Left — Buyer
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(24, 24, 15);
    doc.text(ORG.name, colL, yL, { maxWidth: colLW });
    yL += _textHeight(doc, ORG.name, colLW, 5) + 1;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 90);
    const buyerAddr = ORG.addr + '  |  GSTIN: ' + ORG.gstin;
    doc.text(buyerAddr, colL, yL, { maxWidth: colLW });
    yL += _textHeight(doc, buyerAddr, colLW, 4) + 1;

    // Right — Vendor label
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(155, 154, 144);
    doc.text('VENDOR', colR, yR);
    yR += 5;

    // Vendor name
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(24, 24, 15);
    const vname = po.vendor_name || '—';
    doc.text(vname, colR, yR, { maxWidth: colRW });
    yR += _textHeight(doc, vname, colRW, 5) + 1;

    // Vendor address
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 90);
    if (po.vendor_addr) {
      doc.text(po.vendor_addr, colR, yR, { maxWidth: colRW });
      yR += _textHeight(doc, po.vendor_addr, colRW, 4) + 1;
    }
    if (po.vendor_gst) {
      doc.text('GSTIN: ' + po.vendor_gst, colR, yR, { maxWidth: colRW });
      yR += 4.5;
    }
    if (po.vendor_bank) {
      doc.text('Bank: ' + po.vendor_bank, colR, yR, { maxWidth: colRW });
      yR += _textHeight(doc, 'Bank: ' + po.vendor_bank, colRW, 4) + 1;
    }

    // Advance y past whichever column is taller, with breathing room
    y = Math.max(yL, yR) + 5;

    /* ── Divider ── */
    doc.setDrawColor(210, 208, 200);
    doc.setLineWidth(0.3);
    doc.line(M, y, W - M, y);
    y += 5;

    /* ── Meta strip ── */
    const meta = [
      ['Date',        po.po_date        || '—'],
      ['Department',  po.department     || '—'],
      ['Delivery',    po.delivery_date  || '—'],
      ['Payment Terms', po.payment_terms || '—'],
      ['Approved By', po.approved_by    || 'Pending'],
    ];
    const mw = cw / meta.length;

    // Labels row
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(155, 154, 144);
    meta.forEach((f, i) => doc.text(f[0], M + i * mw, y));
    y += 4.5;

    // Values row — use splitTextToSize so long values wrap within their column
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(24, 24, 15);
    let metaRowH = 0;
    meta.forEach((f, i) => {
      const lines = doc.splitTextToSize(String(f[1]), mw - 2);
      doc.text(lines, M + i * mw, y);
      metaRowH = Math.max(metaRowH, lines.length * 4.5);
    });
    y += metaRowH + 4;

    doc.setDrawColor(210, 208, 200);
    doc.line(M, y, W - M, y);
    y += 4;

    /* ── Line items table ── */
    const intra = (po.vendor_gst || '').startsWith('29');

    const heads = [[
      '#', 'Item', 'Description', 'HSN', 'Qty',
      'Unit Price', 'Disc%', 'GST%',
      intra ? 'CGST' : 'IGST',
      intra ? 'SGST' : '',
      'Total',
    ].filter(h => !(h === '' && !intra))];

    const rows = (po.line_items || []).map((li, idx) => {
      const base  = (li.qty || 1) * (li.unit_price || 0);
      const disc  = base * ((li.discount_pct || 0) / 100);
      const after = base - disc;
      const gstA  = after * ((li.gst_pct || 18) / 100);
      const cgst  = li.cgst  != null ? +li.cgst  : gstA / 2;
      const sgst  = li.sgst  != null ? +li.sgst  : gstA / 2;
      const igst  = li.igst  != null ? +li.igst  : gstA;
      const total = li.line_total != null ? +li.line_total : after + gstA;

      const row = [
        idx + 1,
        li.item_name    || '—',
        li.description  || '—',
        li.hsn_code     || '—',
        li.qty          || 1,
        'Rs.' + Utils.fmt(li.unit_price || 0),
        (li.discount_pct || 0) + '%',
        (li.gst_pct      || 18) + '%',
        'Rs.' + Utils.fmt(intra ? cgst : igst),
      ];
      if (intra) row.push('Rs.' + Utils.fmt(sgst));
      row.push('Rs.' + Utils.fmt(total));
      return row;
    });

    // Column widths — must total exactly cw (182mm)
    const colStyles = intra ? {
      0:  { cellWidth: 7,  halign: 'center' },
      1:  { cellWidth: 26 },
      2:  { cellWidth: 28 },
      3:  { cellWidth: 14 },
      4:  { cellWidth: 9,  halign: 'center' },
      5:  { cellWidth: 22, halign: 'right' },
      6:  { cellWidth: 11, halign: 'center' },
      7:  { cellWidth: 11, halign: 'center' },
      8:  { cellWidth: 18, halign: 'right' },
      9:  { cellWidth: 18, halign: 'right' },
      10: { cellWidth: 18, halign: 'right' },
    } : {
      0:  { cellWidth: 7,  halign: 'center' },
      1:  { cellWidth: 30 },
      2:  { cellWidth: 32 },
      3:  { cellWidth: 16 },
      4:  { cellWidth: 10, halign: 'center' },
      5:  { cellWidth: 25, halign: 'right' },
      6:  { cellWidth: 13, halign: 'center' },
      7:  { cellWidth: 13, halign: 'center' },
      8:  { cellWidth: 22, halign: 'right' },
      9:  { cellWidth: 24, halign: 'right' },
    };

    doc.autoTable({
      head: heads,
      body: rows,
      startY: y,
      margin: { left: M, right: M },
      tableWidth: cw,
      styles:          { fontSize: 8, cellPadding: 3, textColor: [24, 24, 15], overflow: 'linebreak' },
      headStyles:      { fillColor: [24, 24, 15], textColor: 255, fontStyle: 'bold', fontSize: 7.5 },
      alternateRowStyles: { fillColor: [245, 244, 240] },
      columnStyles: colStyles,
    });
    y = doc.lastAutoTable.finalY + 6;

    /* ── Totals box ── */
    const boxW  = 72;
    const boxX  = W - M - boxW;
    const lineH = 5.5;

    // Background box
    doc.setFillColor(245, 244, 240);
    const totalsData = [
      ['Subtotal',                                      'Rs.' + Utils.fmt(po.subtotal  || 0)],
      ['Discount',                                      '-Rs.' + Utils.fmt(po.discount  || 0)],
      [intra ? 'GST (CGST + SGST)' : 'GST (IGST)',     'Rs.' + Utils.fmt(po.gst_total || 0)],
      ['Advance (' + (po.advance_pct || 0) + '%)',      'Rs.' + Utils.fmt(po.advance_amt || 0)],
    ];
    const boxH = totalsData.length * lineH + 12;
    doc.roundedRect(boxX - 4, y - 3, boxW + 8, boxH, 2, 2, 'F');

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(100, 100, 90);
    totalsData.forEach(([k, v]) => {
      doc.text(k,          boxX,          y);
      doc.text(v,          W - M - 2,     y, { align: 'right' });
      y += lineH;
    });

    // Separator line
    doc.setDrawColor(210, 208, 200);
    doc.setLineWidth(0.3);
    doc.line(boxX - 4, y, W - M + 4, y);
    y += 4;

    // Grand total
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(24, 24, 15);
    doc.text('Grand Total', boxX, y);
    doc.text('Rs.' + Utils.fmt(po.grand_total || 0), W - M - 2, y, { align: 'right' });
    y += 12;

    /* ── Notes ── */
    if (po.notes && po.notes.trim()) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(155, 154, 144);
      doc.text('NOTES / TERMS & CONDITIONS', M, y);
      y += 5;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(60, 60, 55);
      const noteLines = doc.splitTextToSize(po.notes, cw);
      doc.text(noteLines, M, y);
      y += noteLines.length * 4.5 + 6;
    }

    /* ── Signature ── */
    doc.setDrawColor(180, 178, 170);
    doc.setLineWidth(0.4);
    doc.line(M, y, M + 65, y);
    y += 5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 90);
    doc.text('Authorised Signatory', M, y);
    y += 4;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(24, 24, 15);
    doc.text(ORG.signer, M, y);

    /* ── Footer ── */
    const footerY = 287;
    doc.setDrawColor(210, 208, 200);
    doc.setLineWidth(0.25);
    doc.line(M, footerY - 3, W - M, footerY - 3);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(155, 154, 144);
    doc.text(
      ORG.name + '  |  ' + ORG.email + '  |  ' + ORG.web + '  |  Tel: ' + ORG.tel,
      M, footerY
    );
    doc.text(
      'Computer-generated document. Valid only with authorised signature.',
      W - M, footerY, { align: 'right' }
    );

    doc.save((po.id || 'PO') + '.pdf');
    Utils.toastSuccess('PDF saved: ' + (po.id || 'PO') + '.pdf');
  }

  return { generate };
})();

window.PDFGen = PDFGen;