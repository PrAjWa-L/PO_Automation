"""
ProcureIQ — CUTIS Hospital
Flask application factory
"""

import os
from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from flask_cors import CORS
from dotenv import load_dotenv
from datetime import timedelta

load_dotenv()

db      = SQLAlchemy()
migrate = Migrate()


def create_app():
    app = Flask(
        __name__,
        template_folder="templates",   # app/templates/
        static_folder="static",        # app/static/
    )

    # ── Config ────────────────────────────────────────────────
    app.config["SECRET_KEY"]                  = os.getenv("SECRET_KEY", "dev-secret-change-me")
    app.config["SQLALCHEMY_DATABASE_URI"]     = _resolve_db_url()
    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
    app.config["UPLOAD_FOLDER"]               = os.getenv("UPLOAD_FOLDER", "uploads")
    app.config["MAX_CONTENT_LENGTH"]          = int(
        os.getenv("MAX_CONTENT_LENGTH", 10 * 1024 * 1024)
    )

    app.config["PERMANENT_SESSION_LIFETIME"] = timedelta(hours=12)

    # ── Extensions ────────────────────────────────────────────
    db.init_app(app)
    migrate.init_app(app, db)

    origins = os.getenv("CORS_ORIGINS", "*").split(",")
    CORS(app, resources={r"/api/*": {"origins": origins}})

    # ── Upload folder ─────────────────────────────────────────
    os.makedirs(app.config["UPLOAD_FOLDER"], exist_ok=True)

    # ── API blueprints ────────────────────────────────────────
    from app.routes.vendors        import vendors_bp
    from app.routes.purchase_orders import po_bp
    from app.routes.payments       import payments_bp
    from app.routes.quotations     import quotations_bp
    from app.routes.ai             import ai_bp
    from app.routes.health         import health_bp
    from app.routes.auth_routes import auth_bp
    from app.routes.indents import indents_bp

    app.register_blueprint(health_bp)
    app.register_blueprint(vendors_bp,    url_prefix="/api/vendors")
    app.register_blueprint(po_bp,         url_prefix="/api/purchase-orders")
    app.register_blueprint(payments_bp,   url_prefix="/api/payments")
    app.register_blueprint(quotations_bp, url_prefix="/api/quotations")
    app.register_blueprint(ai_bp,         url_prefix="/api/ai")
    app.register_blueprint(auth_bp)
    app.register_blueprint(indents_bp, url_prefix="/api/indents")

    # ── Frontend blueprint (serves HTML pages) ────────────────
    from app.routes.frontend import frontend_bp
    app.register_blueprint(frontend_bp)   # no url_prefix — pages at /dashboard, /vendors, etc.

    return app


def _resolve_db_url():
    url = os.getenv("DATABASE_URL", "")
    if not url:
        base = os.path.abspath(os.path.dirname(__file__))
        return f"sqlite:///{os.path.join(base, 'po_automation.db')}"
    # Fix old-style Heroku/Azure postgres:// URLs
    if url.startswith("postgres://"):
        url = url.replace("postgres://", "postgresql://", 1)
    return url
