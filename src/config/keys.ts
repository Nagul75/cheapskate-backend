import { readFileSync } from "fs";
import { importPKCS8, importSPKI } from "jose";
import { env } from "./env";

let privateKey: CryptoKey, publicKey: CryptoKey;

// PEM contents in an env var may use literal "\n" sequences.
function loadPem(value: string | undefined, path: string | undefined): string {
  if (value) return value.replace(/\\n/g, "\n");
  return readFileSync(path!, "utf-8");
}

export async function getPrivateKey() {
  if (!privateKey) {
    privateKey = await importPKCS8(
      loadPem(env.PRIVATE_KEY, env.PRIVATE_KEY_PATH),
      "RS256",
    );
  }
  return privateKey;
}

export async function getPublicKey() {
  if (!publicKey) {
    publicKey = await importSPKI(
      loadPem(env.PUBLIC_KEY, env.PUBLIC_KEY_PATH),
      "RS256",
    );
  }
  return publicKey;
}
