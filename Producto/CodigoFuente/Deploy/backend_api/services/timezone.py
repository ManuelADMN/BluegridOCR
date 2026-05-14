from datetime import datetime
from zoneinfo import ZoneInfo

from core.config import settings


APP_ZONE = ZoneInfo(settings.APP_TIMEZONE)


def app_now() -> datetime:
    return datetime.now(APP_ZONE)


def app_now_naive() -> datetime:
    return app_now().replace(tzinfo=None)
