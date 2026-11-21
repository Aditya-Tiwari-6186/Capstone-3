#!/bin/sh
set -eu

data_dir="${SECUREMARK_DATA:-/data}"
legacy_dir="${SECUREMARK_LEGACY_DATA:-/legacy-data}"
mkdir -p "$data_dir"
if [ "${NODE_ENV:-}" = "production" ]; then
  if [ -z "${SECUREMARK_SECRET:-}" ]; then
    echo "SECUREMARK_SECRET is required in production." >&2
    exit 1
  fi
  if [ -z "${SIGNING_KEY_PEM:-}" ]; then
    echo "SIGNING_KEY_PEM is required in production." >&2
    exit 1
  fi
fi
if [ -d "$legacy_dir" ]; then
  for name in ed25519.pem; do
    if [ ! -e "$data_dir/$name" ] && [ -f "$legacy_dir/$name" ]; then
      cp "$legacy_dir/$name" "$data_dir/$name"
    fi
  done
  if [ "${SECUREMARK_IMPORT_LEGACY_DB:-1}" = "1" ] &&
     [ ! -e "$data_dir/db.json" ] && [ -f "$legacy_dir/db.json" ]; then
    cp "$legacy_dir/db.json" "$data_dir/db.json"
  fi
  if [ -d "$legacy_dir/files" ]; then
    mkdir -p "$data_dir/files"
    for file in "$legacy_dir"/files/*; do
      if [ -f "$file" ] && [ ! -e "$data_dir/files/$(basename "$file")" ]; then
        cp "$file" "$data_dir/files/"
      fi
    done
  fi
fi

if [ -z "${SECUREMARK_SECRET:-}" ]; then
  secret_file="$data_dir/.securemark-secret"
  mkdir -p "$(dirname "$secret_file")"
  if [ ! -s "$secret_file" ]; then
    umask 077
    secret_tmp="${secret_file}.$$"
    node -e 'process.stdout.write(require("node:crypto").randomBytes(32).toString("hex"))' > "$secret_tmp"
    mv "$secret_tmp" "$secret_file"
  fi
  SECUREMARK_SECRET="$(cat "$secret_file")"
  export SECUREMARK_SECRET
fi

exec "$@"
