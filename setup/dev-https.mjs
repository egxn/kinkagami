// Shared dev-server HTTPS options for the Vite apps (embedded and web).
//
//   KGM_DEV_HTTPS=1   serve over HTTPS with the cert from `pnpm certs:dev`
//   KGM_DEV_LAN=1     listen on all interfaces (test from a phone on your LAN)
//   KGM_DEV_CERT / KGM_DEV_KEY   override the certificate / key paths
//
// `*.kinkagami.test` hosts are always accepted (see `pnpm hosts:add`).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const isOn = (value) => value === "1" || value === "true";

/** @param {NodeJS.ProcessEnv} [env] */
export function devServerOptions(env = process.env) {
  const options = { allowedHosts: [".kinkagami.test"] };

  if (isOn(env.KGM_DEV_LAN)) options.host = true;

  if (isOn(env.KGM_DEV_HTTPS)) {
    const certPath = env.KGM_DEV_CERT ?? path.join(root, ".certs/kinkagami.pem");
    const keyPath = env.KGM_DEV_KEY ?? path.join(root, ".certs/kinkagami-key.pem");

    if (!fs.existsSync(certPath) || !fs.existsSync(keyPath)) {
      throw new Error(
        `KGM_DEV_HTTPS is set but no certificate was found at ${certPath}. Run: pnpm certs:dev`,
      );
    }
    options.https = {
      cert: fs.readFileSync(certPath),
      key: fs.readFileSync(keyPath),
    };
  }

  return options;
}
