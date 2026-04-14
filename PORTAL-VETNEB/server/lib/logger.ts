export function logInfo(...args: any[]) {
  console.log('[INFO]', ...args);
}

export function logWarn(...args: any[]) {
  console.warn('[WARN]', ...args);
}

export function logError(...args: any[]) {
  console.error('[ERROR]', ...args);
}

export function serializeError(error: unknown) {
  if (error instanceof Error) {
    return {
      message: error.message,
      stack: error.stack,
      name: error.name
    };
  }
  return error;
}
