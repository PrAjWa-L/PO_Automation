"""
Utility helpers shared across routes
"""

import re
from datetime import date, datetime
from flask import jsonify


# ─────────────────────────────────────────────────────────────
# JSON response helpers
# ─────────────────────────────────────────────────────────────

def ok(data=None, msg="OK", status=200):
    body = {"success": True, "message": msg}
    if data is not None:
        body["data"] = data
    return jsonify(body), status


def created(data=None, msg="Created"):
    return ok(data, msg, 201)


def err(msg="An error occurred", status=400, details=None):
    body = {"success": False, "message": msg}
    if details:
        body["details"] = details
    return jsonify(body), status


def not_found(resource="Resource"):
    return err(f"{resource} not found", 404)


def server_err(e):
    return err(f"Internal server error: {str(e)}", 500)


# ─────────────────────────────────────────────────────────────
# ID generators
# ─────────────────────────────────────────────────────────────

def next_vendor_id():
    from app.models import Vendor
    last = (
        Vendor.query
        .filter(Vendor.id.like("VND-%"))
        .order_by(Vendor.id.desc())
        .first()
    )
    if not last:
        return "VND-001"
    try:
        num = int(last.id.split("-")[1]) + 1
    except (IndexError, ValueError):
        num = 1
    return f"VND-{num:03d}"


def next_po_id():
    """Generate PO-YYYY-NNN, incrementing off the last PO for this year."""
    from app.models import PurchaseOrder
    year = date.today().year
    prefix = f"PO-{year}-"
    last = (
        PurchaseOrder.query
        .filter(PurchaseOrder.id.like(f"{prefix}%"))
        .order_by(PurchaseOrder.id.desc())
        .first()
    )
    if not last:
        return f"{prefix}001"
    try:
        num = int(last.id.replace(prefix, "")) + 1
    except ValueError:
        num = 1
    return f"{prefix}{num:03d}"


def next_quotation_id():
    from app.models import Quotation
    last = (
        Quotation.query
        .filter(Quotation.id.like("Q-%"))
        .order_by(Quotation.id.desc())
        .first()
    )
    if not last:
        return "Q-001"
    try:
        num = int(last.id.split("-")[1]) + 1
    except (IndexError, ValueError):
        num = 1
    return f"Q-{num:03d}"


# ─────────────────────────────────────────────────────────────
# Simple validators
# ─────────────────────────────────────────────────────────────

GST_RE  = re.compile(r"^\d{2}[A-Z]{5}\d{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$")
PAN_RE  = re.compile(r"^[A-Z]{5}\d{4}[A-Z]{1}$")
IFSC_RE = re.compile(r"^[A-Z]{4}0[A-Z0-9]{6}$")


def validate_gst(gst: str) -> bool:
    return bool(GST_RE.match(gst.upper())) if gst else True


def validate_pan(pan: str) -> bool:
    return bool(PAN_RE.match(pan.upper())) if pan else True


def validate_ifsc(ifsc: str) -> bool:
    return bool(IFSC_RE.match(ifsc.upper())) if ifsc else True


def parse_date(val) -> date | None:
    if not val:
        return None
    if isinstance(val, date):
        return val
    for fmt in ("%Y-%m-%d", "%d-%m-%Y", "%d/%m/%Y"):
        try:
            return datetime.strptime(str(val), fmt).date()
        except ValueError:
            continue
    return None


def allowed_file(filename: str, exts=None) -> bool:
    if exts is None:
        exts = {"pdf", "png", "jpg", "jpeg", "webp"}
    return "." in filename and filename.rsplit(".", 1)[1].lower() in exts