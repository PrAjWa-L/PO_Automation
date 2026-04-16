"""
Vendor Master API
  GET    /api/vendors           — list all
  POST   /api/vendors           — create
  GET    /api/vendors/<id>      — get one
  PUT    /api/vendors/<id>      — update
  DELETE /api/vendors/<id>      — delete (soft-guard: blocks if POs exist)
"""

from flask import Blueprint, request
from app import db
from app.models import Vendor
from app.utils import (
    ok, created, err, not_found, server_err,
    next_vendor_id, validate_gst, validate_pan, validate_ifsc,
)

vendors_bp = Blueprint("vendors", __name__)


@vendors_bp.get("")
def list_vendors():
    vendors = Vendor.query.order_by(Vendor.name).all()
    return ok([v.to_dict() for v in vendors])


@vendors_bp.get("/<string:vid>")
def get_vendor(vid):
    v = Vendor.query.get(vid)
    if not v:
        return not_found("Vendor")
    return ok(v.to_dict())


@vendors_bp.post("")
def create_vendor():
    data = request.get_json(silent=True) or {}

    name = (data.get("name") or "").strip()
    if not name:
        return err("Vendor name is required")

    gst  = (data.get("gst")  or "").strip().upper()
    pan  = (data.get("pan")  or "").strip().upper()
    ifsc = (data.get("bank_ifsc") or "").strip().upper()

    if gst  and not validate_gst(gst):
        return err("Invalid GST number format")
    if pan  and not validate_pan(pan):
        return err("Invalid PAN number format")
    if ifsc and not validate_ifsc(ifsc):
        return err("Invalid IFSC code format")

    try:
        v = Vendor(
            id          = next_vendor_id(),
            name        = name,
            contact     = data.get("contact",     ""),
            mobile      = data.get("mobile",      ""),
            email       = data.get("email",       ""),
            gst         = gst,
            pan         = pan,
            address     = data.get("address",     ""),
            bank_name   = data.get("bank_name",   ""),
            bank_acc    = data.get("bank_acc",    ""),
            bank_ifsc   = ifsc,
            bank_branch = data.get("bank_branch", ""),
        )
        db.session.add(v)
        db.session.commit()
        return created(v.to_dict(), f"Vendor {v.name} created")
    except Exception as e:
        db.session.rollback()
        return server_err(e)


@vendors_bp.put("/<string:vid>")
def update_vendor(vid):
    v = Vendor.query.get(vid)
    if not v:
        return not_found("Vendor")

    data = request.get_json(silent=True) or {}

    gst  = (data.get("gst",      v.gst      or "") or "").strip().upper()
    pan  = (data.get("pan",      v.pan      or "") or "").strip().upper()
    ifsc = (data.get("bank_ifsc",v.bank_ifsc or "") or "").strip().upper()

    if gst  and not validate_gst(gst):
        return err("Invalid GST number format")
    if pan  and not validate_pan(pan):
        return err("Invalid PAN number format")
    if ifsc and not validate_ifsc(ifsc):
        return err("Invalid IFSC code format")

    try:
        v.name        = (data.get("name",        v.name)        or "").strip() or v.name
        v.contact     = data.get("contact",      v.contact)
        v.mobile      = data.get("mobile",       v.mobile)
        v.email       = data.get("email",        v.email)
        v.gst         = gst  or v.gst
        v.pan         = pan  or v.pan
        v.address     = data.get("address",      v.address)
        v.bank_name   = data.get("bank_name",    v.bank_name)
        v.bank_acc    = data.get("bank_acc",     v.bank_acc)
        v.bank_ifsc   = ifsc or v.bank_ifsc
        v.bank_branch = data.get("bank_branch",  v.bank_branch)
        db.session.commit()
        return ok(v.to_dict(), "Vendor updated")
    except Exception as e:
        db.session.rollback()
        return server_err(e)


@vendors_bp.delete("/<string:vid>")
def delete_vendor(vid):
    v = Vendor.query.get(vid)
    if not v:
        return not_found("Vendor")

    if v.purchase_orders.count() > 0:
        return err(
            f"Cannot delete vendor '{v.name}': {v.purchase_orders.count()} PO(s) exist. "
            "Archive vendor instead.", 409
        )
    try:
        db.session.delete(v)
        db.session.commit()
        return ok(msg=f"Vendor {vid} deleted")
    except Exception as e:
        db.session.rollback()
        return server_err(e)