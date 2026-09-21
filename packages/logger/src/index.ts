import pino from 'pino';

export function createLogger(service: string) {
  return pino({
    name: service,
    level: process.env.LOG_LEVEL ?? 'info',
    redact: ['req.headers.authorization', '*.secretKey', '*.seedPhrase', '*.mnemonic'],
    serializers: {
      // Pino only auto-serializes a field literally named `err`. An Error logged
      // under any other key stringifies to `{}`, because `message` and `stack`
      // are non-enumerable -- which is how the indexer reported four failed
      // retries as `"error":{}` and told an operator nothing at all.
      error: pino.stdSerializers.err,
      err: pino.stdSerializers.err,
    },
  });
}
