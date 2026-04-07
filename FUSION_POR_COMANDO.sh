#!/usr/bin/env bash
set -euo pipefail

# 1) Descomprimir ambas versiones
rm -rf orig dev merged
mkdir -p orig dev merged
unzip -q portal-vetneb-main.zip -d orig
unzip -q portal-vetneb-dev-eficiencia.zip -d dev

# 2) Base = repo original
cp -a orig/portal-vetneb-main/. merged/

# 3) Superponer cambios auditados
rsync -a \
  --exclude='.gitignore' \
  dev/ merged/

# 4) Limpiar residuos eliminados en la auditoría
rm -rf merged/backup-inicial merged/index.js

# 5) Empaquetar resultado fusionado
(cd merged && zip -qr ../portal-vetneb-fusionado-comando.zip .)
