"""
app/auth.py
───────────
Session-based auth helpers.
"""

from functools import wraps
from flask import session, redirect, url_for, request
from app.utils import err


def current_user():
    return session.get("user")


def login_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if not current_user():
            return redirect(url_for("auth.login", next=request.path))
        return f(*args, **kwargs)
    return decorated


def role_required(*roles):
    """For API routes — returns 403 JSON if wrong role."""
    def decorator(f):
        @wraps(f)
        def decorated(*args, **kwargs):
            user = current_user()
            if not user:
                return err("Not authenticated", 401)
            if user.get("role") not in roles:
                return err("Access denied — insufficient permissions", 403)
            return f(*args, **kwargs)
        return decorated
    return decorator


def frontend_role_required(*roles):
    """For page routes — redirects to /denied if wrong role."""
    def decorator(f):
        @wraps(f)
        def decorated(*args, **kwargs):
            user = current_user()
            if not user:
                return redirect(url_for("auth.login", next=request.path))
            if user.get("role") not in roles:
                return redirect(url_for("auth.denied"))
            return f(*args, **kwargs)
        return decorated
    return decorator