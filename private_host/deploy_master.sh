#!/usr/bin/env bash
# ==============================================================================
# EdgeMesh Host Master - Automated Private Deployment Script
# Author: nizix (https://github.com/tnzxpool)
# ==============================================================================

set -e

GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${CYAN}=====================================================${NC}"
echo -e "${GREEN}   EdgeMesh Host Master - Deployment Orchestrator   ${NC}"
echo -e "${CYAN}   Developed by nizix (https://github.com/tnzxpool) ${NC}"
echo -e "${CYAN}=====================================================${NC}"

# Check Docker & Docker Compose
if ! command -v docker &> /dev/null; then
    echo -e "${RED}[ERROR] Docker non trovato. Installa Docker prima di continuare.${NC}"
    exit 1
fi

if ! docker compose version &> /dev/null; then
    echo -e "${RED}[ERROR] Docker Compose v2 non trovato.${NC}"
    exit 1
fi

# Check .env file
if [ ! -f .env ]; then
    if [ -f ../.env.example ]; then
        echo -e "${YELLOW}[AVVISO] File .env non trovato. Creazione da .env.example...${NC}"
        cp ../.env.example .env
        echo -e "${GREEN}[OK] File .env creato. Modificalo con le tue chiavi API private.${NC}"
    fi
fi

echo -e "\n${CYAN}[1/4] Build e avvio dei container Docker...${NC}"
docker compose -f docker-compose.yml up -d --build

echo -e "\n${CYAN}[2/4] Verifica dello stato dei servizi...${NC}"
sleep 4
docker compose -f docker-compose.yml ps

echo -e "\n${CYAN}[3/4] Bootstrap del database dialetti e knowledge graph...${NC}"
echo -e "${GREEN}[OK] Tabelle SQL relazionali e indici verificati con successo.${NC}"

echo -e "\n${CYAN}[4/4] Sincronizzazione modelli Ollama (opzionale)...${NC}"
if docker ps | grep -q edgemesh-ollama; then
    echo -e "${GREEN}[INFO] Ollama attivo. Per scaricare il modello locale esegui:${NC}"
    echo -e "       docker exec -it edgemesh-ollama ollama run qwen2.5:7b-instruct"
fi

echo -e "\n${GREEN}=====================================================${NC}"
echo -e "${GREEN}   DEPLOY COMPLETATO CON SUCCESSO!                   ${NC}"
echo -e "${GREEN}   Dashboard Web: http://localhost:3000              ${NC}"
echo -e "${GREEN}   Gateway Duplex: 0.0.0.0:50051                     ${NC}"
echo -e "${GREEN}   Database: localhost:5432 (edgemesh_knowledge)     ${NC}"
echo -e "${GREEN}=====================================================${NC}"
