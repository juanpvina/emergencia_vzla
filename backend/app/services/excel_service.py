import io
import logging
from pathlib import Path
from datetime import datetime

import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter

logger = logging.getLogger(__name__)

COLUMNAS_ESPERADAS = [
    "NOMBRE", "CEDULA", "HOSPITAL", "PISO", "HABITACION",
    "ESTADO_SALUD", "EDAD", "CONTACTO", "NOTAS"
]

ALIAS_COLUMNAS = {
    "nombre": "NOMBRE",
    "nombres": "NOMBRE",
    "nombre_completo": "NOMBRE",
    "paciente": "NOMBRE",
    "cedula": "CEDULA",
    "ci": "CEDULA",
    "c.i.": "CEDULA",
    "documento": "CEDULA",
    "hospital": "HOSPITAL",
    "centro": "HOSPITAL",
    "cdi": "HOSPITAL",
    "piso": "PISO",
    "habitacion": "HABITACION",
    "hab": "HABITACION",
    "sala": "HABITACION",
    "estado_salud": "ESTADO_SALUD",
    "estado": "ESTADO_SALUD",
    "condicion": "ESTADO_SALUD",
    "salud": "ESTADO_SALUD",
    "edad": "EDAD",
    "años": "EDAD",
    "contacto": "CONTACTO",
    "telefono": "CONTACTO",
    "tlf": "CONTACTO",
    "teléfono": "CONTACTO",
    "notas": "NOTAS",
    "observaciones": "NOTAS",
    "comentarios": "NOTAS",
}


def parsear_excel(contenido: bytes) -> tuple[list[dict], list[str]]:
    """Parsea archivo Excel y extrae pacientes. Devuelve (pacientes, advertencias)."""
    wb = openpyxl.load_workbook(io.BytesIO(contenido), read_only=True)
    ws = wb.active

    rows = list(ws.iter_rows(values_only=True))
    if not rows:
        raise ValueError("El archivo Excel está vacío")

    headers = [str(c).strip() if c else "" for c in rows[0]]
    col_map = {}

    for i, h in enumerate(headers):
        h_clean = h.lower().strip()
        if h_clean in ALIAS_COLUMNAS:
            col_map[ALIAS_COLUMNAS[h_clean]] = i

    if "NOMBRE" not in col_map:
        raise ValueError(
            "El archivo Excel no tiene una columna de NOMBRE. "
            "Descarga la plantilla desde /api/v1/extraccion/plantilla-excel"
        )

    pacientes = []
    advertencias = []

    for row_idx, row in enumerate(rows[1:], start=2):
        if not row or all(c is None or str(c).strip() == "" for c in row):
            continue

        paciente = {}
        for col_name, col_idx in col_map.items():
            if col_idx < len(row) and row[col_idx] is not None:
                val = str(row[col_idx]).strip()
                if val:
                    paciente[col_name.lower()] = val

        if not paciente.get("nombre"):
            advertencias.append(f"Fila {row_idx}: sin nombre, omitida")
            continue

        if "cedula" in paciente:
            paciente["cedula"] = "".join(c for c in paciente["cedula"] if c.isdigit())

        pacientes.append(paciente)

    wb.close()
    logger.info("Excel parseado: %d pacientes encontrados", len(pacientes))
    return pacientes, advertencias


def generar_plantilla_excel() -> bytes:
    """Genera archivo Excel vacío con el formato requerido."""
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Pacientes"

    header_font = Font(name="Arial", size=11, bold=True, color="FFFFFF")
    header_fill = PatternFill(start_color="2563EB", end_color="2563EB", fill_type="solid")
    header_alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
    thin_border = Border(
        left=Side(style="thin"), right=Side(style="thin"),
        top=Side(style="thin"), bottom=Side(style="thin")
    )

    for col_idx, col_name in enumerate(COLUMNAS_ESPERADAS, start=1):
        cell = ws.cell(row=1, column=col_idx, value=col_name)
        cell.font = header_font
        cell.fill = header_fill
        cell.alignment = header_alignment
        cell.border = thin_border

    ejemplo = [
        "María José Pérez", "12345678", "Hospital Vargas", "3", "302",
        "Estable", "45", "+584121234567", ""
    ]
    for col_idx, val in enumerate(ejemplo, start=1):
        cell = ws.cell(row=2, column=col_idx, value=val)
        cell.border = thin_border
        cell.alignment = Alignment(vertical="center")

    ws2 = wb.create_sheet("Instrucciones")
    instrucciones = [
        ["INSTRUCCIONES PARA LLENAR LA PLANTILLA"],
        [""],
        ["1. No modifiques los nombres de las columnas en la hoja 'Pacientes'."],
        ["2. Solo se reconocerán las columnas con estos nombres exactos:"],
        [f"   {', '.join(COLUMNAS_ESPERADAS)}"],
        [""],
        ["3. La fila de ejemplo es solo ilustrativa, puedes borrarla."],
        ["4. CÉDULA: solo números, sin puntos ni guiones. Ej: 12345678"],
        ["5. CONTACTO: formato +58XXXXXXXXX. Ej: +584121234567"],
        ["6. EDAD: solo el número. Ej: 45"],
        ["7. Los campos vacíos se ignoran (excepto NOMBRE que es obligatorio)."],
        ["8. Puedes agregar tantas filas como necesites."],
        [""],
        [f"Plantilla generada: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}"],
    ]

    for row_idx, row_data in enumerate(instrucciones, start=1):
        cell = ws2.cell(row=row_idx, column=1, value=row_data[0])
        if row_idx == 1:
            cell.font = Font(bold=True, size=14)

    ws2.column_dimensions['A'].width = 80

    col_widths = [22, 14, 22, 8, 14, 16, 8, 18, 20]
    for i, width in enumerate(col_widths, start=1):
        ws.column_dimensions[get_column_letter(i)].width = width

    output = io.BytesIO()
    wb.save(output)
    output.seek(0)
    return output.getvalue()
