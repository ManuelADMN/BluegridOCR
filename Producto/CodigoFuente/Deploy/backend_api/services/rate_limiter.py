"""
Limitador de intentos de login en memoria, con bloqueo progresivo.

Objetivo: mitigar ataques de fuerza bruta contra /auth/login y reducir el riesgo para la
seguridad de los datos personales (Ley 21.719, art. 14 quinquies; principio de seguridad
del art. 3 f). El bloqueo se evalúa ANTES de tocar la base de datos, por lo que también
protege frente a agotamiento de conexiones.

Diseño:
- Clave por (IP, usuario): así se frena tanto una IP probando muchos usuarios como muchos
  intentos contra un mismo usuario desde una IP.
- Ventana deslizante de fallos; superado el umbral, se bloquea por un tiempo que se duplica
  en cada reincidencia (backoff exponencial) hasta un tope.
- Reloj inyectable (`time_fn`) para pruebas deterministas.

Limitación conocida: el estado es por proceso. En despliegues con varios workers/instancias
se necesitaría un almacén compartido (p. ej. Redis). Documentado a propósito.
"""
import threading
import time as _time
from dataclasses import dataclass


@dataclass
class _Bucket:
    fails: int = 0
    window_start: float = 0.0
    locked_until: float = 0.0
    breaches: int = 0


class LoginRateLimiter:
    def __init__(
        self,
        *,
        max_attempts: int = 5,
        window_seconds: int = 300,
        base_lock_seconds: int = 60,
        max_lock_seconds: int = 900,
        time_fn=_time.monotonic,
    ):
        self.max_attempts = max_attempts
        self.window_seconds = window_seconds
        self.base_lock_seconds = base_lock_seconds
        self.max_lock_seconds = max_lock_seconds
        self._now = time_fn
        self._buckets: dict[str, _Bucket] = {}
        self._lock = threading.Lock()

    def seconds_until_unlock(self, key: str) -> int:
        """Segundos que faltan para que la clave se desbloquee (0 si no está bloqueada)."""
        now = self._now()
        with self._lock:
            b = self._buckets.get(key)
            if b and b.locked_until > now:
                return int(b.locked_until - now) + 1
            return 0

    def register_failure(self, key: str) -> int:
        """Registra un intento fallido. Devuelve los segundos de bloqueo si este fallo lo
        provocó; 0 si aún no se alcanza el umbral."""
        now = self._now()
        with self._lock:
            b = self._buckets.get(key)
            if b is None:
                b = _Bucket(window_start=now)
                self._buckets[key] = b

            # Reinicia la ventana si expiró y no hay un bloqueo vigente.
            if now - b.window_start > self.window_seconds and b.locked_until <= now:
                b.fails = 0
                b.window_start = now

            b.fails += 1
            if b.fails >= self.max_attempts:
                lock = min(self.base_lock_seconds * (2 ** b.breaches), self.max_lock_seconds)
                b.locked_until = now + lock
                b.breaches += 1
                b.fails = 0
                b.window_start = now
                return int(lock)
            return 0

    def reset(self, key: str) -> None:
        """Limpia el estado de una clave (tras un login exitoso)."""
        with self._lock:
            self._buckets.pop(key, None)


# Singleton compartido por el proceso.
login_rate_limiter = LoginRateLimiter()
