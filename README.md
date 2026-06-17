# 🌬️ Ar-Saúde — Plataforma de Monitoramento da Qualidade do Ar

O **Ar-Saúde** é um sistema completo e distribuído (baseado em microsserviços) criado para monitorar, alertar e visualizar em tempo real a qualidade do ar em diversos bairros da cidade de São Luís, Maranhão, Brasil. 

O projeto foi construído utilizando **TypeScript**, **Nest.js**, e **Next.js**, centralizando toda a comunicação e o histórico de dados climáticos na plataforma de cidades inteligentes **InterSCity**.

---

## 🏗️ Arquitetura e Fluxo de Funcionamento

O sistema é dividido em três grandes pilares, garantindo alta escalabilidade e separação de responsabilidades:

```text
  ┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
  │   APIs Externas │ ────> │ Microsserviço 1 │ ────> │   InterSCity    │
  │ (Open-Meteo &   │       │    (Coletor)    │       │ (Banco Central) │
  │ OpenWeatherMap) │       └─────────────────┘       └────────┬────────┘
  └─────────────────┘                                          │
                                                               │ (Leitura)
                                                               ▼
  ┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
  │    Usuário      │ <──── │    Frontend     │ <──── │ Microsserviço 2 │
  │  (Dashboard)    │       │   (Next.js)     │       │(Motor Alertas)  │
  └─────────────────┘       └─────────────────┘       └─────────────────┘
```

### 1. Microsserviço 1: Coletor (Diretório `/src` - NestJS)
Sua principal responsabilidade é rodar rotinas agendadas (Cron Jobs) que consultam as coordenadas geográficas de cada bairro de São Luís nas APIs meteorológicas externas.
- **Coleta Híbrida de Qualidade do Ar**: 
  - Consulta a **Open-Meteo API** para obter índices unificados de qualidade do ar e concentração de poluentes base.
  - Consulta a **OpenWeatherMap API** paralelamente para capturar e enriquecer a carga com gases adicionais críticos (como CO, NO, NO₂, SO₂, NH₃).
- **Publicação**: Após mesclar os dados em uma unidade padronizada (`µg/m3`), o Coletor monta a medição no padrão InterSCity e envia (POST) as atualizações para o Catálogo (Capabilities/Recursos) através do gateway de API Kong.

#### ⚙️ Resiliência sob carga (Fila + Cache em memória)
Para aguentar rajadas de requisições (ex.: ~1000 coletas) sem perder dados nem estourar o limite das APIs externas, o Coletor usa duas peças de infraestrutura **100% em memória** (sem dependências externas como Redis):

- **Fila de requisições** (`RequestQueueService`): em vez de processar os bairros inline, o cron apenas *enfileira* um job por bairro. A fila consome os jobs com **concorrência limitada**, **retry com backoff exponencial** e uma **dead-letter** para jobs que esgotam as tentativas — garantindo que nenhuma requisição se perca.
- **Cache em memória** (`CacheService`): respostas da Open-Meteo e da OpenWeatherMap são cacheadas por coordenada com **TTL** configurável. Dentro da janela, coletas repetidas dos mesmos bairros respondem da memória, reduzindo drasticamente o número de chamadas externas.

Variáveis de ambiente relevantes (ver `.env.example`): `QUEUE_CONCURRENCY`, `QUEUE_MAX_ATTEMPTS`, `CACHE_TTL_MS`.

#### 🩺 Alta disponibilidade do InterSCity (Primário + Fallback + Healthcheck)
A integração com o InterSCity é tolerante a falhas:

- **Endpoint primário** (`INTERSCITY_CATALOG_URL` / `INTERSCITY_ADAPTOR_URL`, padrão LSDI/UFMA) é **sempre preferido**.
- Se o primário cair, há **failover automático** para o **fallback** (`*_FALLBACK`).
- Um **healthcheck periódico** (a cada 60s, via `GET {catalog}/capabilities`) verifica primário e fallback, religando o primário assim que ele volta. Também roda na inicialização, antes de registrar capabilities/resources.

**Endpoints de observabilidade / teste de carga:**

| Método | Rota                 | Descrição                                                        |
| ------ | -------------------- | ---------------------------------------------------------------- |
| `GET`  | `/`                  | Healthcheck do serviço.                                          |
| `GET`  | `/stats`             | Estado em tempo real da fila (pendentes, ativos, processados, falhos, dead-letter), do cache (hits, misses, hit rate) e do InterSCity (endpoint ativo, primário/fallback up). |
| `GET`  | `/interscity/health` | Dispara um healthcheck **ao vivo** do primário + fallback.       |
| `POST` | `/collect`           | Enfileira manualmente a coleta de todos os bairros (simular carga). |

```bash
# dispara uma rodada de coleta e observa a fila/cache absorvendo a carga
curl -X POST http://localhost:3000/collect
curl http://localhost:3000/stats

# checa ao vivo se o InterSCity (primário e fallback) está no ar
curl http://localhost:3000/interscity/health
```

#### 🔥 Teste de carga (stress test com rampa)
Para comprovar que a aplicação aguenta rajadas, há um teste de carga que **sobe a concorrência aos poucos** — `10 → 25 → 50 → 100 → 250 → 500 → 1000 → 2000 → 3000 → 5000` requisições simultâneas — mantendo cada nível por alguns segundos e medindo throughput, taxa de sucesso e latência (p50/p95/p99) por estágio.

```bash
# 1) suba o coletor
npm run start:dev

# 2) em outro terminal, rode a rampa (dura ~4 min com os padrões)
npm run load:test
```

Configurável por variáveis de ambiente:

| Variável             | Padrão                          | Descrição                                  |
| -------------------- | ------------------------------- | ------------------------------------------ |
| `LOAD_URL`           | `http://localhost:3000`         | Base do servidor alvo                      |
| `LOAD_PATH`          | `/stats`                        | Rota alvo (leve, sem rede externa)         |
| `LOAD_METHOD`        | `GET`                           | `GET` ou `POST` (use `POST` p/ `/collect`) |
| `LOAD_STAGE_SECONDS` | `20`                            | Duração de cada nível da rampa             |
| `LOAD_STAGES`        | `10,25,...,5000`                | Níveis de concorrência                     |

```bash
# rampa mais longa (30s por nível)
LOAD_STAGE_SECONDS=30 npm run load:test

# martelando a fila de coleta (cuidado: cresce a fila em memória)
LOAD_PATH=/collect LOAD_METHOD=POST LOAD_STAGES=10,50,100 npm run load:test
```

### 2. Microsserviço 2: Motor de Alertas (Diretório `/motor-alertas` - NestJS)
É o cérebro avaliativo do sistema. Possui banco de dados próprio (**PostgreSQL** via TypeORM, provisionado pelo Docker Compose) e age como consumidor final do barramento da cidade inteligente.
- Consulta ativamente a API de dados recentes do **InterSCity**.
- Cruza as concentrações de poluentes contra limiares e diretrizes globais da Organização Mundial da Saúde (OMS 2021).
- Identifica picos críticos (ex: PM2.5 muito alto) e gera **Alertas** persistentes com base na periculosidade daquela amostra de ar específica para o bairro afetado.

### 3. Frontend: Dashboard (Diretório `/frontend` - Next.js)
Interface voltada para o usuário final e gestores, construída em React com foco em alta responsividade e performance (estilização por CSS modular e leve).
- Fornece um painel robusto contendo o histórico temporal da poluição, estatísticas gerais e um mapa geolocalizado de calor de São Luís.
- Suporta **Light Mode** e **Dark Mode**.
- Contém explicações toxicológicas sobre os poluentes exibidos nas colunas de dados (tooltips) e a respectiva margem de segurança da OMS, traduzindo dados brutos em orientações amigáveis.
- **Alertas em tempo real**: além do polling periódico, o painel se inscreve no fluxo **SSE** (`GET /alerts/stream`) do Motor de Alertas e reage na hora a cada alerta criado/resolvido.

---

## 📋 Pré-requisitos

Para rodar todo o ecossistema localmente na sua máquina, certifique-se de possuir instalado:
- **Node.js** (versão 20 ou superior)
- **Docker** e **Docker Compose** *(Altamente recomendado para subir os três serviços simultaneamente)*

---

## 🛠️ Como Executar a Plataforma

A forma mais simples de colocar todo o sistema no ar é utilizando a nossa orquestração via **Docker Compose**, já configurada na raiz do repositório.

### Passo 1: Configuração das Variáveis de Ambiente
Copie e renomeie os arquivos `.env` de exemplo fornecidos nas pastas cruciais do projeto:

```bash
# Na raiz do projeto (Coletor):
cp .env.example .env

# Na pasta do Motor de Alertas:
cd motor-alertas && cp .env.example .env && cd ..

# Na pasta do Frontend:
cd frontend && cp .env.example .env && cd ..
```
*Se aplicável, preencha a variável `OPENWEATHER_API_KEY` com a sua chave pessoal da API dentro do `.env` do Coletor.*

### Passo 2: Inicialização
Na raiz do repositório, faça o *build* estrutural e levante os containers:
```bash
docker-compose up --build
```

O comando irá criar, compilar e executar de forma orquestrada todos os serviços:
- 🌬️ `coletor-ar` na porta **3000** (Responsável por rodar o cron de coleta)
- 🚨 `motor-alertas` na porta **3001** (Fornecedor da API de dados consumíveis)
- 📊 `frontend` na porta **3002** (Servidor web SSR para a interface)
- 🐘 `postgres` na porta **5433** (Banco do Motor de Alertas)
- 📈 `prometheus` na porta **9090** (Coleta as métricas dos microsserviços)
- 📊 `grafana` na porta **3003** (Dashboards de observabilidade — `admin`/`admin`)
- 🔭 `jaeger` na porta **16686** (Tracing distribuído)

### Passo 3: Acessando a Aplicação
Com os terminais rodando limpos sem erros:
- **Dashboard Web**: **http://localhost:3002**
- **Grafana** (dashboard Ar-Saúde já provisionado): **http://localhost:3003**
- **Prometheus**: **http://localhost:9090**
- **Jaeger** (traces): **http://localhost:16686**

> **Nota**: Ao rodar pela primeiríssima vez, a página inicial pode demorar de 10 a 20 segundos para popular a tabela de bairros, pois o Coletor precisa executar o primeiro turno do *Cron Job* em segundo plano, ir até as APIs externas e enviar a primeira leva pro banco de dados da nuvem.

---

## 📈 Observabilidade (Métricas + Tracing)

A plataforma é instrumentada de ponta a ponta para inspeção em tempo real.

### Métricas (Prometheus + Grafana)
Ambos os microsserviços expõem `GET /metrics` no formato Prometheus:
- **Coletor**: fila (pendentes, ativos, processados, falhos, dead-letter), cache (hits/misses/hit rate), InterSCity (primário/fallback up, endpoint ativo, total de failovers), coletas e medições enviadas/falhas.
- **Motor de Alertas**: ciclos de monitoramento, leituras salvas/avaliadas, alertas criados/atualizados/resolvidos, alertas ativos e duração do último ciclo.

O **Prometheus** (`:9090`) faz scrape dos dois serviços a cada 5s e o **Grafana** (`:3003`, `admin`/`admin`) já vem com o dashboard **"Ar-Saúde — Observabilidade"** provisionado.

```bash
curl http://localhost:3000/metrics   # métricas do Coletor
curl http://localhost:3001/metrics   # métricas do Motor de Alertas
```

### Tracing distribuído (OpenTelemetry + Jaeger)
Cada serviço inicializa o **OpenTelemetry** (`src/tracing.ts`, carregado antes de tudo no `main.ts`) com auto-instrumentação de HTTP/Express/Nest/axios, exportando spans via **OTLP/HTTP** para o **Jaeger** (`:16686`). Assim é possível seguir um trace atravessando *Coletor → Kong → InterSCity* e *Motor → InterSCity*.

Controlado por variáveis padrão do OTel: `OTEL_SERVICE_NAME`, `OTEL_EXPORTER_OTLP_ENDPOINT` e `OTEL_SDK_DISABLED=true` (para desligar). Rodando fora do Docker:

```bash
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318 npm run start:dev
```

---

## 🧪 Chaos Test — Failover do InterSCity ao vivo

Para **comprovar** (e não só descrever) o failover automático, há um teste de chaos que derruba o primário do InterSCity no meio da operação e observa o endpoint ativo migrar para o fallback — e voltar quando o primário se recupera.

```bash
# 1) suba o coletor
npm run start:dev

# 2) em outro terminal, rode o chaos test
npm run chaos:test
```

Ele usa o endpoint de chaos (também útil manualmente):

```bash
# força o primário como DOWN → failover para o fallback
curl -X POST http://localhost:3000/chaos/interscity-primary -H 'Content-Type: application/json' -d '{"down":true}'
# recupera o primário
curl -X POST http://localhost:3000/chaos/interscity-primary -H 'Content-Type: application/json' -d '{"down":false}'
```

> **Shutdown gracioso**: no `SIGTERM`/`SIGINT` o Coletor para de iniciar novos jobs e **drena** os que estão em andamento (até `QUEUE_DRAIN_TIMEOUT_MS`, padrão 10s) antes de encerrar, evitando perder trabalho em voo.

---

## 🔍 InterSCity: O Centro de Retenção de Dados

Todo o fluxo foi planejado seguindo os padrões arquiteturais de Internet das Coisas (IoT) em Smart Cities. 
- A robustez baseia-se no fato do Microsserviço Coletor atuar apenas como um "Sensor/Adapter" genérico. Ele detecta, adapta a estrutura da requisição e empilha as métricas nos recursos virtuais do Catálogo na nuvem da UFMA (InterSCity).
- O armazenamento e a série temporal pesada da poluição ocorrem 100% debaixo do guarda-chuva do **InterSCity**.
- O Motor de Alertas, por sua vez, é apenas uma aplicação final de terceira parte consumidora, totalmente desacoplada das diretrizes de coletas. Isso significa que, se as APIs de previsão mudarem ou o coletor cair, o motor ainda mantém a avaliação histórica local acessível no Frontend.
