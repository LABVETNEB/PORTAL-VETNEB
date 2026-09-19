import { restoreNextEnvHygiene } from "./restore-next-env-hygiene.mjs";
import { cleanupOwnedWindowsWebServers } from "./windows-webserver-lifecycle.mjs";

export default async function teardownE2ELifecycle() {
  try {
    cleanupOwnedWindowsWebServers({
      ownerFile: process.env.VETNEB_E2E_WEBSERVER_OWNER_FILE,
      ownerToken: process.env.VETNEB_E2E_WEBSERVER_OWNER_TOKEN,
    });
  } finally {
    await restoreNextEnvHygiene();
  }
}
