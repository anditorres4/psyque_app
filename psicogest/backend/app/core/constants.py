"""Constants for RIPS and clinical data - Res. 2275/2023, Res. 1995/1999."""

ADRES_DOC_TYPES = frozenset({"CC", "TI", "RC", "CE", "PA", "MS", "AS", "NU", "CN"})

DIAGNOSIS_TYPE = {
    "1": "impresión",
    "2": "confirmado",
    "3": "descartado",
}
