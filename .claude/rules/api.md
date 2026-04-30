# Reglas API (Backend FastAPI)

## Estructura de rutas
- Todas las rutas bajo `/api/v1/`
- Cada módulo en `app/api/v1/` tiene su propio archivo de rutas
- La lógica de negocio va en `app/services/`, nunca inline en las rutas
- Usar `Depends(get_current_user)` en todos los endpoints que requieren auth

## Patrones obligatorios

```python
# Ruta correcta
@router.get("/patients", response_model=list[PatientSchema])
async def list_patients(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return await patient_service.list_by_psychologist(db, current_user.id)
```

## Multi-tenancy
- Nunca hacer queries sin filtrar por `psychologist_id`
- El `psychologist_id` siempre viene del JWT (`current_user.id`), nunca del request body
- Para operaciones administrativas que requieran `service_role`, documentar explícitamente el por qué

## Errores
- 400: validación de input (Pydantic lo maneja automáticamente)
- 401: sin autenticación
- 403: autenticado pero sin permiso (tenant incorrecto)
- 404: recurso no existe O no pertenece al tenant
- No revelar en el mensaje de error si el recurso existe pero pertenece a otro tenant

## Migraciones
- Siempre `alembic revision --autogenerate` — nunca SQL manual
- Cada migración debe ser reversible (tener `downgrade()` implementado)
- Nombrar descriptivamente: `alembic revision --autogenerate -m "add_patient_consent_field"`
