import { RequestQueueService } from './request-queue.service.js';

/** Espera a fila esvaziar (sem jobs pendentes nem ativos). */
function waitUntilDrained(queue: RequestQueueService): Promise<void> {
  return new Promise((resolve) => {
    const check = (): void => {
      const { pending, active } = queue.getStats();
      if (pending === 0 && active === 0) resolve();
      else setTimeout(check, 5);
    };
    check();
  });
}

describe('RequestQueueService', () => {
  let queue: RequestQueueService;

  beforeEach(() => {
    queue = new RequestQueueService();
  });

  it('processa todos os jobs enfileirados sem perder nenhum', async () => {
    const processed: number[] = [];
    queue.configure({ concurrency: 3 });
    queue.setWorker<number>((n) => {
      processed.push(n);
      return Promise.resolve();
    });

    queue.enqueueMany([1, 2, 3, 4, 5]);
    await waitUntilDrained(queue);

    expect(processed.sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5]);
    expect(queue.getStats().processed).toBe(5);
    expect(queue.getStats().failed).toBe(0);
  });

  it('respeita o limite de concorrência', async () => {
    let active = 0;
    let maxActive = 0;
    queue.configure({ concurrency: 2 });
    queue.setWorker<number>(async () => {
      active++;
      maxActive = Math.max(maxActive, active);
      await new Promise((r) => setTimeout(r, 20));
      active--;
    });

    queue.enqueueMany([1, 2, 3, 4, 5, 6]);
    await waitUntilDrained(queue);

    expect(maxActive).toBeLessThanOrEqual(2);
  });

  it('faz retry e eventualmente conclui o job', async () => {
    let attempts = 0;
    queue.configure({ concurrency: 1, maxAttempts: 5, retryDelayMs: 1 });
    queue.setWorker<string>(() => {
      attempts++;
      if (attempts < 3) return Promise.reject(new Error('falha transitória'));
      return Promise.resolve();
    });

    queue.enqueue('job');
    await waitUntilDrained(queue);

    expect(attempts).toBe(3);
    expect(queue.getStats().processed).toBe(1);
    expect(queue.getStats().failed).toBe(0);
  });

  it('manda para dead-letter após esgotar as tentativas', async () => {
    queue.configure({ concurrency: 1, maxAttempts: 3, retryDelayMs: 1 });
    queue.setWorker<string>(() => Promise.reject(new Error('sempre falha')));

    queue.enqueue('job');
    await waitUntilDrained(queue);

    expect(queue.getStats().failed).toBe(1);
    expect(queue.getStats().deadLetter).toBe(1);
  });
});
