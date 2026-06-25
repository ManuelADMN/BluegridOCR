# AWS Student Connection Checklist

## 1. Que ya dejo listo el repositorio

- Workflow CI: `.github/workflows/ci-bluegrid.yml`.
- Workflow AWS/ECR OIDC: `.github/workflows/aws-ecr-ready.yml`.
- Compose productivo raiz: `docker-compose.prod.yml`.
- Scripts:
  - `scripts/check_health.sh`
  - `scripts/build_local.sh`
  - `scripts/docker_validate.sh`
  - `scripts/aws_preflight_check.sh`
- Ejemplo de entorno raiz sin secretos: `.env.example`.
- Evidencias:
  - `Documentation/evidencias/system_discovery.log`
  - `Documentation/evidencias/local_validation.log`
  - `Documentation/evidencias/docker_validation.log`
  - `Documentation/evidencias/security_scan.log`

Estado actual:

- Frontend build/test: CUMPLE local.
- Backend tests: CUMPLE local.
- Docker compose config: CUMPLE local.
- Docker build/up local: PENDIENTE/NO CUMPLE por Docker daemon no disponible.
- AWS OIDC/ECR: PENDIENTE hasta configurar cuenta AWS Student y variables GitHub.

## 2. Que debe configurarse en AWS

1. Entrar a AWS Console.
2. Ir a IAM.
3. Crear Identity Provider OIDC:

```text
Provider URL: https://token.actions.githubusercontent.com
Audience: sts.amazonaws.com
```

4. Crear IAM Role para GitHub Actions.
5. Configurar trust policy restringida al repositorio.

Trust policy base:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "arn:aws:iam::<AWS_ACCOUNT_ID>:oidc-provider/token.actions.githubusercontent.com"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
        },
        "StringLike": {
          "token.actions.githubusercontent.com:sub": "repo:<GITHUB_OWNER>/<GITHUB_REPO>:ref:refs/heads/main"
        }
      }
    }
  ]
}
```

6. Crear politica minima para ECR:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "ecr:CreateRepository",
        "ecr:DescribeRepositories",
        "ecr:GetAuthorizationToken",
        "ecr:BatchCheckLayerAvailability",
        "ecr:InitiateLayerUpload",
        "ecr:UploadLayerPart",
        "ecr:CompleteLayerUpload",
        "ecr:PutImage"
      ],
      "Resource": "*"
    }
  ]
}
```

7. Asociar politica al rol.
8. Copiar ARN del rol.

## 3. Que configurar en GitHub

En:

```text
Settings -> Secrets and variables -> Actions -> Variables
```

Agregar:

```text
AWS_REGION=us-east-1
AWS_ROLE_ARN=arn:aws:iam::<ACCOUNT_ID>:role/<ROLE_NAME>
ECR_REPOSITORY=bluegridocr
```

No crear:

```text
AWS_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY
```

## 4. Como probar conexion

1. Ir a GitHub Actions.
2. Ejecutar manualmente `Bluegrid AWS ECR Ready`.
3. Revisar paso `aws sts get-caller-identity`.
4. Verificar que exista o se cree ECR.
5. Verificar imagenes subidas:
   - `<registry>/<repo>:backend-<sha>`
   - `<registry>/<repo>:frontend-<sha>`

## 5. Si falla

| Error | Causa probable | Solucion |
| --- | --- | --- |
| Could not assume role | Trust policy incorrecta | Revisar owner/repo/rama |
| Access denied ECR | Permisos insuficientes | Agregar politica ECR |
| Missing AWS_ROLE_ARN | Variable no creada en GitHub | Crear variable |
| No OpenIDConnect provider found | Falta OIDC Provider | Crear Identity Provider |
| Repository does not exist | ECR no creado | Permitir CreateRepository |
| Docker build failed | Dockerfile/dependencias fallan en runner | Revisar log del workflow CI |

## 6. Recomendacion para AWS Student

Primera etapa:

```text
ECR + EC2 con Docker Compose.
```

Segunda etapa:

```text
ECS Fargate si la cuenta Student permite ECS, IAM y networking suficiente.
```

Motivo:

- EC2 + Docker Compose es mas rapido para entrega y depuracion.
- ECR permite evidenciar CI/CD real con imagenes versionadas.
- ECS queda como evolucion profesional cuando la cuenta permita permisos suficientes.
