"""
Notifications API
- GET  /api/notifications/         — list unread notifications for current user's role
- POST /api/notifications/<id>/read — mark a notification as read
- POST /api/notifications/read-all  — mark all as read
"""

from flask import Blueprint
from app import db
from app.models import Notification
from app.utils import ok, not_found
from app.auth import login_required, current_user

notifications_bp = Blueprint("notifications", __name__)


@notifications_bp.get("/")
@login_required
def list_notifications():
    user = current_user()
    role = user.get("role", "")
    notifications = (
        Notification.query
        .filter_by(target_role=role, is_read=False)
        .order_by(Notification.created_at.desc())
        .all()
    )
    return ok([n.to_dict() for n in notifications])


@notifications_bp.post("/<int:nid>/read")
@login_required
def mark_read(nid):
    notif = Notification.query.get(nid)
    if not notif:
        return not_found("Notification")
    notif.is_read = True
    db.session.commit()
    return ok({}, "Marked as read")


@notifications_bp.post("/read-all")
@login_required
def mark_all_read():
    user = current_user()
    role = user.get("role", "")
    Notification.query.filter_by(target_role=role, is_read=False).update({"is_read": True})
    db.session.commit()
    return ok({}, "All notifications marked as read")