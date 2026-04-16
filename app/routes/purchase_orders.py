"""
Purchase Orders API
  GET    /api/purchase-orders               — list (filters: status, dept, vendor_id)
  POST   /api/purchase-orders               — create with line items
  GET    /api/purchase-orders/<id>          — get one (includes line items + payments)
  PUT    /api/purchase-orders/<id>          — update header + replace line items
  DELETE /api/purchase-orders/<id>          — delete (only Draft allowed)
  PATCH  /api/purchase-orders/<id>/status   — advance status workflow
  GET    /api/purchase-orders/stats         — dashboard summary numbers
"""
from app.auth import login_required, role_required, current_user
from flask import Blueprint, request
from app import db
from app.models import PurchaseOrder, LineItem, Vendor
from app.utils import (
    ok, created, err, not_found, server_err,
    next_po_id, parse_date,
)

po_bp = Blueprint("purchase_orders", __name__)

VALID_STATUSES = ["Draft", "Pending Approval", "Approved", "Rejected", "Closed"]
VALID_DEPTS    = ["IT", "Maintenance", "Housekeeping", "Accounts",
                  "HR", "Pharmacy", "Administration"]


# ─── LIST ────────────────────────────────────────────────────
@po_bp.get("")
def list_pos():
    q = PurchaseOrder.query

    status = request.args.get("status")
    dept   = request.args.get("dept")
    vid    = request.args.get("vendor_id")

    if status:
        q = q.filter(PurchaseOrder.status == status)
    if dept:
        q = q.filter(PurchaseOrder.department == dept)
    if vid:
        q = q.filter(PurchaseOrder.vendor_id == vid)

    pos = q.order_by(PurchaseOrder.created_at.desc()).all()
    return ok([p.to_dict(include_items=False) for p in pos])


# ─── STATS (must come before <id> route) ─────────────────────
@po_bp.get("/stats")
def stats():
    from sqlalchemy import func
    total_pos   = PurchaseOrder.query.count()
    draft       = PurchaseOrder.query.filter_by(status="Draft").count()
    pending     = PurchaseOrder.query.filter_by(status="Pending Approval").count()
    approved    = PurchaseOrder.query.filter_by(status="Approved").count()
    ytd_spend   = db.session.query(
        func.sum(PurchaseOrder.grand_total)
    ).filter(PurchaseOrder.status == "Approved").scalar() or 0

    return ok({
        "total_pos":   total_pos,
        "draft":       draft,
        "pending":     pending,
        "approved":    approved,
        "ytd_spend":   float(ytd_spend),
    })


# ─── GET ONE ─────────────────────────────────────────────────
@po_bp.get("/<string:po_id>")
def get_po(po_id):
    po = PurchaseOrder.query.get(po_id)
    if not po:
        return not_found("Purchase Order")
    d = po.to_dict()
    # Attach payment summary
    payments = po.payments.all()
    paid_total = sum(float(p.amount or 0) for p in payments if p.status == "Paid")
    d["payments_summary"] = {
        "count":      len(payments),
        "paid_total": paid_total,
        "balance":    float(po.grand_total or 0) - paid_total,
    }
    d["payments"] = [p.to_dict() for p in payments]
    return ok(d)


# ─── CREATE ──────────────────────────────────────────────────
@po_bp.post("")
def create_po():
    data = request.get_json(silent=True) or {}

    dept = data.get("department", "").strip()
    if not dept:
        return err("Department is required")
    if dept not in VALID_DEPTS:
        return err(f"Invalid department. Choose from: {', '.join(VALID_DEPTS)}")

    po_date = parse_date(data.get("po_date"))
    if not po_date:
        return err("po_date is required (YYYY-MM-DD)")

    items_data = data.get("line_items", [])
    if not items_data:
        return err("At least one line item is required")

    item_errors = _validate_items(items_data)
    if item_errors:
        return err("Line item validation failed", details=item_errors)

    try:
        # ── Auto-fill vendor snapshot ──────────────────────
        vendor_id   = data.get("vendor_id")
        vendor_name = data.get("vendor_name", "").strip()
        vendor_gst  = data.get("vendor_gst",  "").strip()
        vendor_addr = data.get("vendor_addr", "").strip()
        vendor_bank = data.get("vendor_bank", "").strip()

        if vendor_id:
            v = Vendor.query.get(vendor_id)
            if v:
                vendor_name = vendor_name or v.name
                vendor_gst  = vendor_gst  or (v.gst  or "")
                vendor_addr = vendor_addr or (v.address or "")
                vendor_bank = vendor_bank or _fmt_bank(v)

        po = PurchaseOrder(
            id            = next_po_id(),
            vendor_id     = vendor_id,
            vendor_name   = vendor_name,
            vendor_gst    = vendor_gst,
            vendor_addr   = vendor_addr,
            vendor_bank   = vendor_bank,
            department    = dept,
            requested_by  = data.get("requested_by", "").strip(),
            created_by    = data.get("created_by",   "Accounts Team").strip(),
            approved_by   = data.get("approved_by",  "").strip(),
            po_date       = po_date,
            delivery_date = parse_date(data.get("delivery_date")),
            payment_terms = data.get("payment_terms", "Net 30"),
            notes         = data.get("notes", "").strip(),
            status        = data.get("status", "Draft"),
            advance_pct   = float(data.get("advance_pct", 0) or 0),
        )
        db.session.add(po)
        db.session.flush()   # get po.id before adding children

        for i, item in enumerate(items_data):
            li = _build_line_item(po.id, item, i)
            db.session.add(li)

        db.session.flush()
        po.recalculate_totals()
        db.session.commit()
        return created(po.to_dict(), f"Purchase Order {po.id} created")

    except Exception as e:
        db.session.rollback()
        return server_err(e)


# ─── UPDATE ──────────────────────────────────────────────────
@po_bp.put("/<string:po_id>")
def update_po(po_id):
    po = PurchaseOrder.query.get(po_id)
    if not po:
        return not_found("Purchase Order")

    if po.status == "Closed":
        return err("Cannot edit a Closed PO", 409)

    data = request.get_json(silent=True) or {}

    items_data = data.get("line_items")
    if items_data is not None:
        if not items_data:
            return err("At least one line item is required")
        item_errors = _validate_items(items_data)
        if item_errors:
            return err("Line item validation failed", details=item_errors)

    try:
        # Update header fields if provided
        if "department"    in data: po.department    = data["department"]
        if "requested_by"  in data: po.requested_by  = data["requested_by"]
        if "created_by"    in data: po.created_by    = data["created_by"]
        if "approved_by"   in data: po.approved_by   = data["approved_by"]
        if "po_date"       in data: po.po_date        = parse_date(data["po_date"]) or po.po_date
        if "delivery_date" in data: po.delivery_date  = parse_date(data["delivery_date"])
        if "payment_terms" in data: po.payment_terms  = data["payment_terms"]
        if "notes"         in data: po.notes          = data["notes"]
        if "advance_pct"   in data: po.advance_pct    = float(data["advance_pct"] or 0)
        if "vendor_id"     in data:
            po.vendor_id = data["vendor_id"]
            v = Vendor.query.get(po.vendor_id)
            if v:
                po.vendor_name = v.name
                po.vendor_gst  = v.gst or ""
                po.vendor_addr = v.address or ""
                po.vendor_bank = _fmt_bank(v)

        # Replace line items
        if items_data is not None:
            for li in list(po.line_items):
                db.session.delete(li)
            db.session.flush()
            for i, item in enumerate(items_data):
                db.session.add(_build_line_item(po.id, item, i))
            db.session.flush()

        po.recalculate_totals()
        db.session.commit()
        return ok(po.to_dict(), "Purchase Order updated")

    except Exception as e:
        db.session.rollback()
        return server_err(e)


# ─── STATUS TRANSITION ───────────────────────────────────────
@po_bp.patch("/<string:po_id>/status")
@login_required
def change_status(po_id):
    po = PurchaseOrder.query.get(po_id)
    if not po:
        return not_found("Purchase Order")

    user       = current_user()
    role       = user.get("role") if user else "accounts"
    data       = request.get_json(silent=True) or {}
    new_status = data.get("status", "").strip()

    if new_status not in VALID_STATUSES:
        return err(f"Invalid status. Choose from: {', '.join(VALID_STATUSES)}")

    # Role-based workflow:
    # accounts can only move Draft → Pending Approval
    # COO can move Pending Approval → Approved / Rejected, and Approved → Closed
    allowed = {
        "accounts": {
            "Draft":            ["Pending Approval"],
            "Pending Approval": ["Draft"],        # retract back to draft
            "Approved":         ["Closed"],
            "Rejected":         ["Draft"],
            "Closed":           [],
        },
        "coo": {
            "Draft":            ["Pending Approval", "Approved"],
            "Pending Approval": ["Approved", "Rejected", "Draft"],
            "Approved":         ["Closed"],
            "Rejected":         ["Draft"],
            "Closed":           [],
        },
    }

    allowed_transitions = allowed.get(role, allowed["accounts"])
    if new_status not in allowed_transitions.get(po.status, []):
        return err(
            f"Your role ({role}) cannot move a PO from "
            f"'{po.status}' to '{new_status}'.", 403
        )

    try:
        if new_status == "Approved" and data.get("approved_by"):
            po.approved_by = data["approved_by"]
        if new_status == "Rejected":
            po.rejection_reason = data.get("rejection_reason", "").strip()
        if new_status in ("Draft", "Pending Approval"):
            po.rejection_reason = None   # clear on resubmit
        po.status = new_status
        db.session.commit()
        return ok({"id": po.id, "status": po.status}, f"Status updated to {new_status}")
    except Exception as e:
        db.session.rollback()
        return server_err(e)

# ─── DELETE ──────────────────────────────────────────────────
@po_bp.delete("/<string:po_id>")
def delete_po(po_id):
    po = PurchaseOrder.query.get(po_id)
    if not po:
        return not_found("Purchase Order")

    if po.status != "Draft":
        return err("Only Draft POs can be deleted", 409)

    try:
        db.session.delete(po)
        db.session.commit()
        return ok(msg=f"PO {po_id} deleted")
    except Exception as e:
        db.session.rollback()
        return server_err(e)


# ─── Private helpers ─────────────────────────────────────────

def _fmt_bank(v: Vendor) -> str:
    parts = [v.bank_name or "", f"A/c {v.bank_acc}" if v.bank_acc else "",
             f"IFSC {v.bank_ifsc}" if v.bank_ifsc else ""]
    return " · ".join(p for p in parts if p)


def _validate_items(items):
    errors = []
    for i, item in enumerate(items):
        if not (item.get("item_name") or "").strip():
            errors.append(f"Row {i+1}: item_name is required")
        try:
            price = float(item.get("unit_price", 0) or 0)
            if price < 0:
                errors.append(f"Row {i+1}: unit_price cannot be negative")
        except (TypeError, ValueError):
            errors.append(f"Row {i+1}: unit_price must be a number")
    return errors


def _build_line_item(po_id, item, index) -> LineItem:
    li = LineItem(
        po_id        = po_id,
        sort_order   = index,
        item_name    = (item.get("item_name")  or "").strip(),
        description  = (item.get("description") or "").strip(),
        hsn_code     = (item.get("hsn_code")    or "").strip(),
        department   = (item.get("department")  or "").strip(),
        qty          = float(item.get("qty",          1)  or 1),
        mrp          = float(item.get("mrp",          0)  or 0),
        unit_price   = float(item.get("unit_price",   0)  or 0),
        discount_pct = float(item.get("discount_pct", 0)  or 0),
        gst_pct      = float(item.get("gst_pct",      18) or 18),
    )
    li.compute()
    return li