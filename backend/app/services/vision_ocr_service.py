"""
Servicio de OCR con Google Cloud Vision API + parser rule-based
para estructurar texto de listados hospitalarios venezolanos.

Motores:
- vision: Cloud Vision OCR + parser rule-based (gratuito hasta 1000/img/mes)
- vision+gemini: Cloud Vision OCR + Gemini estructura el texto (más preciso)
"""
import logging
import re

from google.cloud import vision

from app.config import settings
from app.schemas.extraccion import CampoExtraido, GeminiResponse, PacienteExtraido

logger = logging.getLogger(__name__)

_vision_client = None


def _get_vision_client() -> vision.ImageAnnotatorClient:
    global _vision_client
    if _vision_client is None:
        _vision_client = vision.ImageAnnotatorClient()
    return _vision_client


def extraer_texto_vision(contenido: bytes) -> list[str]:
    """
    Extrae texto de una imagen usando Google Cloud Vision API (document_text_detection).

    Args:
        contenido: Bytes de la imagen (JPEG, PNG, etc.)

    Returns:
        Lista de líneas de texto detectadas, ordenadas de arriba a abajo.
    """
    client = _get_vision_client()
    image = vision.Image(content=contenido)

    response = client.document_text_detection(image=image)

    if response.error.message:
        raise RuntimeError(f"Cloud Vision error: {response.error.message}")

    annotation = response.full_text_annotation
    if not annotation or not annotation.pages:
        return []

    lineas = []
    for page in annotation.pages:
        for block in page.blocks:
            for paragraph in block.paragraphs:
                palabras = []
                for word in paragraph.words:
                    texto = "".join(s.text for s in word.symbols if s.text)
                    if texto:
                        palabras.append(texto)
                if palabras:
                    linea = " ".join(palabras)
                    if linea.strip():
                        lineas.append(linea.strip())

    logger.info("Cloud Vision extrajo %d líneas de texto", len(lineas))
    return lineas


def parsear_texto_a_pacientes(lineas: list[str]) -> GeminiResponse:
    """
    Convierte líneas de texto OCR en registros estructurados de pacientes.

    Estrategia:
    1. Agrupar líneas en bloques por paciente
    2. Extraer campos con regex específicos para listados venezolanos
    """
    if not lineas:
        return GeminiResponse(pacientes=[], advertencias=["No se detectó texto en la imagen"])

    bloques = _agrupar_en_bloques(lineas)
    pacientes = []
    advertencias = []

    for bloque in bloques:
        paciente = _extraer_campos_de_bloque(bloque)
        if paciente:
            pacientes.append(paciente)

    if not pacientes:
        advertencias.append(
            "No se pudo estructurar ningún paciente del texto OCR. "
            "Usa motor='vision+gemini' para mejor estructuración."
        )

    return GeminiResponse(pacientes=pacientes, advertencias=advertencias)


def _agrupar_en_bloques(lineas: list[str]) -> list[list[str]]:
    """Agrupa líneas en bloques por paciente."""
    if not lineas:
        return []

    bloques = []
    bloque_actual = [lineas[0]]

    for linea in lineas[1:]:
        if _es_inicio_paciente(linea):
            bloques.append(bloque_actual)
            bloque_actual = [linea]
        else:
            bloque_actual.append(linea)

    bloques.append(bloque_actual)
    return bloques


def _es_inicio_paciente(linea: str) -> bool:
    """Detecta si una línea inicia un nuevo paciente."""
    if re.search(r"[A-ZÁÉÍÓÚÑ]{2,}.*(?:C\.?I\.?|V-?|E-?)\s*[\d\.]+", linea, re.IGNORECASE):
        return True
    if re.search(r"(?:^|\s)[\d]{1,2}\.?[\d]{3}\.?[\d]{3}(?:\s|$)", linea):
        return True
    if re.match(r"^\d+[\.\)]\s+[A-ZÁÉÍÓÚÑ]{3,}", linea, re.IGNORECASE):
        return True
    return False


def _extraer_campos_de_bloque(bloque: list[str]) -> PacienteExtraido | None:
    """Extrae todos los campos de un bloque de texto."""
    texto_completo = " | ".join(bloque)

    nombre = _extraer_nombre(texto_completo, bloque)
    if not nombre.valor:
        return None

    cedula = _extraer_cedula(texto_completo)
    hospital = _extraer_hospital(texto_completo)
    piso, habitacion = _extraer_ubicacion(texto_completo)
    edad = _extraer_edad(texto_completo)
    estado = _extraer_estado_salud(texto_completo)
    contacto = _extraer_contacto(texto_completo)

    return PacienteExtraido(
        nombre=nombre,
        cedula=cedula,
        hospital=hospital,
        piso=piso,
        habitacion=habitacion,
        edad=edad,
        estado_salud=estado,
        contacto=contacto,
    )


def _extraer_nombre(texto: str, bloque: list[str]) -> CampoExtraido:
    """Extrae el nombre del paciente de la primera línea del bloque."""
    primera_linea = bloque[0] if bloque else texto
    primera_linea = re.sub(r"^\d+[\.\)]\s*", "", primera_linea).strip()

    patrones = [
        r"^([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+\s+(?:[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+\s*){0,4})(?:C\.?I\.?|V-?|E-?)",
        r"^([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:,\s*[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+){0,2})",
        r"^([A-ZÁÉÍÓÚÑ][A-Za-záéíóúñÁÉÍÓÚÑ\s]+?)(?:\s+\d{1,2}[\.\s]?\d{3})",
    ]

    for patron in patrones:
        match = re.search(patron, primera_linea, re.IGNORECASE)
        if match:
            nombre_extraido = match.group(1).strip().rstrip(",").strip()
            if len(nombre_extraido) >= 5:
                return CampoExtraido(valor=nombre_extraido, confianza=0.85, raw_text=primera_linea)

    if len(primera_linea) >= 3:
        return CampoExtraido(valor=primera_linea[:200], confianza=0.55, raw_text=primera_linea)

    return CampoExtraido()


def _extraer_cedula(texto: str) -> CampoExtraido:
    """Extrae y normaliza la cédula venezolana."""
    patrones = [
        r"(?:C\.?I\.?|V-?|E-?)\s*(\d{1,2})[\.\s]?(\d{3})[\.\s]?(\d{3})",
        r"(?:^|\s)(\d{1,2})[\.\s](\d{3})[\.\s](\d{3})(?:\s|$)",
        r"(?:^|\s)(\d{7,8})(?:\s|$)",
    ]

    for patron in patrones:
        match = re.search(patron, texto, re.IGNORECASE)
        if match:
            if len(match.groups()) == 3:
                raw = match.group(0)
                cedula = "".join(match.groups())
            else:
                raw = match.group(1)
                cedula = match.group(1)

            cedula = "".join(c for c in cedula if c.isdigit())
            if 5 <= len(cedula) <= 10:
                return CampoExtraido(valor=cedula, confianza=0.90, raw_text=raw.strip())

    return CampoExtraido()


def _extraer_hospital(texto: str) -> CampoExtraido:
    """Extrae el nombre del hospital."""
    patrones = [
        r"(?:Hosp(?:ital)?\.?\s*:?\s*)([A-ZÁÉÍÓÚÑ][A-Za-záéíóúñÁÉÍÓÚÑ\s\.]+?)(?:\s*[-–]\s*Piso|\s*Piso|\s*$)",
        r"(?:CDI|C\.D\.I\.|Ambulatorio|Cl[ií]nica)\s+([A-ZÁÉÍÓÚÑ][A-Za-záéíóúñÁÉÍÓÚÑ\s\.]+?)(?:\s*[-–]\s*Piso|\s*Piso|\s*$)",
        r"(?:Centro|Hospital|CDI)\s+([A-ZÁÉÍÓÚÑ][A-Za-záéíóúñÁÉÍÓÚÑ\s\.]{3,40}?)(?:\s*[-–]\s*Piso|\s*Piso|\s*$)",
    ]

    for patron in patrones:
        match = re.search(patron, texto, re.IGNORECASE)
        if match:
            nombre = match.group(1).strip().rstrip(".,;").strip()
            if len(nombre) >= 3:
                conf = 0.80 if "Hospital" in texto or "CDI" in texto.upper() else 0.60
                return CampoExtraido(valor=nombre, confianza=conf, raw_text=match.group(0))

    return CampoExtraido()


def _extraer_ubicacion(texto: str) -> tuple[CampoExtraido, CampoExtraido]:
    """Extrae piso y habitación."""
    piso = CampoExtraido()
    habitacion = CampoExtraido()

    piso_match = re.search(r"Piso\s*:?\s*(\d+|PB|S[óo]tano)", texto, re.IGNORECASE)
    if piso_match:
        piso = CampoExtraido(valor=piso_match.group(1), confianza=0.90, raw_text=piso_match.group(0))

    hab_match = re.search(r"(?:Hab(?:itaci[óo]n)?|Sala|Cama|Cuarto)\s*:?\s*(\d+[A-Za-z]?)", texto, re.IGNORECASE)
    if hab_match:
        habitacion = CampoExtraido(valor=hab_match.group(1), confianza=0.90, raw_text=hab_match.group(0))
    else:
        compuesto = re.search(r"(?:^|\s)(\d+)-(\d+[A-Za-z]?)(?:\s|$)", texto)
        if compuesto:
            if not piso.valor:
                piso = CampoExtraido(valor=compuesto.group(1), confianza=0.75, raw_text=compuesto.group(0))
            if not habitacion.valor:
                habitacion = CampoExtraido(valor=compuesto.group(2), confianza=0.75, raw_text=compuesto.group(0))

    return piso, habitacion


def _extraer_edad(texto: str) -> CampoExtraido:
    """Extrae la edad."""
    for patron in [r"(\d{1,3})\s*años", r"Edad\s*:?\s*(\d{1,3})", r"(\d{1,3})\s*a\b"]:
        match = re.search(patron, texto, re.IGNORECASE)
        if match:
            edad = int(match.group(1))
            if 0 <= edad <= 120:
                return CampoExtraido(valor=str(edad), confianza=0.88, raw_text=match.group(0))
    return CampoExtraido()


def _extraer_estado_salud(texto: str) -> CampoExtraido:
    """Extrae el estado de salud con palabras clave."""
    estados = {
        "estable": 0.70, "grave": 0.85, "cr[ií]tico": 0.85,
        "reservado": 0.80, "mejor[ií]a": 0.75, "sedado": 0.85,
        "intubado": 0.85, "quir[oó]fano": 0.90, "alta m[eé]dica": 0.90,
        "observaci[oó]n": 0.75, "fallecido": 0.95, "urgencia": 0.80,
        "emergencia": 0.80, "uci": 0.90, "hospitalizaci[oó]n": 0.70,
    }
    texto_lower = texto.lower()
    for estado, conf in estados.items():
        if re.search(rf"\b{estado}\b", texto_lower):
            return CampoExtraido(valor=estado.capitalize(), confianza=conf, raw_text=estado)
    return CampoExtraido()


def _extraer_contacto(texto: str) -> CampoExtraido:
    """Extrae y normaliza el número de contacto venezolano."""
    patrones = [
        r"\+58\s*(\d{3})[\s-]?(\d{3})[\s-]?(\d{2})[\s-]?(\d{2})",
        r"(04(?:12|14|16|24|26|18|28))\s*[\s-]?\s*(\d{3})\s*[\s-]?\s*(\d{2})\s*[\s-]?\s*(\d{2})",
        r"(?:T[eé]l[eé]fono|Tlf|Contacto)\s*:?\s*(\+?[\d\s-]{7,15})",
        r"(0\d{3}[\s-]?\d{3}[\s-]?\d{2}[\s-]?\d{2})",
    ]

    for i, patron in enumerate(patrones):
        match = re.search(patron, texto, re.IGNORECASE)
        if match:
            if i == 0:
                digitos = "+58" + "".join(match.groups())
                return CampoExtraido(valor=digitos, confianza=0.90, raw_text=match.group(0))
            elif i == 1:
                digitos = "+58" + "".join(match.groups())
                return CampoExtraido(valor=digitos, confianza=0.90, raw_text=match.group(0))
            elif i == 2:
                raw = match.group(1)
                digitos = "".join(c for c in raw if c.isdigit() or c == "+")
                return CampoExtraido(valor=digitos, confianza=0.70, raw_text=match.group(0))
            else:
                digitos = "".join(c for c in match.group(1) if c.isdigit())
                return CampoExtraido(valor="+58" + digitos, confianza=0.65, raw_text=match.group(1))

    return CampoExtraido()


async def estructurar_texto_con_gemini(lineas: list[str], contexto: str = "") -> GeminiResponse:
    """
    Envía el texto extraído por OCR a Gemini para estructuración (solo texto, sin imagen).
    Más barato y rápido que enviar la imagen completa a Gemini Vision.
    """
    from app.services.gemini_service import _configurar_gemini
    import google.generativeai as genai

    _configurar_gemini()

    texto_ocr = "\n".join(lineas)
    if not texto_ocr.strip():
        return GeminiResponse(pacientes=[], advertencias=["No se detectó texto"])

    contexto_bloque = ""
    if contexto:
        contexto_bloque = f"""CONTEXTO DEL LISTADO (proporcionado por el administrador):
{contexto}

────────────────────────────────────────────────────────

"""
    prompt = f"""{contexto_bloque}Estructura los siguientes datos de pacientes venezolanos extraídos por OCR de una foto de listado hospitalario.

TEXTO OCR:
```
{texto_ocr}
```

INSTRUCCIONES:
1. Identifica cada paciente
2. Extrae: nombre, cédula (solo dígitos), hospital, piso, habitación, edad, estado_salud, contacto (+58XXXXXXXXX)
3. Confianza 0.9 si claro, 0.6 si dudoso, null si no aparece
4. Devuelve SOLO JSON, sin markdown, sin explicación, sin comillas simples:

{{
  "pacientes": [
    {{
      "nombre": {{ "valor": "Nombre", "confianza": 0.9, "raw_text": "texto" }},
      "cedula": {{ "valor": "12345678", "confianza": 0.9, "raw_text": "texto" }},
      "hospital": {{ "valor": "Hospital X", "confianza": 0.9, "raw_text": "texto" }},
      "piso": {{ "valor": "3", "confianza": 0.9, "raw_text": "texto" }},
      "habitacion": {{ "valor": "312", "confianza": 0.9, "raw_text": "texto" }},
      "edad": {{ "valor": "45", "confianza": 0.9, "raw_text": "texto" }},
      "estado_salud": {{ "valor": "Estable", "confianza": 0.9, "raw_text": "texto" }},
      "contacto": {{ "valor": "+584121234567", "confianza": 0.9, "raw_text": "texto" }}
    }}
  ],
  "advertencias": []
}}"""

    model = genai.GenerativeModel(
        model_name=settings.gemini_model,
        generation_config={"temperature": 0.0, "max_output_tokens": 8192},
    )

    response = model.generate_content(prompt)

    from app.services.gemini_service import _parsear_respuesta
    return _parsear_respuesta(response.text)


async def estructurar_con_gemini_con_imagen(ruta_imagen: str, lineas: list[str], contexto: str = "") -> GeminiResponse:
    """
    Envía la imagen ORIGINAL + el texto OCR a Gemini para estructuración.
    Gemini ve la imagen (para contexto visual) y el texto extraído por OCR
    (para precisión). Es el motor más preciso pero el más caro.
    """
    from app.services.gemini_service import _configurar_gemini
    import google.generativeai as genai
    import base64

    _configurar_gemini()

    texto_ocr = "\n".join(lineas)
    if not texto_ocr.strip():
        return GeminiResponse(pacientes=[], advertencias=["No se detectó texto"])

    with open(ruta_imagen, "rb") as f:
        img_b64 = base64.b64encode(f.read()).decode()

    contexto_bloque = ""
    if contexto:
        contexto_bloque = f"""CONTEXTO DEL LISTADO (proporcionado por el administrador):
{contexto}

────────────────────────────────────────────────────────

"""
    prompt = f"""{contexto_bloque}Eres un extractor de datos de listados hospitalarios venezolanos.

Tienes dos fuentes de información:
1. La IMAGEN original del listado (adjunta)
2. El texto extraído por OCR de esa misma imagen (abajo)

Usa AMBAS fuentes para extraer los datos de cada paciente.
La imagen te da contexto visual. El OCR te da el texto exacto.

TEXTO OCR:
```
{texto_ocr}
```

Devuelve SOLO JSON con esta estructura exacta (sin markdown, sin explicación):
{{
  "pacientes": [
    {{
      "nombre": {{"valor": "Nombre Apellido", "confianza": 0.95, "raw_text": "texto"}},
      "cedula": {{"valor": "12345678", "confianza": 0.95, "raw_text": "texto"}},
      "hospital": {{"valor": "Hospital X", "confianza": 0.95, "raw_text": "texto"}},
      "piso": {{"valor": "3", "confianza": 0.95, "raw_text": "texto"}},
      "habitacion": {{"valor": "312", "confianza": 0.95, "raw_text": "texto"}},
      "edad": {{"valor": "45", "confianza": 0.95, "raw_text": "texto"}},
      "estado_salud": {{"valor": "Estable", "confianza": 0.95, "raw_text": "texto"}},
      "contacto": {{"valor": "+584121234567", "confianza": 0.95, "raw_text": "texto"}}
    }}
  ],
  "advertencias": []
}}

Si un campo no está disponible, pon {{"valor": null, "confianza": null, "raw_text": null}}.
Extrae TODOS los pacientes visibles.
"""

    model = genai.GenerativeModel(
        model_name=settings.gemini_model,
        generation_config={"temperature": 0.0, "max_output_tokens": 8192},
    )

    response = model.generate_content([
        prompt,
        {"inline_data": {"mime_type": "image/jpeg", "data": img_b64}},
    ])

    from app.services.gemini_service import _parsear_respuesta
    return _parsear_respuesta(response.text)
