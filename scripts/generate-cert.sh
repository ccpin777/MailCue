#!/bin/sh
set -eu
CERT_DIR="$HOME/Library/Application Support/MailCue/certs"
mkdir -p "$CERT_DIR"
openssl req -x509 -newkey rsa:2048 -nodes -days 825 \
  -keyout "$CERT_DIR/localhost-key.pem" \
  -out "$CERT_DIR/localhost.pem" \
  -subj "/CN=localhost" \
  -addext "subjectAltName=DNS:localhost,IP:127.0.0.1"
chmod 600 "$CERT_DIR/localhost-key.pem"
printf '%s\n' "Created $CERT_DIR/localhost.pem" "Trust this certificate in your macOS login Keychain before sideloading the add-in."
