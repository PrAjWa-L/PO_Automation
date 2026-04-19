"""
Indents API
  GET    /api/indents                  — list (filters: status, dept)
  POST   /api/indents                  — create (dept admin)
  GET    /api/indents/<id>             — get one
  PUT    /api/indents/<id>             — edit (only Pending, by raiser)
  DELETE /api/indents/<id>             — delete (only Pending)
  PATCH  /api/indents/<id>/approve     — COO approves
  PATCH  /api/indents/<id>/reject      — COO rejects
  PATCH  /api/indents/<id>/rfq-sent   — mark RFQ sent
"""

from datetime import datetime, timezone
from flask import Blueprint, request
from app import db
from app.models import Indent
from app.auth import login_required, role_required, current_user
from app.utils import ok, created, err, not_found, server_err

indents_bp = Blueprint("indents", __name__)

VALID_DEPTS = [
    "IT", "Maintenance", "Housekeeping", "Accounts",
    "HR", "Pharmacy", "Administration",
]
VALID_PRIORITIES = ["Low", "Normal", "High", "Urgent"]
VALID_UNITS      = ["Nos", "Kg", "Ltrs", "Box", "Pkt", "Set", "Pair", "Mtr", "Roll", "Other"]


# ─── LIST ────────────────────────────────────────────────────
@indents_bp.get("")
@login_required
def list_indents():
    user   = current_user()
    q      = Indent.query

    # Dept admins only see their own department's indents; COO sees all
    if user.get("role") not in ("coo",):
        dept = request.args.get("dept") or user.get("department", "")
        if dept:
            q = q.filter(Indent.department == dept)

    status = request.args.get("status")
    dept   = request.args.get("dept")
    if status:
        q = q.filter(Indent.status == status)
    if dept and user.get("role") == "coo":
        q = q.filter(Indent.department == dept)

    indents = q.order_by(Indent.created_at.desc()).all()
    return ok([i.to_dict() for i in indents])


# ─── STATS ───────────────────────────────────────────────────
@indents_bp.get("/stats")
@login_required
def stats():
    from sqlalchemy import func
    q = Indent.query
    user = current_user()
    if user.get("role") not in ("coo",):
        dept = user.get("department", "")
        if dept:
            q = q.filter(Indent.department == dept)

    total    = q.count()
    pending  = q.filter(Indent.status == "Pending").count()
    approved = q.filter(Indent.status == "Approved").count()
    rejected = q.filter(Indent.status == "Rejected").count()
    rfq_sent = q.filter(Indent.status == "RFQ Sent").count()
    return ok({
        "total": total, "pending": pending,
        "approved": approved, "rejected": rejected, "rfq_sent": rfq_sent,
    })


# ─── GET ONE ─────────────────────────────────────────────────
@indents_bp.get("/<string:iid>")
@login_required
def get_indent(iid):
    indent = Indent.query.get(iid)
    if not indent:
        return not_found("Indent")
    return ok(indent.to_dict())


# ─── CREATE ──────────────────────────────────────────────────
@indents_bp.post("")
@login_required
def create_indent():
    data = request.get_json(silent=True) or {}
    user = current_user()

    item_name = (data.get("item_name") or "").strip()
    if not item_name:
        return err("item_name is required")

    department = (data.get("department") or "").strip()
    if not department:
        return err("department is required")

    try:
        qty = float(data.get("quantity") or 1)
        if qty <= 0:
            return err("quantity must be greater than 0")
    except (TypeError, ValueError):
        return err("quantity must be a number")

    priority = data.get("priority", "Normal")
    if priority not in VALID_PRIORITIES:
        priority = "Normal"

    unit = data.get("unit", "Nos")
    if unit not in VALID_UNITS:
        unit = "Nos"

    try:
        indent = Indent(
            id          = _next_indent_id(),
            indent_date = _today(),
            department  = department,
            item_name   = item_name,
            quantity    = qty,
            unit        = unit,
            priority    = priority,
            remarks     = (data.get("remarks") or "").strip(),
            status      = "Pending",
            raised_by   = user.get("display_name") or user.get("username", ""),
        )
        db.session.add(indent)
        db.session.commit()
        return created(indent.to_dict(), f"Indent {indent.id} raised successfully")
    except Exception as e:
        db.session.rollback()
        return server_err(e)


# ─── EDIT ────────────────────────────────────────────────────
@indents_bp.put("/<string:iid>")
@login_required
def update_indent(iid):
    indent = Indent.query.get(iid)
    if not indent:
        return not_found("Indent")
    if indent.status != "Pending":
        return err("Only Pending indents can be edited")

    data = request.get_json(silent=True) or {}

    if "item_name" in data:
        indent.item_name = (data["item_name"] or "").strip() or indent.item_name
    if "department" in data:
        indent.department = data["department"] or indent.department
    if "quantity" in data:
        try:
            qty = float(data["quantity"])
            if qty > 0:
                indent.quantity = qty
        except (TypeError, ValueError):
            pass
    if "unit" in data and data["unit"] in VALID_UNITS:
        indent.unit = data["unit"]
    if "priority" in data and data["priority"] in VALID_PRIORITIES:
        indent.priority = data["priority"]
    if "remarks" in data:
        indent.remarks = (data["remarks"] or "").strip()

    try:
        db.session.commit()
        return ok(indent.to_dict(), "Indent updated")
    except Exception as e:
        db.session.rollback()
        return server_err(e)


# ─── DELETE ──────────────────────────────────────────────────
@indents_bp.delete("/<string:iid>")
@login_required
def delete_indent(iid):
    indent = Indent.query.get(iid)
    if not indent:
        return not_found("Indent")
    if indent.status != "Pending":
        return err("Only Pending indents can be deleted")
    try:
        db.session.delete(indent)
        db.session.commit()
        return ok(msg=f"Indent {iid} deleted")
    except Exception as e:
        db.session.rollback()
        return server_err(e)


# ─── APPROVE ─────────────────────────────────────────────────
@indents_bp.patch("/<string:iid>/approve")
@role_required("coo")
def approve_indent(iid):
    indent = Indent.query.get(iid)
    if not indent:
        return not_found("Indent")
    if indent.status != "Pending":
        return err(f"Indent is already {indent.status}")

    user = current_user()
    indent.status      = "Approved"
    indent.approved_by = user.get("display_name") or user.get("username", "")
    indent.approved_at = datetime.now(timezone.utc)
    try:
        db.session.commit()
        return ok(indent.to_dict(), f"Indent {iid} approved")
    except Exception as e:
        db.session.rollback()
        return server_err(e)


# ─── REJECT ──────────────────────────────────────────────────
@indents_bp.patch("/<string:iid>/reject")
@role_required("coo")
def reject_indent(iid):
    indent = Indent.query.get(iid)
    if not indent:
        return not_found("Indent")
    if indent.status not in ("Pending", "Approved"):
        return err(f"Indent is already {indent.status}")

    data = request.get_json(silent=True) or {}
    remark = (data.get("remarks") or "").strip()
    if remark:
        indent.remarks = remark

    user = current_user()
    indent.status      = "Rejected"
    indent.approved_by = user.get("display_name") or user.get("username", "")
    indent.approved_at = datetime.now(timezone.utc)
    try:
        db.session.commit()
        return ok(indent.to_dict(), f"Indent {iid} rejected")
    except Exception as e:
        db.session.rollback()
        return server_err(e)


# ─── MARK RFQ SENT ───────────────────────────────────────────
@indents_bp.patch("/<string:iid>/rfq-sent")
@role_required("coo")
def mark_rfq_sent(iid):
    indent = Indent.query.get(iid)
    if not indent:
        return not_found("Indent")
    if indent.status != "Approved":
        return err("Only Approved indents can be marked as RFQ Sent")
    indent.status = "RFQ Sent"
    try:
        db.session.commit()
        return ok(indent.to_dict(), f"Indent {iid} marked as RFQ Sent")
    except Exception as e:
        db.session.rollback()
        return server_err(e)


# ─── HELPERS ─────────────────────────────────────────────────
def _today():
    from datetime import date
    return date.today()


def _next_indent_id():
    from datetime import date
    year   = date.today().year
    prefix = f"IND-{year}-"
    last   = (
        Indent.query
        .filter(Indent.id.like(f"{prefix}%"))
        .order_by(Indent.id.desc())
        .first()
    )
    if not last:
        return f"{prefix}001"
    try:
        num = int(last.id.replace(prefix, "")) + 1
    except ValueError:
        num = 1
    return f"{prefix}{num:03d}"

@indents_bp.get("/next-id")
@login_required
def next_id():
    return ok({"next_id": _next_indent_id()})