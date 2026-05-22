"""Pydantic schemas for FEV-RIPS MinSalud API endpoints."""
from pydantic import BaseModel


class RipsSubmitRequest(BaseModel):
    num_factura: str | None = None
    xml_fev_b64: str = ""  # empty → CargarRipsSinFactura (independent psychologists)


class RipsSubmitResponse(BaseModel):
    export_id: str
    cuv: str | None
    fecha_radicacion: str | None
    result_state: bool
    validation_results: list[dict]
    message: str
