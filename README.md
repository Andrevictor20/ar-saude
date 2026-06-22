# 🌬️ Ar-Saúde — Plataforma de Monitoramento da Qualidade do Ar

O **Ar-Saúde** é um sistema completo e distribuído (baseado em microsserviços) criado para monitorar, alertar e visualizar em tempo real a qualidade do ar em diversos bairros da cidade de São Luís, Maranhão, Brasil. 

O projeto foi construído utilizando **TypeScript**, **Nest.js**, e **Next.js**, centralizando toda a comunicação e o histórico de dados climáticos na plataforma de cidades inteligentes **InterSCity**.

---

## 🏗️ Arquitetura de Implantação (Produção)

O sistema foi arquitetado para ser resiliente e distribuído em múltiplos ambientes, garantindo alta disponibilidade. A topologia de produção divide a carga de processamento e os serviços da seguinte maneira:

### 🍓 1. Raspberry Pi 4 
O hardware principal responsável por rodar os microsserviços da aplicação, a interface do usuário e a camada de observabilidade.
- **Microsserviço 1 (Coletor)**: Roda internamente na porta **3000**.
- **Microsserviço 2 (Motor de Alertas)**: Roda na porta **3001**.
- **Frontend (Dashboard)**: Roda na porta **3002**.
- **Stack de Monitoramento**:
  - **Prometheus**: Porta **9090**.
  - **Grafana**: Porta **3003**.

### 💻 2. Máquina Virtual Debian 12 
Uma VM dedicada a atuar como nó de fallback para a plataforma InterSCity e gerenciar o tráfego da API.
- **InterSCity (Instância de Fallback)**: Roda na porta **8000**.
- **Kong API Gateway**: Roda na porta **8001**, atuando como proxy reverso e gerenciador de APIs para o InterSCity.

### 🌐 3. Exposição via Cloudflare Tunnels
Para garantir acesso seguro aos serviços locais a partir da internet, sem a necessidade de abrir portas no roteador, o sistema utiliza **Cloudflare Tunnels**. Abaixo estão os domínios de produção configurados:

| Serviço | Domínio Público | Destino Local (Infraestrutura) |
| :--- | :--- | :--- |
| **Frontend (Dashboard)** | `https://arsaude.rasppi.cloud` | `http://192.168.100.17:3002` (Raspberry Pi) |
| **Motor de Alertas (API)** | `https://alertas.rasppi.cloud` | `http://192.168.100.17:3001` (Raspberry Pi) |
| **Grafana (Observabilidade)** | `https://grafana-ar-saude.rasppi.cloud` | `http://192.168.100.17:3003` (Raspberry Pi) |
| **Prometheus (Métricas)** | `https://prometheus-ar-saude.rasppi.cloud` | `http://192.168.100.17:9090` (Raspberry Pi) |
| **InterSCity (Fallback)** | `https://interscity.rasppi.cloud` | `http://10.0.2.15:8000` (VM Debian 12) |
| **Kong (Gateway)** | `https://kong.rasppi.cloud` | `http://10.0.2.15:8001` (VM Debian 12) |

---

## ⚙️ Arquitetura Lógica e Microsserviços

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
- **Coleta Híbrida**: Consulta a **Open-Meteo API** e **OpenWeatherMap API** para capturar índices de qualidade do ar e gases (CO, NO, NO₂, SO₂, NH₃).
- **Publicação**: Formata os dados no padrão InterSCity e envia para o Catálogo na nuvem através do Kong.
- **Resiliência**: Utiliza uma fila de processamento em memória (`RequestQueueService`) e cache (`CacheService`) para absorver rajadas de requisições sem estourar os limites das APIs públicas.
- **Alta Disponibilidade (Failover Automático)**: Possui um healthcheck periódico. Se a instância primária do InterSCity (LSDI/UFMA) cair, o Coletor redireciona o fluxo automaticamente para a instância de **fallback** rodando na VM Debian 12.

### 2. Microsserviço 2: Motor de Alertas (Diretório `/motor-alertas` - NestJS)
É o cérebro avaliativo do sistema. Possui banco de dados próprio (**PostgreSQL**).
- Consome os dados recentes diretamente do **InterSCity**.
- Avalia as concentrações de poluentes cruzando com os limites de segurança da OMS (Organização Mundial da Saúde).
- Gera e persiste **Alertas** críticos (ex: PM2.5 muito alto) com base na periculosidade por bairro.

### 3. Frontend: Dashboard (Diretório `/frontend` - Next.js)
Interface para o usuário final, construída com React.
- **Painel Robusto**: Histórico temporal, dados estatísticos e um **mapa geolocalizado interativo** de São Luís.
- **Alertas em Tempo Real**: Conecta-se via **SSE** (Server-Sent Events) ao Motor de Alertas para refletir instantaneamente a criação ou resolução de problemas no ar.
- **Temas**: Suporte a Light Mode e Dark Mode, com explicações toxicológicas sobre os poluentes.

---

## 🛠️ Como Executar Localmente (Ambiente de Desenvolvimento)

A forma mais simples de colocar todo o sistema no ar em sua máquina é via **Docker Compose**, orquestrando os serviços em um único comando.

### Pré-requisitos
- **Node.js** (versão 20 ou superior)
- **Docker** e **Docker Compose**

### Passo 1: Configuração das Variáveis de Ambiente
Copie e renomeie os arquivos `.env` de exemplo fornecidos:

```bash
# Na raiz do projeto (Coletor):
cp .env.example .env

# Na pasta do Motor de Alertas:
cd motor-alertas && cp .env.example .env && cd ..

# Na pasta do Frontend:
cd frontend && cp .env.example .env && cd ..
```
*No `.env` da raiz, você pode adicionar sua `OPENWEATHER_API_KEY` pessoal.*

### Passo 2: Inicialização via Docker Compose
Na raiz do repositório, levante os containers:
```bash
docker-compose up --build
```
Isso iniciará localmente:
- Coletor-ar (`:3000`)
- Motor-alertas (`:3001`)
- Frontend (`:3002`)
- PostgreSQL (`:5433`)
- Prometheus (`:9090`), Grafana (`:3003`)

Acesse o Dashboard Web em: **http://localhost:3002**

> **Nota**: Ao rodar pela primeira vez, o sistema pode demorar até 20 segundos para preencher a tabela inicial devido à primeira carga do Cron Job de coleta.

---

## 📈 Observabilidade e Testes de Carga

A plataforma foi construída com instrumentação nativa:

- **Métricas**: `GET /metrics` no Coletor e no Motor de Alertas no formato **Prometheus**. Exibidas dinamicamente via **Grafana** (dashboards pré-configurados).
- **Tracing**: O tracing via OpenTelemetry pode ser reativado definindo `OTEL_SDK_DISABLED=false` e configurando um coletor OTLP externo.

### Teste de Carga e Chaos (Failover)

Para rodar os testes fora do Docker (necessita npm install local):

```bash
# 1) Suba o Coletor
npm run start:dev

# 2) Em outro terminal, rodar a rampa de estresse (até 5000 reqs concorrentes)
npm run load:test

# 3) Testar a resiliência do Fallback (Chaos Engineering)
# Derruba simuladamente o InterSCity Primário e observa a migração para a VM
npm run chaos:test
```

---
*Projeto idealizado para experimentação em cidades inteligentes e integração com middlewares distribuídos (LSDI/UFMA).*
