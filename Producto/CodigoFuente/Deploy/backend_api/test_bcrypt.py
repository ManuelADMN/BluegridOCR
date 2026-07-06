import bcrypt

plain_pw = "password-segura-de-prueba"
hashed_pw = bcrypt.hashpw(plain_pw.encode("utf-8"), bcrypt.gensalt(rounds=12))

try:
    # Test checkpw
    match = bcrypt.checkpw(plain_pw.encode("utf-8"), hashed_pw)
    print(f"Match: {match}")
except Exception as e:
    print(f"Error: {e}")
