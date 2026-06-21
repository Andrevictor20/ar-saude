import { Injectable } from "@nestjs/common";
import * as client from "prom-client";

/** Resumo de um ciclo do monitor, para as métricas. */
export interface MonitorCycleResult {
  resources: number;
  saved: number;
  evaluated: number;
  durationMs: number;
}

/**
 * Registro central de métricas Prometheus do Motor de Alertas.
 *
 * Counters: ciclos do monitor, leituras salvas/avaliadas, alertas
 * criados/atualizados/resolvidos. Gauges: alertas ativos e parâmetros do
 * último ciclo (amostrados no scrape via `updateRuntimeGauges`).
 */
@Injectable()
export class MetricsService {
  readonly registry = new client.Registry();

  private readonly monitorCyclesTotal = new client.Counter({
    name: "arsaude_monitor_cycles_total",
    help: "Total de ciclos de monitoramento executados.",
  });
  private readonly readingsSavedTotal = new client.Counter({
    name: "arsaude_readings_saved_total",
    help: "Total de leituras persistidas.",
  });
  private readonly readingsEvaluatedTotal = new client.Counter({
    name: "arsaude_readings_evaluated_total",
    help: "Total de leituras avaliadas contra os limiares da OMS.",
  });
  private readonly alertsCreatedTotal = new client.Counter({
    name: "arsaude_alerts_created_total",
    help: "Total de alertas criados.",
  });
  private readonly alertsUpdatedTotal = new client.Counter({
    name: "arsaude_alerts_updated_total",
    help: "Total de alertas atualizados.",
  });
  private readonly alertsResolvedTotal = new client.Counter({
    name: "arsaude_alerts_resolved_total",
    help: "Total de alertas resolvidos.",
  });

  private readonly activeAlerts = new client.Gauge({
    name: "arsaude_active_alerts",
    help: "Alertas atualmente ativos.",
  });
  private readonly aqiThreshold = new client.Gauge({
    name: "arsaude_aqi_threshold",
    help: "Limiar de AQI configurado para disparar alertas.",
  });
  private readonly lastCycleResources = new client.Gauge({
    name: "arsaude_last_cycle_resources",
    help: "Recursos Ar-Saúde encontrados no último ciclo.",
  });
  private readonly lastCycleDurationMs = new client.Gauge({
    name: "arsaude_last_cycle_duration_ms",
    help: "Duração do último ciclo de monitoramento (ms).",
  });

  constructor() {
    this.registry.setDefaultLabels({ service: "ar-saude-motor-alertas" });
    client.collectDefaultMetrics({ register: this.registry });
    for (const metric of [
      this.monitorCyclesTotal,
      this.readingsSavedTotal,
      this.readingsEvaluatedTotal,
      this.alertsCreatedTotal,
      this.alertsUpdatedTotal,
      this.alertsResolvedTotal,
      this.activeAlerts,
      this.aqiThreshold,
      this.lastCycleResources,
      this.lastCycleDurationMs,
    ]) {
      this.registry.registerMetric(metric);
    }
  }

  /** Registra o resultado de um ciclo de monitoramento. */
  recordCycle(result: MonitorCycleResult): void {
    this.monitorCyclesTotal.inc();
    this.readingsSavedTotal.inc(result.saved);
    this.readingsEvaluatedTotal.inc(result.evaluated);
    this.lastCycleResources.set(result.resources);
    this.lastCycleDurationMs.set(result.durationMs);
  }

  /** Incrementa o contador correspondente ao tipo de evento de alerta. */
  recordAlertEvent(type: "created" | "updated" | "resolved"): void {
    if (type === "created") this.alertsCreatedTotal.inc();
    else if (type === "updated") this.alertsUpdatedTotal.inc();
    else this.alertsResolvedTotal.inc();
  }

  /** Amostra gauges dependentes de I/O no instante do scrape. */
  updateRuntimeGauges(snapshot: {
    activeAlerts: number;
    aqiThreshold: number;
  }): void {
    this.activeAlerts.set(snapshot.activeAlerts);
    this.aqiThreshold.set(snapshot.aqiThreshold);
  }

  getMetrics(): Promise<string> {
    return this.registry.metrics();
  }
}
