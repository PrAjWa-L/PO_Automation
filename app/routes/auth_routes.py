"""
app/routes/auth_routes.py
─────────────────────────
Login / logout / access-denied pages.
"""

from flask import Blueprint, render_template, request, session, redirect, url_for
from app.models import User

auth_bp = Blueprint("auth", __name__)


@auth_bp.get("/login")
def login():
    if session.get("user"):
        return redirect(url_for("frontend.dashboard"))
    return render_template("login.html", next=request.args.get("next", ""), error=None)


@auth_bp.post("/login")
def login_post():
    username = request.form.get("username", "").strip().lower()
    password = request.form.get("password", "")
    next_url = request.form.get("next", "") or url_for("frontend.dashboard")

    user = User.query.filter_by(username=username).first()
    if not user or not user.check_password(password):
        return render_template("login.html", next=next_url,
                               error="Invalid username or password.")

    session.permanent = True
    session["user"] = user.to_session()
    return redirect(next_url)


@auth_bp.get("/logout")
def logout():
    session.clear()
    return redirect(url_for("auth.login"))


@auth_bp.get("/denied")
def denied():
    return render_template("denied.html"), 403