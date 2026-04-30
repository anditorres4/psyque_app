---
name: test-writer
description: Escribe tests para backend FastAPI y frontend React con foco en aislamiento de tenants y seguridad
---

## Stack de testing

- **Backend:** pytest + pytest-asyncio + httpx (TestClient)
- **Frontend:** Vitest + React Testing Library (por configurar)

## Patrones backend

```python
# Siempre crear psychologist fixture aislado por test
@pytest.fixture
async def psychologist(db):
    return await create_test_psychologist(db)

# Test de aislamiento de tenant: psicólogo A no ve datos de B
async def test_tenant_isolation(client, psychologist_a, psychologist_b):
    # crear paciente para A, verificar que B no lo ve
```

## Qué testear siempre
- Aislamiento de tenants (psicólogo A no accede a datos de B)
- Endpoints sin auth retornan 401
- Validación de inputs (campos requeridos, formatos)
- Lógica de negocio crítica: RIPS generation, firma de sesiones

## Qué NO mockear
- Base de datos (usar DB de test real con Supabase o SQLite en memoria)
- RLS policies (crítico para seguridad multi-tenant)
