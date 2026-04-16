from flask import Blueprint, jsonify
from app import db

health_bp = Blueprint("health", __name__)


@health_bp.get("/api/health")
def health():
    try:
        db.session.execute(db.text("SELECT 1"))
        db_ok = True
    except Exception as e:
        db_ok = False

    return jsonify({
        "status": "ok" if db_ok else "degraded",
        "db": "connected" if db_ok else "error",
        "app": "ProcureIQ — CUTIS Hospital",
    }), 200