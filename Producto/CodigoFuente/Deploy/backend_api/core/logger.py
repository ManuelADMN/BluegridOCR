import logging
import os

_LOG_DIR = os.path.join(os.path.dirname(__file__), "..", "logs")
os.makedirs(_LOG_DIR, exist_ok=True)

_fmt = logging.Formatter("%(asctime)s | %(levelname)-8s | %(message)s", datefmt="%Y-%m-%d %H:%M:%S")

_console = logging.StreamHandler()
_console.setFormatter(_fmt)

_file = logging.FileHandler(os.path.join(_LOG_DIR, "app.log"), encoding="utf-8")
_file.setFormatter(_fmt)

logger = logging.getLogger("bluegridocr")
logger.setLevel(logging.DEBUG)
logger.addHandler(_console)
logger.addHandler(_file)
logger.propagate = False
