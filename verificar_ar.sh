#!/bin/bash

# ==========================================
# Script de Verificação de Dados - Ar-Saúde
# ==========================================

# 1. Definição de Cores para o Terminal (UX)
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # Sem Cor

# 2. Definição das URLs (facilita a manutenção se a URL mudar)
CATALOG_URL="https://interscity.rasppi.cloud/catalog/resources?per_page=500"
COLLECTOR_BASE_URL="https://interscity.rasppi.cloud/collector/resources"

echo -e "${BLUE}Iniciando verificação de dados do Ar-Saúde...${NC}\n"

# 3. Verificação de Dependências (Garante que curl e jq existam)
if ! command -v jq &> /dev/null; then
    echo -e "${RED}Erro: O comando 'jq' não está instalado. Instale-o (sudo dnf install jq / sudo apt install jq) para continuar.${NC}"
    exit 1
fi

if ! command -v curl &> /dev/null; then
    echo -e "${RED}Erro: O comando 'curl' não está instalado.${NC}"
    exit 1
fi

echo -e "Consultando catálogo do InterSCity...\n"

# 4. Busca os recursos com tratamento de falha de conexão (--fail)
RESOURCES=$(curl -s --fail "$CATALOG_URL") || {
    echo -e "${RED}❌ Erro ao conectar ao Catálogo do InterSCity.${NC}"
    exit 1
}

# 5. Otimização do Parse JSON: Extrai UUID e NOME de uma vez e separa por TAB (@tsv)
echo "$RESOURCES" | jq -r '.resources[]? | select(.description | contains("Ar-Saúde")) | [.uuid, (.description | sub("Monitoramento Ar-Saúde - Bairro: "; ""))] | @tsv' | \
while IFS=$'\t' read -r UUID NAME; do
    
    # Previne a execução caso a busca retorne vazia
    if [ -z "$UUID" ]; then
        continue
    fi

    echo -e "${CYAN}========================================${NC}"
    echo -e "📍 ${YELLOW}Bairro: $NAME${NC} ${BLUE}(UUID: $UUID)${NC}"

    # 6. Busca os dados mais recentes do Collector
    RESPONSE=$(curl -s --fail "${COLLECTOR_BASE_URL}/${UUID}/data") || {
        echo -e "  ${RED}❌ Erro de conexão ao buscar dados no coletor para este bairro.${NC}"
        continue
    }

    # 7. Checa se o bairro já possui dados coletados com segurança
    HAS_DATA=$(echo "$RESPONSE" | jq -r 'if (.resources[0].capabilities | length) > 0 then "true" else "false" end')

    if [ "$HAS_DATA" == "true" ]; then
        echo -e "📊 ${GREEN}Última Medição:${NC}"
        
        # O uso do `// "N/A"` garante que o script não quebre se algum valor vier nulo
        echo "$RESPONSE" | jq -r '.resources[0].capabilities | to_entries[]? | "  - \(.key): \(.value[-1].value // "N/A")"'
    else
        echo -e "⏳ ${YELLOW}Ainda não há dados coletados para este bairro (Aguarde a próxima execução do Cron).${NC}"
    fi
    sleep 1
done

echo -e "\n${CYAN}========================================${NC}"
echo -e "${GREEN}Verificação concluída com sucesso!${NC}"
