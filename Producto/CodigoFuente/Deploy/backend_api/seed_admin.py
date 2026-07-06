import os

from create_admin import upsert_admin


ADMIN_USERNAME = "admin@bluegrid.cl"


def seed_admin() -> None:
    password = os.getenv("ADMIN_PASSWORD")
    if not password:
        raise RuntimeError("Define ADMIN_PASSWORD antes de ejecutar seed_admin.py.")
    upsert_admin(ADMIN_USERNAME, password)
    print(f"Usuario '{ADMIN_USERNAME}' listo como admin.")


if __name__ == "__main__":
    seed_admin()
