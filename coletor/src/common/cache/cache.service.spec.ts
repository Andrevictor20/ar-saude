import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { CacheService } from './cache.service.js';

describe('CacheService', () => {
  let cache: CacheService;
  
  const mockRedis = {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    flushdb: jest.fn(),
    dbsize: jest.fn().mockResolvedValue(0),
    on: jest.fn(),
    disconnect: jest.fn(),
  };

  beforeEach(async () => {
    // We mock the ioredis module inline, but since CacheService imports it,
    // we can mock the redis instance created inside onModuleInit by casting it.
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CacheService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue('redis://localhost:6379'),
          },
        },
      ],
    }).compile();

    cache = module.get<CacheService>(CacheService);
    cache['redis'] = mockRedis as any; // Inject mock directly
    cache['hits'] = 0;
    cache['misses'] = 0;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('retorna undefined para chave inexistente (miss)', async () => {
    mockRedis.get.mockResolvedValueOnce(null);
    const result = await cache.get('x');
    expect(result).toBeUndefined();
    expect((await cache.getStats()).misses).toBe(1);
  });

  it('grava e lê um valor (hit)', async () => {
    mockRedis.get.mockResolvedValueOnce(JSON.stringify(42));
    const result = await cache.get<number>('k');
    expect(result).toBe(42);
    expect((await cache.getStats()).hits).toBe(1);
  });

  it('wrap chama a factory só uma vez se for miss', async () => {
    mockRedis.get.mockResolvedValueOnce(null);
    const factory = jest.fn().mockResolvedValue('result');

    const a = await cache.wrap('key', 1000, factory);
    expect(a).toBe('result');
    expect(factory).toHaveBeenCalledTimes(1);
    expect(mockRedis.set).toHaveBeenCalledWith('key', JSON.stringify('result'), 'EX', 1);
  });
  
  it('wrap retorna o cache no hit', async () => {
    mockRedis.get.mockResolvedValueOnce(JSON.stringify('result'));
    const factory = jest.fn().mockResolvedValue('new-result');

    const a = await cache.wrap('key', 1000, factory);
    expect(a).toBe('result');
    expect(factory).not.toHaveBeenCalled();
  });
});
