#!/usr/bin/env node
/**
 * Teste de carga com RAMPA progressiva para o Coletor Ar-Saúde.
 *
 * Sobe a concorrência aos poucos (10 → ... → 5000 requisições simultâneas),
 * mantendo cada nível por alguns segundos, e mede para cada estágio:
 *   - throughput (req/s)
 *   - taxa de sucesso / falha (+ tipos de erro)
 *   - latência (min, média, p50, p90, p95, p99, max)
 *
 * Não derruba a aplicação: o objetivo é provar que ela aguenta a rajada
 * (fila + cache absorvem a carga) sem perder requisições.
 *
 * --- Uso ---
 *   1. Suba o coletor:   npm run start:dev   (porta 3000)
 *   2. Rode o teste:     npm run load:test
 *
 * --- Configuração via env ---
 *   LOAD_URL=http://localhost:3000   Base do servidor
 *   LOAD_PATH=/stats                 Rota alvo (leve, sem rede externa)
 *   LOAD_METHOD=GET                  GET ou POST (use POST p/ /collect)
 *   LOAD_STAGE_SECONDS=20            Duração de cada estágio (segundos)
 *   LOAD_STAGES=10,25,50,...,5000    Níveis de concorrência da rampa
 *
 * Exemplos:
 *   LOAD_STAGE_SECONDS=30 npm run load:test
 *   LOAD_PATH=/collect LOAD_METHOD=POST LOAD_STAGES=10,50,100 npm run load:test
 */

import http from 'node:http';
import https from 'node:https';
import { performance } from 'node:perf_hooks';

// ────────────────────────────── Configuração ──────────────────────────────
const BASE = process.env.LOAD_URL ?? 'http://localhost:3000';
const PATH = process.env.LOAD_PATH ?? '/stats';
const METHOD = (process.env.LOAD_METHOD ?? 'GET').toUpperCase();
const STAGE_SECONDS = Number(process.env.LOAD_STAGE_SECONDS ?? 20);
const COOLDOWN_MS = Number(process.env.LOAD_COOLDOWN_MS ?? 2000);
const STAGES = (
  process.env.LOAD_STAGES ?? '10,25,50,100,250,500,1000,2000,3000,5000'
)
  .split(',')
  .map((s) => Number(s.trim()))
  .filter((n) => Number.isFinite(n) && n > 0);

const target = new URL(PATH, BASE);
const client = target.protocol === 'https:' ? https : http;
// keepAlive reaproveita sockets; maxSockets alto permite concorrência real.
const agent = new client.Agent({
  keepAlive: true,
  maxSockets: Math.max(...STAGES) + 100,
  rejectUnauthorized: false,
});

// Buckets de latência (ms) para percentis aproximados sem guardar tudo.
const BUCKETS = [
  1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610, 1000, 1500, 2000, 3000,
  5000, 10000, Infinity,
];

// ────────────────────────────── Helpers ──────────────────────────────
function newStats() {
  return {
    total: 0,
    ok: 0,
    failed: 0,
    sumMs: 0,
    minMs: Infinity,
    maxMs: 0,
    hist: new Array(BUCKETS.length).fill(0),
    errors: {},
  };
}

function record(stats, r) {
  stats.total++;
  stats.sumMs += r.ms;
  if (r.ms < stats.minMs) stats.minMs = r.ms;
  if (r.ms > stats.maxMs) stats.maxMs = r.ms;
  let i = 0;
  while (r.ms > BUCKETS[i]) i++;
  stats.hist[i]++;
  if (r.ok) {
    stats.ok++;
  } else {
    stats.failed++;
    const key = r.error ?? `HTTP ${r.status}`;
    stats.errors[key] = (stats.errors[key] ?? 0) + 1;
  }
}

function percentile(stats, p) {
  if (stats.total === 0) return 0;
  const threshold = stats.total * p;
  let cum = 0;
  for (let i = 0; i < BUCKETS.length; i++) {
    cum += stats.hist[i];
    if (cum >= threshold) {
      // teto do bucket, nunca acima do máximo real observado
      return BUCKETS[i] === Infinity ? stats.maxMs : Math.min(BUCKETS[i], stats.maxMs);
    }
  }
  return stats.maxMs;
}

function doRequest() {
  return new Promise((resolve) => {
    const start = performance.now();
    const options = { method: METHOD, agent };
    if (METHOD === 'POST') {
      options.headers = { 'Content-Type': 'application/json' };
    }
    const req = client.request(target, options, (res) => {
      res.on('data', () => {}); // drena o corpo
      res.on('end', () => {
        const ms = performance.now() - start;
        const ok = res.statusCode >= 200 && res.statusCode < 400;
        resolve({ ok, status: res.statusCode, ms });
      });
    });
    req.on('error', (err) => {
      resolve({
        ok: false,
        status: 0,
        ms: performance.now() - start,
        error: err.code ?? err.message,
      });
    });
    if (METHOD === 'POST') req.end('{}');
    else req.end();
  });
}

async function runStage(concurrency, durationMs) {
  const stats = newStats();
  const deadline = performance.now() + durationMs;

  async function worker() {
    while (performance.now() < deadline) {
      const r = await doRequest();
      record(stats, r);
    }
  }

  const t0 = performance.now();
  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  stats.elapsedS = (performance.now() - t0) / 1000;
  return stats;
}

function fmt(n, w = 0) {
  return String(n).padStart(w);
}

function printStageResult(concurrency, s) {
  const rps = (s.total / s.elapsedS).toFixed(0);
  const avg = (s.sumMs / Math.max(s.total, 1)).toFixed(1);
  const okRate = ((s.ok / Math.max(s.total, 1)) * 100).toFixed(1);
  const errSummary =
    s.failed === 0
      ? 'nenhum'
      : Object.entries(s.errors)
          .map(([k, v]) => `${k}×${v}`)
          .join(', ');

  console.log(
    `│ ${fmt(concurrency, 5)} │ ${fmt(s.total, 8)} │ ${fmt(rps, 7)} │ ` +
      `${fmt(s.ok, 8)} │ ${fmt(s.failed, 7)} │ ${fmt(okRate + '%', 6)} │ ` +
      `${fmt(avg, 7)} │ ${fmt(percentile(s, 0.5).toFixed(0), 5)} │ ` +
      `${fmt(percentile(s, 0.95).toFixed(0), 5)} │ ${fmt(percentile(s, 0.99).toFixed(0), 5)} │ ` +
      `${fmt(s.maxMs.toFixed(0), 6)} │`,
  );
  if (s.failed > 0) {
    console.log(`│       └─ erros: ${errSummary}`);
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function ping() {
  try {
    const r = await doRequest();
    return r.ok || r.status > 0;
  } catch {
    return false;
  }
}

// ────────────────────────────── Execução ──────────────────────────────
async function main() {
  console.log('\n🔥 Teste de carga — Coletor Ar-Saúde');
  console.log(`   Alvo:      ${METHOD} ${target.href}`);
  console.log(`   Rampa:     ${STAGES.join(' → ')} simultâneas`);
  console.log(`   Por nível: ${STAGE_SECONDS}s  (cooldown ${COOLDOWN_MS}ms)`);
  const totalMin = ((STAGES.length * (STAGE_SECONDS * 1000 + COOLDOWN_MS)) / 60000).toFixed(1);
  console.log(`   Duração estimada: ~${totalMin} min\n`);

  if (!(await ping())) {
    console.error(
      `❌ Servidor não respondeu em ${target.href}\n` +
        `   Suba o coletor antes:  npm run start:dev\n`,
    );
    process.exit(1);
  }

  console.log(
    '┌───────┬──────────┬─────────┬──────────┬─────────┬────────┬─────────┬───────┬───────┬───────┬────────┐',
  );
  console.log(
    '│ conc. │    reqs  │   req/s │  sucesso │  falhas │   ok%  │  avg ms │  p50  │  p95  │  p99  │ max ms │',
  );
  console.log(
    '├───────┼──────────┼─────────┼──────────┼─────────┼────────┼─────────┼───────┼───────┼───────┼────────┤',
  );

  const grand = newStats();

  for (const concurrency of STAGES) {
    const s = await runStage(concurrency, STAGE_SECONDS * 1000);
    printStageResult(concurrency, s);

    // agrega no total geral
    grand.total += s.total;
    grand.ok += s.ok;
    grand.failed += s.failed;
    grand.sumMs += s.sumMs;
    grand.minMs = Math.min(grand.minMs, s.minMs);
    grand.maxMs = Math.max(grand.maxMs, s.maxMs);
    s.hist.forEach((c, i) => (grand.hist[i] += c));
    for (const [k, v] of Object.entries(s.errors)) {
      grand.errors[k] = (grand.errors[k] ?? 0) + v;
    }

    await sleep(COOLDOWN_MS);
  }

  console.log(
    '└───────┴──────────┴─────────┴──────────┴─────────┴────────┴─────────┴───────┴───────┴───────┴────────┘',
  );

  const okRate = ((grand.ok / Math.max(grand.total, 1)) * 100).toFixed(2);
  console.log('\n📊 Resumo geral');
  console.log(`   Requisições totais: ${grand.total}`);
  console.log(`   Sucesso: ${grand.ok} (${okRate}%)  |  Falhas: ${grand.failed}`);
  console.log(
    `   Latência: avg ${(grand.sumMs / Math.max(grand.total, 1)).toFixed(1)}ms | ` +
      `p95 ${percentile(grand, 0.95).toFixed(0)}ms | p99 ${percentile(grand, 0.99).toFixed(0)}ms | ` +
      `max ${grand.maxMs.toFixed(0)}ms`,
  );
  if (grand.failed > 0) {
    const errSummary = Object.entries(grand.errors)
      .map(([k, v]) => `${k}×${v}`)
      .join(', ');
    console.log(`   Erros: ${errSummary}`);
  }
  console.log(
    grand.failed === 0
      ? '\n✅ Nenhuma requisição perdida — aplicação aguentou a rampa inteira.\n'
      : `\n⚠️  ${grand.failed} requisições falharam — veja os tipos de erro acima.\n`,
  );

  agent.destroy();
}

main().catch((err) => {
  console.error('Erro no teste de carga:', err);
  process.exit(1);
});
