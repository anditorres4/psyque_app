# Caja + Cartera Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement Caja (shift-based income/expense tracking per user) and Cartera (pending invoice collection dashboard), integrated through the existing `Invoice` model.

**Architecture:** Two new models (`CashSession`, `CashTransaction`) feed into `Invoice.amount_paid` updates via a shared `InvoiceService.apply_payment()` helper. Cartera is a derived view over invoices with `payment_status != "paid"`. All patterns (service layer, `TenantDB`, RLS, React Query) follow the existing codebase conventions exactly.

**Tech Stack:** FastAPI + SQLAlchemy 2 + Alembic + PostgreSQL/Supabase RLS (backend); React 18 + TypeScript + shadcn/ui + React Query (frontend)

---

## File Map

**New backend files:**
- `psicogest/backend/app/models/cash_session.py`
- `psicogest/backend/app/models/cash_transaction.py`
- `psicogest/backend/app/schemas/caja.py`
- `psicogest/backend/app/schemas/cartera.py`
- `psicogest/backend/app/services/caja_service.py`
- `psicogest/backend/app/services/cartera_service.py`
- `psicogest/backend/app/api/v1/caja.py`
- `psicogest/backend/app/api/v1/cartera.py`
- `psicogest/backend/alembic/versions/0009_add_invoice_payment_fields.py`
- `psicogest/backend/alembic/versions/0010_create_cash_sessions.py`
- `psicogest/backend/alembic/versions/0011_create_cash_transactions.py`
- `psicogest/backend/tests/test_caja_service.py`
- `psicogest/backend/tests/test_cartera_service.py`
- `psicogest/frontend/src/pages/caja/CajaPage.tsx`
- `psicogest/frontend/src/pages/cartera/CarteraPage.tsx`

**Modified backend files:**
- `psicogest/backend/app/models/invoice.py` — add `amount_paid`, `payment_status`
- `psicogest/backend/app/schemas/invoice.py` — expose new fields in response schemas
- `psicogest/backend/app/services/invoice_service.py` — update `mark_paid()`, add `apply_payment()`
- `psicogest/backend/app/main.py` — register caja + cartera routers

**Modified frontend files:**
- `psicogest/frontend/src/lib/api.ts` — add Caja + Cartera types and API methods
- `psicogest/frontend/src/App.tsx` — add `/caja` and `/cartera` routes
- `psicogest/frontend/src/components/layout/Sidebar.tsx` — add nav items

---

## Task 1: Invoice model — add payment tracking fields

**Files:**
- Modify: `psicogest/backend/app/models/invoice.py`
- Modify: `psicogest/backend/app/schemas/invoice.py`
- Modify: `psicogest/backend/app/services/invoice_service.py`
- Create: `psicogest/backend/alembic/versions/0009_add_invoice_payment_fields.py`

- [ ] **Step 1: Write migration 0009**

Create `psicogest/backend/alembic/versions/0009_add_invoice_payment_fields.py`:

```python
"""Add amount_paid and payment_status to invoices for partial payment tracking.

Revision ID: 0009
Revises: 0008
Create Date: 2026-04-23
"""
from alembic import op
import sqlalchemy as sa

revision = "0009"
down_revision = "0008"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("CREATE TYPE invoice_payment_status AS ENUM ('unpaid', 'partial', 'paid')")
    op.add_column(
        "invoices",
        sa.Column("amount_paid", sa.Integer(), nullable=False, server_default="0"),
    )
    op.add_column(
        "invoices",
        sa.Column(
            "payment_status",
            sa.Enum("unpaid", "partial", "paid", name="invoice_payment_status"),
            nullable=False,
            server_default="unpaid",
        ),
    )
    # Sync existing paid invoices: set amount_paid = total_cop, payment_status = 'paid'
    op.execute("""
        UPDATE invoices
        SET amount_paid = total_cop, payment_status = 'paid'
        WHERE status = 'paid'
    """)


def downgrade() -> None:
    op.drop_column("invoices", "payment_status")
    op.drop_column("invoices", "amount_paid")
    op.execute("DROP TYPE invoice_payment_status")
```

- [ ] **Step 2: Add fields to Invoice ORM model**

In `psicogest/backend/app/models/invoice.py`, add after the `paid_at` field:

```python
    amount_paid: Mapped[int] = mapped_column(
        sa.Integer(), nullable=False, server_default=sa.text("0")
    )
    payment_status: Mapped[str] = mapped_column(
        sa.Enum("unpaid", "partial", "paid", name="invoice_payment_status"),
        nullable=False,
        server_default=sa.text("'unpaid'"),
    )
```

- [ ] **Step 3: Expose new fields in Pydantic schemas**

In `psicogest/backend/app/schemas/invoice.py`, add to `InvoiceSummary`:

```python
class InvoiceSummary(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    invoice_number: str
    patient_id: uuid.UUID
    status: str
    payment_status: str        # NEW
    amount_paid: int           # NEW
    issue_date: datetime | None
    due_date: datetime | None
    subtotal_cop: int
    tax_cop: int
    total_cop: int
    created_at: datetime
```

- [ ] **Step 4: Add `apply_payment()` static method to InvoiceService and update `mark_paid()`**

In `psicogest/backend/app/services/invoice_service.py`:

```python
    @staticmethod
    def apply_payment(invoice: "Invoice", delta: int) -> None:
        """Apply a payment delta to invoice.amount_paid and recalculate payment_status.

        Call with a positive delta to record a payment, negative to reverse one.
        Automatically promotes status to 'paid' and sets paid_at when fully settled.
        """
        from datetime import datetime, timezone
        invoice.amount_paid = max(0, invoice.amount_paid + delta)
        if invoice.amount_paid <= 0:
            invoice.payment_status = "unpaid"
        elif invoice.amount_paid >= invoice.total_cop:
            invoice.payment_status = "paid"
            invoice.status = "paid"
            invoice.paid_at = datetime.now(tz=timezone.utc)
        else:
            invoice.payment_status = "partial"
```

Also update the existing `mark_paid()` method to keep both status systems in sync:

```python
    def mark_paid(self, invoice_id: str) -> Invoice:
        """Mark invoice as fully paid (legacy endpoint — also updates payment tracking fields)."""
        invoice = self._get_invoice(invoice_id)
        invoice.status = "paid"
        invoice.paid_at = datetime.now(tz=timezone.utc)
        invoice.amount_paid = invoice.total_cop
        invoice.payment_status = "paid"
        self.db.flush()
        self.db.refresh(invoice)
        return invoice
```

- [ ] **Step 5: Run migration**

```bash
cd psicogest/backend
alembic upgrade head
```

Expected: `Running upgrade 0008 -> 0009, Add amount_paid and payment_status to invoices`

- [ ] **Step 6: Commit**

```bash
git add psicogest/backend/app/models/invoice.py \
        psicogest/backend/app/schemas/invoice.py \
        psicogest/backend/app/services/invoice_service.py \
        psicogest/backend/alembic/versions/0009_add_invoice_payment_fields.py
git commit -m "feat: add invoice payment tracking fields (amount_paid, payment_status)"
```

---

## Task 2: CashSession + CashTransaction models + migrations

**Files:**
- Create: `psicogest/backend/app/models/cash_session.py`
- Create: `psicogest/backend/app/models/cash_transaction.py`
- Create: `psicogest/backend/alembic/versions/0010_create_cash_sessions.py`
- Create: `psicogest/backend/alembic/versions/0011_create_cash_transactions.py`

- [ ] **Step 1: Create CashSession model**

Create `psicogest/backend/app/models/cash_session.py`:

```python
"""CashSession ORM model — daily shift opened/closed per user.

Table: cash_sessions
"""
import uuid
from datetime import datetime

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin, TenantMixin, UUIDPrimaryKey


class CashSession(Base, UUIDPrimaryKey, TenantMixin, TimestampMixin):
    """A work shift opened by a user. Tracks income and expenses for a day."""

    __tablename__ = "cash_sessions"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, index=True
    )
    opened_at: Mapped[datetime] = mapped_column(
        sa.TIMESTAMP(timezone=True), nullable=False
    )
    closed_at: Mapped[datetime | None] = mapped_column(
        sa.TIMESTAMP(timezone=True), nullable=True
    )
    status: Mapped[str] = mapped_column(
        sa.Enum("open", "closed", name="cash_session_status"),
        nullable=False,
        server_default=sa.text("'open'"),
    )
    notes: Mapped[str | None] = mapped_column(sa.Text(), nullable=True)
```

- [ ] **Step 2: Create CashTransaction model**

Create `psicogest/backend/app/models/cash_transaction.py`:

```python
"""CashTransaction ORM model — individual income or expense within a shift.

Table: cash_transactions
"""
import uuid

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin, TenantMixin, UUIDPrimaryKey


class CashTransaction(Base, UUIDPrimaryKey, TenantMixin, TimestampMixin):
    """One income or expense movement. Income may be linked to an invoice."""

    __tablename__ = "cash_transactions"

    session_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True, index=True
    )
    type: Mapped[str] = mapped_column(
        sa.Enum("income", "expense", name="cash_transaction_type"),
        nullable=False,
    )
    amount: Mapped[int] = mapped_column(sa.Integer(), nullable=False)
    category: Mapped[str] = mapped_column(sa.String(50), nullable=False)
    description: Mapped[str] = mapped_column(sa.Text(), nullable=False)
    invoice_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True, index=True
    )
    patient_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True, index=True
    )
    payment_method: Mapped[str | None] = mapped_column(sa.String(20), nullable=True)
    created_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
```

- [ ] **Step 3: Create migration 0010 — cash_sessions table**

Create `psicogest/backend/alembic/versions/0010_create_cash_sessions.py`:

```python
"""Create cash_sessions table with RLS.

Revision ID: 0010
Revises: 0009
Create Date: 2026-04-23
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "0010"
down_revision = "0009"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("CREATE TYPE cash_session_status AS ENUM ('open', 'closed')")
    op.create_table(
        "cash_sessions",
        sa.Column("id", UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("tenant_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("user_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("opened_at", sa.TIMESTAMP(timezone=True), nullable=False),
        sa.Column("closed_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("status",
                  sa.Enum("open", "closed", name="cash_session_status"),
                  nullable=False, server_default="open"),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True),
                  server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.TIMESTAMP(timezone=True),
                  server_default=sa.text("now()"), nullable=False),
    )
    op.execute("ALTER TABLE cash_sessions ENABLE ROW LEVEL SECURITY")
    op.execute("""
        CREATE POLICY tenant_isolation ON cash_sessions
        USING (tenant_id::text = current_setting('app.tenant_id', true))
    """)
    # Unique constraint: only one open session per (tenant, user)
    op.execute("""
        CREATE UNIQUE INDEX uq_cash_sessions_open_per_user
        ON cash_sessions (tenant_id, user_id)
        WHERE status = 'open'
    """)


def downgrade() -> None:
    op.drop_table("cash_sessions")
    op.execute("DROP TYPE cash_session_status")
```

- [ ] **Step 4: Create migration 0011 — cash_transactions table**

Create `psicogest/backend/alembic/versions/0011_create_cash_transactions.py`:

```python
"""Create cash_transactions table with RLS.

Revision ID: 0011
Revises: 0010
Create Date: 2026-04-23
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "0011"
down_revision = "0010"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("CREATE TYPE cash_transaction_type AS ENUM ('income', 'expense')")
    op.create_table(
        "cash_transactions",
        sa.Column("id", UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("tenant_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("session_id", UUID(as_uuid=True), nullable=True, index=True),
        sa.Column("type",
                  sa.Enum("income", "expense", name="cash_transaction_type"),
                  nullable=False),
        sa.Column("amount", sa.Integer(), nullable=False),
        sa.Column("category", sa.String(50), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("invoice_id", UUID(as_uuid=True), nullable=True, index=True),
        sa.Column("patient_id", UUID(as_uuid=True), nullable=True, index=True),
        sa.Column("payment_method", sa.String(20), nullable=True),
        sa.Column("created_by", UUID(as_uuid=True), nullable=False),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True),
                  server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.TIMESTAMP(timezone=True),
                  server_default=sa.text("now()"), nullable=False),
    )
    op.execute("ALTER TABLE cash_transactions ENABLE ROW LEVEL SECURITY")
    op.execute("""
        CREATE POLICY tenant_isolation ON cash_transactions
        USING (tenant_id::text = current_setting('app.tenant_id', true))
    """)


def downgrade() -> None:
    op.drop_table("cash_transactions")
    op.execute("DROP TYPE cash_transaction_type")
```

- [ ] **Step 5: Run migrations**

```bash
cd psicogest/backend
alembic upgrade head
```

Expected:
```
Running upgrade 0009 -> 0010, Create cash_sessions table with RLS
Running upgrade 0010 -> 0011, Create cash_transactions table with RLS
```

- [ ] **Step 6: Commit**

```bash
git add psicogest/backend/app/models/cash_session.py \
        psicogest/backend/app/models/cash_transaction.py \
        psicogest/backend/alembic/versions/0010_create_cash_sessions.py \
        psicogest/backend/alembic/versions/0011_create_cash_transactions.py
git commit -m "feat: add CashSession and CashTransaction models with migrations"
```

---

## Task 3: CajaService

**Files:**
- Create: `psicogest/backend/app/services/caja_service.py`
- Create: `psicogest/backend/tests/test_caja_service.py`

- [ ] **Step 1: Write failing tests for CajaService**

Create `psicogest/backend/tests/test_caja_service.py`:

```python
"""Tests for CajaService — shift and transaction management."""
import uuid

import pytest
from sqlalchemy import text
from sqlalchemy.orm import Session

from tests.conftest import _create_tenant, _insert_patient
from app.services.caja_service import CajaService, CajaSessionAlreadyOpenError, CajaNotFoundError


def _set_ctx(db: Session, tenant_id: str) -> None:
    db.execute(text("SET LOCAL app.tenant_id = :tid"), {"tid": tenant_id})


def _insert_invoice(db: Session, tenant_id: str, patient_id: str, total: int = 100_000) -> str:
    _set_ctx(db, tenant_id)
    result = db.execute(
        text("""
            INSERT INTO invoices (tenant_id, invoice_number, patient_id, status,
                subtotal_cop, tax_cop, total_cop, session_ids,
                amount_paid, payment_status)
            VALUES (:tid, 'INV-2026-0001', :pid, 'issued',
                :total, 0, :total, '[]',
                0, 'unpaid')
            RETURNING id
        """),
        {"tid": tenant_id, "pid": patient_id, "total": total},
    )
    return str(result.mappings().one()["id"])


class TestOpenCloseSession:
    def test_open_session_creates_open_record(self, db, two_tenants):
        tid = two_tenants["tenant_a"]["id"]
        uid = two_tenants["tenant_a"]["auth_user_id"]
        _set_ctx(db, tid)
        svc = CajaService(db, tid, uid)

        session = svc.open_session()
        db.flush()

        assert session.status == "open"
        assert session.closed_at is None
        assert str(session.tenant_id) == tid
        assert str(session.user_id) == uid

    def test_cannot_open_second_session(self, db, two_tenants):
        tid = two_tenants["tenant_a"]["id"]
        uid = two_tenants["tenant_a"]["auth_user_id"]
        _set_ctx(db, tid)
        svc = CajaService(db, tid, uid)
        svc.open_session()
        db.flush()

        with pytest.raises(CajaSessionAlreadyOpenError):
            svc.open_session()

    def test_close_session(self, db, two_tenants):
        tid = two_tenants["tenant_a"]["id"]
        uid = two_tenants["tenant_a"]["auth_user_id"]
        _set_ctx(db, tid)
        svc = CajaService(db, tid, uid)
        session = svc.open_session()
        db.flush()

        closed = svc.close_session(str(session.id), notes="Turno de prueba")
        db.flush()

        assert closed.status == "closed"
        assert closed.closed_at is not None
        assert closed.notes == "Turno de prueba"

    def test_tenant_isolation(self, db, two_tenants):
        tid_a = two_tenants["tenant_a"]["id"]
        tid_b = two_tenants["tenant_b"]["id"]
        uid_a = two_tenants["tenant_a"]["auth_user_id"]
        uid_b = two_tenants["tenant_b"]["auth_user_id"]

        _set_ctx(db, tid_a)
        svc_a = CajaService(db, tid_a, uid_a)
        session_a = svc_a.open_session()
        db.flush()

        _set_ctx(db, tid_b)
        svc_b = CajaService(db, tid_b, uid_b)
        with pytest.raises(CajaNotFoundError):
            svc_b.close_session(str(session_a.id))


class TestTransactions:
    def test_add_expense_transaction(self, db, two_tenants):
        tid = two_tenants["tenant_a"]["id"]
        uid = two_tenants["tenant_a"]["auth_user_id"]
        _set_ctx(db, tid)
        svc = CajaService(db, tid, uid)
        session = svc.open_session()
        db.flush()

        tx = svc.add_transaction(
            str(session.id),
            type="expense",
            amount=50_000,
            category="servicios",
            description="Pago arriendo oficina",
        )
        db.flush()

        assert tx.type == "expense"
        assert tx.amount == 50_000
        assert tx.invoice_id is None

    def test_add_income_updates_invoice(self, db, two_tenants):
        tid = two_tenants["tenant_a"]["id"]
        uid = two_tenants["tenant_a"]["auth_user_id"]
        pid = two_tenants["patient_a_id"]
        _set_ctx(db, tid)
        inv_id = _insert_invoice(db, tid, pid, total=80_000)
        svc = CajaService(db, tid, uid)
        session = svc.open_session()
        db.flush()

        svc.add_transaction(
            str(session.id),
            type="income",
            amount=80_000,
            category="PA",
            description="Pago consulta",
            invoice_id=inv_id,
            patient_id=pid,
            payment_method="efectivo",
        )
        db.flush()

        result = db.execute(
            text("SELECT amount_paid, payment_status FROM invoices WHERE id = :id"),
            {"id": inv_id},
        ).mappings().one()
        assert result["amount_paid"] == 80_000
        assert result["payment_status"] == "paid"

    def test_partial_payment_sets_partial_status(self, db, two_tenants):
        tid = two_tenants["tenant_a"]["id"]
        uid = two_tenants["tenant_a"]["auth_user_id"]
        pid = two_tenants["patient_a_id"]
        _set_ctx(db, tid)
        inv_id = _insert_invoice(db, tid, pid, total=100_000)
        svc = CajaService(db, tid, uid)
        session = svc.open_session()
        db.flush()

        svc.add_transaction(
            str(session.id),
            type="income",
            amount=40_000,
            category="PA",
            description="Abono parcial",
            invoice_id=inv_id,
        )
        db.flush()

        result = db.execute(
            text("SELECT amount_paid, payment_status FROM invoices WHERE id = :id"),
            {"id": inv_id},
        ).mappings().one()
        assert result["amount_paid"] == 40_000
        assert result["payment_status"] == "partial"

    def test_session_summary(self, db, two_tenants):
        tid = two_tenants["tenant_a"]["id"]
        uid = two_tenants["tenant_a"]["auth_user_id"]
        pid = two_tenants["patient_a_id"]
        _set_ctx(db, tid)
        inv_id = _insert_invoice(db, tid, pid, total=80_000)
        svc = CajaService(db, tid, uid)
        session = svc.open_session()
        db.flush()

        svc.add_transaction(str(session.id), type="income", amount=80_000,
                            category="PA", description="Consulta", invoice_id=inv_id)
        svc.add_transaction(str(session.id), type="expense", amount=20_000,
                            category="servicios", description="Café")
        db.flush()

        summary = svc.get_session_summary(str(session.id))
        assert summary["total_income"] == 80_000
        assert summary["total_expense"] == 20_000
        assert summary["net"] == 60_000
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd psicogest/backend
pytest tests/test_caja_service.py -v 2>&1 | head -30
```

Expected: `ImportError: cannot import name 'CajaService' from 'app.services.caja_service'`

- [ ] **Step 3: Implement CajaService**

Create `psicogest/backend/app/services/caja_service.py`:

```python
"""CajaService — shift management and transaction recording."""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy.orm import Session as DBSession

from app.models.cash_session import CashSession
from app.models.cash_transaction import CashTransaction
from app.models.invoice import Invoice
from app.services.invoice_service import InvoiceService


class CajaSessionAlreadyOpenError(Exception):
    pass


class CajaSessionNotOpenError(Exception):
    pass


class CajaNotFoundError(Exception):
    pass


class CajaService:
    def __init__(self, db: DBSession, tenant_id: str, user_id: str) -> None:
        self.db = db
        self.tenant_id = tenant_id
        self._tenant_uuid = uuid.UUID(tenant_id)
        self._user_uuid = uuid.UUID(user_id)

    # ------------------------------------------------------------------
    # Session management
    # ------------------------------------------------------------------

    def open_session(self) -> CashSession:
        existing = (
            self.db.query(CashSession)
            .filter(
                CashSession.tenant_id == self._tenant_uuid,
                CashSession.user_id == self._user_uuid,
                CashSession.status == "open",
            )
            .first()
        )
        if existing:
            raise CajaSessionAlreadyOpenError("Ya hay un turno abierto para este usuario.")

        session = CashSession(
            id=uuid.uuid4(),
            tenant_id=self._tenant_uuid,
            user_id=self._user_uuid,
            opened_at=datetime.now(tz=timezone.utc),
            status="open",
        )
        self.db.add(session)
        self.db.flush()
        return session

    def close_session(self, session_id: str, notes: str | None = None) -> CashSession:
        session = self._get_session(session_id)
        if session.status != "open":
            raise CajaSessionNotOpenError("El turno ya está cerrado.")
        session.status = "closed"
        session.closed_at = datetime.now(tz=timezone.utc)
        if notes:
            session.notes = notes
        self.db.flush()
        return session

    def get_open_session(self) -> CashSession | None:
        return (
            self.db.query(CashSession)
            .filter(
                CashSession.tenant_id == self._tenant_uuid,
                CashSession.user_id == self._user_uuid,
                CashSession.status == "open",
            )
            .first()
        )

    def list_sessions(self, user_id: str | None = None) -> list[CashSession]:
        query = self.db.query(CashSession).filter(
            CashSession.tenant_id == self._tenant_uuid
        )
        if user_id:
            query = query.filter(CashSession.user_id == uuid.UUID(user_id))
        return query.order_by(CashSession.opened_at.desc()).all()

    def get_session_summary(self, session_id: str) -> dict:
        session = self._get_session(session_id)
        txs = self.list_transactions(session_id)
        total_income = sum(t.amount for t in txs if t.type == "income")
        total_expense = sum(t.amount for t in txs if t.type == "expense")
        return {
            "session": session,
            "total_income": total_income,
            "total_expense": total_expense,
            "net": total_income - total_expense,
            "transactions": txs,
        }

    # ------------------------------------------------------------------
    # Transaction management
    # ------------------------------------------------------------------

    def add_transaction(
        self,
        session_id: str,
        type: str,
        amount: int,
        category: str,
        description: str,
        invoice_id: str | None = None,
        patient_id: str | None = None,
        payment_method: str | None = None,
    ) -> CashTransaction:
        session = self._get_session(session_id)
        if session.status != "open":
            raise CajaSessionNotOpenError("Solo se pueden registrar movimientos en turnos abiertos.")

        tx = CashTransaction(
            id=uuid.uuid4(),
            tenant_id=self._tenant_uuid,
            session_id=session.id,
            type=type,
            amount=amount,
            category=category,
            description=description,
            invoice_id=uuid.UUID(invoice_id) if invoice_id else None,
            patient_id=uuid.UUID(patient_id) if patient_id else None,
            payment_method=payment_method,
            created_by=self._user_uuid,
        )
        self.db.add(tx)
        self.db.flush()

        if type == "income" and invoice_id:
            self._apply_invoice_payment(invoice_id, amount)

        return tx

    def add_transaction_no_session(
        self,
        type: str,
        amount: int,
        category: str,
        description: str,
        invoice_id: str | None = None,
        patient_id: str | None = None,
        payment_method: str | None = None,
    ) -> CashTransaction:
        """Create a transaction without a session (used from Cartera when no shift is open)."""
        tx = CashTransaction(
            id=uuid.uuid4(),
            tenant_id=self._tenant_uuid,
            session_id=None,
            type=type,
            amount=amount,
            category=category,
            description=description,
            invoice_id=uuid.UUID(invoice_id) if invoice_id else None,
            patient_id=uuid.UUID(patient_id) if patient_id else None,
            payment_method=payment_method,
            created_by=self._user_uuid,
        )
        self.db.add(tx)
        self.db.flush()

        if type == "income" and invoice_id:
            self._apply_invoice_payment(invoice_id, amount)

        return tx

    def update_transaction(
        self,
        tx_id: str,
        amount: int | None = None,
        category: str | None = None,
        description: str | None = None,
    ) -> CashTransaction:
        tx = self._get_transaction(tx_id)
        if tx.type == "income" and tx.invoice_id and amount is not None:
            delta = amount - tx.amount
            if delta != 0:
                self._apply_invoice_payment(str(tx.invoice_id), delta)
        if amount is not None:
            tx.amount = amount
        if category is not None:
            tx.category = category
        if description is not None:
            tx.description = description
        self.db.flush()
        return tx

    def delete_transaction(self, tx_id: str) -> None:
        tx = self._get_transaction(tx_id)
        if tx.type == "income" and tx.invoice_id:
            self._apply_invoice_payment(str(tx.invoice_id), -tx.amount)
        self.db.delete(tx)
        self.db.flush()

    def list_transactions(self, session_id: str) -> list[CashTransaction]:
        session = self._get_session(session_id)
        return (
            self.db.query(CashTransaction)
            .filter(
                CashTransaction.tenant_id == self._tenant_uuid,
                CashTransaction.session_id == session.id,
            )
            .order_by(CashTransaction.created_at.asc())
            .all()
        )

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _apply_invoice_payment(self, invoice_id: str, delta: int) -> None:
        invoice = self.db.get(Invoice, uuid.UUID(invoice_id))
        if not invoice or invoice.tenant_id != self._tenant_uuid:
            return
        InvoiceService.apply_payment(invoice, delta)
        self.db.flush()

    def _get_session(self, session_id: str) -> CashSession:
        session = self.db.get(CashSession, uuid.UUID(session_id))
        if not session or session.tenant_id != self._tenant_uuid:
            raise CajaNotFoundError("Turno no encontrado.")
        return session

    def _get_transaction(self, tx_id: str) -> CashTransaction:
        tx = self.db.get(CashTransaction, uuid.UUID(tx_id))
        if not tx or tx.tenant_id != self._tenant_uuid:
            raise CajaNotFoundError("Transacción no encontrada.")
        return tx
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
cd psicogest/backend
pytest tests/test_caja_service.py -v
```

Expected: all 7 tests PASS

- [ ] **Step 5: Commit**

```bash
git add psicogest/backend/app/services/caja_service.py \
        psicogest/backend/tests/test_caja_service.py
git commit -m "feat: implement CajaService with session and transaction management"
```

---

## Task 4: CarteraService

**Files:**
- Create: `psicogest/backend/app/services/cartera_service.py`
- Create: `psicogest/backend/tests/test_cartera_service.py`

- [ ] **Step 1: Write failing tests for CarteraService**

Create `psicogest/backend/tests/test_cartera_service.py`:

```python
"""Tests for CarteraService — pending invoice management."""
import pytest
from sqlalchemy import text
from sqlalchemy.orm import Session

from tests.conftest import _create_tenant, _insert_patient
from app.services.cartera_service import CarteraService, CarteraNotFoundError


def _set_ctx(db: Session, tenant_id: str) -> None:
    db.execute(text("SET LOCAL app.tenant_id = :tid"), {"tid": tenant_id})


def _insert_invoice(
    db: Session, tenant_id: str, patient_id: str,
    total: int = 100_000, amount_paid: int = 0,
    payment_status: str = "unpaid"
) -> str:
    _set_ctx(db, tenant_id)
    result = db.execute(
        text("""
            INSERT INTO invoices (tenant_id, invoice_number, patient_id, status,
                subtotal_cop, tax_cop, total_cop, session_ids,
                amount_paid, payment_status)
            VALUES (:tid, :inv_num, :pid, 'issued',
                :total, 0, :total, '[]', :paid, :pstatus)
            RETURNING id
        """),
        {
            "tid": tenant_id, "pid": patient_id,
            "inv_num": f"INV-2026-{patient_id[:4]}",
            "total": total, "paid": amount_paid, "pstatus": payment_status,
        },
    )
    return str(result.mappings().one()["id"])


class TestListPending:
    def test_returns_unpaid_invoices(self, db, two_tenants):
        tid = two_tenants["tenant_a"]["id"]
        pid = two_tenants["patient_a_id"]
        _set_ctx(db, tid)
        _insert_invoice(db, tid, pid, total=80_000)
        svc = CarteraService(db, tid)

        items = svc.list_pending()
        assert len(items) == 1
        assert items[0]["total_cop"] == 80_000
        assert items[0]["balance"] == 80_000

    def test_excludes_paid_invoices(self, db, two_tenants):
        tid = two_tenants["tenant_a"]["id"]
        pid = two_tenants["patient_a_id"]
        _set_ctx(db, tid)
        _insert_invoice(db, tid, pid, total=80_000, amount_paid=80_000,
                        payment_status="paid")
        svc = CarteraService(db, tid)

        items = svc.list_pending()
        assert len(items) == 0

    def test_partial_payment_shows_correct_balance(self, db, two_tenants):
        tid = two_tenants["tenant_a"]["id"]
        pid = two_tenants["patient_a_id"]
        _set_ctx(db, tid)
        _insert_invoice(db, tid, pid, total=100_000, amount_paid=40_000,
                        payment_status="partial")
        svc = CarteraService(db, tid)

        items = svc.list_pending()
        assert len(items) == 1
        assert items[0]["balance"] == 60_000

    def test_tenant_isolation(self, db, two_tenants):
        tid_a = two_tenants["tenant_a"]["id"]
        tid_b = two_tenants["tenant_b"]["id"]
        pid_a = two_tenants["patient_a_id"]
        _set_ctx(db, tid_a)
        _insert_invoice(db, tid_a, pid_a)

        _set_ctx(db, tid_b)
        svc_b = CarteraService(db, tid_b)
        items = svc_b.list_pending()
        assert len(items) == 0


class TestGetSummary:
    def test_summary_totals(self, db, two_tenants):
        tid = two_tenants["tenant_a"]["id"]
        pid = two_tenants["patient_a_id"]
        _set_ctx(db, tid)
        _insert_invoice(db, tid, pid, total=100_000)
        svc = CarteraService(db, tid)

        summary = svc.get_summary()
        assert summary["total_pending"] == 100_000
        # Patient has payer_type 'PA' (particular)
        assert summary["particular_pending"] == 100_000
        assert summary["eps_pending"] == 0


class TestRegisterPayment:
    def test_register_payment_creates_transaction(self, db, two_tenants):
        tid = two_tenants["tenant_a"]["id"]
        uid = two_tenants["tenant_a"]["auth_user_id"]
        pid = two_tenants["patient_a_id"]
        _set_ctx(db, tid)
        inv_id = _insert_invoice(db, tid, pid, total=80_000)
        svc = CarteraService(db, tid)

        tx = svc.register_payment(
            invoice_id=inv_id,
            amount=80_000,
            description="Pago total desde cartera",
            user_id=uid,
        )
        db.flush()

        assert tx.type == "income"
        assert tx.amount == 80_000
        assert tx.session_id is None  # no open session

        result = db.execute(
            text("SELECT payment_status FROM invoices WHERE id = :id"),
            {"id": inv_id},
        ).mappings().one()
        assert result["payment_status"] == "paid"
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd psicogest/backend
pytest tests/test_cartera_service.py -v 2>&1 | head -20
```

Expected: `ImportError: cannot import name 'CarteraService'`

- [ ] **Step 3: Implement CarteraService**

Create `psicogest/backend/app/services/cartera_service.py`:

```python
"""CarteraService — pending invoice management and payment registration."""
from __future__ import annotations

import uuid

import sqlalchemy as sa
from sqlalchemy.orm import Session as DBSession

from app.models.cash_transaction import CashTransaction
from app.models.invoice import Invoice
from app.models.patient import Patient
from app.services.invoice_service import InvoiceService


class CarteraNotFoundError(Exception):
    pass


class CarteraService:
    def __init__(self, db: DBSession, tenant_id: str) -> None:
        self.db = db
        self.tenant_id = tenant_id
        self._tenant_uuid = uuid.UUID(tenant_id)

    def list_pending(
        self,
        payer_type: str | None = None,
        search: str | None = None,
        limit: int = 100,
    ) -> list[dict]:
        query = (
            self.db.query(Invoice, Patient)
            .join(Patient, Invoice.patient_id == Patient.id)
            .filter(
                Invoice.tenant_id == self._tenant_uuid,
                Invoice.payment_status.in_(["unpaid", "partial"]),
            )
        )
        if payer_type == "particular":
            query = query.filter(Patient.payer_type == "PA")
        elif payer_type == "eps":
            query = query.filter(Patient.payer_type != "PA")
        if search:
            pattern = f"%{search}%"
            query = query.filter(
                sa.or_(
                    Patient.first_surname.ilike(pattern),
                    Patient.first_name.ilike(pattern),
                    Patient.doc_number.ilike(pattern),
                )
            )
        rows = query.order_by(Invoice.created_at.desc()).limit(limit).all()
        return [
            {
                "invoice_id": str(inv.id),
                "invoice_number": inv.invoice_number,
                "issue_date": inv.issue_date.isoformat() if inv.issue_date else None,
                "total_cop": inv.total_cop,
                "amount_paid": inv.amount_paid,
                "balance": inv.total_cop - inv.amount_paid,
                "payment_status": inv.payment_status,
                "patient_id": str(pat.id),
                "patient_name": " ".join(filter(None, [
                    pat.first_surname, pat.second_surname
                ])) + f", {pat.first_name}",
                "payer_type": pat.payer_type,
                "eps_name": getattr(pat, "eps_name", None),
            }
            for inv, pat in rows
        ]

    def get_summary(self) -> dict:
        base = (
            self.db.query(
                sa.func.coalesce(
                    sa.func.sum(Invoice.total_cop - Invoice.amount_paid), 0
                )
            )
            .join(Patient, Invoice.patient_id == Patient.id)
            .filter(
                Invoice.tenant_id == self._tenant_uuid,
                Invoice.payment_status.in_(["unpaid", "partial"]),
            )
        )
        particular = base.filter(Patient.payer_type == "PA").scalar()
        eps = base.filter(Patient.payer_type != "PA").scalar()
        return {
            "particular_pending": int(particular),
            "eps_pending": int(eps),
            "total_pending": int(particular) + int(eps),
        }

    def register_payment(
        self,
        invoice_id: str,
        amount: int,
        description: str,
        session_id: str | None = None,
        user_id: str | None = None,
    ) -> CashTransaction:
        invoice = self.db.get(Invoice, uuid.UUID(invoice_id))
        if not invoice or invoice.tenant_id != self._tenant_uuid:
            raise CarteraNotFoundError("Factura no encontrada.")

        patient = self.db.get(Patient, invoice.patient_id)
        category = "PA" if patient and patient.payer_type == "PA" else "eps"

        tx = CashTransaction(
            id=uuid.uuid4(),
            tenant_id=self._tenant_uuid,
            session_id=uuid.UUID(session_id) if session_id else None,
            type="income",
            amount=amount,
            category=category,
            description=description,
            invoice_id=invoice.id,
            patient_id=invoice.patient_id,
            created_by=uuid.UUID(user_id) if user_id else uuid.uuid4(),
        )
        self.db.add(tx)
        self.db.flush()

        InvoiceService.apply_payment(invoice, amount)
        self.db.flush()

        return tx
```

- [ ] **Step 4: Run all service tests**

```bash
cd psicogest/backend
pytest tests/test_caja_service.py tests/test_cartera_service.py -v
```

Expected: all tests PASS

- [ ] **Step 5: Commit**

```bash
git add psicogest/backend/app/services/cartera_service.py \
        psicogest/backend/tests/test_cartera_service.py
git commit -m "feat: implement CarteraService with pending invoices and payment registration"
```

---

## Task 5: Pydantic schemas for Caja and Cartera

**Files:**
- Create: `psicogest/backend/app/schemas/caja.py`
- Create: `psicogest/backend/app/schemas/cartera.py`

- [ ] **Step 1: Create caja.py schemas**

Create `psicogest/backend/app/schemas/caja.py`:

```python
"""Pydantic schemas for Caja endpoints."""
import uuid
from datetime import datetime

from pydantic import BaseModel, Field


class CashSessionOpen(BaseModel):
    pass  # No input fields — user_id comes from JWT


class CashSessionClose(BaseModel):
    notes: str | None = None


class CashSessionSummary(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    user_id: uuid.UUID
    opened_at: datetime
    closed_at: datetime | None
    status: str
    notes: str | None
    created_at: datetime


class CashSessionDetail(CashSessionSummary):
    total_income: int
    total_expense: int
    net: int
    transactions: list["CashTransactionResponse"]


class CashTransactionCreate(BaseModel):
    type: str  # "income" | "expense"
    amount: int = Field(..., gt=0)
    category: str
    description: str
    invoice_id: uuid.UUID | None = None
    patient_id: uuid.UUID | None = None
    payment_method: str | None = None  # "efectivo" | "transferencia" | "tarjeta"


class CashTransactionUpdate(BaseModel):
    amount: int | None = Field(None, gt=0)
    category: str | None = None
    description: str | None = None


class CashTransactionResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    session_id: uuid.UUID | None
    type: str
    amount: int
    category: str
    description: str
    invoice_id: uuid.UUID | None
    patient_id: uuid.UUID | None
    payment_method: str | None
    created_by: uuid.UUID
    created_at: datetime
```

- [ ] **Step 2: Create cartera.py schemas**

Create `psicogest/backend/app/schemas/cartera.py`:

```python
"""Pydantic schemas for Cartera endpoints."""
import uuid
from pydantic import BaseModel, Field


class CarteraItem(BaseModel):
    invoice_id: str
    invoice_number: str
    issue_date: str | None
    total_cop: int
    amount_paid: int
    balance: int
    payment_status: str
    patient_id: str
    patient_name: str
    payer_type: str
    eps_name: str | None


class CarteraListResponse(BaseModel):
    items: list[CarteraItem]
    total: int


class CarteraSummary(BaseModel):
    particular_pending: int
    eps_pending: int
    total_pending: int


class CarteraPaymentCreate(BaseModel):
    amount: int = Field(..., gt=0)
    description: str
    session_id: uuid.UUID | None = None
```

- [ ] **Step 3: Commit**

```bash
git add psicogest/backend/app/schemas/caja.py \
        psicogest/backend/app/schemas/cartera.py
git commit -m "feat: add Pydantic schemas for Caja and Cartera endpoints"
```

---

## Task 6: API routers + register in main.py

**Files:**
- Create: `psicogest/backend/app/api/v1/caja.py`
- Create: `psicogest/backend/app/api/v1/cartera.py`
- Modify: `psicogest/backend/app/main.py`
- Modify: `psicogest/backend/app/api/v1/invoices.py` — add `payment_pending` filter

- [ ] **Step 1: Create Caja router**

Create `psicogest/backend/app/api/v1/caja.py`:

```python
"""Caja router — shift management and transaction recording."""
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status

from app.core.deps import get_tenant_db, TenantDB
from app.schemas.caja import (
    CashSessionClose,
    CashSessionDetail,
    CashSessionSummary,
    CashTransactionCreate,
    CashTransactionResponse,
    CashTransactionUpdate,
)
from app.services.caja_service import (
    CajaService,
    CajaNotFoundError,
    CajaSessionAlreadyOpenError,
    CajaSessionNotOpenError,
)

router = APIRouter(prefix="/caja", tags=["caja"])


def _svc(ctx: TenantDB) -> CajaService:
    return CajaService(ctx.db, ctx.tenant.tenant_id, ctx.tenant.user_id)


@router.get("/sessions/open", response_model=CashSessionSummary | None)
def get_open_session(ctx: Annotated[TenantDB, Depends(get_tenant_db)]):
    session = _svc(ctx).get_open_session()
    if not session:
        return None
    return CashSessionSummary.model_validate(session)


@router.post("/sessions", response_model=CashSessionSummary, status_code=status.HTTP_201_CREATED)
def open_session(ctx: Annotated[TenantDB, Depends(get_tenant_db)]):
    try:
        session = _svc(ctx).open_session()
        ctx.db.commit()
        ctx.db.refresh(session)
        return CashSessionSummary.model_validate(session)
    except CajaSessionAlreadyOpenError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc))


@router.get("/sessions", response_model=list[CashSessionSummary])
def list_sessions(ctx: Annotated[TenantDB, Depends(get_tenant_db)]):
    sessions = _svc(ctx).list_sessions()
    return [CashSessionSummary.model_validate(s) for s in sessions]


@router.get("/sessions/{session_id}", response_model=CashSessionDetail)
def get_session(session_id: str, ctx: Annotated[TenantDB, Depends(get_tenant_db)]):
    try:
        summary = _svc(ctx).get_session_summary(session_id)
        detail = CashSessionDetail.model_validate(summary["session"])
        detail.total_income = summary["total_income"]
        detail.total_expense = summary["total_expense"]
        detail.net = summary["net"]
        detail.transactions = [
            CashTransactionResponse.model_validate(t) for t in summary["transactions"]
        ]
        return detail
    except CajaNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Turno no encontrado.")


@router.put("/sessions/{session_id}/close", response_model=CashSessionSummary)
def close_session(
    session_id: str,
    body: CashSessionClose,
    ctx: Annotated[TenantDB, Depends(get_tenant_db)],
):
    try:
        session = _svc(ctx).close_session(session_id, notes=body.notes)
        ctx.db.commit()
        ctx.db.refresh(session)
        return CashSessionSummary.model_validate(session)
    except CajaNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Turno no encontrado.")
    except CajaSessionNotOpenError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc))


@router.get("/sessions/{session_id}/transactions", response_model=list[CashTransactionResponse])
def list_transactions(session_id: str, ctx: Annotated[TenantDB, Depends(get_tenant_db)]):
    try:
        txs = _svc(ctx).list_transactions(session_id)
        return [CashTransactionResponse.model_validate(t) for t in txs]
    except CajaNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Turno no encontrado.")


@router.post(
    "/sessions/{session_id}/transactions",
    response_model=CashTransactionResponse,
    status_code=status.HTTP_201_CREATED,
)
def add_transaction(
    session_id: str,
    body: CashTransactionCreate,
    ctx: Annotated[TenantDB, Depends(get_tenant_db)],
):
    try:
        tx = _svc(ctx).add_transaction(
            session_id,
            type=body.type,
            amount=body.amount,
            category=body.category,
            description=body.description,
            invoice_id=str(body.invoice_id) if body.invoice_id else None,
            patient_id=str(body.patient_id) if body.patient_id else None,
            payment_method=body.payment_method,
        )
        ctx.db.commit()
        ctx.db.refresh(tx)
        return CashTransactionResponse.model_validate(tx)
    except CajaNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Turno no encontrado.")
    except CajaSessionNotOpenError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc))


@router.put("/transactions/{tx_id}", response_model=CashTransactionResponse)
def update_transaction(
    tx_id: str,
    body: CashTransactionUpdate,
    ctx: Annotated[TenantDB, Depends(get_tenant_db)],
):
    try:
        tx = _svc(ctx).update_transaction(
            tx_id,
            amount=body.amount,
            category=body.category,
            description=body.description,
        )
        ctx.db.commit()
        ctx.db.refresh(tx)
        return CashTransactionResponse.model_validate(tx)
    except CajaNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Transacción no encontrada.")


@router.delete("/transactions/{tx_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_transaction(tx_id: str, ctx: Annotated[TenantDB, Depends(get_tenant_db)]):
    try:
        _svc(ctx).delete_transaction(tx_id)
        ctx.db.commit()
    except CajaNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Transacción no encontrada.")
```

- [ ] **Step 2: Create Cartera router**

Create `psicogest/backend/app/api/v1/cartera.py`:

```python
"""Cartera router — pending invoice management."""
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.core.deps import get_tenant_db, TenantDB
from app.schemas.cartera import (
    CarteraItem,
    CarteraListResponse,
    CarteraPaymentCreate,
    CarteraSummary,
)
from app.schemas.caja import CashTransactionResponse
from app.services.cartera_service import CarteraService, CarteraNotFoundError

router = APIRouter(prefix="/cartera", tags=["cartera"])


def _svc(ctx: TenantDB) -> CarteraService:
    return CarteraService(ctx.db, ctx.tenant.tenant_id)


@router.get("", response_model=CarteraListResponse)
def list_pending(
    ctx: Annotated[TenantDB, Depends(get_tenant_db)],
    payer_type: str | None = Query(None, description="'particular' or 'eps'"),
    search: str | None = Query(None),
):
    items = _svc(ctx).list_pending(payer_type=payer_type, search=search)
    return CarteraListResponse(
        items=[CarteraItem(**i) for i in items],
        total=len(items),
    )


@router.get("/summary", response_model=CarteraSummary)
def get_summary(ctx: Annotated[TenantDB, Depends(get_tenant_db)]):
    return CarteraSummary(**_svc(ctx).get_summary())


@router.post(
    "/invoices/{invoice_id}/payments",
    response_model=CashTransactionResponse,
    status_code=status.HTTP_201_CREATED,
)
def register_payment(
    invoice_id: str,
    body: CarteraPaymentCreate,
    ctx: Annotated[TenantDB, Depends(get_tenant_db)],
):
    try:
        tx = _svc(ctx).register_payment(
            invoice_id=invoice_id,
            amount=body.amount,
            description=body.description,
            session_id=str(body.session_id) if body.session_id else None,
            user_id=ctx.tenant.user_id,
        )
        ctx.db.commit()
        ctx.db.refresh(tx)
        return CashTransactionResponse.model_validate(tx)
    except CarteraNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
```

- [ ] **Step 3: Add `payment_pending` filter to invoices endpoint**

In `psicogest/backend/app/api/v1/invoices.py`, update `list_invoices`:

```python
@router.get("", response_model=InvoiceListResponse)
def list_invoices(
    ctx: Annotated[TenantDB, Depends(get_tenant_db)],
    patient_id: str | None = Query(None),
    status: str | None = Query(None),
    payment_pending: bool = Query(False),
    limit: int = Query(20, ge=1, le=100),
) -> InvoiceListResponse:
    if patient_id:
        invoices = _service(ctx).list_by_patient(patient_id)
        if payment_pending:
            invoices = [i for i in invoices if i.payment_status != "paid"]
    else:
        invoices = _service(ctx).list_all(status=status, limit=limit)
    return InvoiceListResponse(
        items=[InvoiceSummary.model_validate(i) for i in invoices],
        total=len(invoices),
    )
```

- [ ] **Step 4: Register routers in main.py**

In `psicogest/backend/app/main.py`, add at the top with other imports:

```python
from app.api.v1.caja import router as caja_router
from app.api.v1.cartera import router as cartera_router
```

And at the bottom with other `include_router` calls:

```python
app.include_router(caja_router, prefix="/api/v1")
app.include_router(cartera_router, prefix="/api/v1")
```

- [ ] **Step 5: Start backend and verify endpoints appear in docs**

```bash
cd psicogest/backend
uvicorn app.main:app --reload --port 8000
```

Open `http://localhost:8000/docs` and verify `/caja` and `/cartera` sections appear.

- [ ] **Step 6: Commit**

```bash
git add psicogest/backend/app/api/v1/caja.py \
        psicogest/backend/app/api/v1/cartera.py \
        psicogest/backend/app/api/v1/invoices.py \
        psicogest/backend/app/main.py
git commit -m "feat: add Caja and Cartera HTTP routers, register in main"
```

---

## Task 7: Frontend — API client types and methods

**Files:**
- Modify: `psicogest/frontend/src/lib/api.ts`

- [ ] **Step 1: Add Caja + Cartera types to api.ts**

At the end of the interfaces section in `psicogest/frontend/src/lib/api.ts` (before the `api` object export), add:

```typescript
// --- Caja -----------------------------------------------------------------

export type CashSessionStatus = "open" | "closed";
export type CashTransactionType = "income" | "expense";

export interface CashSessionSummary {
  id: string;
  user_id: string;
  opened_at: string;
  closed_at: string | null;
  status: CashSessionStatus;
  notes: string | null;
  created_at: string;
}

export interface CashSessionDetail extends CashSessionSummary {
  total_income: number;
  total_expense: number;
  net: number;
  transactions: CashTransactionResponse[];
}

export interface CashTransactionResponse {
  id: string;
  session_id: string | null;
  type: CashTransactionType;
  amount: number;
  category: string;
  description: string;
  invoice_id: string | null;
  patient_id: string | null;
  payment_method: string | null;
  created_by: string;
  created_at: string;
}

export interface CashTransactionCreatePayload {
  type: CashTransactionType;
  amount: number;
  category: string;
  description: string;
  invoice_id?: string;
  patient_id?: string;
  payment_method?: string;
}

// --- Cartera --------------------------------------------------------------

export interface CarteraItem {
  invoice_id: string;
  invoice_number: string;
  issue_date: string | null;
  total_cop: number;
  amount_paid: number;
  balance: number;
  payment_status: string;
  patient_id: string;
  patient_name: string;
  payer_type: string;
  eps_name: string | null;
}

export interface CarteraListResponse {
  items: CarteraItem[];
  total: number;
}

export interface CarteraSummary {
  particular_pending: number;
  eps_pending: number;
  total_pending: number;
}
```

- [ ] **Step 2: Add API methods for Caja and Cartera inside the `api` object**

Inside the `api` object in `api.ts` (alongside existing `invoices`, `patients`, etc. sections), add:

```typescript
  caja: {
    getOpenSession: () =>
      request<CashSessionSummary | null>("GET", "/caja/sessions/open"),
    openSession: () =>
      request<CashSessionSummary>("POST", "/caja/sessions"),
    listSessions: () =>
      request<CashSessionSummary[]>("GET", "/caja/sessions"),
    getSession: (id: string) =>
      request<CashSessionDetail>("GET", `/caja/sessions/${id}`),
    closeSession: (id: string, notes?: string) =>
      request<CashSessionSummary>("PUT", `/caja/sessions/${id}/close`, { notes }),
    addTransaction: (sessionId: string, body: CashTransactionCreatePayload) =>
      request<CashTransactionResponse>("POST", `/caja/sessions/${sessionId}/transactions`, body),
    updateTransaction: (txId: string, body: { amount?: number; category?: string; description?: string }) =>
      request<CashTransactionResponse>("PUT", `/caja/transactions/${txId}`, body),
    deleteTransaction: (txId: string) =>
      request<void>("DELETE", `/caja/transactions/${txId}`),
    listTransactions: (sessionId: string) =>
      request<CashTransactionResponse[]>("GET", `/caja/sessions/${sessionId}/transactions`),
  },

  cartera: {
    listPending: (params?: { payer_type?: string; search?: string }) => {
      const q = new URLSearchParams();
      if (params?.payer_type) q.set("payer_type", params.payer_type);
      if (params?.search) q.set("search", params.search);
      return request<CarteraListResponse>("GET", `/cartera?${q}`);
    },
    getSummary: () =>
      request<CarteraSummary>("GET", "/cartera/summary"),
    registerPayment: (invoiceId: string, body: { amount: number; description: string; session_id?: string }) =>
      request<CashTransactionResponse>("POST", `/cartera/invoices/${invoiceId}/payments`, body),
  },
```

- [ ] **Step 3: Also update InvoiceSummary type to include new fields**

In the existing `InvoiceSummary` interface in `api.ts`, add:

```typescript
export interface InvoiceSummary {
  id: string;
  invoice_number: string;
  patient_id: string;
  status: InvoiceStatus;
  payment_status: string;   // NEW: "unpaid" | "partial" | "paid"
  amount_paid: number;      // NEW
  issue_date: string | null;
  due_date: string | null;
  subtotal_cop: number;
  tax_cop: number;
  total_cop: number;
  created_at: string;
}
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd psicogest/frontend
npm run build 2>&1 | tail -20
```

Expected: no TypeScript errors

- [ ] **Step 5: Commit**

```bash
git add psicogest/frontend/src/lib/api.ts
git commit -m "feat: add Caja and Cartera types and API methods to frontend client"
```

---

## Task 8: Frontend — CajaPage

**Files:**
- Create: `psicogest/frontend/src/pages/caja/CajaPage.tsx`

- [ ] **Step 1: Create CajaPage**

Create `psicogest/frontend/src/pages/caja/CajaPage.tsx`:

```tsx
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { api, CashSessionSummary, CashTransactionResponse, InvoiceSummary, PatientSummary } from "@/lib/api";

const formatCOP = (v: number) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(v);

const formatTime = (iso: string) =>
  new Date(iso).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" });

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("es-CO");

// ---- Modals ---------------------------------------------------------------

function AddExpenseModal({ sessionId, onClose }: { sessionId: string; onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ category: "servicios", amount: "", description: "" });

  const mutation = useMutation({
    mutationFn: () =>
      api.caja.addTransaction(sessionId, {
        type: "expense",
        amount: parseInt(form.amount.replace(/\D/g, ""), 10),
        category: form.category,
        description: form.description,
      }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["caja-session"] }); onClose(); },
  });

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm space-y-4">
        <h2 className="text-lg font-semibold text-[#1E3A5F]">Registrar gasto</h2>
        <div>
          <Label>Categoría</Label>
          <select
            className="w-full h-10 px-3 border rounded-md mt-1"
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
          >
            <option value="nomina">Nómina</option>
            <option value="servicios">Servicios</option>
            <option value="compras">Compras</option>
            <option value="otro">Otro</option>
          </select>
        </div>
        <div>
          <Label>Monto (COP)</Label>
          <Input
            type="number"
            min={1}
            value={form.amount}
            onChange={(e) => setForm({ ...form, amount: e.target.value })}
          />
        </div>
        <div>
          <Label>Descripción</Label>
          <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </div>
        <div className="flex gap-2 pt-2">
          <Button variant="outline" className="flex-1" onClick={onClose}>Cancelar</Button>
          <Button
            className="flex-1"
            disabled={!form.amount || !form.description || mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            Guardar
          </Button>
        </div>
      </div>
    </div>
  );
}

function AddIncomeModal({ sessionId, onClose }: { sessionId: string; onClose: () => void }) {
  const qc = useQueryClient();
  const [patient, setPatient] = useState<PatientSummary | null>(null);
  const [invoice, setInvoice] = useState<InvoiceSummary | null>(null);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("efectivo");
  const [search, setSearch] = useState("");

  const { data: searchResults } = useQuery({
    queryKey: ["patient-caja-search", search],
    queryFn: () => api.patients.list({ search, page_size: 6 }),
    enabled: search.length >= 2 && !patient,
  });

  const { data: invoicesData } = useQuery({
    queryKey: ["pending-invoices-caja", patient?.id],
    queryFn: () => api.invoices.list({ patient_id: patient!.id, payment_pending: true }),
    enabled: !!patient,
  });

  const mutation = useMutation({
    mutationFn: () =>
      api.caja.addTransaction(sessionId, {
        type: "income",
        amount: parseInt(amount, 10),
        category: patient?.payer_type === "PA" ? "PA" : "eps",
        description: `Pago factura ${invoice?.invoice_number}`,
        invoice_id: invoice?.id,
        patient_id: patient?.id,
        payment_method: method,
      }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["caja-session"] }); onClose(); },
  });

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm space-y-4">
        <h2 className="text-lg font-semibold text-[#1E3A5F]">Registrar ingreso</h2>

        {!patient ? (
          <div>
            <Label>Buscar paciente</Label>
            <Input
              placeholder="Nombre o documento..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="mt-1"
            />
            {searchResults?.items.map((p) => (
              <button
                key={p.id}
                type="button"
                className="w-full text-left px-3 py-2 text-sm border-b hover:bg-slate-50"
                onClick={() => { setPatient(p); setSearch(""); }}
              >
                {[p.first_surname, p.second_surname].filter(Boolean).join(" ")}, {p.first_name}
              </button>
            ))}
          </div>
        ) : (
          <div className="text-sm bg-slate-50 px-3 py-2 rounded flex justify-between items-center">
            <span>{[patient.first_surname, patient.second_surname].filter(Boolean).join(" ")}, {patient.first_name}</span>
            <button type="button" className="text-muted-foreground ml-2" onClick={() => { setPatient(null); setInvoice(null); }}>✕</button>
          </div>
        )}

        {patient && (
          <div>
            <Label>Factura pendiente</Label>
            <select
              className="w-full h-10 px-3 border rounded-md mt-1"
              value={invoice?.id ?? ""}
              onChange={(e) => {
                const inv = invoicesData?.items.find((i) => i.id === e.target.value) ?? null;
                setInvoice(inv);
                if (inv) setAmount(String(inv.total_cop - inv.amount_paid));
              }}
            >
              <option value="">Seleccionar factura...</option>
              {invoicesData?.items.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.invoice_number} — {formatCOP(i.total_cop - i.amount_paid)} pendiente
                </option>
              ))}
            </select>
          </div>
        )}

        <div>
          <Label>Monto (COP)</Label>
          <Input type="number" min={1} value={amount} onChange={(e) => setAmount(e.target.value)} />
        </div>

        <div>
          <Label>Método de pago</Label>
          <select
            className="w-full h-10 px-3 border rounded-md mt-1"
            value={method}
            onChange={(e) => setMethod(e.target.value)}
          >
            <option value="efectivo">Efectivo</option>
            <option value="transferencia">Transferencia</option>
            <option value="tarjeta">Tarjeta</option>
          </select>
        </div>

        <div className="flex gap-2 pt-2">
          <Button variant="outline" className="flex-1" onClick={onClose}>Cancelar</Button>
          <Button
            className="flex-1"
            disabled={!amount || !patient || mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            Guardar
          </Button>
        </div>
      </div>
    </div>
  );
}

// ---- Open session view ----------------------------------------------------

function OpenSessionView({ session }: { session: CashSessionSummary }) {
  const qc = useQueryClient();
  const [showExpense, setShowExpense] = useState(false);
  const [showIncome, setShowIncome] = useState(false);
  const [closingNotes, setClosingNotes] = useState("");
  const [confirmClose, setConfirmClose] = useState(false);

  const { data: detail, isLoading } = useQuery({
    queryKey: ["caja-session", session.id],
    queryFn: () => api.caja.getSession(session.id),
  });

  const closeMutation = useMutation({
    mutationFn: () => api.caja.closeSession(session.id, closingNotes || undefined),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["caja-open"] }); qc.invalidateQueries({ queryKey: ["caja-sessions"] }); },
  });

  const deleteMutation = useMutation({
    mutationFn: (txId: string) => api.caja.deleteTransaction(txId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["caja-session"] }),
  });

  const txTypeBadge = (type: string) =>
    type === "income"
      ? <span className="px-2 py-0.5 rounded-full text-xs bg-green-100 text-green-800">Ingreso</span>
      : <span className="px-2 py-0.5 rounded-full text-xs bg-red-100 text-red-800">Gasto</span>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">Turno abierto desde las {formatTime(session.opened_at)}</p>
        </div>
        <Button variant="outline" onClick={() => setConfirmClose(true)}>Cerrar turno</Button>
      </div>

      {confirmClose && (
        <div className="border rounded-lg p-4 space-y-3 bg-yellow-50">
          <p className="text-sm font-medium">¿Cerrar el turno ahora?</p>
          <Input placeholder="Observaciones (opcional)" value={closingNotes} onChange={(e) => setClosingNotes(e.target.value)} />
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setConfirmClose(false)}>No</Button>
            <Button size="sm" onClick={() => closeMutation.mutate()} disabled={closeMutation.isPending}>Sí, cerrar</Button>
          </div>
        </div>
      )}

      {isLoading ? (
        <Skeleton className="h-24" />
      ) : detail ? (
        <>
          <div className="grid grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-4">
                <p className="text-xs text-muted-foreground">Ingresos</p>
                <p className="text-xl font-bold text-green-700">{formatCOP(detail.total_income)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <p className="text-xs text-muted-foreground">Egresos</p>
                <p className="text-xl font-bold text-red-700">{formatCOP(detail.total_expense)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <p className="text-xs text-muted-foreground">Neto</p>
                <p className={`text-xl font-bold ${detail.net >= 0 ? "text-[#1E3A5F]" : "text-red-700"}`}>{formatCOP(detail.net)}</p>
              </CardContent>
            </Card>
          </div>

          <div className="flex gap-2">
            <Button onClick={() => setShowIncome(true)}>+ Registrar ingreso</Button>
            <Button variant="outline" onClick={() => setShowExpense(true)}>+ Registrar gasto</Button>
          </div>

          <div className="space-y-2">
            {detail.transactions.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">Sin movimientos aún</p>
            ) : (
              detail.transactions.map((tx: CashTransactionResponse) => (
                <div key={tx.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    {txTypeBadge(tx.type)}
                    <div>
                      <p className="text-sm font-medium">{tx.description}</p>
                      <p className="text-xs text-muted-foreground">{tx.category} · {formatTime(tx.created_at)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`font-semibold ${tx.type === "income" ? "text-green-700" : "text-red-700"}`}>
                      {tx.type === "income" ? "+" : "-"}{formatCOP(tx.amount)}
                    </span>
                    <button
                      type="button"
                      className="text-muted-foreground hover:text-red-600 text-xs"
                      onClick={() => deleteMutation.mutate(tx.id)}
                    >
                      Eliminar
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      ) : null}

      {showExpense && <AddExpenseModal sessionId={session.id} onClose={() => setShowExpense(false)} />}
      {showIncome && <AddIncomeModal sessionId={session.id} onClose={() => setShowIncome(false)} />}
    </div>
  );
}

// ---- Main page ------------------------------------------------------------

export function CajaPage() {
  const qc = useQueryClient();

  const { data: openSession, isLoading } = useQuery({
    queryKey: ["caja-open"],
    queryFn: () => api.caja.getOpenSession(),
  });

  const { data: sessions } = useQuery({
    queryKey: ["caja-sessions"],
    queryFn: () => api.caja.listSessions(),
  });

  const openMutation = useMutation({
    mutationFn: () => api.caja.openSession(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["caja-open"] });
      qc.invalidateQueries({ queryKey: ["caja-sessions"] });
    },
  });

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[#1E3A5F]">Caja</h1>
        <p className="text-muted-foreground mt-1">Control de turnos, ingresos y egresos del día</p>
      </div>

      {isLoading ? (
        <Skeleton className="h-32" />
      ) : openSession ? (
        <Card>
          <CardHeader><CardTitle>Turno activo</CardTitle></CardHeader>
          <CardContent>
            <OpenSessionView session={openSession} />
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="pt-6 flex flex-col items-center gap-4 py-12">
            <p className="text-muted-foreground">No hay un turno abierto para hoy</p>
            <Button size="lg" onClick={() => openMutation.mutate()} disabled={openMutation.isPending}>
              Abrir turno — {new Date().toLocaleDateString("es-CO")}
            </Button>
          </CardContent>
        </Card>
      )}

      {sessions && sessions.length > 0 && (
        <Card className="mt-6">
          <CardHeader><CardTitle>Historial de turnos</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {sessions.filter((s) => s.status === "closed").map((s) => (
                <div key={s.id} className="flex items-center justify-between p-3 border rounded-lg text-sm">
                  <span>{formatDate(s.opened_at)}</span>
                  <span className="text-muted-foreground">
                    {formatTime(s.opened_at)} – {s.closed_at ? formatTime(s.closed_at) : "—"}
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-xs bg-slate-100">Cerrado</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add psicogest/frontend/src/pages/caja/CajaPage.tsx
git commit -m "feat: add CajaPage — shift control with income and expense modals"
```

---

## Task 9: Frontend — CarteraPage

**Files:**
- Create: `psicogest/frontend/src/pages/cartera/CarteraPage.tsx`

- [ ] **Step 1: Create CarteraPage**

Create `psicogest/frontend/src/pages/cartera/CarteraPage.tsx`:

```tsx
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { api, CarteraItem } from "@/lib/api";

const formatCOP = (v: number) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(v);

const TABS = [
  { key: undefined, label: "Todos" },
  { key: "particular", label: "Particular" },
  { key: "eps", label: "EPS / Convenio" },
] as const;

function AbonarModal({ item, openSessionId, onClose }: {
  item: CarteraItem;
  openSessionId: string | null;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [amount, setAmount] = useState(String(item.balance));
  const [description, setDescription] = useState("");

  const mutation = useMutation({
    mutationFn: () =>
      api.cartera.registerPayment(item.invoice_id, {
        amount: parseInt(amount, 10),
        description: description || `Abono factura ${item.invoice_number}`,
        session_id: openSessionId ?? undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cartera"] });
      qc.invalidateQueries({ queryKey: ["cartera-summary"] });
      qc.invalidateQueries({ queryKey: ["caja-session"] });
      onClose();
    },
  });

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm space-y-4">
        <h2 className="text-lg font-semibold text-[#1E3A5F]">Registrar abono</h2>
        <div className="bg-slate-50 rounded-lg px-3 py-2 text-sm space-y-1">
          <p className="font-medium">{item.patient_name}</p>
          <p className="text-muted-foreground">{item.invoice_number} · Saldo: {formatCOP(item.balance)}</p>
        </div>
        <div>
          <Label>Monto del abono (COP)</Label>
          <Input
            type="number"
            min={1}
            max={item.balance}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="mt-1"
          />
        </div>
        <div>
          <Label>Descripción (opcional)</Label>
          <Input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={`Abono factura ${item.invoice_number}`}
            className="mt-1"
          />
        </div>
        {!openSessionId && (
          <p className="text-xs text-amber-600">Sin turno abierto — el abono se registrará como movimiento administrativo.</p>
        )}
        <div className="flex gap-2 pt-2">
          <Button variant="outline" className="flex-1" onClick={onClose}>Cancelar</Button>
          <Button
            className="flex-1"
            disabled={!amount || mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            Registrar
          </Button>
        </div>
      </div>
    </div>
  );
}

export function CarteraPage() {
  const [activeTab, setActiveTab] = useState<string | undefined>(undefined);
  const [search, setSearch] = useState("");
  const [abonarItem, setAbonarItem] = useState<CarteraItem | null>(null);

  const { data: summary } = useQuery({
    queryKey: ["cartera-summary"],
    queryFn: () => api.cartera.getSummary(),
  });

  const { data: listData, isLoading } = useQuery({
    queryKey: ["cartera", activeTab, search],
    queryFn: () => api.cartera.listPending({ payer_type: activeTab, search: search || undefined }),
  });

  const { data: openSession } = useQuery({
    queryKey: ["caja-open"],
    queryFn: () => api.caja.getOpenSession(),
  });

  const statusBadge = (status: string) => {
    if (status === "partial") return <span className="px-2 py-0.5 rounded-full text-xs bg-yellow-100 text-yellow-800">Parcial</span>;
    return <span className="px-2 py-0.5 rounded-full text-xs bg-red-100 text-red-800">Pendiente</span>;
  };

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[#1E3A5F]">Cartera</h1>
        <p className="text-muted-foreground mt-1">Facturas con saldo pendiente de cobro</p>
      </div>

      {summary && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          <Card>
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground">Cartera particular</p>
              <p className="text-xl font-bold text-[#1E3A5F]">{formatCOP(summary.particular_pending)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground">Cartera EPS</p>
              <p className="text-xl font-bold text-[#1E3A5F]">{formatCOP(summary.eps_pending)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground">Total cartera</p>
              <p className="text-2xl font-bold text-[#1E3A5F]">{formatCOP(summary.total_pending)}</p>
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex gap-1">
              {TABS.map((t) => (
                <button
                  key={String(t.key)}
                  type="button"
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    activeTab === t.key
                      ? "bg-[#1E3A5F] text-white"
                      : "text-muted-foreground hover:bg-slate-100"
                  }`}
                  onClick={() => setActiveTab(t.key)}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <Input
              className="w-56"
              placeholder="Buscar paciente..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-16" />)}
            </div>
          ) : !listData || listData.items.length === 0 ? (
            <EmptyState title="Sin cartera pendiente" description="Todas las facturas están al día." icon="✅" />
          ) : (
            <div className="space-y-2">
              {listData.items.map((item) => (
                <div key={item.invoice_id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <p className="font-medium text-sm">{item.patient_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.invoice_number}
                      {item.eps_name && ` · ${item.eps_name}`}
                      {item.issue_date && ` · ${new Date(item.issue_date).toLocaleDateString("es-CO")}`}
                    </p>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                      <span>Total: {formatCOP(item.total_cop)}</span>
                      <span>Pagado: {formatCOP(item.amount_paid)}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {statusBadge(item.payment_status)}
                    <span className="font-bold text-red-700">{formatCOP(item.balance)}</span>
                    <Button size="sm" onClick={() => setAbonarItem(item)}>Abonar</Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {abonarItem && (
        <AbonarModal
          item={abonarItem}
          openSessionId={openSession?.id ?? null}
          onClose={() => setAbonarItem(null)}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add psicogest/frontend/src/pages/cartera/CarteraPage.tsx
git commit -m "feat: add CarteraPage with pending invoices, summary cards and payment modal"
```

---

## Task 10: Frontend — routing and navigation

**Files:**
- Modify: `psicogest/frontend/src/App.tsx`
- Modify: `psicogest/frontend/src/components/layout/Sidebar.tsx`

- [ ] **Step 1: Add routes to App.tsx**

In `psicogest/frontend/src/App.tsx`, add imports at the top:

```typescript
import { CajaPage } from "@/pages/caja/CajaPage";
import { CarteraPage } from "@/pages/cartera/CarteraPage";
```

Inside the protected `<Route>` block (alongside other route declarations), add:

```tsx
<Route path="/caja" element={<CajaPage />} />
<Route path="/cartera" element={<CarteraPage />} />
```

- [ ] **Step 2: Add nav items to Sidebar.tsx**

In `psicogest/frontend/src/components/layout/Sidebar.tsx`, update the `navItems` array to add Caja and Cartera after Facturas:

```typescript
const navItems: NavItem[] = [
  { to: "/dashboard", label: "Dashboard", icon: "📊" },
  { to: "/agenda", label: "Agenda", icon: "📅" },
  { to: "/patients", label: "Pacientes", icon: "👤" },
  { to: "/sessions", label: "Sesiones activas", icon: "🩺" },
  { to: "/rips", label: "RIPS", icon: "📋" },
  { to: "/invoices", label: "Facturas", icon: "💳" },
  { to: "/caja", label: "Caja", icon: "🏦" },          // NEW
  { to: "/cartera", label: "Cartera", icon: "💰" },     // NEW
  { to: "/reports", label: "Reportes", icon: "📈" },
  { to: "/settings", label: "Configuración", icon: "⚙️" },
];
```

- [ ] **Step 3: Verify TypeScript build**

```bash
cd psicogest/frontend
npm run build 2>&1 | tail -20
```

Expected: no errors, build completes successfully.

- [ ] **Step 4: Start frontend dev server and verify both pages load**

```bash
cd psicogest/frontend
npm run dev
```

Navigate to `http://localhost:5173/caja` — verify Caja page loads with "Abrir turno" button.  
Navigate to `http://localhost:5173/cartera` — verify Cartera page loads with summary cards and empty state.

- [ ] **Step 5: Commit**

```bash
git add psicogest/frontend/src/App.tsx \
        psicogest/frontend/src/components/layout/Sidebar.tsx
git commit -m "feat: add /caja and /cartera routes and sidebar navigation"
```

---

## Self-review checklist (do not skip)

- [ ] Spec section "Modelos de datos: CashSession" → covered in Task 2
- [ ] Spec section "Modelos de datos: CashTransaction (session_id nullable)" → covered in Task 2 + Task 3
- [ ] Spec section "Cambios a Invoice (amount_paid, payment_status)" → covered in Task 1
- [ ] Spec section "Regla: category auto-fill desde invoice type" → covered in CajaPage AddIncomeModal (auto-sets category from patient.payer_type)
- [ ] Spec section "Transacciones sin turno desde Cartera" → covered in CarteraService.register_payment() (session_id=None) and AbonarModal
- [ ] Spec section "API Router /caja" — all 8 endpoints → covered in Task 6
- [ ] Spec section "API Router /cartera" — 3 endpoints → covered in Task 6
- [ ] Spec section "Permisos sin fricción" → no role UI distinction implemented; any tenant user can manage all transactions
- [ ] Spec section "Frontend Caja: turno abierto/cerrado estados" → covered in CajaPage
- [ ] Spec section "Frontend Cartera: tabs particular/EPS/todos" → covered in CarteraPage
- [ ] Spec section "Frontend Cartera: card resumen" → covered in CarteraPage summary cards
- [ ] Spec section "Modal Registrar abono aviso sin turno abierto" → covered in AbonarModal amber warning

---

**Plan complete and saved to `docs/superpowers/plans/2026-04-23-caja-cartera.md`. Two execution options:**

**1. Subagent-Driven (recommended)** — dispatcha un subagente por tarea, revisión entre tareas, iteración rápida

**2. Inline Execution** — ejecuta las tareas en esta sesión usando executing-plans, con checkpoints de revisión

**¿Cuál prefieres?**
