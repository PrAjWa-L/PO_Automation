# ProcureIQ — Backend

Flask REST API backend for the CUTIS Hospital PO Automation app.  
**Port:** 8001 (helpdesk stays on 8000)  
**DB:** PostgreSQL via Laragon (SQLite fallback)

---

## Quick Start (Windows)

```bat
cd po_automation
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt

copy .env.example .env
:: Edit .env — set DATABASE_URL and SECRET_KEY

flask --app run db init
flask --app run db migrate -m "initial"
flask --app run db upgrade

python run.py
```

Health check: http://localhost:8001/api/health

---

## Production (Waitress + NSSM)

```bat
:: After venv setup, use Waitress instead of dev server
waitress-serve --host=0.0.0.0 --port=8001 run:app

:: Or run deploy_windows.bat as Administrator to install as Windows service
```

---

## API Reference

All endpoints return:
```json
{ "success": true/false, "message": "...", "data": ... }
```

### Health
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | DB + app status |

---

### Vendors `/api/vendors`
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/vendors` | List all vendors |
| POST | `/api/vendors` | Create vendor |
| GET | `/api/vendors/<id>` | Get one vendor |
| PUT | `/api/vendors/<id>` | Update vendor |
| DELETE | `/api/vendors/<id>` | Delete (blocked if POs exist) |

**POST /api/vendors body:**
```json
{
  "name": "Amwin Systems",
  "contact": "Rahul Sharma",
  "mobile": "+91 98765 43210",
  "email": "rahul@amwin.in",
  "gst": "29AAPCA1129E1ZR",
  "pan": "AAPCA1129E",
  "address": "123 MG Road, Bengaluru-560001",
  "bank_name": "HDFC Bank",
  "bank_acc": "50100123456789",
  "bank_ifsc": "HDFC0001234",
  "bank_branch": "MG Road"
}
```

---

### Purchase Orders `/api/purchase-orders`
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/purchase-orders` | List (filter: `?status=Draft&dept=IT`) |
| GET | `/api/purchase-orders/stats` | Dashboard numbers |
| POST | `/api/purchase-orders` | Create PO with line items |
| GET | `/api/purchase-orders/<id>` | Full PO with items + payments |
| PUT | `/api/purchase-orders/<id>` | Update header + replace items |
| PATCH | `/api/purchase-orders/<id>/status` | Advance status |
| DELETE | `/api/purchase-orders/<id>` | Delete Draft only |

**POST /api/purchase-orders body:**
```json
{
  "vendor_id": "VND-001",
  "department": "IT",
  "po_date": "2026-03-30",
  "requested_by": "Kiran M",
  "payment_terms": "Net 30",
  "advance_pct": 50,
  "notes": "Deliver before April 5",
  "line_items": [
    {
      "item_name": "QNAP NAS TS-464",
      "description": "4-bay NAS with 8GB RAM",
      "hsn_code": "84717090",
      "qty": 1,
      "unit_price": 128700,
      "discount_pct": 0,
      "gst_pct": 18
    }
  ]
}
```

**PATCH /api/purchase-orders/<id>/status body:**
```json
{ "status": "Approved", "approved_by": "COO — Dr. Manjula C.N" }
```

**Status workflow:**
```
Draft → Pending Approval → Approved → Closed
               ↓
           Rejected → Draft
```

---

### Payments `/api/payments`
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/payments` | List (filter: `?status=Pending&po_id=PO-2026-001`) |
| GET | `/api/payments/pending-utr` | Payments missing UTR |
| GET | `/api/payments/summary` | Totals by status |
| POST | `/api/payments` | Record payment |
| GET | `/api/payments/<id>` | Get one |
| PUT | `/api/payments/<id>` | Update (not Paid) |
| PATCH | `/api/payments/<id>/utr` | Record UTR → auto marks Paid |
| DELETE | `/api/payments/<id>` | Delete Pending/Failed only |

**POST /api/payments body:**
```json
{
  "po_id": "PO-2026-001",
  "payment_type": "Advance",
  "amount": 64350,
  "payment_date": "2026-03-30",
  "due_date": "2026-04-14",
  "payment_mode": "NEFT",
  "remarks": "50% advance as per PO terms"
}
```

**PATCH /api/payments/<id>/utr body (most common action):**
```json
{
  "utr_number": "HDFC26033012345678",
  "payment_mode": "NEFT"
}
```

---

### Quotations `/api/quotations`
| Method | Endpoint | Body/Notes |
|--------|----------|------------|
| GET | `/api/quotations` | Filter: `?po_id=PO-2026-001` |
| POST | `/api/quotations` | `multipart/form-data` with optional `file` |
| GET | `/api/quotations/<id>` | Get one |
| DELETE | `/api/quotations/<id>` | Also removes file from disk |

---

### AI Compare `/api/ai`
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/ai/compare-quotations` | Send quotation IDs or objects, get Claude analysis |

```json
{ "quotation_ids": ["Q-001", "Q-002", "Q-003"] }
```

---

## Connecting the Frontend

Replace all in-memory `DB.*` calls in `po_automation.html` with `fetch()` calls:

```javascript
// Example: load vendors into dropdown
const res  = await fetch('http://192.168.2.163:8001/api/vendors');
const json = await res.json();
// json.data = array of vendor objects
```

CORS is pre-configured to allow your LAN origin.

---

## Project Structure

```
po_automation/
├── app/
│   ├── __init__.py        # App factory
│   ├── models.py          # SQLAlchemy models
│   ├── utils.py           # Helpers, validators, ID generators
│   └── routes/
│       ├── vendors.py
│       ├── purchase_orders.py
│       ├── payments.py
│       ├── quotations.py
│       ├── ai.py
│       └── health.py
├── run.py                 # Entry point
├── requirements.txt
└── README.md
```
