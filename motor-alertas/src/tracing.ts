/**
 * Bootstrap do OpenTelemetry — DEVE ser importado antes de qualquer outro
 * módulo (primeira linha do main.ts), para que as instrumentações consigam
 * "patchar" http/axios/express/nest/pg antes de eles serem carregados.
 *
 * Configuração por variáveis de ambiente padrão do OTel:
 *   OTEL_SERVICE_NAME=ar-saude-motor-alertas
 *   OTEL_EXPORTER_OTLP_ENDPOINT=http://jaeger:4318   (OTLP/HTTP)
 *   OTEL_SDK_DISABLED=true                            (desliga o tracing)
 */
import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';

const disabled = process.env.OTEL_SDK_DISABLED === 'true';

const sdk = new NodeSDK({
  traceExporter: new OTLPTraceExporter(),
  instrumentations: [
    getNodeAutoInstrumentations({
      '@opentelemetry/instrumentation-fs': { enabled: false },
    }),
  ],
});

if (!disabled) {
  try {
    sdk.start();
    // eslint-disable-next-line no-console
    console.log('🔭 OpenTelemetry tracing iniciado (Motor de Alertas).');
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Falha ao iniciar OpenTelemetry:', error);
  }

  const shutdown = (): void => {
    void sdk
      .shutdown()
      .catch(() => undefined)
      .finally(() => process.exit(0));
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

export default sdk;
