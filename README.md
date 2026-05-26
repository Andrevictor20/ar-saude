# 🌬️ Ar-Saúde — Microsserviço 1 (Coletor)

O **Microsserviço 1 (Coletor)** do projeto **Ar-Saúde** é um serviço em segundo plano construído sobre o framework **Nest.js** com **TypeScript**. Sua função exclusiva é executar rotinas agendadas (Cron Jobs) para coletar dados meteorológicos e de qualidade do ar da API pública **Open-Meteo**, processá-los e atualizar a plataforma de cidades inteligentes **InterSCity** com novas medições para a cidade de São Luís, Maranhão, Brasil.

---

## 🚀 Fluxo de Funcionamento

```
  ┌───────────────┐        GET /v1/air-quality        ┌─────────────────┐
  │               │ ────────────────────────────────> │  Open-Meteo API │
  │  Microsserviço│                                   └─────────────────┘
  │   1 Coletor   │ ── POST /collector/.../data ────> ┌─────────────────┐
  │   (Agendado)  │    (Roteado através do Kong)     │    InterSCity   │
  └───────────────┘                                   └─────────────────┘
```

1. **Inicialização (`onModuleInit`)**: O microsserviço tenta registrar no Catálogo do InterSCity as **Capacidades** (poluentes e índices) e dezenas de **Recursos** (um para cada Bairro monitorado em São Luís) caso ainda não estejam criados.
2. **Coleta Agendada (`@Cron`)**: Periodicamente, o coletor consulta a API do Open-Meteo iterando pelas coordenadas geográficas exatas de cada bairro.
3. **Resiliência (`retryWithBackoff`)**: Qualquer requisição HTTP falha é tratada com retry automático usando backoff exponencial e jitter.
4. **Envio de Medições**: O microsserviço empacota as medições no formato exigido pelo InterSCity e envia para o gateway de API (Kong/Adaptor) via requisição POST.

---

## 📋 Pré-requisitos

Antes de iniciar, garanta que você possui instalado na sua máquina:
- **Node.js** (versão 20 ou superior recomendada)
- **npm** (gerenciador de pacotes padrão do Node)
- **Git** (para versionamento e download do código)
- **Docker** (opcional, necessário apenas se quiser rodar em container)

---

## 🛠️ Guia de Instalação e Configuração Passo a Passo

### Passo 1: Download do Repositório
Abra um terminal no seu sistema operacional e clone o repositório público do GitHub:
```bash
git clone https://github.com/Andrevictor20/ar-saude-coletor.git
```

Acesse o diretório do projeto clonado:
```bash
cd ar-saude-coletor
```

### Passo 2: Instalação de Dependências
Dentro da pasta do projeto, execute o comando abaixo para instalar todas as dependências necessárias do NestJS e de utilitários:
```bash
npm install
```

### Passo 3: Criação e Configuração do Arquivo `.env`
O microsserviço depende de variáveis de ambiente para saber onde estão hospedados os serviços (InterSCity, API Open-Meteo, Kong) e as configurações de execução.

1. Duplique o arquivo de exemplo fornecido no repositório criando um arquivo chamado `.env`:
   ```bash
   cp .env.example .env
   ```

2. Abra o arquivo `.env` gerado em um editor de sua preferência (VS Code, Vim, Nano, etc.). Ele possui a seguinte estrutura e campos que podem ser modificados:

```env
# --- Servidor ---
PORT=3000

# --- Open-Meteo (API pública de qualidade do ar) ---
OPEN_METEO_BASE_URL=https://air-quality-api.open-meteo.com/v1/air-quality

# --- InterSCity (Plataforma de Cidades Inteligentes) ---
INTERSCITY_CATALOG_URL=https://interscity.rasppi.cloud/catalog
INTERSCITY_ADAPTOR_URL=https://interscity.rasppi.cloud/adaptor
INTERSCITY_COLLECTOR_URL=https://interscity.rasppi.cloud/collector

# --- Kong API Gateway ---
KONG_UPSTREAM_URL=https://kong.rasppi.cloud/upstreams

# --- Cron (Intervalos de execução) ---
# Expressão cron para a coleta de dados (Padrão: a cada 30 minutos)
CRON_COLLECT_INTERVAL=*/30 * * * *

# --- Retry / Resiliência ---
# Número máximo de tentativas de requisição HTTP em caso de falha/rate-limit
MAX_RETRIES=5
# Tempo base inicial em milissegundos para o backoff exponencial
RETRY_BASE_DELAY_MS=1000
```

> **Dica para testes rápidos:** Se você quiser que a rotina de coleta execute a cada minuto em vez de a cada 30 minutos, altere o valor de `CRON_COLLECT_INTERVAL` para:
> ```env
> CRON_COLLECT_INTERVAL=* * * * *
> ```

---

## 🏃 Como Executar a Aplicação

Você pode executar o microsserviço em diferentes modos:

### Opção A: Execução em Desenvolvimento (Local com Hot-Reload)
Este comando inicia o servidor em modo de observação de mudanças. Qualquer alteração nos arquivos fontes reiniciará o serviço automaticamente.
```bash
npm run start:dev
```

### Opção B: Execução em Produção (Compilado para JavaScript Puro)
Para rodar em ambiente produtivo, primeiro compile o código TypeScript para JavaScript na pasta `/dist` e depois inicie a aplicação:
```bash
npm run build
npm run start:prod
```

### Opção C: Execução com Docker (Containerizado)
Se você preferir executar a aplicação dentro de um container Docker isolado para produção:

1. Gere a imagem do Docker localmente:
   ```bash
   docker build -t ar-saude-coletor .
   ```

2. Execute o container vinculando a porta `3000` da sua máquina e injetando as variáveis do arquivo `.env`:
   ```bash
   docker run -d --name ar-saude-coletor-instance -p 3000:3000 --env-file .env ar-saude-coletor
   ```

---

## 📊 Saídas e Logs Esperados

Ao inicializar o serviço, você deverá ver logs semelhantes a estes no terminal de execução:

```text
[Nest] 12345  - 25/05/2026, 22:50:00Z     LOG [NestFactory] Starting Nest application...
[Nest] 12345  - 25/05/2026, 22:50:00Z     LOG [InstanceLoader] AppModule dependencies initialized +15ms
...
🌬️  Ar-Saúde Coletor rodando na porta 3000
[Nest] 12345  - 25/05/2026, 22:50:01Z     LOG [InterscityService] 🔧 Inicializando integração com InterSCity...
[Nest] 12345  - 25/05/2026, 22:50:01Z     LOG [InterscityService] Registrando capabilities no InterSCity...
[Nest] 12345  - 25/05/2026, 22:50:02Z     LOG [InterscityService]   ⏭️  Capability "air_quality_index" já existe, pulando.
[Nest] 12345  - 25/05/2026, 22:50:02Z     LOG [InterscityService]   ⏭️  Capability "pm10" já existe, pulando.
...
[Nest] 12345  - 25/05/2026, 22:50:03Z     LOG [InterscityService] Recurso já existe, buscando UUID...
[Nest] 12345  - 25/05/2026, 22:50:04Z     LOG [InterscityService] ✅ Recurso existente encontrado — UUID: f59d0421-2a6f-4428-98e3-e8470a1a5b82
[Nest] 12345  - 25/05/2026, 22:50:04Z     LOG [InterscityService] ✅ InterSCity inicializado — Resource UUID: f59d0421-2a6f-4428-98e3-e8470a1a5b82
```

Quando o Cron Job for ativado (conforme o intervalo configurado em `CRON_COLLECT_INTERVAL`), as seguintes mensagens serão exibidas:

```text
[Nest] 12345  - 25/05/2026, 23:00:00Z     LOG [CollectorService] ═══════════════════════════════════════════════════
[Nest] 12345  - 25/05/2026, 23:00:00Z     LOG [CollectorService] 🔄 Execução #1 — Iniciando coleta de qualidade do ar por bairros...
[Nest] 12345  - 25/05/2026, 23:00:00Z     LOG [CollectorService] ═══════════════════════════════════════════════════
[Nest] 12345  - 25/05/2026, 23:00:00Z     LOG [CollectorService] 
--- Bairro: Centro ---
[Nest] 12345  - 25/05/2026, 23:00:00Z     LOG [CollectorService] [1/2] Coletando dados do Open-Meteo...
[Nest] 12345  - 25/05/2026, 23:00:01Z     LOG [OpenMeteoService] Iniciando coleta de dados para bairro Centro (lat=-2.5283, lon=-44.3044)
[Nest] 12345  - 25/05/2026, 23:00:02Z     LOG [OpenMeteoService] ✅ Dados coletados com sucesso — AQI: 18 (Bom)
[Nest] 12345  - 25/05/2026, 23:00:02Z     LOG [CollectorService] [1/2] ✅ Dados coletados — AQI: 18 (Bom) | PM10: 10.2 | PM2.5: 4.8 | NO₂: 5.1 | O₃: 36.8
[Nest] 12345  - 25/05/2026, 23:00:02Z     LOG [CollectorService] [2/2] Enviando dados ao InterSCity...
[Nest] 12345  - 25/05/2026, 23:00:02Z     LOG [InterscityService] 📤 Enviando medição ao InterSCity — URL: https://interscity.rasppi.cloud/adaptor/resources/f59d0421-2a6f-4428-98e3-e8470a1a5b82/data
[Nest] 12345  - 25/05/2026, 23:00:03Z     LOG [InterscityService] ✅ Medição enviada com sucesso para Centro — AQI: 18 (Bom)
[Nest] 12345  - 25/05/2026, 23:00:03Z     LOG [CollectorService] [2/2] ✅ Medição de Centro enviada com sucesso!
[Nest] 12345  - 25/05/2026, 23:00:03Z     LOG [CollectorService] 
--- Bairro: Renascença ---
...
[Nest] 12345  - 25/05/2026, 23:00:33Z     LOG [CollectorService] 🏁 Execução #1 concluída em 33230ms
```

---

## 🔍 Como Visualizar no InterSCity se Tudo está Funcionando

Você pode testar a integridade das conexões e dados gravados no banco do InterSCity utilizando a ferramenta de terminal `curl` para fazer requisições HTTP diretas à plataforma.

### 1. Testar o healthcheck local do microsserviço
Antes de consultar as nuvens, garanta que o microsserviço local está respondendo:
```bash
curl -s http://localhost:3000/
```
**Resposta esperada:**
```json
{"status":"ok","service":"ar-saude-coletor","timestamp":"2026-05-25T23:00:00.000Z"}
```

---

### 2. Verificar as Capabilities (Capacidades) no InterSCity
Consulte a API pública do Catálogo do InterSCity para garantir que os parâmetros do Ar-Saúde foram registrados no sistema:
```bash
curl -s https://interscity.rasppi.cloud/catalog/capabilities
```
Se você quiser filtrar apenas por uma específica para poluir menos o terminal, por exemplo, a capability de nível da qualidade do ar:
```bash
curl -s https://interscity.rasppi.cloud/catalog/capabilities | grep -A 3 -B 1 '"name": "air_quality_level"'
```
**Resposta esperada:**
```json
{
  "name": "air_quality_level",
  "description": "Classificação textual do nível de qualidade do ar (ex.: Bom, Moderado, Ruim)",
  "capability_type": "sensor"
}
```

---

### 3. Visualizar Dados Coletados por Bairro (Script Bash)
Como o microsserviço agora registra múltiplos bairros (múltiplos UUIDs), você pode utilizar o script abaixo no seu terminal para iterar pelos recursos no Catálogo e automaticamente consultar os níveis de poluição de cada um deles no Coletor.

Certifique-se de ter a ferramenta `jq` instalada (`sudo apt install jq` no Linux) e execute:

```bash
curl -s https://interscity.rasppi.cloud/catalog/resources | \
jq -c '.resources[] | select(.description | contains("Ar-Saúde")) | {uuid: .uuid, name: (.description | sub("Monitoramento Ar-Saúde - Bairro: "; ""))}' | \
while read -r item; do
    UUID=$(echo "$item" | jq -r .uuid)
    NAME=$(echo "$item" | jq -r .name)
    echo "========================================"
    echo "📍 Bairro: $NAME"
    
    # Busca os dados mais recentes do Collector
    RESPONSE=$(curl -s "https://interscity.rasppi.cloud/collector/resources/${UUID}/data")
    
    # Checa se o bairro já possui dados coletados
    HAS_DATA=$(echo "$RESPONSE" | jq '.resources[0].capabilities | length > 0')
    
    if [ "$HAS_DATA" == "true" ]; then
        echo "📊 Última Medição:"
        echo "$RESPONSE" | jq -r '.resources[0].capabilities | to_entries[] | "  - \(.key): \(.value[-1].value)"'
    else
        echo "⏳ Ainda não há dados coletados para este bairro (Aguarde a próxima execução do Cron)."
    fi
done
```

**Resultado Esperado:**
```text
========================================
📍 Bairro: Centro
📊 Última Medição:
  - air_quality_index: 23
  - pm10: 10.6
  - pm2_5: 7.2
  - no2: 4.2
  - ozone: 57
  - air_quality_level: Moderado
========================================
...
```

### 5. Consultar Dados de uma Única Capability Específica
Se você quiser obter a série temporal histórica de apenas uma propriedade (ex: apenas o `air_quality_index`), use:
```bash
UUID="f59d0421-2a6f-4428-98e3-e8470a1a5b82"
curl -s "https://interscity.rasppi.cloud/collector/resources/${UUID}/data/air_quality_index"
```
