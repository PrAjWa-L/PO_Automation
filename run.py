"""
Entry point for ProcureIQ Flask backend.

Development:
    python run.py

Production (Waitress — same as helpdesk setup):
    waitress-serve --host=0.0.0.0 --port=8001 run:app
    (use port 8001 to avoid clashing with the helpdesk on 8000)
"""

from app import create_app, db
from app.models import Vendor, PurchaseOrder, LineItem, Payment, Quotation  # noqa: F401
from dotenv import load_dotenv
load_dotenv()

app = create_app()


@app.shell_context_processor
def make_shell_context():
    return {
        "db": db,
        "Vendor": Vendor,
        "PurchaseOrder": PurchaseOrder,
        "LineItem": LineItem,
        "Payment": Payment,
        "Quotation": Quotation,
    }


if __name__ == "__main__":
    import os
    port  = int(os.getenv("PORT", 8001))
    debug = os.getenv("FLASK_DEBUG", "0") == "1"
    print(f"  ProcureIQ starting on http://0.0.0.0:{port}")
    app.run(host="0.0.0.0", port=port, debug=debug)