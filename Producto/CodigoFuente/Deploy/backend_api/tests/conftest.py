"""
Configuración de pytest para los tests del motor OCR.

Inserta la raíz `backend_api/` en sys.path para permitir `from services.motor_ia import ...`
sin depender del cwd. No abre conexiones de red ni de base de datos.
"""
import os
import sys

BACKEND_API_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BACKEND_API_ROOT not in sys.path:
    sys.path.insert(0, BACKEND_API_ROOT)
