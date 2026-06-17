#!/usr/bin/env node
/**
 * Chaos test de FAILOVER do InterSCity para o Coletor Ar-Saúde.
 *
 * Comprova empiricamente o failover automático: em vez de só descrever que
 * "se o primário cair, vai para o fallback", este teste DERRUBA o primário ao
 * vivo (via endpoint de chaos) no meio de uma carga de coleta e observa o
 * endpoint ativo migrar primário → fallback e voltar quando o primário se
 * recupera.
 *
 * Linha do tempo:
 *   1. baseline  — observa o estado normal (primário ativo)
 *   2. carga     — dispara coletas (POST /collect) em paralelo
 *   3. 💥 falha  — POST /chaos/interscity-primary {down:true}
 *   4. observa   — endpoint ativo deve virar "fallback"
 *   5. 🔧 recup. — POST /chaos/interscity-primary {down:false}
 *   6. observa   — endpoint ativo deve voltar para "primary"
 *
 * --- Uso ---
 *   1. Suba o coletor:   npm run start:dev
 *   2. Rode o chaos:     npm run chaos:test
 *
 * --- Configuração via env ---
 *   CHAOS_URL=http://localhost:3000   Base do Coletor
 *   CHAOS_PHASE_SECONDS=8             Duração de cada fase de observação
 *   CHAOS_POLL_MS=1000                Intervalo de polling do estado
 *   CHAOS_LOAD=0                      Nº de POST /collect por fase (0 = desliga)
 */

const BASE = process.env.CHAOS_URL ?? 'http://localhost:3000';
const PHASE_SECONDS = Number(process.env.CHAOS_PHASE_SECONDS ?? 8);
const POLL_MS = Number(process.env.CHAOS_POLL_MS ?? 1000);
const LOAD = Number(process.env.CHAOS_LOAD ?? 0);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getJson(path) {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`GET ${path} → HTTP ${res.status}`);
  return res.json();
}

async function postJson(path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body ?? {}),
  });
  if (!res.ok) throw new Error(`POST ${path} → HTTP ${res.status}`);
  return res.json();
}

function icon(active) {
  return active === 'primary' ? '🟢' : active === 'fallback' ? '🟡' : '🔴';
}

/** Observa o estado por `seconds`, logando a cada POLL_MS. Retorna o último health. */
async function observe(label, seconds) {
  const deadline = Date.now() + seconds * 1000;
  let last;
  while (Date.now() < deadline) {
    const stats = await getJson('/stats');
    last = stats.interscity;
    const q = stats.queue;
    console.log(
      `  ${icon(last.active)} [${label}] ativo=${last.active.padEnd(8)} ` +
        `primário=${last.primaryUp ? 'UP ' : 'DOWN'} fallback=${last.fallbackUp ? 'UP ' : 'DOWN'} ` +
        `| fila: pend=${q.pending} ativos=${q.active} proc=${q.processed} dead=${q.deadLetter}`,
    );
    await sleep(POLL_MS);
  }
  return last;
}

async function applyLoad() {
  if (LOAD <= 0) return;
  const bursts = Array.from({ length: LOAD }, () =>
    postJson('/collect').catch(() => undefined),
  );
  await Promise.all(bursts);
}

async function main() {
  console.log('\n🧪 Chaos test — Failover do InterSCity (Coletor Ar-Saúde)');
  console.log(`   Alvo: ${BASE}  |  fase: ${PHASE_SECONDS}s  |  carga/fase: ${LOAD} POST /collect\n`);

  try {
    await getJson('/');
  } catch {
    console.error(`❌ Coletor não respondeu em ${BASE}. Suba antes: npm run start:dev\n`);
    process.exit(1);
  }

  console.log('① Baseline (estado normal):');
  const baseline = await observe('baseline', PHASE_SECONDS);

  console.log(`\n② Aplicando carga e 💥 DERRUBANDO o primário...`);
  await applyLoad();
  await postJson('/chaos/interscity-primary', { down: true });
  const duringChaos = await observe('chaos', PHASE_SECONDS);

  console.log(`\n③ 🔧 Recuperando o primário...`);
  await applyLoad();
  await postJson('/chaos/interscity-primary', { down: false });
  const afterRecovery = await observe('recuperação', PHASE_SECONDS);

  // ── Veredito ──
  console.log('\n📋 Resultado:');
  const failedOver =
    baseline?.active === 'primary' && duringChaos?.active === 'fallback';
  const recovered = afterRecovery?.active === 'primary';

  console.log(`   • Failover primário→fallback sob falha: ${failedOver ? '✅ SIM' : '❌ NÃO'}`);
  console.log(`   • Recuperação fallback→primário:        ${recovered ? '✅ SIM' : '⚠️  não (primário pode estar fora)'}`);

  if (failedOver) {
    console.log(
      '\n✅ Failover comprovado ao vivo: o sistema continuou operando no fallback ' +
        'enquanto o primário esteve fora.\n',
    );
  } else {
    console.log(
      '\n⚠️  Não foi possível observar o failover. Verifique se o fallback do ' +
        'InterSCity está acessível (precisa estar UP para assumir).\n',
    );
  }
}

main().catch((err) => {
  console.error('Erro no chaos test:', err);
  process.exit(1);
});
