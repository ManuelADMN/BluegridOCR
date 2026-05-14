import psycopg2
import os
from dotenv import load_dotenv

load_dotenv()
DB_URL = os.getenv("DATABASE_URL")

def check_schema():
    conn = psycopg2.connect(DB_URL)
    cur = conn.cursor()
    cur.execute("SELECT column_name FROM information_schema.columns WHERE table_name = 'usuarios'")
    columns = [row[0] for row in cur.fetchall()]
    print(f"Columns in 'usuarios': {columns}")
    conn.close()

if __name__ == "__main__":
    check_schema()
