#!/usr/bin/env bash
# ==============================================================================
# EdgeMesh Host Master - Database Backup & Recovery Tool
# Author: nizix (https://github.com/tnzxpool)
# ==============================================================================

ACTION=$1
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_DIR="./backups"

mkdir -p "$BACKUP_DIR"

if [ "$ACTION" == "backup" ]; then
    echo "[BACKUP] Esportazione del database dei dialetti e del knowledge graph..."
    docker exec -t edgemesh-postgres pg_dump -U nizix_admin -d edgemesh_knowledge > "$BACKUP_DIR/edgemesh_backup_${TIMESTAMP}.sql"
    echo "[SUCCESS] Backup salvato in: $BACKUP_DIR/edgemesh_backup_${TIMESTAMP}.sql"

elif [ "$ACTION" == "restore" ]; then
    FILE=$2
    if [ -z "$FILE" ]; then
        echo "[ERROR] Specifica il file SQL da ripristinare. Esempio: ./backup_restore.sh restore ./backups/mio_file.sql"
        exit 1
    fi
    echo "[RESTORE] Ripristino del database dal file: $FILE..."
    cat "$FILE" | docker exec -i edgemesh-postgres psql -U nizix_admin -d edgemesh_knowledge
    echo "[SUCCESS] Ripristino completato con successo!"

else
    echo "Uso: ./backup_restore.sh [backup|restore <file.sql>]"
fi
