#!/usr/bin/env bash
set -euo pipefail
umask 077

if [[ $# -ne 3 ]]; then
  echo "Uso: bash $0 /ruta/privada/nueva imagen@sha256:digest https://host/agestyles-product-media" >&2
  exit 2
fi

env_dir=$1
image=$2
media_url=$3
if [[ ! $env_dir =~ ^/[a-zA-Z0-9_./-]+$ || -e $env_dir || -L $env_dir ||
      ! $image =~ ^[a-zA-Z0-9_./:-]+@sha256:[a-f0-9]{64}$ ||
      ! $media_url =~ ^https://[a-zA-Z0-9.-]+/agestyles-product-media$ ]]; then
  echo "Indica una carpeta absoluta nueva, una imagen por digest y la URL HTTPS del bucket." >&2
  exit 2
fi
parent=$(realpath -- "$(dirname -- "$env_dir")")
repo=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd -P)
if [[ ! $parent =~ ^/[a-zA-Z0-9_./-]*$ || $parent == "$repo" || $parent == "$repo/"* ]]; then
  echo "La carpeta privada debe quedar fuera del repositorio." >&2
  exit 2
fi
env_dir="$parent/$(basename -- "$env_dir")"

postgres_password=$(openssl rand -hex 32)
minio_password=$(openssl rand -hex 32)
jwt_secret=$(openssl rand -hex 32)
cookie_secret=$(openssl rand -hex 32)
mkdir -- "$env_dir"
cat > "$env_dir/compose.env" <<EOF
AGESTYLES_PRODUCTION_IMAGE=$image
AGESTYLES_PRODUCTION_API_ENV_FILE=$env_dir/api.env
AGESTYLES_PRODUCTION_POSTGRES_PASSWORD=$postgres_password
AGESTYLES_PRODUCTION_MINIO_USER=agestyles-media-admin
AGESTYLES_PRODUCTION_MINIO_PASSWORD=$minio_password
EOF
cat > "$env_dir/api.env" <<EOF
DATABASE_URL=postgres://agestyles_production:$postgres_password@127.0.0.1:15473/agestyles_commerce
JWT_SECRET=$jwt_secret
COOKIE_SECRET=$cookie_secret
S3_REGION=us-east-1
S3_FILE_URL=$media_url
EOF
echo "Archivos privados creados en $env_dir. Añade a api.env las claves de la cuenta de servicio de MinIO."
