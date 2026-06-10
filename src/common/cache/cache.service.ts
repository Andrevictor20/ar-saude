import { Injectable, Logger } from '@nestjs/common';

/** Entrada interna do cache com valor e instante de expiração. */
interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

/** Estatísticas de uso do cache para observabilidade. */
export interface CacheStats {
  size: number;
  hits: number;
  misses: number;
  hitRate: string;
}

/**
 * Cache simples em memória com TTL (time-to-live).
 *
 * Evita refazer chamadas idênticas às APIs externas dentro de uma janela de
 * tempo — fundamental para suportar rajadas de requisições sem estourar os
 * limites das APIs (Open-Meteo / OpenWeatherMap).
 */
@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);

  private readonly store = new Map<string, CacheEntry<unknown>>();

  private hits = 0;
  private misses = 0;

  /** Retorna o valor cacheado se existir e ainda estiver válido. */
  get<T>(key: string): T | undefined {
    const entry = this.store.get(key);

    if (!entry) {
      this.misses++;
      return undefined;
    }

    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      this.misses++;
      return undefined;
    }

    this.hits++;
    return entry.value as T;
  }

  /** Grava um valor no cache com o TTL informado (ms). */
  set<T>(key: string, value: T, ttlMs: number): void {
    this.store.set(key, { value, expiresAt: Date.now() + ttlMs });
  }

  /**
   * Retorna o valor cacheado ou executa a `factory`, cacheando o resultado.
   * É o atalho recomendado: na primeira chamada busca na origem, nas seguintes
   * (dentro do TTL) devolve direto da memória.
   */
  async wrap<T>(
    key: string,
    ttlMs: number,
    factory: () => Promise<T>,
  ): Promise<T> {
    const cached = this.get<T>(key);
    if (cached !== undefined) {
      this.logger.debug(`HIT  → ${key}`);
      return cached;
    }

    this.logger.debug(`MISS → ${key}`);
    const value = await factory();
    this.set(key, value, ttlMs);
    return value;
  }

  /** Remove uma chave específica. */
  delete(key: string): void {
    this.store.delete(key);
  }

  /** Limpa todo o cache. */
  clear(): void {
    this.store.clear();
  }

  /** Estatísticas de hits/misses para o endpoint de observabilidade. */
  getStats(): CacheStats {
    const total = this.hits + this.misses;
    const hitRate =
      total === 0 ? '0%' : `${((this.hits / total) * 100).toFixed(1)}%`;
    return {
      size: this.store.size,
      hits: this.hits,
      misses: this.misses,
      hitRate,
    };
  }
}
