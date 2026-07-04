import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

export interface CacheStats {
  size: number;
  hits: number;
  misses: number;
  hitRate: string;
}

@Injectable()
export class CacheService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CacheService.name);
  private redis: Redis;

  private hits = 0;
  private misses = 0;

  constructor(private configService: ConfigService) {}

  onModuleInit() {
    const redisUrl = this.configService.get<string>('REDIS_URL', 'redis://localhost:6379');
    this.redis = new Redis(redisUrl);
    this.redis.on('connect', () => this.logger.log('Connected to Redis'));
    this.redis.on('error', (err) => this.logger.error('Redis error', err));
  }

  onModuleDestroy() {
    this.redis.disconnect();
  }

  async get<T>(key: string): Promise<T | undefined> {
    const value = await this.redis.get(key);
    if (!value) {
      this.misses++;
      return undefined;
    }
    this.hits++;
    return JSON.parse(value) as T;
  }

  async set<T>(key: string, value: T, ttlMs: number): Promise<void> {
    const ttlSeconds = Math.max(1, Math.floor(ttlMs / 1000));
    await this.redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
  }

  async wrap<T>(
    key: string,
    ttlMs: number,
    factory: () => Promise<T>,
  ): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== undefined) {
      this.logger.debug(`HIT  → ${key}`);
      return cached;
    }

    this.logger.debug(`MISS → ${key}`);
    const value = await factory();
    await this.set(key, value, ttlMs);
    return value;
  }

  async delete(key: string): Promise<void> {
    await this.redis.del(key);
  }

  async clear(): Promise<void> {
    await this.redis.flushdb();
  }

  async getStats(): Promise<CacheStats> {
    const total = this.hits + this.misses;
    const hitRate = total === 0 ? '0%' : `${((this.hits / total) * 100).toFixed(1)}%`;
    const dbSize = await this.redis.dbsize();
    return {
      size: dbSize,
      hits: this.hits,
      misses: this.misses,
      hitRate,
    };
  }
}
