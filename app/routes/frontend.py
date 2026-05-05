"""
app/routes/frontend.py
──────────────────────
Serves the Jinja2 HTML templates.

Roles:
  coo            — full access to everything
  accounts       — everything except approvals and ai-compare
  hod            — indent module only, redirected to /indents on login
  accounts_head  — approvals module only
"""

import os
from flask import Blueprint, render_template, redirect, url_for
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
@login_required
def index():
    # HOD goes straight to indents; everyone else to dashboard
    user = current_user()
    if user and user.get("role") == "hod":
        return redirect(url_for("frontend.indents"))
    if user and user.get("role") == "accounts_head":
        return redirect(url_for("frontend.approvals"))
    return redirect(url_for("frontend.dashboard"))


@frontend_bp.get("/dashboard")
@frontend_role_required("coo", "accounts")
def dashboard():
    return render_template("dashboard.html", **_ctx(current_page="dashboard"))


@frontend_bp.get("/vendors")
@frontend_role_required("coo", "accounts")
def vendors():
    return render_template("vendors.html", **_ctx(current_page="vendors"))


@frontend_bp.get("/purchase-orders")
@frontend_role_required("coo", "accounts")
def purchase_orders():
    return render_template("purchase_orders.html", **_ctx(current_page="po"))


@frontend_bp.get("/approvals")
@frontend_role_required("coo", "accounts_head")
def approvals():
    return render_template("approvals.html", **_ctx(current_page="approvals"))


@frontend_bp.get("/quotations")
@frontend_role_required("coo", "accounts")
def quotations():
    return render_template("quotations.html", **_ctx(current_page="quotations"))


@frontend_bp.get("/ai-compare")
@frontend_role_required("coo")
def ai_compare():
    return render_template("ai_compare.html", **_ctx(current_page="ai"))


@frontend_bp.get("/payments")
@frontend_role_required("coo", "accounts")
def payments():
    return render_template("payments.html", **_ctx(current_page="payments"))


@frontend_bp.get("/invoices")
@frontend_role_required("coo", "accounts")
def invoices():
    return render_template("invoices.html", **_ctx(current_page="invoices"))


@frontend_bp.get("/reports")
@frontend_role_required("coo", "accounts")
def reports():
    return render_template("reports.html", **_ctx(current_page="reports"))


@frontend_bp.get("/indents")
@frontend_role_required("coo", "accounts", "hod")
def indents():
    return render_template("indents.html", **_ctx(current_page="indents"))