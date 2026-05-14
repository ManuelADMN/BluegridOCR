import csv
import zipfile
from html import escape
from io import BytesIO, StringIO
from typing import Optional

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from psycopg2.extras import RealDictCursor

from dependencies.auth import require_roles
from services.db import get_connection

router = APIRouter(tags=["Reportes"])


def build_filters(fecha_desde: Optional[str], fecha_hasta: Optional[str], estado: Optional[str]):
    filters = ["UPPER(COALESCE(r.estado_validacion, '')) <> 'ELIMINADO'"]
    params = []

    if fecha_desde:
        filters.append("DATE(r.fecha_carga) >= %s")
        params.append(fecha_desde)

    if fecha_hasta:
        filters.append("DATE(r.fecha_carga) <= %s")
        params.append(fecha_hasta)

    if estado and estado.upper() != "ELIMINADO":
        filters.append("LOWER(r.estado_validacion) = LOWER(%s)")
        params.append(estado)
    elif estado and estado.upper() == "ELIMINADO":
        filters = ["UPPER(COALESCE(r.estado_validacion, '')) = 'ELIMINADO'"]

    return "WHERE " + " AND ".join(filters), params


def records_query(where_sql: str):
    return f"""
        SELECT
            r.id_registro,
            r.fecha_carga,
            r.estado_validacion,
            COALESCE(r.promedio_confianza, 0) AS promedio_confianza,
            COALESCE(s.nombre_sector, 'Sin sector') AS sector,
            COALESCE(s.region_chile, 'Sin region') AS region,
            u.id_usuario AS usuario_id,
            COALESCE(u.nombre_completo, u.correo, 'Sin usuario') AS usuario,
            COALESCE(ro.nombre_rol, 'Sin rol') AS tipo_usuario,
            COALESCE(SUM(d.n_nidos), 0) AS nidos,
            COALESCE(SUM(d.n_cuevas_cubiertas), 0) AS cuevas_cubiertas,
            COALESCE(SUM(CASE WHEN d.captura_hembras_tipo > 0 THEN 1 ELSE 0 END), 0) AS hembras,
            COALESCE(SUM(d.total_pulpos), 0) AS total_pulpos
        FROM registros_ocr r
        LEFT JOIN sectores s ON s.id_sector = r.fk_sector
        LEFT JOIN usuarios u ON u.id_usuario = r.fk_usuario_creador
        LEFT JOIN roles ro ON ro.id_rol = u.fk_rol
        LEFT JOIN detalles_captura d ON d.fk_registro = r.id_registro
        {where_sql}
        GROUP BY r.id_registro, r.fecha_carga, r.estado_validacion, r.promedio_confianza,
                 s.nombre_sector, s.region_chile, u.id_usuario, u.nombre_completo, u.correo, ro.nombre_rol
        ORDER BY r.fecha_carga DESC, r.id_registro DESC
    """


EXPORT_COLUMNS = [
    ("id_registro", "ID Registro"),
    ("usuario_id", "ID Usuario"),
    ("tipo_usuario", "Tipo Usuario"),
    ("usuario", "Nombre Usuario"),
    ("nidos", "Nidos con Huevos"),
    ("cuevas_cubiertas", "Cuevas Cubiertas"),
    ("hembras", "Captura Hembras"),
    ("total_pulpos", "Total Pulpos"),
    ("promedio_confianza", "Confianza OCR"),
    ("estado_validacion", "Estado"),
    ("fecha_carga", "Fecha Carga"),
    ("sector", "Centro"),
    ("region", "Region"),
]


def format_cell(value):
    if value is None:
        return ""
    return str(value)


def build_csv(rows):
    output = StringIO()
    writer = csv.writer(output)
    writer.writerow([label for _, label in EXPORT_COLUMNS])
    for row in rows:
        writer.writerow([format_cell(row.get(key)) for key, _ in EXPORT_COLUMNS])
    output.seek(0)
    return output.getvalue()


def column_letter(index: int) -> str:
    letters = ""
    while index:
        index, remainder = divmod(index - 1, 26)
        letters = chr(65 + remainder) + letters
    return letters


def sheet_cell(ref: str, value, style: int = 0) -> str:
    text = escape(format_cell(value))
    return f'<c r="{ref}" t="inlineStr" s="{style}"><is><t>{text}</t></is></c>'


def build_xlsx(rows, fecha_desde: Optional[str], fecha_hasta: Optional[str], estado: Optional[str]) -> bytes:
    title = "BluegridOCR - Reporte de Registros"
    filters = f"Periodo: {fecha_desde or 'inicio'} a {fecha_hasta or 'actual'} | Estado: {estado or 'Todos'}"
    total_cols = len(EXPORT_COLUMNS)
    last_col = column_letter(total_cols)

    sheet_rows = [
        f'<row r="1" ht="24"><c r="A1" t="inlineStr" s="1"><is><t>{escape(title)}</t></is></c></row>',
        f'<row r="2" ht="20"><c r="A2" t="inlineStr" s="2"><is><t>{escape(filters)}</t></is></c></row>',
        '<row r="4" ht="30">' + ''.join(
            sheet_cell(f"{column_letter(i)}4", label, 3)
            for i, (_, label) in enumerate(EXPORT_COLUMNS, start=1)
        ) + '</row>',
    ]

    for row_index, row in enumerate(rows, start=5):
        cells = ''.join(
            sheet_cell(f"{column_letter(col_index)}{row_index}", row.get(key), 4)
            for col_index, (key, _) in enumerate(EXPORT_COLUMNS, start=1)
        )
        sheet_rows.append(f'<row r="{row_index}" ht="22">{cells}</row>')

    widths = [14, 14, 18, 32, 24, 24, 24, 18, 20, 24, 28, 34, 20]
    cols_xml = ''.join(
        f'<col min="{i}" max="{i}" width="{width}" customWidth="1"/>'
        for i, width in enumerate(widths, start=1)
    )

    worksheet = f'''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"
 xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <cols>{cols_xml}</cols>
  <sheetData>{''.join(sheet_rows)}</sheetData>
  <mergeCells count="2">
    <mergeCell ref="A1:{last_col}1"/>
    <mergeCell ref="A2:{last_col}2"/>
  </mergeCells>
</worksheet>'''

    styles = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="3">
    <font><sz val="11"/><color rgb="FF111827"/><name val="Arial"/></font>
    <font><b/><sz val="14"/><color rgb="FFFFFFFF"/><name val="Arial"/></font>
    <font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Arial"/></font>
  </fonts>
  <fills count="4">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF111827"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF1D4ED8"/><bgColor indexed="64"/></patternFill></fill>
  </fills>
  <borders count="2">
    <border><left/><right/><top/><bottom/><diagonal/></border>
    <border>
      <left style="thin"><color rgb="FF94A3B8"/></left>
      <right style="thin"><color rgb="FF94A3B8"/></right>
      <top style="thin"><color rgb="FF94A3B8"/></top>
      <bottom style="thin"><color rgb="FF94A3B8"/></bottom>
      <diagonal/>
    </border>
  </borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="5">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="2" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
  </cellXfs>
  <cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>'''

    buffer = BytesIO()
    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as archive:
        archive.writestr("[Content_Types].xml", '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>''')
        archive.writestr("_rels/.rels", '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>''')
        archive.writestr("xl/workbook.xml", '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"
 xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets><sheet name="Registros" sheetId="1" r:id="rId1"/></sheets>
</workbook>''')
        archive.writestr("xl/_rels/workbook.xml.rels", '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>''')
        archive.writestr("xl/worksheets/sheet1.xml", worksheet)
        archive.writestr("xl/styles.xml", styles)

    return buffer.getvalue()

@router.get("/reports/history")
def get_history(
    fecha_desde: Optional[str] = Query(None),
    fecha_hasta: Optional[str] = Query(None),
    estado: Optional[str] = Query(None),
    limit: int = Query(100, ge=1, le=500),
    current_user: dict = Depends(require_roles(["admin", "supervisor"]))
):
    where_sql, params = build_filters(fecha_desde, fecha_hasta, estado)
    conn = get_connection()

    try:
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute(records_query(where_sql) + " LIMIT %s", [*params, limit])
        return {"items": cur.fetchall()}
    finally:
        conn.close()


@router.get("/reports/export")
def export_records(
    fecha_desde: Optional[str] = Query(None),
    fecha_hasta: Optional[str] = Query(None),
    estado: Optional[str] = Query(None),
    formato: str = Query("csv", pattern="^(csv|xls|xlsx)$"),
    current_user: dict = Depends(require_roles(["admin", "supervisor"]))
):
    where_sql, params = build_filters(fecha_desde, fecha_hasta, estado)
    conn = get_connection()

    try:
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute(records_query(where_sql), params)
        rows = cur.fetchall()
    finally:
        conn.close()
    if formato in ("xls", "xlsx"):
        content = build_xlsx(rows, fecha_desde, fecha_hasta, estado)
        return StreamingResponse(
            iter([content]),
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": "attachment; filename=bluegridocr_registros.xlsx"},
        )

    content = build_csv(rows)
    return StreamingResponse(
        iter([content]),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": "attachment; filename=bluegridocr_registros.csv"},
    )
