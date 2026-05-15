"""Therapeutic goals CRUD — max 3 active goals per patient."""
import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.core.deps import get_tenant_db, TenantDB
from app.models.therapeutic_goal import TherapeuticGoal
from app.schemas.therapeutic_goal import TherapeuticGoalCreate, TherapeuticGoalOut, TherapeuticGoalUpdate

router = APIRouter(prefix="/therapeutic-goals", tags=["therapeutic-goals"])

_MAX_GOALS = 3


def _get_goal(goal_id: str, ctx: TenantDB) -> TherapeuticGoal:
    goal = (
        ctx.db.query(TherapeuticGoal)
        .filter(
            TherapeuticGoal.id == uuid.UUID(goal_id),
            TherapeuticGoal.tenant_id == uuid.UUID(ctx.tenant.tenant_id),
        )
        .first()
    )
    if not goal:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Objetivo no encontrado.")
    return goal


@router.get("", response_model=list[TherapeuticGoalOut])
def list_goals(
    patient_id: str = Query(...),
    ctx: Annotated[TenantDB, Depends(get_tenant_db)] = ...,
) -> list[TherapeuticGoalOut]:
    goals = (
        ctx.db.query(TherapeuticGoal)
        .filter(
            TherapeuticGoal.tenant_id == uuid.UUID(ctx.tenant.tenant_id),
            TherapeuticGoal.patient_id == uuid.UUID(patient_id),
        )
        .order_by(TherapeuticGoal.created_at)
        .all()
    )
    return [TherapeuticGoalOut.model_validate(g) for g in goals]


@router.post("", response_model=TherapeuticGoalOut, status_code=status.HTTP_201_CREATED)
def create_goal(
    body: TherapeuticGoalCreate,
    ctx: Annotated[TenantDB, Depends(get_tenant_db)],
) -> TherapeuticGoalOut:
    active_count = (
        ctx.db.query(TherapeuticGoal)
        .filter(
            TherapeuticGoal.tenant_id == uuid.UUID(ctx.tenant.tenant_id),
            TherapeuticGoal.patient_id == body.patient_id,
            TherapeuticGoal.status == "active",
        )
        .count()
    )
    if active_count >= _MAX_GOALS:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Máximo {_MAX_GOALS} objetivos activos por paciente.",
        )
    goal = TherapeuticGoal(
        tenant_id=uuid.UUID(ctx.tenant.tenant_id),
        patient_id=body.patient_id,
        goal_text=body.goal_text,
        status="active",
    )
    ctx.db.add(goal)
    ctx.db.commit()
    ctx.db.refresh(goal)
    return TherapeuticGoalOut.model_validate(goal)


@router.put("/{goal_id}", response_model=TherapeuticGoalOut)
def update_goal(
    goal_id: str,
    body: TherapeuticGoalUpdate,
    ctx: Annotated[TenantDB, Depends(get_tenant_db)],
) -> TherapeuticGoalOut:
    goal = _get_goal(goal_id, ctx)
    goal.status = body.status
    ctx.db.commit()
    ctx.db.refresh(goal)
    return TherapeuticGoalOut.model_validate(goal)


@router.delete("/{goal_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_goal(
    goal_id: str,
    ctx: Annotated[TenantDB, Depends(get_tenant_db)],
) -> None:
    goal = _get_goal(goal_id, ctx)
    ctx.db.delete(goal)
    ctx.db.commit()
