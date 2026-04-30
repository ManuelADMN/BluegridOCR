import psycopg2
from services.db import DB_URL
from services.auth_utils import get_password_hash

def seed_admin():
    conn = psycopg2.connect(DB_URL)
    try:
        cur = conn.cursor()
        
        # Check if admin exists
        cur.execute("SELECT id_usuario FROM usuarios WHERE username = 'admin'")
        admin = cur.fetchone()
        
        hashed_pw = "$2y$12$Z/c.TZTylWpevHeETwQwRO1bsdD98FfhnONrhf0MD0mOGCyFKLMT."
        
        if admin:
            print("Updating existing admin password...")
            cur.execute("UPDATE usuarios SET password = %s WHERE username = 'admin'", (hashed_pw,))
        else:
            print("Creating new admin user...")
            # Assuming fk_rol 1 is admin
            cur.execute(
                "INSERT INTO usuarios (username, password, nombre_completo, fk_rol) VALUES (%s, %s, %s, %s)",
                ('admin', hashed_pw, 'Administrador General', 1)
            )
        
        conn.commit()
        print("✅ Admin user seeded/updated successfully.")
    except Exception as e:
        print(f"❌ Error seeding admin: {e}")
        conn.rollback()
    finally:
        conn.close()

if __name__ == "__main__":
    seed_admin()
