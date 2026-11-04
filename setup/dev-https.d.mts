export interface DevServerOptions {
  allowedHosts: string[];
  host?: true;
  https?: { cert: Buffer; key: Buffer };
}

export function devServerOptions(env?: NodeJS.ProcessEnv): DevServerOptions;
