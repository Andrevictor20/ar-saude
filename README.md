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

### 2. Microsserviço 2: Motor de Alertas (Diretório `/motor-alertas` - NestJS)
É o cérebro avaliativo do sistema. Possui banco de dados embutido (SQLite via TypeORM) e age como consumidor final do barramento da cidade inteligente.
- Consulta ativamente a API de dados recentes do **InterSCity**.
- Cruza as concentrações de poluentes contra limiares e diretrizes globais da Organização Mundial da Saúde (OMS 2021).
- Identifica picos críticos (ex: PM2.5 muito alto) e gera **Alertas** persistentes com base na periculosidade daquela amostra de ar específica para o bairro afetado.

### 3. Frontend: Dashboard (Diretório `/frontend` - Next.js)
Interface voltada para o usuário final e gestores, construída em React com foco em alta responsividade e performance (estilização por CSS modular e leve).
- Fornece um painel robusto contendo o histórico temporal da poluição, estatísticas gerais e um mapa geolocalizado de calor de São Luís.
- Suporta **Light Mode** e **Dark Mode**.
- Contém explicações toxicológicas sobre os poluentes exibidos nas colunas de dados (tooltips) e a respectiva margem de segurança da OMS, traduzindo dados brutos em orientações amigáveis.

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

O comando irá criar, compilar e executar de forma orquestrada as três instâncias:
- 🌬️ `coletor-ar` na porta **3000** (Responsável por rodar o cron de coleta)
- 🚨 `motor-alertas` na porta **3001** (Fornecedor da API de dados consumíveis)
- 📊 `frontend` na porta **3002** (Servidor web SSR para a interface)

### Passo 3: Acessando a Aplicação
Com os terminais rodando limpos sem erros:
- Abra seu navegador de internet e vá até: **http://localhost:3002** para acessar o **Dashboard Web**.

> **Nota**: Ao rodar pela primeiríssima vez, a página inicial pode demorar de 10 a 20 segundos para popular a tabela de bairros, pois o Coletor precisa executar o primeiro turno do *Cron Job* em segundo plano, ir até as APIs externas e enviar a primeira leva pro banco de dados da nuvem.

---

## 🔍 InterSCity: O Centro de Retenção de Dados

Todo o fluxo foi planejado seguindo os padrões arquiteturais de Internet das Coisas (IoT) em Smart Cities. 
- A robustez baseia-se no fato do Microsserviço Coletor atuar apenas como um "Sensor/Adapter" genérico. Ele detecta, adapta a estrutura da requisição e empilha as métricas nos recursos virtuais do Catálogo na nuvem da UFMA (InterSCity).
- O armazenamento e a série temporal pesada da poluição ocorrem 100% debaixo do guarda-chuva do **InterSCity**.
- O Motor de Alertas, por sua vez, é apenas uma aplicação final de terceira parte consumidora, totalmente desacoplada das diretrizes de coletas. Isso significa que, se as APIs de previsão mudarem ou o coletor cair, o motor ainda mantém a avaliação histórica local acessível no Frontend.
