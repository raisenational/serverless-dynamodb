export type SeedConfig = Record<string, {
	sources: {
		table: string;
		sources?: string[];
		rawsources?: string[];
	}[];
}>;

export type Config = {
	start?: {
		host?: string;
		port?: number;
		seed?: boolean | string;
		region?: string;
	};
	stages?: string[];
	seed?: SeedConfig;
};
