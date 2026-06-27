export type ClientVersionUnsupportedState = {
  minimumClientVersion: string;
  clientVersion: string;
};

type ClientVersionErrorListener = () => void;

let browserClientVersionUnsupported: ClientVersionUnsupportedState | null = null;
const browserClientVersionErrorListeners = new Set<ClientVersionErrorListener>();

export function publishClientVersionUnsupported(
  state: ClientVersionUnsupportedState,
): void {
  if (typeof window === "undefined") {
    return;
  }

  browserClientVersionUnsupported = state;
  browserClientVersionErrorListeners.forEach((listener) => listener());
}

export function subscribeClientVersionUnsupported(
  listener: ClientVersionErrorListener,
): () => void {
  browserClientVersionErrorListeners.add(listener);
  return () => browserClientVersionErrorListeners.delete(listener);
}

export function getClientVersionUnsupportedSnapshot(): ClientVersionUnsupportedState | null {
  return browserClientVersionUnsupported;
}

export function getClientVersionUnsupportedServerSnapshot(): null {
  return null;
}
