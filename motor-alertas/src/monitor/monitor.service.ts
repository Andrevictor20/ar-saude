import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";

import { InterscityReaderService } from "../interscity/interscity-reader.service";
import { MeasurementsService } from "../measurements/measurements.service";
import { AlertsService } from "../alerts/alerts.service";
import { MetricsService } from "../metrics/metrics.service";

@Injectable()
export class MonitorService implements OnModuleInit {
  private readonly logger = new Logger(MonitorService.name);
  private running = false;
  private cycleCount = 0;

  constructor(
    private readonly reader: InterscityReaderService,
    private readonly measurements: MeasurementsService,
    private readonly alerts: AlertsService,
    private readonly metrics: MetricsService,
  ) {}

  onModuleInit(): void {
    setTimeout(() => {
      void this.runCycle();
    }, 3000);
  }

  @Cron(process.env.MONITOR_INTERVAL ?? "*/1 * * * *", {
    name: "air-quality-monitor",
    timeZone: "America/Sao_Paulo",
  })
  async handleCron(): Promise<void> {
    await this.runCycle();
  }

  async runCycle(): Promise<void> {
    if (this.running) {
      this.logger.warn("Ciclo anterior ainda em execucao. Pulando.");
      return;
    }

    this.running = true;
    this.cycleCount++;
    const cycleId = this.cycleCount;
    const startedAt = Date.now();

    let resources;
    try {
      resources = await this.reader.fetchResources();
    } catch (error) {
      this.logger.error(
        `Ciclo #${cycleId} abortado: falha ao listar recursos do InterSCity: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      this.running = false;
      return;
    }

    this.logger.log(
      `Ciclo #${cycleId} iniciado. ${resources.length} recursos Ar-Saude encontrados.`,
    );

    let saved = 0;
    let evaluated = 0;

    for (const resource of resources) {
      try {
        const reading = await this.reader.fetchLatestReading(resource);
        if (!reading) {
          continue;
        }

        const persisted = await this.measurements.saveReading(reading);
        if (persisted) saved++;

        await this.alerts.evaluate(reading);
        evaluated++;
      } catch (error) {
        this.logger.error(
          `Falha ao processar ${resource.neighborhoodName}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }

    const elapsed = Date.now() - startedAt;
    this.metrics.recordCycle({
      resources: resources.length,
      saved,
      evaluated,
      durationMs: elapsed,
    });
    this.logger.log(
      `Ciclo #${cycleId} concluido em ${elapsed}ms. Avaliados: ${evaluated}, novas medicoes: ${saved}.`,
    );

    this.running = false;
  }

  getCycleCount(): number {
    return this.cycleCount;
  }
}
