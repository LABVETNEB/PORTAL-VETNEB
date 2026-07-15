// Infrastructure check (E2E-STAB-004): after a Playwright-owned run finishes,
// both server ports must be free and no runner process may be left listening.
// Exits 0 when every port is free; exits 1 naming each port still in use.
//
// Usage: pnpm e2e:verify-teardown
// Note: with E2E_REUSE_SERVER=1 the developer owns the dev server lifecycle,
// so a busy port is expected and this check does not apply.
import { connect } from "node:net";

const HOST = "127.0.0.1";
const E2E_PORTS = [3000, 3107];
const CONNECT_TIMEOUT_MS = 1_500;

function probePort(port) {
  return new Promise((resolve) => {
    const socket = connect({ host: HOST, port });
    const finish = (busy) => {
      socket.destroy();
      resolve(busy);
    };

    socket.once("connect", () => finish(true));
    socket.once("error", () => finish(false));
    socket.setTimeout(CONNECT_TIMEOUT_MS, () => finish(false));
  });
}

const busyPorts = [];
for (const port of E2E_PORTS) {
  if (await probePort(port)) {
    busyPorts.push(port);
  }
}

if (busyPorts.length > 0) {
  console.error(
    `[e2e:verify-teardown] ports still in use after the run: ${busyPorts.join(", ")}. ` +
      "A webServer process (Next dev on 3000 / fixture API on 3107) did not shut down.",
  );
  process.exit(1);
}

console.log("[e2e:verify-teardown] ports 3000 and 3107 are free.");
