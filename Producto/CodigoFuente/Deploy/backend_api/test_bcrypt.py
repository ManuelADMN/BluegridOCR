import bcrypt

hashed_pw = "$2b$12$Hw8EU7eW3dgQIk51/OVY2eeWSotOy/RSsf9ugP5mr5ppJFErTQTP."
plain_pw = "BGCwc5NLVULdnmItX7"

try:
    # Test checkpw
    match = bcrypt.checkpw(plain_pw.encode('utf-8'), hashed_pw.encode('utf-8'))
    print(f"Match: {match}")
except Exception as e:
    print(f"Error: {e}")
