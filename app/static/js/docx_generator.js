/**
 * docx_generator.js — Word (.docx) PO export via raw OOXML + ZIP
 * No external library needed — builds the ZIP in memory.
 * Exposes: window.DOCXGen
 */

const DOCXGen = (() => {

  const ORG = {
    name:   'CUTIS Hospital — Academy of Cutaneous Sciences',
    addr:   '5/1, 4th Main, MRCR Layout, Vijayanagar, Bengaluru-560040',
    gstin:  '29AAHFC6018K1Z8',
    email:  'care@cutis.org.in',
    web:    'www.cutis.org.in',
    tel:    '080-23401200',
    signer: 'COO / Dr. Manjula C.N',
  };

  /* ── OOXML helpers ── */
  function e(s) {
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function p(text, sz, bold, color, afterPts) {
    return `<w:p><w:pPr><w:spacing w:after="${afterPts || 80}"/></w:pPr>
      <w:r><w:rPr>
        ${bold ? '<w:b/>' : ''}
        <w:sz w:val="${sz || 20}"/>
        <w:color w:val="${color || '18180F'}"/>
      </w:rPr><w:t xml:space="preserve">${text}</w:t></w:r></w:p>`;
  }

  function tc(text, widthDXA, rpr, alignRight) {
    return `<w:tc>
      <w:tcPr>
        <w:tcW w:w="${widthDXA}" w:type="dxa"/>
        <w:tcMar>
          <w:top w:w="50" w:type="dxa"/><w:bottom w:w="50" w:type="dxa"/>
          <w:left w:w="80" w:type="dxa"/><w:right w:w="80" w:type="dxa"/>
        </w:tcMar>
      </w:tcPr>
      <w:p>
        <w:pPr>${alignRight ? '<w:jc w:val="right"/>' : ''}</w:pPr>
        <w:r>${rpr ? `<w:rPr>${rpr}</w:rPr>` : ''}<w:t xml:space="preserve">${e(text)}</w:t></w:r>
      </w:p>
    </w:tc>`;
  }

  const HDR_RPR = '<w:b/><w:color w:val="FFFFFF"/><w:sz w:val="14"/>';
  const BORDERS = `<w:tblBorders>
    <w:top    w:val="single" w:sz="4" w:color="CCCCCC"/>
    <w:left   w:val="single" w:sz="4" w:color="CCCCCC"/>
    <w:bottom w:val="single" w:sz="4" w:color="CCCCCC"/>
    <w:right  w:val="single" w:sz="4" w:color="CCCCCC"/>
    <w:insideH w:val="single" w:sz="4" w:color="CCCCCC"/>
    <w:insideV w:val="single" w:sz="4" w:color="CCCCCC"/>
  </w:tblBorders>`;
  const NO_BORDERS = `<w:tblBorders>
    <w:top w:val="none"/><w:left w:val="none"/>
    <w:bottom w:val="none"/><w:right w:val="none"/>
    <w:insideH w:val="none"/><w:insideV w:val="none"/>
  </w:tblBorders>`;

  function totRow(label, value, bold) {
    const rp = bold ? '<w:b/><w:sz w:val="22"/>' : '<w:sz w:val="20"/>';
    const color = bold ? '18180F' : '5C5B52';
    return `<w:tr>
      <w:tc><w:tcPr><w:tcW w:w="7200" w:type="dxa"/>
        <w:tcBorders><w:top w:val="none"/><w:left w:val="none"/>
          <w:bottom w:val="none"/><w:right w:val="none"/></w:tcBorders>
      </w:tcPr>
      <w:p><w:pPr><w:jc w:val="right"/></w:pPr>
        <w:r><w:rPr>${rp}<w:color w:val="5C5B52"/></w:rPr>
          <w:t>${e(label)}</w:t></w:r></w:p></w:tc>
      <w:tc><w:tcPr><w:tcW w:w="2800" w:type="dxa"/>
        <w:tcBorders><w:top w:val="none"/><w:left w:val="none"/>
          <w:bottom w:val="none"/><w:right w:val="none"/></w:tcBorders>
      </w:tcPr>
      <w:p><w:pPr><w:jc w:val="right"/></w:pPr>
        <w:r><w:rPr>${rp}<w:color w:val="${color}"/></w:rPr>
          <w:t>${e(value)}</w:t></w:r></w:p></w:tc>
    </w:tr>`;
  }

  /* ── Main generate function ── */
  function generate(po) {
    const fmt = Utils.fmt;

    const itemRows = (po.line_items || []).map((li, i) => {
      const b  = (li.qty || 1) * (li.unit_price || 0) * (1 - (li.discount_pct || 0) / 100);
      const ga = b * (li.gst_pct || 18) / 100;
      return `<w:tr>
        ${tc(String(i + 1),              '360')}
        ${tc(e(li.item_name   || '—'),  '1600')}
        ${tc(e(li.description || '—'),  '1800')}
        ${tc(e(li.hsn_code    || '—'),   '700')}
        ${tc(String(li.qty    || 1),     '400', '', true)}
        ${tc('Rs. ' + fmt(li.unit_price || 0), '1000', '', true)}
        ${tc((li.discount_pct || 0) + '%',  '450', '', true)}
        ${tc((li.gst_pct || 18) + '%',       '450', '', true)}
        ${tc('Rs. ' + fmt(li.cgst != null ? li.cgst : ga / 2), '850', '', true)}
        ${tc('Rs. ' + fmt(li.sgst != null ? li.sgst : ga / 2), '850', '', true)}
        ${tc('Rs. ' + fmt(li.line_total || b + ga), '1040', '', true)}
      </w:tr>`;
    }).join('');

    const xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:body>

<w:p><w:pPr><w:spacing w:after="0"/></w:pPr>
  <w:r><w:rPr><w:b/><w:sz w:val="32"/></w:rPr>
    <w:t xml:space="preserve">PURCHASE ORDER   </w:t></w:r>
  <w:r><w:rPr><w:sz w:val="22"/><w:color w:val="5C5B52"/></w:rPr>
    <w:t>${e(po.id || 'PO-DRAFT')} | ${e(po.status || 'Draft')}</w:t></w:r>
</w:p>

<w:p><w:pPr>
  <w:pBdr><w:bottom w:val="single" w:sz="8" w:space="1" w:color="18180F"/></w:pBdr>
  <w:spacing w:after="120"/>
</w:pPr></w:p>

${p(e(ORG.name), '22', true, '18180F', '40')}
${p(e(ORG.addr) + ' | GSTIN: ' + ORG.gstin, '16', false, '9B9A90', '80')}

${p('Vendor: ' + e(po.vendor_name || '—') +
    (po.vendor_gst ? ' | GSTIN: ' + e(po.vendor_gst) : '') +
    (po.vendor_addr ? ' | ' + e(po.vendor_addr) : ''), '18', false, '18180F', '60')}

${p('Date: ' + e(po.po_date || '—') +
    '  |  Dept: '         + e(po.department    || '—') +
    '  |  Delivery: '     + e(po.delivery_date || '—') +
    '  |  Payment: '      + e(po.payment_terms || '—'), '16', false, '9B9A90', '60')}

${p('Req. by: ' + e(po.requested_by || '—') +
    '  |  Created by: '   + e(po.created_by    || '—') +
    '  |  Approved by: '  + e(po.approved_by   || 'Pending'), '16', false, '9B9A90', '140')}

<w:p><w:pPr>
  <w:pBdr><w:bottom w:val="single" w:sz="4" w:space="1" w:color="DEDAD0"/></w:pBdr>
  <w:spacing w:after="120"/>
</w:pPr></w:p>

<w:tbl>
  <w:tblPr>
    <w:tblW w:w="10500" w:type="dxa"/>
    ${BORDERS}
  </w:tblPr>
  <w:tr>
    ${tc('#',           '360',  HDR_RPR)}
    ${tc('Item Name',   '1600', HDR_RPR)}
    ${tc('Description', '1800', HDR_RPR)}
    ${tc('HSN',         '700',  HDR_RPR)}
    ${tc('Qty',         '400',  HDR_RPR)}
    ${tc('Unit Price',  '1000', HDR_RPR)}
    ${tc('Disc%',       '450',  HDR_RPR)}
    ${tc('GST%',        '450',  HDR_RPR)}
    ${tc('CGST',        '850',  HDR_RPR)}
    ${tc('SGST',        '850',  HDR_RPR)}
    ${tc('Total',       '1040', HDR_RPR)}
  </w:tr>
  ${itemRows}
</w:tbl>

<w:tbl>
  <w:tblPr>
    <w:tblW w:w="10500" w:type="dxa"/>
    ${NO_BORDERS}
  </w:tblPr>
  ${totRow('Subtotal',                             'Rs. ' + fmt(po.subtotal   || 0), false)}
  ${totRow('Discount',                             '− Rs. ' + fmt(po.discount || 0), false)}
  ${totRow('GST (CGST + SGST)',                    'Rs. ' + fmt(po.gst_total  || 0), false)}
  ${totRow('Advance (' + fmt(po.advance_pct || 0) + '%)', 'Rs. ' + fmt(po.advance_amt || 0), false)}
  ${totRow('Grand Total',                          'Rs. ' + fmt(po.grand_total|| 0), true)}
</w:tbl>

${po.notes ? p(e(po.notes), '17', false, '18180F', '80') : ''}

<w:p><w:pPr>
  <w:pBdr><w:bottom w:val="single" w:sz="4" w:space="1" w:color="DEDAD0"/></w:pBdr>
  <w:spacing w:before="280" w:after="100"/>
</w:pPr></w:p>

${p('Authorised Signatory: _______________________________     Date: _______________', '18', false, '18180F', '80')}
${p(e(ORG.signer) + ' | ' + e(ORG.name), '15', false, '9B9A90', '40')}
${p(e(ORG.email) + ' | ' + e(ORG.web) + ' | Tel: ' + e(ORG.tel), '14', false, '9B9A90', '0')}

<w:sectPr>
  <w:pgSz w:w="12240" w:h="15840"/>
  <w:pgMar w:top="900" w:right="900" w:bottom="900" w:left="900"/>
</w:sectPr>
</w:body>
</w:document>`;

    const files = {
      '[Content_Types].xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml"  ContentType="application/xml"/>
  <Override PartName="/word/document.xml"
    ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`,
      '_rels/.rels': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1"
    Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument"
    Target="word/document.xml"/>
</Relationships>`,
      'word/_rels/document.xml.rels': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>`,
      'word/document.xml': xml,
    };

    _buildZip(files, (po.id || 'PO') + '.docx');
    Utils.toastSuccess('Word file saved: ' + (po.id || 'PO') + '.docx');
  }

  /* ── Minimal ZIP builder (stored, no compression) ── */
  function _buildZip(files, filename) {
    const enc = new TextEncoder();
    const u16 = n => { const b = new Uint8Array(2); new DataView(b.buffer).setUint16(0, n >>> 0, true); return b; };
    const u32 = n => { const b = new Uint8Array(4); new DataView(b.buffer).setUint32(0, n >>> 0, true); return b; };
    const cat = (...a) => {
      const t = a.reduce((s, x) => s + x.length, 0);
      const o = new Uint8Array(t);
      let i = 0;
      a.forEach(x => { o.set(x, i); i += x.length; });
      return o;
    };
    const crc32 = data => {
      let c = 0xFFFFFFFF;
      for (let i = 0; i < data.length; i++) {
        c ^= data[i];
        for (let j = 0; j < 8; j++) c = (c & 1) ? (c >>> 1) ^ 0xEDB88320 : (c >>> 1);
      }
      return (c ^ 0xFFFFFFFF) >>> 0;
    };

    const entries = [];
    let offset = 0;
    for (const [name, content] of Object.entries(files)) {
      const nb  = enc.encode(name);
      const db  = enc.encode(content);
      const crc = crc32(db);
      const lh  = cat(
        new Uint8Array([0x50, 0x4B, 0x03, 0x04]),
        u16(20), u16(0), u16(0), u16(0), u16(0),
        u32(crc), u32(db.length), u32(db.length),
        u16(nb.length), u16(0),
        nb
      );
      entries.push({ nb, db, crc, offset, lh });
      offset += lh.length + db.length;
    }

    const cd = cat(...entries.map(en => cat(
      new Uint8Array([0x50, 0x4B, 0x01, 0x02]),
      u16(20), u16(20), u16(0), u16(0), u16(0), u16(0),
      u32(en.crc), u32(en.db.length), u32(en.db.length),
      u16(en.nb.length), u16(0), u16(0), u16(0), u16(0),
      u32(0), u32(en.offset),
      en.nb
    )));

    const eocd = cat(
      new Uint8Array([0x50, 0x4B, 0x05, 0x06]),
      u16(0), u16(0),
      u16(entries.length), u16(entries.length),
      u32(cd.length), u32(offset),
      u16(0)
    );

    const blob = new Blob(
      [cat(...entries.flatMap(en => [en.lh, en.db]), cd, eocd)],
      { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }
    );
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return { generate };
})();

window.DOCXGen = DOCXGen;
