"""
Invoice Matching API
- Upload vendor invoice PDF
- Extract amount & GST using Ollama
- Match against linked PO
"""

import os, json, base64
import requests
from flask import Blueprint, request, current_app
from app import db
from app.models import Invoice, PurchaseOrder
from app.utils import ok, err, not_found, server_err
from app.auth import login_required

invoices_bp = Blueprint("invoices", __name__)

OLLAMA_URL   = "http://localhost:11434/api/generate"
OLLAMA_MODEL = "llama3.2:3b"
TOLERANCE    = 1.0   # ₹ tolerance for amount matching


# ─── LIST ALL INVOICES ────────────────────────────────────────
@invoices_bp.get("/")
@login_required
def list_invoices():
    invoices = Invoice.query.order_by(Invoice.created_at.desc()).all()
    return ok([i.to_dict() for i in invoices])


# ─── UPLOAD + EXTRACT + MATCH ─────────────────────────────────
@invoices_bp.post("/upload")
@login_required
def upload_invoice():
    po_id = request.form.get("po_id", "").strip()
    file  = request.files.get("file")

    if not file or not file.filename.lower().endswith(".pdf"):
        return err("Please upload a valid PDF file")

    if not po_id:
        return err("Please select a PO to match against")

    po = PurchaseOrder.query.get(po_id)
    if not po:
        return not_found("Purchase Order")

    # Save the file
    upload_folder = current_app.config.get("UPLOAD_FOLDER", "uploads")
    os.makedirs(upload_folder, exist_ok=True)
    safe_name = f"INV_{po_id}_{file.filename.replace(' ', '_')}"
    file_path = os.path.join(upload_folder, safe_name)
    file.save(file_path)

    # Extract text from PDF
    try:
        pdf_text = _extract_pdf_text(file_path)
    except Exception as e:
        return err(f"Could not read PDF: {e}")

    # Use Ollama to extract invoice fields
    try:
        extracted = _extract_with_ollama(pdf_text)
    except Exception as e:
        return err(f"AI extraction failed: {e}")

    # Match against PO
    match_status, match_notes = _match(extracted, po)

    # Save to DB
    try:
        invoice = Invoice(
            po_id           = po_id,
            invoice_number  = extracted.get("invoice_number", ""),
            vendor_name     = extracted.get("vendor_name", ""),
            invoice_date    = _parse_date(extracted.get("invoice_date")),
            invoice_amount  = extracted.get("taxable_amount", 0),
            invoice_gst     = extracted.get("gst_amount", 0),
            invoice_total   = extracted.get("total_amount", 0),
            match_status    = match_status,
            match_notes     = match_notes,
            file_path       = file_path,
            file_name       = file.filename,
        )
        db.session.add(invoice)
        db.session.commit()
        return ok(invoice.to_dict(), "Invoice uploaded and matched successfully")
    except Exception as e:
        db.session.rollback()
        return server_err(e)


# ─── GET SINGLE INVOICE ───────────────────────────────────────
@invoices_bp.get("/<int:iid>")
@login_required
def get_invoice(iid):
    invoice = Invoice.query.get(iid)
    if not invoice:
        return not_found("Invoice")
    return ok(invoice.to_dict())


# ─── DELETE INVOICE ───────────────────────────────────────────
@invoices_bp.delete("/<int:iid>")
@login_required
def delete_invoice(iid):
    invoice = Invoice.query.get(iid)
    if not invoice:
        return not_found("Invoice")
    db.session.delete(invoice)
    db.session.commit()
    return ok({}, "Invoice deleted")


# ─── HELPERS ──────────────────────────────────────────────────

def _extract_pdf_text(file_path):
    """Extract plain text from a PDF using pypdf."""
    try:
        from pypdf import PdfReader
    except ImportError:
        from PyPDF2 import PdfReader
    reader = PdfReader(file_path)
    text = ""
    for page in reader.pages:
        text += page.extract_text() or ""
    return text.strip()


def _extract_with_ollama(pdf_text):
    """Use Ollama to extract invoice fields from PDF text. Returns a dict."""
    prompt = f"""You are an invoice data extraction assistant.
Extract the following fields from the invoice text below and return ONLY a valid JSON object.
Do not include any explanation or markdown — just the raw JSON.

Fields to extract:
- invoice_number (string)
- vendor_name (string)
- invoice_date (string, format YYYY-MM-DD if possible)
- taxable_amount (number, amount before GST)
- gst_amount (number, total GST amount)
- total_amount (number, final invoice total including GST)

If a field is not found, use null.

Invoice text:
{pdf_text[:3000]}

Return only JSON:"""

    response = requests.post(
        OLLAMA_URL,
        json={"model": OLLAMA_MODEL, "prompt": prompt, "stream": False},
        timeout=120,
    )
    response.raise_for_status()
    raw = response.json().get("response", "{}")

    # Strip any markdown fences
    raw = raw.strip().strip("```json").strip("```").strip()
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        # Try to extract JSON from the response
        import re
        match = re.search(r'\{.*\}', raw, re.DOTALL)
        if match:
            return json.loads(match.group())
        return {}


def _match(extracted, po):
    """Compare extracted invoice fields against PO and return (status, notes)."""
    notes = []
    has_mismatch = False

    po_total = float(po.grand_total or 0)
    po_gst   = float(po.gst_total or 0)
    inv_total = float(extracted.get("total_amount") or 0)
    inv_gst   = float(extracted.get("gst_amount") or 0)

    # Match total amount
    if inv_total == 0:
        notes.append("⚠ Could not extract total amount from invoice.")
        has_mismatch = True
    elif abs(inv_total - po_total) <= TOLERANCE:
        notes.append(f"✓ Total amount matches — Invoice ₹{inv_total:,.2f} vs PO ₹{po_total:,.2f}")
    else:
        diff = inv_total - po_total
        notes.append(f"✗ Total amount mismatch — Invoice ₹{inv_total:,.2f} vs PO ₹{po_total:,.2f} (Δ ₹{diff:+,.2f})")
        has_mismatch = True

    # Match GST amount
    if inv_gst == 0:
        notes.append("⚠ Could not extract GST amount from invoice.")
    elif abs(inv_gst - po_gst) <= TOLERANCE:
        notes.append(f"✓ GST amount matches — Invoice ₹{inv_gst:,.2f} vs PO ₹{po_gst:,.2f}")
    else:
        diff = inv_gst - po_gst
        notes.append(f"✗ GST amount mismatch — Invoice ₹{inv_gst:,.2f} vs PO ₹{po_gst:,.2f} (Δ ₹{diff:+,.2f})")
        has_mismatch = True

    status = "Mismatch" if has_mismatch else "Matched"
    return status, "\n".join(notes)


def _parse_date(date_str):
    if not date_str:
        return None
    from datetime import date as dt
    for fmt in ("%Y-%m-%d", "%d-%m-%Y", "%d/%m/%Y", "%d %b %Y", "%d %B %Y"):
        try:
            from datetime import datetime
            return datetime.strptime(date_str, fmt).date()
        except Exception:
            continue
    return None