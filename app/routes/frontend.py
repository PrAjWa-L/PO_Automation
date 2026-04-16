"""
app/routes/frontend.py
──────────────────────
Serves the Jinja2 HTML templates.
All pages require login. Approvals and AI Compare require COO role.
"""

import os
from flask import Blueprint, render_template
from app.auth import login_required, frontend_role_required, current_user

frontend_bp = Blueprint(
    "frontend",
    __name__,
    template_folder="../../templates",
    static_folder="../../static",
)


def _ctx(**kwargs):
    defaults = {
        "api_base":     os.getenv("API_BASE_URL", "http://localhost:8001"),
        "current_user": current_user(),
    }
    defaults.update(kwargs)
    return defaults


@frontend_bp.get("/")
@frontend_bp.get("/dashboard")
@login_required
def dashboard():
    return render_template("dashboard.html", **_ctx(current_page="dashboard"))


@frontend_bp.get("/vendors")
@login_required
def vendors():
    return render_template("vendors.html", **_ctx(current_page="vendors"))


@frontend_bp.get("/purchase-orders")
@login_required
def purchase_orders():
    return render_template("purchase_orders.html", **_ctx(current_page="po"))


@frontend_bp.get("/approvals")
@frontend_role_required("coo")
def approvals():
    return render_template("approvals.html", **_ctx(current_page="approvals"))


@frontend_bp.get("/quotations")
@login_required
def quotations():
    return render_template("quotations.html", **_ctx(current_page="quotations"))


@frontend_bp.get("/ai-compare")
@frontend_role_required("coo")
def ai_compare():
    return render_template("ai_compare.html", **_ctx(current_page="ai"))


@frontend_bp.get("/payments")
@login_required
def payments():
    return render_template("payments.html", **_ctx(current_page="payments"))


@frontend_bp.get("/invoices")
@login_required
def invoices():
    return render_template("invoices.html", **_ctx(current_page="invoices"))


@frontend_bp.get("/reports")
@login_required
def reports():
    return render_template("reports.html", **_ctx(current_page="reports"))

@frontend_bp.get("/indents")
@login_required
def indents():
    return render_template("indents.html", **_ctx(current_page="indents"))