export const loggerConfig = {
  development: {
    transport: {
      target: "pino-pretty",
      options: {
        translateTime: "HH:MM:ss Z",
        ignore: "pid,hostname",
      },
    },
  },
  production: true,
  test: false,
};

export function getLoggerConfig() {
  const env = (process.env.NODE_ENV || "development") as keyof typeof loggerConfig;
  return loggerConfig[env] ?? true;
}
