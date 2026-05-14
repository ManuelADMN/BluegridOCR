import bcrypt

hashed_pw = "$2y$12$Z/c.TZTylWpevHeETwQwRO1bsdD98FfhnONrhf0MD0mOGCyFKLMT."
plain_pw = "admin1234"

try:
    # Test checkpw
    match = bcrypt.checkpw(plain_pw.encode('utf-8'), hashed_pw.encode('utf-8'))
    print(f"Match: {match}")
except Exception as e:
    print(f"Error: {e}")
