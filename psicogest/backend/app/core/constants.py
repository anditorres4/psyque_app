"""Constants for RIPS, FEV and clinical data - Res. 2275/2023, Res. 1995/1999, DIAN AT 1.9."""

ADRES_DOC_TYPES = frozenset({"CC", "TI", "RC", "CE", "PA", "MS", "AS", "NU", "CN"})

DIAGNOSIS_TYPE = {
    "1": "impresión",
    "2": "confirmado",
    "3": "descartado",
}

# DIVIPOLA — códigos de municipios más frecuentes en uso del sistema.
# Fuente: DANE divipola actualización 2024.
DIVIPOLA_MUNICIPIOS: dict[str, str] = {
    "11001": "Bogotá D.C.",
    "05001": "Medellín",
    "76001": "Cali",
    "08001": "Barranquilla",
    "13001": "Cartagena",
    "54001": "Cúcuta",
    "68001": "Bucaramanga",
    "17001": "Manizales",
    "63001": "Armenia",
    "66001": "Pereira",
    "18001": "Florencia",
    "19001": "Popayán",
    "20001": "Valledupar",
    "23001": "Montería",
    "25001": "Agua de Dios",
    "27001": "Quibdó",
    "41001": "Neiva",
    "44001": "Riohacha",
    "47001": "Santa Marta",
    "50001": "Villavicencio",
    "52001": "Pasto",
    "70001": "Sincelejo",
    "73001": "Ibagué",
    "85001": "Yopal",
    "86001": "Mocoa",
    "88001": "San Andrés",
    "91001": "Leticia",
    "94001": "Inírida",
    "95001": "San José del Guaviare",
    "97001": "Mitú",
    "99001": "Puerto Carreño",
}
