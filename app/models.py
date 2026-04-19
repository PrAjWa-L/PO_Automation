"""
Database models for ProcureIQ
"""

from datetime import datetime, timezone
from app import db


def utcnow():
    return datetime.now(timezone.utc)

# ─────────────────────────────────────────────────────────────────────────────
# USER
# ─────────────────────────────────────────────────────────────────────────────

class User(db.Model):
    __tablename__ = "users"

    id            = db.Column(db.Integer,     primary_key=True)
    username      = db.Column(db.String(80),  unique=True, nullable=False)
    password_hash = db.Column(db.String(256), nullable=False)
    display_name  = db.Column(db.String(120))
    role          = db.Column(db.String(20),  nullable=False, default="accounts")
    created_at    = db.Column(db.DateTime(timezone=True), default=utcnow)

    def set_password(self, password):
        from werkzeug.security import generate_password_hash
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        from werkzeug.security import check_password_hash
        return check_password_hash(self.password_hash, password)

    def to_session(self):
        return {
            "id":           self.id,
            "username":     self.username,
            "display_name": self.display_name or self.username,
            "role":         self.role,
        }


# ─────────────────────────────────────────────────────────────────────────────
# VENDOR MASTER
# ─────────────────────────────────────────────────────────────────────────────

class Vendor(db.Model):
    __tablename__ = "vendors"

    id          = db.Column(db.String(20),  primary_key=True)   # e.g. VND-001
    name        = db.Column(db.String(200), nullable=False)
    contact     = db.Column(db.String(100))
    mobile      = db.Column(db.String(20))
    email       = db.Column(db.String(120))
    gst         = db.Column(db.String(20))
    pan         = db.Column(db.String(15))
    address     = db.Column(db.Text)

    # Bank details
    bank_name   = db.Column(db.String(100))
    bank_acc    = db.Column(db.String(40))
    bank_ifsc   = db.Column(db.String(15))
    bank_branch = db.Column(db.String(100))

    created_at  = db.Column(db.DateTime(timezone=True), default=utcnow)
    updated_at  = db.Column(db.DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    # Relationships
    purchase_orders = db.relationship("PurchaseOrder", back_populates="vendor", lazy="dynamic")
    quotations      = db.relationship("Quotation",     back_populates="vendor", lazy="dynamic")

    def to_dict(self):
        return {
            "id":          self.id,
            "name":        self.name,
            "contact":     self.contact,
            "mobile":      self.mobile,
            "email":       self.email,
            "gst":         self.gst,
            "pan":         self.pan,
            "address":     self.address,
            "bank_name":   self.bank_name,
            "bank_acc":    self.bank_acc,
            "bank_ifsc":   self.bank_ifsc,
            "bank_branch": self.bank_branch,
            "created_at":  self.created_at.isoformat() if self.created_at else None,
        }


# ─────────────────────────────────────────────────────────────────────────────
# PURCHASE ORDER
# ─────────────────────────────────────────────────────────────────────────────

class PurchaseOrder(db.Model):
    __tablename__ = "purchase_orders"

    id           = db.Column(db.String(30),  primary_key=True)   # e.g. PO-2026-042
    vendor_id    = db.Column(db.String(20),  db.ForeignKey("vendors.id"), nullable=True)
    vendor_name  = db.Column(db.String(200))                      # denormalised snapshot
    vendor_gst   = db.Column(db.String(20))
    vendor_addr  = db.Column(db.Text)
    vendor_bank  = db.Column(db.String(200))

    department   = db.Column(db.String(60),  nullable=False)
    requested_by = db.Column(db.String(100))
    created_by   = db.Column(db.String(100), default="Accounts Team")
    approved_by  = db.Column(db.String(100))

    po_date      = db.Column(db.Date,        nullable=False)
    delivery_date= db.Column(db.Date)
    payment_terms= db.Column(db.String(60),  default="Net 30")
    notes        = db.Column(db.Text)

    # Order type: Purchase Order | Work Order
    order_type   = db.Column(db.String(20),  default="Purchase Order", nullable=False)
    tds_pct      = db.Column(db.Numeric(5,  2), default=0)   # only used for Work Orders
    tds_amt      = db.Column(db.Numeric(14, 2), default=0)

    # Status: Draft | Pending Approval | Approved | Rejected | Closed
    status       = db.Column(db.String(30),  default="Draft", nullable=False)
    rejection_reason = db.Column(db.Text, nullable=True)

    # Financials (computed and stored for quick queries / reports)
    subtotal     = db.Column(db.Numeric(14, 2), default=0)
    discount     = db.Column(db.Numeric(14, 2), default=0)
    gst_total    = db.Column(db.Numeric(14, 2), default=0)
    grand_total  = db.Column(db.Numeric(14, 2), default=0)
    advance_pct  = db.Column(db.Numeric(5,  2), default=0)
    advance_amt  = db.Column(db.Numeric(14, 2), default=0)

    created_at   = db.Column(db.DateTime(timezone=True), default=utcnow)
    updated_at   = db.Column(db.DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    # Relationships
    vendor       = db.relationship("Vendor",      back_populates="purchase_orders")
    line_items   = db.relationship("LineItem",    back_populates="po",
                                   cascade="all, delete-orphan", lazy="joined")
    payments     = db.relationship("Payment",     back_populates="po",  lazy="dynamic")
    quotations   = db.relationship("Quotation",   back_populates="po",  lazy="dynamic")
    indents = db.relationship("Indent", back_populates="po", lazy="dynamic")

    def to_dict(self, include_items=True):
        d = {
            "id":            self.id,
            "order_type":    self.order_type or "Purchase Order",
            "vendor_id":     self.vendor_id,
            "vendor_name":   self.vendor_name,
            "vendor_gst":    self.vendor_gst,
            "vendor_addr":   self.vendor_addr,
            "vendor_bank":   self.vendor_bank,
            "department":    self.department,
            "requested_by":  self.requested_by,
            "created_by":    self.created_by,
            "approved_by":   self.approved_by,
            "po_date":       self.po_date.isoformat()       if self.po_date       else None,
            "delivery_date": self.delivery_date.isoformat() if self.delivery_date else None,
            "payment_terms": self.payment_terms,
            "notes":         self.notes,
            "status":        self.status,
            "subtotal":      float(self.subtotal   or 0),
            "discount":      float(self.discount   or 0),
            "gst_total":     float(self.gst_total  or 0),
            "tds_pct":       float(self.tds_pct    or 0),
            "tds_amt":       float(self.tds_amt    or 0),
            "grand_total":   float(self.grand_total or 0),
            "advance_pct":   float(self.advance_pct or 0),
            "advance_amt":   float(self.advance_amt or 0),
            "created_at":    self.created_at.isoformat() if self.created_at else None,
            "updated_at":    self.updated_at.isoformat() if self.updated_at else None,
            "rejection_reason": self.rejection_reason or "",
        }
        if include_items:
            d["line_items"] = [li.to_dict() for li in self.line_items]
        return d

    def recalculate_totals(self):
        """Re-derive all financial fields from line items."""
        subtotal = discount = gst_total = 0.0
        for li in self.line_items:
            base     = float(li.qty) * float(li.unit_price)
            disc_amt = base * float(li.discount_pct) / 100
            after    = base - disc_amt
            subtotal  += base
            discount  += disc_amt
            gst_total += after * float(li.gst_pct) / 100
        grand = subtotal - discount + gst_total
        # TDS deduction applies only to Work Orders
        tds_amt = 0.0
        if self.order_type == "Work Order":
            tds_amt = (subtotal - discount) * float(self.tds_pct or 0) / 100
        grand_after_tds = grand - tds_amt
        adv   = grand_after_tds * float(self.advance_pct or 0) / 100
        self.subtotal    = round(subtotal,       2)
        self.discount    = round(discount,       2)
        self.gst_total   = round(gst_total,      2)
        self.tds_amt     = round(tds_amt,        2)
        self.grand_total = round(grand_after_tds, 2)
        self.advance_amt = round(adv,            2)


# ─────────────────────────────────────────────────────────────────────────────
# LINE ITEM  (child of PurchaseOrder)
# ─────────────────────────────────────────────────────────────────────────────

class LineItem(db.Model):
    __tablename__ = "line_items"

    id            = db.Column(db.Integer, primary_key=True, autoincrement=True)
    po_id         = db.Column(db.String(30), db.ForeignKey("purchase_orders.id"), nullable=False)
    sort_order    = db.Column(db.Integer, default=0)

    item_name     = db.Column(db.String(200), nullable=False)
    description   = db.Column(db.Text)
    hsn_code      = db.Column(db.String(20))
    department    = db.Column(db.String(60))

    qty           = db.Column(db.Numeric(10, 3), default=1)
    mrp           = db.Column(db.Numeric(14, 2), default=0)
    unit_price    = db.Column(db.Numeric(14, 2), nullable=False)
    discount_pct  = db.Column(db.Numeric(5,  2), default=0)
    gst_pct       = db.Column(db.Numeric(5,  2), default=18)

    # Computed (stored for convenience)
    cgst          = db.Column(db.Numeric(14, 2), default=0)
    sgst          = db.Column(db.Numeric(14, 2), default=0)
    igst          = db.Column(db.Numeric(14, 2), default=0)
    line_total    = db.Column(db.Numeric(14, 2), default=0)

    # Relationship
    po            = db.relationship("PurchaseOrder", back_populates="line_items")

    def compute(self):
        """Calculate tax and total fields."""
        base      = float(self.qty or 1)       * float(self.unit_price or 0)
        after_disc= base * (1 - float(self.discount_pct or 0) / 100)
        gst_amt   = after_disc * float(self.gst_pct or 18) / 100
        self.cgst       = round(gst_amt / 2, 2)
        self.sgst       = round(gst_amt / 2, 2)
        self.igst       = 0
        self.line_total = round(after_disc + gst_amt, 2)

    def to_dict(self):
        return {
            "id":           self.id,
            "po_id":        self.po_id,
            "sort_order":   self.sort_order,
            "item_name":    self.item_name,
            "description":  self.description,
            "hsn_code":     self.hsn_code,
            "department":   self.department,
            "qty":          float(self.qty          or 1),
            "mrp":          float(self.mrp          or 0),
            "unit_price":   float(self.unit_price   or 0),
            "discount_pct": float(self.discount_pct or 0),
            "gst_pct":      float(self.gst_pct      or 18),
            "cgst":         float(self.cgst         or 0),
            "sgst":         float(self.sgst         or 0),
            "igst":         float(self.igst         or 0),
            "line_total":   float(self.line_total   or 0),
        }


# ─────────────────────────────────────────────────────────────────────────────
# PAYMENT
# ─────────────────────────────────────────────────────────────────────────────

class Payment(db.Model):
    __tablename__ = "payments"

    id           = db.Column(db.Integer, primary_key=True, autoincrement=True)
    po_id        = db.Column(db.String(30), db.ForeignKey("purchase_orders.id"), nullable=False)

    # Payment identity
    payment_type = db.Column(db.String(30), default="Full")   # Advance | Partial | Full | Final
    amount       = db.Column(db.Numeric(14, 2), nullable=False)
    payment_date = db.Column(db.Date, nullable=False)
    due_date     = db.Column(db.Date)

    # UTR / reference
    utr_number   = db.Column(db.String(60))   # Unique Transaction Reference
    payment_mode = db.Column(db.String(30))   # NEFT | RTGS | IMPS | Cheque | Cash | UPI
    bank_ref     = db.Column(db.String(100))
    cheque_no    = db.Column(db.String(30))

    # Status: Pending | Paid | Failed | Cancelled
    status       = db.Column(db.String(20), default="Pending", nullable=False)

    # COO approval workflow
    approval_status = db.Column(db.String(20), default="Pending Approval", nullable=True, server_default="Pending Approval")
    approved_by     = db.Column(db.String(120))
    approved_at     = db.Column(db.DateTime(timezone=True))

    remarks      = db.Column(db.Text)

    created_at   = db.Column(db.DateTime(timezone=True), default=utcnow)
    updated_at   = db.Column(db.DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    # Relationship
    po           = db.relationship("PurchaseOrder", back_populates="payments")

    def to_dict(self):
        return {
            "id":           self.id,
            "po_id":        self.po_id,
            "payment_type": self.payment_type,
            "amount":       float(self.amount or 0),
            "payment_date": self.payment_date.isoformat() if self.payment_date else None,
            "due_date":     self.due_date.isoformat()     if self.due_date     else None,
            "utr_number":   self.utr_number,
            "payment_mode": self.payment_mode,
            "cheque_no":    self.cheque_no,
            "status":       self.status,
            "approval_status": self.approval_status or "Pending Approval",
            "approved_by":  self.approved_by,
            "approved_at":  self.approved_at.isoformat() if self.approved_at else None,
            "remarks":      self.remarks,
            "created_at":   self.created_at.isoformat() if self.created_at else None,
            "updated_at":   self.updated_at.isoformat() if self.updated_at else None,
            # Summary fields joined from PO
            "vendor_name":  self.po.vendor_name  if self.po else None,
            "department":   self.po.department   if self.po else None,
            "po_grand":     float(self.po.grand_total or 0) if self.po else None,
        }


# ─────────────────────────────────────────────────────────────────────────────
# QUOTATION  (uploaded doc linked to a PO or standalone)
# ─────────────────────────────────────────────────────────────────────────────

class Quotation(db.Model):
    __tablename__ = "quotations"

    id           = db.Column(db.String(20),  primary_key=True)   # Q-001
    po_id        = db.Column(db.String(30),  db.ForeignKey("purchase_orders.id"), nullable=True)
    vendor_id    = db.Column(db.String(20),  db.ForeignKey("vendors.id"),         nullable=True)

    vendor_name  = db.Column(db.String(200))   # snapshot if vendor not in master
    doc_type     = db.Column(db.String(30))    # Quotation | Proforma Invoice | Tax Invoice
    ref_number   = db.Column(db.String(60))
    doc_date     = db.Column(db.Date)

    total_amount = db.Column(db.Numeric(14, 2), default=0)
    gst_pct      = db.Column(db.Numeric(5,  2), default=18)
    delivery_days= db.Column(db.String(60))
    warranty     = db.Column(db.String(100))
    payment_terms= db.Column(db.String(60))
    vendor_gst   = db.Column(db.String(20))
    description  = db.Column(db.Text)

    # Stored file
    file_path    = db.Column(db.String(500))
    file_name    = db.Column(db.String(200))
    file_type    = db.Column(db.String(10))    # pdf | image

    created_at   = db.Column(db.DateTime(timezone=True), default=utcnow)

    # Relationships
    po           = db.relationship("PurchaseOrder", back_populates="quotations")
    vendor       = db.relationship("Vendor",        back_populates="quotations")

    def to_dict(self):
        return {
            "id":            self.id,
            "po_id":         self.po_id,
            "vendor_id":     self.vendor_id,
            "vendor_name":   self.vendor_name,
            "doc_type":      self.doc_type,
            "ref_number":    self.ref_number,
            "doc_date":      self.doc_date.isoformat() if self.doc_date else None,
            "total_amount":  float(self.total_amount or 0),
            "gst_pct":       float(self.gst_pct or 18),
            "delivery_days": self.delivery_days,
            "warranty":      self.warranty,
            "payment_terms": self.payment_terms,
            "vendor_gst":    self.vendor_gst,
            "description":   self.description,
            "file_name":     self.file_name,
            "file_type":     self.file_type,
            "created_at":    self.created_at.isoformat() if self.created_at else None,
        }
    

class Indent(db.Model):
    __tablename__ = "indents"
 
    id           = db.Column(db.String(20),  primary_key=True)          # IND-2025-001
    indent_date  = db.Column(db.Date,        nullable=False)
    department   = db.Column(db.String(60),  nullable=False)
    item_name    = db.Column(db.String(200), nullable=False)
    quantity     = db.Column(db.Numeric(12, 3), nullable=False, default=1)
    unit         = db.Column(db.String(30),  default="Nos")              # Nos, Kg, Ltrs, etc.
    priority     = db.Column(db.String(20),  default="Normal")           # Low | Normal | High | Urgent
    remarks      = db.Column(db.Text)
    status       = db.Column(db.String(30),  default="Pending")          # Pending | Approved | Rejected | RFQ Sent
    raised_by    = db.Column(db.String(120))                             # display_name of dept admin
    approved_by  = db.Column(db.String(120))                             # display_name of COO
    approved_at  = db.Column(db.DateTime(timezone=True))
 
    # Optional link to PO created after approval
    po_id        = db.Column(db.String(30), db.ForeignKey("purchase_orders.id"), nullable=True)
    po           = db.relationship("PurchaseOrder", back_populates="indents")
 
    created_at   = db.Column(db.DateTime(timezone=True), default=utcnow)
 
    def to_dict(self):
        return {
            "id":           self.id,
            "indent_date":  self.indent_date.isoformat() if self.indent_date else None,
            "department":   self.department,
            "item_name":    self.item_name,
            "quantity":     float(self.quantity or 1),
            "unit":         self.unit,
            "priority":     self.priority,
            "remarks":      self.remarks,
            "status":       self.status,
            "raised_by":    self.raised_by,
            "approved_by":  self.approved_by,
            "approved_at":  self.approved_at.isoformat() if self.approved_at else None,
            "po_id":        self.po_id,
            "created_at":   self.created_at.isoformat() if self.created_at else None,
        }