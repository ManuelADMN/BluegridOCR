# Gestión segura de credenciales

## Estado aplicado en el repositorio

- La contraseña de evaluación fue retirada de README, evidencias, `seed_admin.py` y `test_bcrypt.py`.
- `seed_admin.py` exige `ADMIN_PASSWORD` desde el entorno.
- Los archivos `.env` permanecen ignorados por Git.
- Los ejemplos contienen placeholders, no secretos funcionales.

## Acción externa obligatoria del propietario

La eliminación del texto en la rama actual no invalida una credencial que ya fue publicada. El propietario debe rotar, fuera de Git:

1. Contraseña del administrador.
2. `JWT_SECRET_KEY`.
3. Clave Anthropic si estuvo en logs o documentación.
4. Credenciales de Supabase si fueron compartidas.

Ejemplo seguro para regenerar el administrador:

```powershell
cd Producto/CodigoFuente/Deploy/backend_api
$env:ADMIN_PASSWORD = Read-Host "Nueva contraseña"
python create_admin.py --username admin@bluegrid.cl
Remove-Item Env:ADMIN_PASSWORD
```

Verificación antes del commit:

```powershell
git grep -n -I -E "(password|secret|token|api[_-]?key)" -- ':!*.env' ':!**/package-lock.json'
git status --short
git diff --check
```
