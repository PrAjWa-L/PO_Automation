"""
app/routes/drive.py
────────────────────
Receives approved PO PDFs from the frontend and emails them
to the PO archive mailbox (PO_ARCHIVE_EMAIL in .env).
"""

import base64

from flask import Blueprint, request
from app.auth import login_required
from app.utils import ok, err
from app.mail import send_po_pdf_mail

drive_bp = Blueprint("drive", __name__)


@drive_bp.post("/upload-pdf")
@login_required
def upload_pdf():
    """
    Body (JSON):
      {
        "po_id":    "PO-2026-005",
        "filename": "PO-2026-005.pdf",
        "pdf_b64":  "<base64-encoded PDF bytes>"
      }
    """
    data     = request.get_json(silent=True) or {}
    po_id    = data.get("po_id", "").strip()
    filename = data.get("filename", f"{po_id}.pdf")
    pdf_b64  = data.get("pdf_b64", "")

    if not po_id or not pdf_b64:
        return err("po_id and pdf_b64 are required", 400)

    try:
        pdf_bytes = base64.b64decode(pdf_b64)
    except Exception:
        return err("Invalid base64 PDF data", 400)

    try:
        send_po_pdf_mail(po_id, filename, pdf_bytes)
        return ok({}, f"PDF emailed for {po_id}")
    except Exception as e:
        return err(f"Failed to email PDF: {str(e)}", 500)