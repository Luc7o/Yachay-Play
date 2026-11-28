#!/usr/bin/env bash
# ============================================================================
# RESPALDO DE LA BASE DE DATOS (lo corre .github/workflows/respaldo-db.yml)
# ----------------------------------------------------------------------------
# 1. pg_dump completo en formato "custom" (comprimido, se restaura con pg_restore).
# 2. Comprueba que la copia se pueda leer (pg_restore --list) y que traiga tablas.
# 3. La cifra con GPG (AES-256) usando una frase secreta: el repositorio es
#    público y los artefactos de GitHub los puede bajar cualquiera, así que la
#    copia NUNCA se guarda sin cifrar.
#
# Variables:
#   DATABASE_URL    cadena de conexión (directa, no la del pooler) — secreto
#   RESPALDO_CLAVE  frase para cifrar (larga y aleatoria) — secreto
#   SALIDA          carpeta donde dejar el archivo (por defecto: respaldo/)
#
# Para restaurar, ver README → "Respaldo de la base de datos".
# ============================================================================
set -euo pipefail

: "${DATABASE_URL:?Falta el secreto DATABASE_URL (Settings → Secrets → Actions)}"
: "${RESPALDO_CLAVE:?Falta el secreto RESPALDO_CLAVE (Settings → Secrets → Actions)}"
if [ "${#RESPALDO_CLAVE}" -lt 20 ]; then
  echo "RESPALDO_CLAVE es muy corta: usa al menos 20 caracteres aleatorios." >&2
  exit 1
fi

SALIDA="${SALIDA:-respaldo}"
mkdir -p "$SALIDA"
FECHA="$(date -u +%Y-%m-%d_%H%M)"
DUMP="$(mktemp -d)/yachayplay.dump"
ARCHIVO="$SALIDA/yachayplay_${FECHA}.dump.gpg"

echo "Versión de pg_dump: $(pg_dump --version)"
echo "Haciendo la copia..."
pg_dump "$DATABASE_URL" --format=custom --compress=9 --no-owner --no-privileges --file="$DUMP"

# La copia debe poder leerse y traer las tablas de la app
TABLAS="$(pg_restore --list "$DUMP" | grep -c ' TABLE public ' || true)"
DATOS="$(pg_restore --list "$DUMP" | grep -c ' TABLE DATA ' || true)"
echo "Copia leída: $TABLAS tablas, $DATOS con datos."
if [ "$TABLAS" -lt 1 ]; then
  echo "La copia no trae tablas: algo salió mal." >&2
  exit 1
fi
for t in users games classes; do
  if ! pg_restore --list "$DUMP" | grep -qE " TABLE public $t( |$)"; then
    echo "Falta la tabla '$t' en la copia." >&2
    exit 1
  fi
done

gpg --batch --yes --quiet --pinentry-mode loopback --symmetric --cipher-algo AES256 \
  --passphrase-fd 3 --output "$ARCHIVO" "$DUMP" 3<<<"$RESPALDO_CLAVE"
rm -f "$DUMP"

echo "Respaldo cifrado: $ARCHIVO ($(du -h "$ARCHIVO" | cut -f1))"
if [ -n "${GITHUB_OUTPUT:-}" ]; then
  echo "archivo=$ARCHIVO" >>"$GITHUB_OUTPUT"
  echo "nombre=yachayplay_${FECHA}" >>"$GITHUB_OUTPUT"
fi
