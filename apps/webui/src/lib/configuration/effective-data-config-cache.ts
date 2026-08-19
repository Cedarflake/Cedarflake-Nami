import type { DataConfig } from "@nami/config";

export interface EffectiveDataConfigValue {
  config: DataConfig;
  isAuthoritative: boolean;
}

interface EffectiveDataConfigCacheEntry extends EffectiveDataConfigValue {
  expiresAt: number;
}

export interface EffectiveDataConfigCacheOptions {
  adoptCacheSeconds?: number;
  defaultConfig: DataConfig;
  failureRetrySeconds: number;
  loadRemote(): Promise<DataConfig>;
  now?(): number;
  onLoadError?(error: unknown): void;
  successCacheSeconds?(config: DataConfig): number;
}

export class EffectiveDataConfigCache {
  private cacheEntry: EffectiveDataConfigCacheEntry | undefined;
  private generation = 0;
  private inFlightLoad: Promise<EffectiveDataConfigValue> | undefined;

  constructor(private readonly options: EffectiveDataConfigCacheOptions) {}

  async get(): Promise<EffectiveDataConfigValue> {
    const now = this.getNow();
    if (this.cacheEntry && this.cacheEntry.expiresAt > now) {
      return this.cacheEntry;
    }
    if (this.inFlightLoad) {
      return this.inFlightLoad;
    }

    const generation = this.generation;
    const load = this.load(generation);
    this.inFlightLoad = load;
    try {
      return await load;
    } finally {
      if (this.inFlightLoad === load) {
        this.inFlightLoad = undefined;
      }
    }
  }

  async getAuthoritative(): Promise<DataConfig> {
    const value = await this.get();
    if (!value.isAuthoritative) {
      throw new Error("Authoritative remote instance config is unavailable");
    }
    return value.config;
  }

  adopt(config: DataConfig): void {
    this.generation += 1;
    this.cacheEntry = this.createEntry(
      config,
      true,
      this.getNow(),
      this.options.adoptCacheSeconds,
    );
  }

  private async load(generation: number): Promise<EffectiveDataConfigValue> {
    try {
      const config = await this.options.loadRemote();
      if (generation !== this.generation) {
        return this.cacheEntry ?? { config, isAuthoritative: true };
      }

      const entry = this.createEntry(config, true, this.getNow());
      this.cacheEntry = entry;
      return entry;
    } catch (error) {
      this.options.onLoadError?.(error);
      if (generation !== this.generation && this.cacheEntry) {
        return this.cacheEntry;
      }

      const value: EffectiveDataConfigValue = this.cacheEntry ?? {
        config: this.options.defaultConfig,
        isAuthoritative: false,
      };
      if (generation === this.generation) {
        this.cacheEntry = {
          ...value,
          expiresAt: this.getNow() + this.getFailureRetryMilliseconds(value.config),
        };
      }
      return value;
    }
  }

  private createEntry(
    config: DataConfig,
    isAuthoritative: boolean,
    now: number,
    cacheSecondsOverride?: number,
  ): EffectiveDataConfigCacheEntry {
    const successCacheSeconds = cacheSecondsOverride
      ?? this.options.successCacheSeconds?.(config)
      ?? config.runtime.configCacheTtlSeconds;
    return {
      config,
      isAuthoritative,
      expiresAt: now + Math.max(0, successCacheSeconds) * 1000,
    };
  }

  private getFailureRetryMilliseconds(config: DataConfig): number {
    return Math.min(
      this.options.failureRetrySeconds,
      config.runtime.configCacheTtlSeconds,
    ) * 1000;
  }

  private getNow(): number {
    return this.options.now?.() ?? Date.now();
  }
}
