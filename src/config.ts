export interface SeedConfig {
  [categoryName: string]: {
    sources: {
      table: string,
      sources?: string[],
      rawsources?: string[],
    }[]
  }
}

export interface Config {
  start?: {
    host?: string;
    port?: number;
    seed?: boolean | string;
    region?: string;
  },
  stages?: string[],
  seed?: SeedConfig;
}
