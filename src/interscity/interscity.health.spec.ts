import { of, throwError } from 'rxjs';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { InterscityService } from './interscity.service.js';

/**
 * Testa exclusivamente a lógica de healthcheck/failover de endpoints,
 * sem tocar a rede nem o registro de capabilities/resources.
 */
describe('InterscityService — healthcheck e failover', () => {
  /** ConfigService que sempre devolve o valor default informado. */
  const configService = {
    get: <T>(_key: string, def: T): T => def,
  } as unknown as ConfigService;

  /** Timeouts observados em cada chamada de healthcheck (na ordem). */
  let observedTimeouts: number[] = [];

  /**
   * Monta o service com um HttpService falso cujo GET responde conforme
   * `responder(url)` — devolvendo status ou lançando erro por endpoint.
   */
  function buildService(
    responder: (url: string) => { status: number } | 'fail',
  ): InterscityService {
    observedTimeouts = [];
    const httpService = {
      get: (url: string, config: { timeout: number }) => {
        observedTimeouts.push(config.timeout);
        const result = responder(url);
        if (result === 'fail') {
          return throwError(() => new Error('connection refused'));
        }
        return of(result);
      },
    } as unknown as HttpService;

    return new InterscityService(httpService, configService);
  }

  const isPrimary = (url: string): boolean => url.includes('lsdi.ufma.br');

  it('usa o primário quando ele está no ar', async () => {
    const service = buildService(() => ({ status: 200 }));

    const health = await service.checkHealth();

    expect(health.primaryUp).toBe(true);
    expect(health.fallbackUp).toBe(true);
    expect(health.active).toBe('primary');
    expect(health.lastCheckedAt).not.toBeNull();
  });

  it('faz failover para o fallback quando o primário cai', async () => {
    const service = buildService((url) =>
      isPrimary(url) ? 'fail' : { status: 200 },
    );

    const health = await service.checkHealth();

    expect(health.primaryUp).toBe(false);
    expect(health.fallbackUp).toBe(true);
    expect(health.active).toBe('fallback');
  });

  it('volta para o primário assim que ele se recupera', async () => {
    let primaryUp = false;
    const service = buildService((url) => {
      if (isPrimary(url)) return primaryUp ? { status: 200 } : 'fail';
      return { status: 200 };
    });

    await service.checkHealth();
    expect(service.getHealth().active).toBe('fallback');

    primaryUp = true;
    await service.checkHealth();
    expect(service.getHealth().active).toBe('primary');
  });

  it('usa timeout maior no primeiro check (cold start) e menor depois', async () => {
    const service = buildService(() => ({ status: 200 }));

    await service.checkHealth();
    const firstTimeouts = [...observedTimeouts];

    await service.checkHealth();
    const secondTimeouts = observedTimeouts.slice(firstTimeouts.length);

    // 1º check: timeout estendido (default 30s)
    expect(firstTimeouts.every((t) => t === 30_000)).toBe(true);
    // 2º check: timeout normal (default 8s)
    expect(secondTimeouts.every((t) => t === 8_000)).toBe(true);
  });

  it('mantém o endpoint atual quando ambos estão fora do ar', async () => {
    const service = buildService(() => 'fail');

    const health = await service.checkHealth();

    expect(health.primaryUp).toBe(false);
    expect(health.fallbackUp).toBe(false);
    // sem endpoint saudável, mantém o ativo inicial (primário)
    expect(health.active).toBe('primary');
  });
});
