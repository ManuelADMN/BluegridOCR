from create_admin import upsert_admin


ADMIN_USERNAME = "admin@bluegrid.cl"
ADMIN_PASSWORD = "BGCwc5NLVULdnmItX7"


def seed_admin() -> None:
    upsert_admin(ADMIN_USERNAME, ADMIN_PASSWORD)
    print(f"Usuario '{ADMIN_USERNAME}' listo como admin.")


if __name__ == "__main__":
    seed_admin()
