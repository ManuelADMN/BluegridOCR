import psycopg2
from core.config import settings

def seed_admin():
    try:
        print(f"Conectando a la base de datos...")
        conn = psycopg2.connect(settings.DATABASE_URL)
        cur = conn.cursor()
        
        # El hash para 'admin1234'
        hashed_pw = "$2y$12$Z/c.TZTylWpevHeETwQwRO1bsdD98FfhnONrhf0MD0mOGCyFKLMT."
        
        # Verificar si el usuario 'admin' existe por username
        cur.execute("SELECT id_usuario FROM usuarios WHERE username = 'admin'")
        admin = cur.fetchone()
        
        if admin:
            print(f"Actualizando contraseña para el usuario 'admin' (ID: {admin[0]})...")
            cur.execute("UPDATE usuarios SET password_hash = %s, activo = TRUE WHERE username = 'admin'", (hashed_pw,))
        else:
            # Si no existe por username, ver si el ID 1 es el administrador (que suele serlo)
            cur.execute("SELECT id_usuario FROM usuarios WHERE id_usuario = 1")
            user1 = cur.fetchone()
            
            if user1:
                print("Actualizando el usuario con ID 1 para que sea 'admin'...")
                cur.execute(
                    "UPDATE usuarios SET username = 'admin', password_hash = %s, nombre_completo = 'Administrador General', activo = TRUE WHERE id_usuario = 1",
                    (hashed_pw,)
                )
            else:
                print("Creando nuevo usuario 'admin'...")
                # Asumiendo fk_rol 1 es admin y rut ficticio
                cur.execute(
                    "INSERT INTO usuarios (username, password_hash, nombre_completo, rut, correo, fk_rol, activo) VALUES (%s, %s, %s, %s, %s, %s, %s)",
                    ('admin', hashed_pw, 'Administrador General', '11.111.111-1', 'admin@denoise.cl', 1, True)
                )
        
        conn.commit()
        print("✅ Usuario 'admin' listo. Contraseña: admin1234")
    except Exception as e:
        print(f"❌ Error: {e}")
        if 'conn' in locals():
            conn.rollback()
    finally:
        if 'conn' in locals():
            conn.close()

if __name__ == "__main__":
    seed_admin()
