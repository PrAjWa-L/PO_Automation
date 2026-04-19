"""
AI Compare API — local Ollama model, COO only.
"""

import requests
from flask import Blueprint, request
from app.utils import ok, err, server_err
from app.models import Quotation
from app.auth import role_required

ai_bp = Blueprint("ai", __name__)

OLLAMA_URL   = "http://localhost:11434/api/generate"
OLLAMA_MODEL = "llama3.2:3b"


@ai_bp.post("/compare-quotations")
@role_required("coo")
def compare_quotations():
    data  = request.get_json(silent=True) or {}
    quots = []

    ids = data.get("quotation_ids", [])
    if ids:
        for qid in ids:
            q = Quotation.query.get(qid)
            if q:
                quots.append(q.to_dict())

    if not quots:
        quots = data.get("quotations", [])

    if not quots:
        return err("No quotations provided for comparison")
    if len(quots) < 2:
        return err("Provide at least 2 quotations to compare")

    try:
        response = requests.post(
            OLLAMA_URL,
            json={"model": OLLAMA_MODEL, "prompt": _build_prompt(quots), "stream": False},
            timeout=120,
        )
        response.raise_for_status()
        return ok({"analysis": response.json().get("response", "")})

    except requests.exceptions.ConnectionError:
        return err("Could not connect to Ollama. Is it running on localhost:11434?", 503)
    except Exception as e:
        return server_err(e)


def _build_prompt(quots):
    lines = [
        "You are a procurement analyst for CUTIS Hospital, Bengaluru.",
        "Compare the following vendor quotations and recommend the best option.",
        "Consider: total cost, GST compliance, delivery time, warranty, and payment terms.",
        "Flag any red flags such as unusually high/low prices or missing GST details.",
        "Respond in clear paragraphs with a final recommendation.",
        "",
        "QUOTATIONS:",
    ]
    for i, q in enumerate(quots, 1):
        lines += [
            f"\n--- Quotation {i} ---",
            f"Vendor     : {q.get('vendor_name', '—')}",
            f"Doc Type   : {q.get('doc_type', '—')}",
            f"Date       : {q.get('doc_date', '—')}",
            f"Total      : Rs.{q.get('total_amount', 0):,.2f}",
            f"GST %      : {q.get('gst_pct', 18)}%",
            f"Vendor GST : {q.get('vendor_gst', '—')}",
            f"Delivery   : {q.get('delivery_days', '—')}",
            f"Warranty   : {q.get('warranty', '—')}",
            f"Pay Terms  : {q.get('payment_terms', '—')}",
            f"Description: {q.get('description', '—')}",
        ]
    return "\n".join(lines)