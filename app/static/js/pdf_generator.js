/**
 * pdf_generator.js — jsPDF-based PO PDF export (redesigned)
 * Depends on: jsPDF + jsPDF-autotable CDN scripts, utils.js
 * Exposes: window.PDFGen
 */

const PDFGen = (() => {

  const ORG = {
    name:   'CUTIS Hospital — Academy of Cutaneous Sciences',
    addr:   '5/1, 4th Main, MRCR Layout, Vijayanagar, Bengaluru-560040',
    gstin:  '29AAHFC6018K1Z8',
    email:  'care@cutis.org.in',
    web:    'www.cutis.org.in',
    tel:    '080-23401200',
    signer: 'COO',
  };

  // Colours
  const C = {
    blue:     [26,  86, 219],   // #1a56db
    darkBlue: [21,  67, 172],
    black:    [17,  24,  39],
    grey:     [107,114, 128],
    lightGrey:[209,213, 219],
    bgLight:  [238,242, 255],   // #EEF2FF
    bgRow:    [249,250, 251],
    white:    [255,255, 255],
  };

  function _lh(doc, text, maxW, size) {
    const lines = doc.splitTextToSize(String(text || ''), maxW);
    return lines.length * (size * 0.352778 + 1.2);   // approx mm per line
  }

  function generate(po) {
    if (!window.jspdf) {
      Utils.toast('PDF library not loaded. Check internet connection.');
      return;
    }
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const M  = 14;
    const PW = 210;
    const CW = PW - M * 2;   // 182 mm
    let y = M;

    const intra = (po.vendor_gst || '').toUpperCase().startsWith('29');

    /* ══════════════════════════════════════════════════════════
       1. HEADER BAR — blue background, PO title + PO number
    ══════════════════════════════════════════════════════════ */
    doc.setFillColor(...C.blue);
    doc.roundedRect(M, y, CW, 16, 2, 2, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(...C.white);
    const orderLabel = (po.order_type || 'Purchase Order').toUpperCase();
    doc.text(orderLabel, M + 5, y + 10.5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(po.id || 'PO-DRAFT', PW - M - 3, y + 6.5,  { align: 'right' });
    doc.text('Status: ' + (po.status || 'Draft'), PW - M - 3, y + 12, { align: 'right' });
    y += 22;

    /* ══════════════════════════════════════════════════════════
       2. BUYER | VENDOR  two-column block
    ══════════════════════════════════════════════════════════ */
    const colL  = M;
    const colR  = M + CW * 0.52;
    const colLW = CW * 0.48;
    const colRW = CW * 0.46;
    let yL = y, yR = y;

    // — Buyer (left) —
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...C.black);
    const orgLines = doc.splitTextToSize(ORG.name, colLW);
    doc.text(orgLines, colL, yL);
    yL += orgLines.length * 5 + 1.5;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...C.grey);
    const addrLine = ORG.addr;
    const addrLines = doc.splitTextToSize(addrLine, colLW);
    doc.text(addrLines, colL, yL);
    yL += addrLines.length * 4 + 1;
    doc.text('GSTIN: ' + ORG.gstin, colL, yL);  yL += 4;
    doc.text('Tel: ' + ORG.tel + '  |  ' + ORG.email, colL, yL); yL += 4;

    // — Vendor (right) —
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(...C.grey);
    doc.text('VENDOR', colR, yR);
    yR += 5;

    const vname = po.vendor_name || '—';
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...C.black);
    const vnLines = doc.splitTextToSize(vname, colRW);
    doc.text(vnLines, colR, yR);
    yR += vnLines.length * 5 + 1.5;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...C.grey);
    if (po.vendor_addr) {
      const vaLines = doc.splitTextToSize(po.vendor_addr, colRW);
      doc.text(vaLines, colR, yR);
      yR += vaLines.length * 4 + 1;
    }
    if (po.vendor_gst) {
      doc.text('GSTIN: ' + po.vendor_gst, colR, yR); yR += 4;
    }
    if (po.vendor_bank) {
      const vbLines = doc.splitTextToSize('Bank: ' + po.vendor_bank, colRW);
      doc.text(vbLines, colR, yR);
      yR += vbLines.length * 4 + 1;
    }

    y = Math.max(yL, yR) + 4;

    /* ══════════════════════════════════════════════════════════
       3. SUPPLIER CODE / PO META row  (blue-labelled grid)
    ══════════════════════════════════════════════════════════ */
    doc.setDrawColor(...C.lightGrey);
    doc.setLineWidth(0.3);
    doc.line(M, y, PW - M, y);
    y += 5;

    const metaFields = [
      ['Supplier Code', po.vendor_id    || '—'],
      ['PO Date',       po.po_date      || '—'],
      ['PO Number',     po.id           || '—'],
      ['Department',    po.department   || '—'],
      ['Payment Terms', po.payment_terms|| '—'],
      ['Approved By',   po.approved_by  || 'Pending'],
    ];
    if (po.delivery_date) {
      metaFields.splice(3, 0, ['Delivery Date', po.delivery_date]);
    }

    const mCols   = Math.min(metaFields.length, 6);
    const mW      = CW / mCols;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(...C.grey);
    metaFields.slice(0, mCols).forEach((f, i) => doc.text(f[0], M + i * mW, y));
    y += 4.5;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(...C.black);
    let metaH = 0;
    metaFields.slice(0, mCols).forEach((f, i) => {
      const lines = doc.splitTextToSize(String(f[1]), mW - 2);
      doc.text(lines, M + i * mW, y);
      metaH = Math.max(metaH, lines.length * 4.5);
    });
    y += metaH + 5;

    doc.setDrawColor(...C.lightGrey);
    doc.line(M, y, PW - M, y);
    y += 5;

    /* ══════════════════════════════════════════════════════════
       4. BILL TO / SHIP TO  (blue header cells)
    ══════════════════════════════════════════════════════════ */
    const halfW = CW / 2;
    const bAddr = ORG.name + '\n' + ORG.addr + '\nGSTIN: ' + ORG.gstin +
                  '\nContact: ' + ORG.tel + '\nEmail: ' + ORG.email;

    // Draw blue header cells
    doc.setFillColor(...C.blue);
    doc.rect(M,             y, halfW - 0.5, 7, 'F');
    doc.rect(M + halfW + 0.5, y, halfW - 0.5, 7, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...C.white);
    doc.text('Bill To:', M + 3, y + 4.8);
    doc.text('Ship To:', M + halfW + 3.5, y + 4.8);
    y += 9;

    // Body rows
    const addrBlockLines = bAddr.split('\n');
    const addrBlockH = addrBlockLines.length * 4 + 4;

    doc.setFillColor(...C.bgLight);
    doc.rect(M,             y, halfW - 0.5, addrBlockH, 'F');
    doc.rect(M + halfW + 0.5, y, halfW - 0.5, addrBlockH, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(...C.black);
    doc.text(ORG.name, M + 3, y + 4.5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...C.grey);
    let ay = y + 8.5;
    [ORG.addr, 'GSTIN: ' + ORG.gstin, 'Contact: ' + ORG.tel, 'Email: ' + ORG.email].forEach(line => {
      const ls = doc.splitTextToSize(line, halfW - 7);
      doc.text(ls, M + 3, ay);
      ay += ls.length * 3.8;
    });

    // Ship to (same address for hospital)
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(...C.black);
    doc.text(ORG.name, M + halfW + 3.5, y + 4.5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...C.grey);
    ay = y + 8.5;
    [ORG.addr, 'GSTIN: ' + ORG.gstin, 'Contact: ' + ORG.tel, 'Email: ' + ORG.email].forEach(line => {
      const ls = doc.splitTextToSize(line, halfW - 7);
      doc.text(ls, M + halfW + 3.5, ay);
      ay += ls.length * 3.8;
    });

    // Border around both cells
    doc.setDrawColor(...C.lightGrey);
    doc.setLineWidth(0.3);
    doc.rect(M,             y - 9, halfW - 0.5, addrBlockH + 9, 'S');
    doc.rect(M + halfW + 0.5, y - 9, halfW - 0.5, addrBlockH + 9, 'S');

    y += addrBlockH + 5;

    /* ══════════════════════════════════════════════════════════
       5. LINE ITEMS TABLE
    ══════════════════════════════════════════════════════════ */
    const heads = [[
      '#', 'Code', 'Product Name', 'HSN Code',
      'Qty', 'Unit', 'Rate', 'Tax',
      intra ? 'CGST' : '',
      intra ? 'SGST' : '',
      'Total',
    ].filter((h, i) => !(h === '' && !intra) && (intra || (i !== 8 && i !== 9)))];

    const rows = (po.line_items || []).map((li, idx) => {
      const qty    = parseFloat(li.qty        || 1);
      const price  = parseFloat(li.unit_price || 0);
      const disc   = parseFloat(li.discount_pct || 0);
      const gstPct = parseFloat(li.gst_pct    || 18);
      const base   = qty * price * (1 - disc / 100);
      const cgst   = li.cgst  != null ? parseFloat(li.cgst)  : base * gstPct / 200;
      const sgst   = li.sgst  != null ? parseFloat(li.sgst)  : base * gstPct / 200;
      const igst   = li.igst  != null ? parseFloat(li.igst)  : base * gstPct / 100;
      const total  = li.line_total != null ? parseFloat(li.line_total) : base + (intra ? cgst + sgst : igst);

      const row = [
        idx + 1,
        li.id || '',
        li.item_name   || '—',
        li.hsn_code    || '—',
        qty % 1 === 0 ? qty : qty.toFixed(2),
        'nos',
        price.toFixed(2),
        gstPct + '%',
      ];
      if (intra) {
        row.push(cgst.toFixed(2), sgst.toFixed(2));
      }
      row.push(total.toFixed(2));
      return row;
    });

    // Column widths
    const cws = intra
      ? [10, 16, 38, 22, 18, 12, 18, 10, 16, 16, 16]   // sum = 192 → tableWidth clips to 182
      : [10, 16, 52, 24, 18, 12, 24, 12,             24];

    const colStyles = {};
    cws.forEach((w, i) => {
      colStyles[i] = { cellWidth: w, halign: [0,1,2,3].includes(i) ? 'center' : 'right' };
    });
    colStyles[2] = { cellWidth: cws[2], halign: 'left' };  // item name left-aligned

    doc.autoTable({
      head: heads,
      body: rows,
      startY: y,
      margin: { left: M, right: M },
      tableWidth: CW,
      styles: {
        fontSize: 8,
        cellPadding: 3,
        textColor: C.black,
        overflow: 'linebreak',
        valign: 'middle',
      },
      headStyles: {
        fillColor: C.blue,
        textColor: C.white,
        fontStyle: 'bold',
        fontSize: 7.5,
        halign: 'center',
      },
      alternateRowStyles: { fillColor: C.bgRow },
      columnStyles: colStyles,
    });
    y = doc.lastAutoTable.finalY + 6;

    /* ══════════════════════════════════════════════════════════
       6. TOTALS BOX  (right-aligned)
    ══════════════════════════════════════════════════════════ */
    const boxW  = 80;
    const boxX  = PW - M - boxW;
    const lineH = 6;

    const totalsRows = [
      ['Total',    po.subtotal  || 0],
      ['Discounts', -(po.discount || 0)],
      [intra ? 'GST (CGST + SGST)' : 'GST (IGST)', po.gst_total || 0],
    ];
    if (po.order_type === 'Work Order' && parseFloat(po.tds_amt || 0) > 0) {
      totalsRows.push([`TDS (${po.tds_pct || 0}%)`, -(po.tds_amt || 0)]);
    }

    const boxH = totalsRows.length * lineH + 3;
    doc.setFillColor(...C.bgLight);
    doc.roundedRect(boxX - 4, y - 2, boxW + 8, boxH, 1.5, 1.5, 'F');
    doc.setDrawColor(...C.lightGrey);
    doc.setLineWidth(0.3);
    doc.roundedRect(boxX - 4, y - 2, boxW + 8, boxH, 1.5, 1.5, 'S');

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    totalsRows.forEach(([label, val]) => {
      doc.setTextColor(...C.grey);
      doc.text(label, boxX, y + 3.5);
      doc.setTextColor(...C.black);
      const v = parseFloat(val);
      doc.text((v < 0 ? '-' : '') + 'Rs.' + Math.abs(v).toLocaleString('en-IN', { minimumFractionDigits: 1, maximumFractionDigits: 1 }), PW - M - 2, y + 3.5, { align: 'right' });
      y += lineH;
    });

    // Divider + Grand Total
    y += 2;
    doc.setDrawColor(...C.blue);
    doc.setLineWidth(0.5);
    doc.line(boxX - 4, y, PW - M + 4, y);
    y += 5;

    doc.setFillColor(...C.bgLight);
    doc.roundedRect(boxX - 4, y - 3, boxW + 8, 10, 1.5, 1.5, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(...C.black);
    doc.text('Grand Total', boxX, y + 4);
    doc.setTextColor(...C.blue);
    const gt = parseFloat(po.grand_total || 0);
    doc.text('Rs.' + gt.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }), PW - M - 2, y + 4, { align: 'right' });
    y += 14;

    /* ══════════════════════════════════════════════════════════
       7. NOTES + TERMS & CONDITIONS
    ══════════════════════════════════════════════════════════ */
    const hasNotes = po.notes && po.notes.trim();
    if (hasNotes) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(...C.grey);
      doc.text('NOTES / TERMS & CONDITIONS', M, y);
      y += 5;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(...C.black);
      const noteLines = doc.splitTextToSize(po.notes, CW);
      doc.text(noteLines, M, y, { align: 'left' });
      y += noteLines.length * 4.2 + 4;
    }

    /* ══════════════════════════════════════════════════════════
       8. SIGNATURE BOX  (right side, blue header)
    ══════════════════════════════════════════════════════════ */
    const sigX = M;
    const sigW = 75;
    const sigY = y;

    // Blue header
    doc.setFillColor(...C.blue);
    doc.roundedRect(sigX, sigY, sigW, 8, 1.5, 1.5, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(...C.white);
    doc.text('For ' + ORG.name.split('—')[0].trim(), sigX + sigW / 2, sigY + 5.5, { align: 'center' });

    // Signature area
    doc.setDrawColor(...C.lightGrey);
    doc.setLineWidth(0.3);
    doc.rect(sigX, sigY + 8, sigW, 22, 'S');
    doc.setDrawColor(...C.lightGrey);
    doc.line(sigX + 5, sigY + 23, sigX + sigW - 5, sigY + 23);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...C.grey);
    doc.text('Authorised Signatory', sigX + sigW / 2, sigY + 27, { align: 'center' });
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(...C.black);
    doc.text(ORG.signer, sigX + sigW / 2, sigY + 22, { align: 'center' });

    /* ══════════════════════════════════════════════════════════
       9. FOOTER
    ══════════════════════════════════════════════════════════ */
    const footY = 287;
    doc.setDrawColor(...C.lightGrey);
    doc.setLineWidth(0.25);
    doc.line(M, footY - 3, PW - M, footY - 3);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...C.grey);
    doc.text(ORG.name + '  |  ' + ORG.email + '  |  ' + ORG.web + '  |  Tel: ' + ORG.tel, PW / 2, footY, { align: 'center' });
    doc.text('Computer-generated document. Valid only with authorised signature.', PW / 2, footY + 4, { align: 'center' });

    doc.save((po.id || 'PO') + '.pdf');
    Utils.toastSuccess('PDF saved: ' + (po.id || 'PO') + '.pdf');
  }

  return { generate };
})();

window.PDFGen = PDFGen;