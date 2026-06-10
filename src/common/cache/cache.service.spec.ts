import { CacheService } from './cache.service.js';

describe('CacheService', () => {
  let cache: CacheService;

  beforeEach(() => {
    cache = new CacheService();
  });

  it('retorna undefined para chave inexistente (miss)', () => {
    expect(cache.get('x')).toBeUndefined();
    expect(cache.getStats().misses).toBe(1);
  });

  it('grava e lê um valor dentro do TTL (hit)', () => {
    cache.set('k', 42, 1000);
    expect(cache.get<number>('k')).toBe(42);
    expect(cache.getStats().hits).toBe(1);
  });

  it('expira o valor após o TTL', () => {
    cache.set('k', 'v', 1000);
    const now = Date.now();
    jest.spyOn(Date, 'now').mockReturnValue(now + 1500);
    expect(cache.get('k')).toBeUndefined();
    jest.restoreAllMocks();
  });

  it('wrap chama a factory só uma vez dentro do TTL', async () => {
    const factory = jest.fn().mockResolvedValue('result');

    const a = await cache.wrap('key', 1000, factory);
    const b = await cache.wrap('key', 1000, factory);

    expect(a).toBe('result');
    expect(b).toBe('result');
    expect(factory).toHaveBeenCalledTimes(1);
  });
});
