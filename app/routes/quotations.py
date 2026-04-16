"""
Quotations API (v1 stub — file upload wired up, full AI compare in ai.py)
  GET    /api/quotations           — list
  POST   /api/quotations           — create with optional file upload
  GET    /api/quotations/<id>      — get one
  DELETE /api/quotations/<id>      — delete
"""

import os
from flask import Blueprint, request, current_app
from werkzeug.utils import secure_filename
from app import db
from app.models import Quotation
from app.utils import (
    ok, created, err, not_found, server_err,
    next_quotation_id, parse_date, allowed_file,
)

quotations_bp = Blueprint("quotations", __name__)


@quotations_bp.get("")
def list_quotations():
    po_id = request.args.get("po_id")
    q = Quotation.query
    if po_id:
        q = q.filter(Quotation.po_id == po_id)
    quots = q.order_by(Quotation.created_at.desc()).all()
    return ok([q.to_dict() for q in quots])


@quotations_bp.get("/<string:qid>")
def get_quotation(qid):
    quot = Quotation.query.get(qid)
    if not quot:
        return not_found("Quotation")
    return ok(quot.to_dict())


@quotations_bp.post("")
def create_quotation():
    # Support both JSON and multipart/form-data (file upload)
    if request.content_type and "multipart" in request.content_type:
        data = request.form
        file = request.files.get("file")
    else:
        data = request.get_json(silent=True) or {}
        file = None

    vendor_name = (data.get("vendor_name") or "").strip()
    if not vendor_name:
        return err("vendor_name is required")

    file_path = file_name = file_type = None
    if file and file.filename:
        if not allowed_file(file.filename):
            return err("File type not allowed. Use PDF, PNG, JPG, JPEG, or WEBP.")
        fname     = secure_filename(file.filename)
        save_path = os.path.join(current_app.config["UPLOAD_FOLDER"], fname)
        file.save(save_path)
        file_path = save_path
        file_name = fname
        file_type = fname.rsplit(".", 1)[-1].lower()

    try:
        quot = Quotation(
            id            = next_quotation_id(),
            po_id         = data.get("po_id")     or None,
            vendor_id     = data.get("vendor_id") or None,
            vendor_name   = vendor_name,
            doc_type      = data.get("doc_type",      "Quotation"),
            ref_number    = data.get("ref_number",    ""),
            doc_date      = parse_date(data.get("doc_date")),
            total_amount  = float(data.get("total_amount",  0) or 0),
            gst_pct       = float(data.get("gst_pct",       18) or 18),
            delivery_days = data.get("delivery_days", ""),
            warranty      = data.get("warranty",      ""),
            payment_terms = data.get("payment_terms", ""),
            vendor_gst    = (data.get("vendor_gst") or "").upper(),
            description   = data.get("description",  ""),
            file_path     = file_path,
            file_name     = file_name,
            file_type     = file_type,
        )
        db.session.add(quot)
        db.session.commit()
        return created(quot.to_dict(), f"Quotation from {vendor_name} saved")
    except Exception as e:
        db.session.rollback()
        return server_err(e)


@quotations_bp.delete("/<string:qid>")
def delete_quotation(qid):
    quot = Quotation.query.get(qid)
    if not quot:
        return not_found("Quotation")
    try:
        # Optionally remove file from disk
        if quot.file_path and os.path.exists(quot.file_path):
            os.remove(quot.file_path)
        db.session.delete(quot)
        db.session.commit()
        return ok(msg=f"Quotation {qid} deleted")
    except Exception as e:
        db.session.rollback()
        return server_err(e)