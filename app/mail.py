import os
from flask_mail import Mail, Message
from flask import current_app

mail = Mail()


def init_mail(app):
    app.config["MAIL_SERVER"]   = os.getenv("MAIL_SERVER",   "smtp.gmail.com")
    app.config["MAIL_PORT"]     = int(os.getenv("MAIL_PORT", 587))
    app.config["MAIL_USE_TLS"]  = True
    app.config["MAIL_USERNAME"] = os.getenv("MAIL_USERNAME", "")
    app.config["MAIL_PASSWORD"] = os.getenv("MAIL_PASSWORD", "")
    app.config["MAIL_DEFAULT_SENDER"] = os.getenv("MAIL_USERNAME", "")
    mail.init_app(app)


def send_approval_mail(po):
    """Send approval notification email to the COO."""
    coo_email = os.getenv("COO_EMAIL", "")
    if not coo_email:
        current_app.logger.warning("COO_EMAIL not set — skipping approval email.")
        return

    try:
        msg = Message(
            subject=f"PO Approved — {po.id}",
            recipients=[coo_email],
        )
        msg.html = f"""
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 24px;">
            <h2 style="color: #0F6E56; margin-bottom: 4px;">Purchase Order Approved</h2>
            <p style="color: #555; margin-top: 0;">The following PO has been approved and is ready for processing.</p>

            <table style="width:100%; border-collapse:collapse; margin: 20px 0; font-size: 14px;">
                <tr style="background:#f5f5f5;">
                    <td style="padding:10px 12px; font-weight:bold; width:40%;">PO Number</td>
                    <td style="padding:10px 12px;">{po.id}</td>
                </tr>
                <tr>
                    <td style="padding:10px 12px; font-weight:bold;">Vendor</td>
                    <td style="padding:10px 12px;">{po.vendor_name or "—"}</td>
                </tr>
                <tr style="background:#f5f5f5;">
                    <td style="padding:10px 12px; font-weight:bold;">Department</td>
                    <td style="padding:10px 12px;">{po.department or "—"}</td>
                </tr>
                <tr>
                    <td style="padding:10px 12px; font-weight:bold;">Requested By</td>
                    <td style="padding:10px 12px;">{po.requested_by or "—"}</td>
                </tr>
                <tr style="background:#f5f5f5;">
                    <td style="padding:10px 12px; font-weight:bold;">Total Amount</td>
                    <td style="padding:10px 12px;">₹{float(po.grand_total or 0):,.2f}</td>
                </tr>
                <tr>
                    <td style="padding:10px 12px; font-weight:bold;">Approved By</td>
                    <td style="padding:10px 12px;">{po.approved_by or "—"}</td>
                </tr>
                <tr style="background:#f5f5f5;">
                    <td style="padding:10px 12px; font-weight:bold;">PO Date</td>
                    <td style="padding:10px 12px;">{po.po_date.strftime('%d %b %Y') if po.po_date else "—"}</td>
                </tr>
            </table>

            <p style="font-size: 13px; color: #888;">This is an automated notification from ProcureIQ — CUTIS Hospital.</p>
        </div>
        """
        mail.send(msg)
        current_app.logger.info(f"Approval email sent for {po.id} to {coo_email}")
    except Exception as e:
        current_app.logger.error(f"Failed to send approval email for {po.id}: {e}")