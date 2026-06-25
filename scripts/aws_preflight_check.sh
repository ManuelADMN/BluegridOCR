#!/usr/bin/env sh
set -eu

echo "== AWS preflight BluegridOCR =="

if ! command -v aws >/dev/null 2>&1; then
  echo "NO CUMPLE: AWS CLI no disponible"
  exit 1
fi
echo "CUMPLE: AWS CLI disponible"
aws --version

if [ -z "${AWS_REGION:-}" ] && [ -z "${AWS_DEFAULT_REGION:-}" ]; then
  echo "NO CUMPLE: AWS_REGION/AWS_DEFAULT_REGION no configurada"
  exit 1
fi
echo "CUMPLE: region configurada (${AWS_REGION:-$AWS_DEFAULT_REGION})"

echo "== Identidad AWS =="
aws sts get-caller-identity
echo "CUMPLE: identidad AWS valida"

echo "== ECR repositories =="
aws ecr describe-repositories >/dev/null
echo "CUMPLE: ECR disponible y permisos de lectura validos"

echo "PENDIENTE: permisos EC2/ECS no validados por este script"
echo "CUMPLE: preflight AWS/OIDC/ECR finalizado"
