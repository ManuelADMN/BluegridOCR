import psycopg2
import os
from dotenv import load_dotenv

# Cargar variables de entorno (DATABASE_URL)
load_dotenv()
DB_URL = os.getenv("DATABASE_URL")

def seed_admin():
    """
    Crea o actualiza el usuario administrador inicial.
    """
    conn = None
    try:
        print("Conectando a la base de datos...")
        conn = psycopg2.connect(DB_URL)
        cur = conn.cursor()
        
        # El hash para 'admin1234'
        hashed_pw = "$2y$12$Z/c.TZTylWpevHeETwQwRO1bsdD98FfhnONrhf0MD0mOGCyFKLMT."
        
        # 1. Verificar si el usuario 'admin' ya existe
        cur.execute("SELECT id_usuario FROM usuarios WHERE username = 'admin'")
        admin = cur.fetchone()
        
        if admin:
            print(f"Actualizando contraseña para el usuario 'admin' existente (ID: {admin[0]})...")
            cur.execute(
                "UPDATE usuarios SET password_hash = %s, activo = TRUE WHERE username = 'admin'", 
                (hashed_pw,)
            )
        else:
            print("Creando nuevo usuario 'admin'...")
            # Asumiendo que el ID de rol para admin es 1 (verificado en la tabla roles)
            # Se incluyen campos adicionales que suelen ser obligatorios en este esquema
            cur.execute(
                """
                INSERT INTO usuarios (username, password_hash, nombre_completo, fk_rol, rut, correo, activo) 
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                """,
                ('admin', hashed_pw, 'Administrador General', 1, '11.111.111-1', 'admin@bluegrid.cl', True)
            )
        
        conn.commit()
        print("✅ Usuario 'admin' configurado exitosamente.")
        print("   Username: admin")
        print("   Password: admin1234")
        
    except Exception as e:
        print(f"❌ Error al crear admin: {e}")
        if conn:
            conn.rollback()
    finally:
        if conn:
            conn.close()

if __name__ == "__main__":
    seed_admin()
