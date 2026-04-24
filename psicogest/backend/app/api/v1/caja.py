"""Caja router — cash sessions and transactions."""
from datetime import datetime
from typing import Annotated
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func

from app.core.deps import get_tenant_db, TenantDB
from app.models.cash_session import CashSession
from app.models.cash_transaction import CashTransaction
from app.models.invoice import Invoice
from app.models.tenant import Tenant
from app.schemas.cash_session import (
    CashSessionClose,
    CashSessionCreate,
    CashSessionDetail,
    CashSessionListResponse,
    CashSessionSummary,
)
from app.schemas.cash_transaction import (
    CashTransactionCreate,
    CashTransactionListResponse,
    CashTransactionSummary,
    CashTransactionUpdate,
)

router = APIRouter(prefix="/caja", tags=["caja"])


def _is_tenant_owner(ctx: TenantDB) -> bool:
    """Check if current user is the tenant owner."""
    result = ctx.db.query(Tenant).filter(
        Tenant.auth_user_id == ctx.tenant.user_id
    ).first()
    return result is not None


def _has_open_session(ctx: TenantDB) -> CashSession | None:
    """Return the open session for current user, if any."""
    return ctx.db.query(CashSession).filter(
        CashSession.tenant_id == ctx.tenant.tenant_id,
        CashSession.user_id == ctx.tenant.user_id,
        CashSession.status == "open",
    ).first()


def _get_session_or_404(ctx: TenantDB, session_id: uuid.UUID) -> CashSession:
    """Get session by ID or raise 404."""
    session = ctx.db.query(CashSession).filter(
        CashSession.id == session_id,
        CashSession.tenant_id == ctx.tenant.tenant_id,
    ).first()
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sesión de caja no encontrada.")
    return session


def _get_transaction_or_404(ctx: TenantDB, transaction_id: uuid.UUID) -> CashTransaction:
    """Get transaction by ID or raise 404."""
    tx = ctx.db.query(CashTransaction).filter(
        CashTransaction.id == transaction_id,
        CashTransaction.tenant_id == ctx.tenant.tenant_id,
    ).first()
    if not tx:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Transacción no encontrada.")
    return tx


@router.post("/sessions", response_model=CashSessionSummary, status_code=status.HTTP_201_CREATED)
def open_session(
    ctx: Annotated[TenantDB, Depends(get_tenant_db)],
) -> CashSessionSummary:
    """Open a new cash session. Fails if there's already an open session for this user."""
    existing = _has_open_session(ctx)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Ya tienes un turno abierto.",
        )

    session = CashSession(
        tenant_id=ctx.tenant.tenant_id,
        user_id=ctx.tenant.user_id,
        opened_at=datetime.utcnow(),
        status="open",
    )
    ctx.db.add(session)
    ctx.db.commit()
    ctx.db.refresh(session)
    return CashSessionSummary.model_validate(session)


@router.get("/sessions", response_model=CashSessionListResponse)
def list_sessions(
    ctx: Annotated[TenantDB, Depends(get_tenant_db)],
    limit: int = Query(50, ge=1, le=200),
) -> CashSessionListResponse:
    """List cash sessions. Owner sees all; others see only their own."""
    query = ctx.db.query(CashSession).filter(
        CashSession.tenant_id == ctx.tenant.tenant_id
    )
    if not _is_tenant_owner(ctx):
        query = query.filter(CashSession.user_id == ctx.tenant.user_id)
    query = query.order_by(CashSession.opened_at.desc())
    sessions = query.limit(limit).all()
    return CashSessionListResponse(
        items=[CashSessionSummary.model_validate(s) for s in sessions],
        total=len(sessions),
    )


@router.get("/sessions/current", response_model=CashSessionDetail)
def get_current_session(
    ctx: Annotated[TenantDB, Depends(get_tenant_db)],
) -> CashSessionDetail:
    """Get the current open session for the user, or 404 if none."""
    session = _has_open_session(ctx)
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No tienes un turno de caja abierto.",
        )

    income = ctx.db.query(func.coalesce(func.sum(CashTransaction.amount), 0)).filter(
        CashTransaction.session_id == session.id,
        CashTransaction.type == "income",
    ).scalar() or 0

    expense = ctx.db.query(func.coalesce(func.sum(CashTransaction.amount), 0)).filter(
        CashTransaction.session_id == session.id,
        CashTransaction.type == "expense",
    ).scalar() or 0

    return CashSessionDetail(
        id=session.id,
        tenant_id=session.tenant_id,
        user_id=session.user_id,
        opened_at=session.opened_at,
        closed_at=session.closed_at,
        status=session.status,
        notes=session.notes,
        total_income=income,
        total_expense=expense,
        net=income - expense,
    )


@router.get("/sessions/{session_id}", response_model=CashSessionDetail)
def get_session(
    session_id: uuid.UUID,
    ctx: Annotated[TenantDB, Depends(get_tenant_db)],
) -> CashSessionDetail:
    """Get session detail with financial summary."""
    session = _get_session_or_404(ctx, session_id)

    income = ctx.db.query(func.coalesce(func.sum(CashTransaction.amount), 0)).filter(
        CashTransaction.session_id == session.id,
        CashTransaction.type == "income",
    ).scalar() or 0

    expense = ctx.db.query(func.coalesce(func.sum(CashTransaction.amount), 0)).filter(
        CashTransaction.session_id == session.id,
        CashTransaction.type == "expense",
    ).scalar() or 0

    return CashSessionDetail(
        id=session.id,
        tenant_id=session.tenant_id,
        user_id=session.user_id,
        opened_at=session.opened_at,
        closed_at=session.closed_at,
        status=session.status,
        notes=session.notes,
        total_income=income,
        total_expense=expense,
        net=income - expense,
    )


@router.put("/sessions/{session_id}/close", response_model=CashSessionSummary)
def close_session(
    session_id: uuid.UUID,
    body: CashSessionClose,
    ctx: Annotated[TenantDB, Depends(get_tenant_db)],
) -> CashSessionSummary:
    """Close a cash session. Only the session owner can close it."""
    session = _get_session_or_404(ctx, session_id)
    if str(session.user_id) != ctx.tenant.user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo el dueño del turno puede cerrarlo.",
        )
    if session.status == "closed":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="El turno ya está cerrado.",
        )

    session.status = "closed"
    session.closed_at = datetime.utcnow()
    if body.notes:
        session.notes = body.notes
    ctx.db.commit()
    ctx.db.refresh(session)
    return CashSessionSummary.model_validate(session)


@router.post("/sessions/{session_id}/transactions", response_model=CashTransactionSummary, status_code=status.HTTP_201_CREATED)
def create_transaction(
    session_id: uuid.UUID,
    body: CashTransactionCreate,
    ctx: Annotated[TenantDB, Depends(get_tenant_db)],
) -> CashTransactionSummary:
    """Register a transaction in a session. Must be the session owner and session must be open."""
    session = _get_session_or_404(ctx, session_id)
    if str(session.user_id) != ctx.tenant.user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo el dueño del turno puede registrar transacciones.",
        )
    if session.status == "closed":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="No se pueden registrar transacciones en un turno cerrado.",
        )

    tx = CashTransaction(
        tenant_id=ctx.tenant.tenant_id,
        session_id=session_id,
        type=body.type,
        amount=body.amount,
        category=body.category,
        description=body.description,
        invoice_id=body.invoice_id,
        patient_id=body.patient_id,
        created_at=datetime.utcnow(),
        created_by=ctx.tenant.user_id,
    )
    ctx.db.add(tx)

    # If income with invoice, update invoice
    if body.type == "income" and body.invoice_id:
        invoice = ctx.db.query(Invoice).filter(Invoice.id == body.invoice_id).first()
        if invoice:
            invoice.amount_paid += body.amount
            if invoice.amount_paid >= invoice.total_cop:
                invoice.payment_status = "paid"
            elif invoice.amount_paid > 0:
                invoice.payment_status = "partial"
            else:
                invoice.payment_status = "unpaid"

    ctx.db.commit()
    ctx.db.refresh(tx)
    return CashTransactionSummary.model_validate(tx)


@router.get("/sessions/{session_id}/transactions", response_model=CashTransactionListResponse)
def list_session_transactions(
    session_id: uuid.UUID,
    ctx: Annotated[TenantDB, Depends(get_tenant_db)],
) -> CashTransactionListResponse:
    """List transactions for a session."""
    _get_session_or_404(ctx, session_id)
    txs = ctx.db.query(CashTransaction).filter(
        CashTransaction.session_id == session_id
    ).order_by(CashTransaction.created_at.desc()).all()
    return CashTransactionListResponse(
        items=[CashTransactionSummary.model_validate(t) for t in txs],
        total=len(txs),
    )


@router.put("/transactions/{transaction_id}", response_model=CashTransactionSummary)
def update_transaction(
    transaction_id: uuid.UUID,
    body: CashTransactionUpdate,
    ctx: Annotated[TenantDB, Depends(get_tenant_db)],
) -> CashTransactionSummary:
    """Edit a transaction. Owner of the session or tenant owner can edit."""
    tx = _get_transaction_or_404(ctx, transaction_id)

    # Check permission: tenant owner or session owner
    is_owner = _is_tenant_owner(ctx)
    can_edit = is_owner
    if tx.session_id:
        session = ctx.db.query(CashSession).filter(CashSession.id == tx.session_id).first()
        if session and str(session.user_id) == ctx.tenant.user_id:
            can_edit = True

    if not can_edit:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tienes permiso para editar esta transacción.",
        )

    if body.amount is not None:
        tx.amount = body.amount
    if body.category is not None:
        tx.category = body.category
    if body.description is not None:
        tx.description = body.description

    ctx.db.commit()
    ctx.db.refresh(tx)
    return CashTransactionSummary.model_validate(tx)


@router.delete("/transactions/{transaction_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_transaction(
    transaction_id: uuid.UUID,
    ctx: Annotated[TenantDB, Depends(get_tenant_db)],
) -> None:
    """Delete a transaction. Owner of the session or tenant owner can delete."""
    tx = _get_transaction_or_404(ctx, transaction_id)

    is_owner = _is_tenant_owner(ctx)
    can_delete = is_owner
    if tx.session_id:
        session = ctx.db.query(CashSession).filter(CashSession.id == tx.session_id).first()
        if session and str(session.user_id) == ctx.tenant.user_id:
            can_delete = True

    if not can_delete:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tienes permiso para eliminar esta transacción.",
        )

    ctx.db.delete(tx)
    ctx.db.commit()