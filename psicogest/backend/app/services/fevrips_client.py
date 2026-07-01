"""HTTP client for Colombia MinSalud FEV-RIPS Docker API v4.3."""
import gzip
import json
from typing import Any

import httpx


class FevRipsError(Exception):
    pass


class FevRipsClient:
    """Sync HTTP client for MinSalud FEV-RIPS API.

    For independent psychologists (PIN): doc_type="CC", doc_number=CC, nit=CC (same value).
    For IPS/entities (RE): doc_type="NIT", doc_number=NIT, nit=NIT.
    """

    def __init__(
        self,
        base_url: str,
        nit: str,
        password: str,
        tipo_usuario: str = "PIN",
        doc_type: str = "CC",
        doc_number: str | None = None,
    ):
        self.base_url = base_url.rstrip("/")
        self.nit = nit
        self.password = password
        self.tipo_usuario = tipo_usuario
        self.doc_type = doc_type
        self.doc_number = doc_number or nit  # PIN: CC == NIT

    def login(self) -> str:
        """POST /api/Auth/LoginSISPRO → Bearer token."""
        persona: dict[str, Any] = {
            "nit": self.nit,
            "clave": self.password,
            "identificacion": {
                "tipo": self.doc_type,
                "numero": self.doc_number,
            },
        }
        if self.tipo_usuario:
            persona["tipoUsuario"] = self.tipo_usuario

        with httpx.Client(verify=False, timeout=30) as client:
            resp = client.post(
                f"{self.base_url}/api/Auth/LoginSISPRO",
                json={"persona": persona},
                headers={"Content-Type": "application/json"},
            )
        resp.raise_for_status()
        data = resp.json()
        token = data.get("token") or data.get("Token")
        if not token:
            raise FevRipsError(f"LoginSISPRO returned no token: {data}")
        return token

    def _post_gzip(self, path: str, payload: dict, token: str) -> dict:
        body = gzip.compress(json.dumps(payload, ensure_ascii=False).encode())
        with httpx.Client(verify=False, timeout=60) as client:
            resp = client.post(
                f"{self.base_url}{path}",
                content=body,
                headers={
                    "Content-Type": "application/json",
                    "Content-Encoding": "gzip",
                    "Authorization": f"Bearer {token}",
                },
            )
        resp.raise_for_status()
        return resp.json()

    def cargar_rips_sin_factura(self, rips: dict, token: str) -> dict:
        """Primary method for independent psychologists (no EPS/ERP contracts).

        RIPS without FEV XML. numFactura in the RIPS JSON is the internal invoice number.
        Returns dict with CodigoUnicoValidacion (CUV) on success.
        """
        return self._post_gzip(
            "/api/PaquetesFevRips/CargarRipsSinFactura",
            {"rips": rips, "xmlFevFile": ""},
            token,
        )

    def cargar_fev_rips(self, rips: dict, xml_fev_b64: str, token: str) -> dict:
        """For providers with EPS contracts. Requires DIAN-validated FEV XML in Base64."""
        return self._post_gzip(
            "/api/PaquetesFevRips/CargarFevRips",
            {"rips": rips, "xmlFevFile": xml_fev_b64},
            token,
        )
