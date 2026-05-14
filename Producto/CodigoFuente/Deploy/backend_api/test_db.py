import psycopg2
from core.config import settings

try:
    print(f"Conectando a Supabase...")
    conn = psycopg2.connect(settings.DATABASE_URL, connect_timeout=10)
    cur = conn.cursor()
    cur.execute("SELECT 1")
    print("✅ Conexión a Supabase exitosa!")
    
    cur.execute("SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name")
    tables = [r[0] for r in cur.fetchall()]
    print(f"Tablas encontradas ({len(tables)}):", tables)
    
    if "usuarios" in tables:
        cur.execute("SELECT id_usuario, correo, nombre_completo, activo FROM usuarios LIMIT 5")
        users = cur.fetchall()
        print(f"\nUsuarios ({len(users)}):")
        for u in users:
            print(f"  ID: {u[0]} | Correo: '{u[1]}' | Name: {u[2]} | Activo: {u[3]}")
    
    conn.close()
except Exception as e:
    print(f"❌ Error: {e}")
