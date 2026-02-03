import { FastifyInstance } from "fastify";
import fp from "fastify-plugin";
import Redis from "ioredis";

declare module "fastify" {
  interface FastifyInstance {
    redis: Redis | null;
  }
}

async function redisPlugin(fastify: FastifyInstance) {
  // Skip Redis entirely if REDIS_URL is not set (dev mode)
  if (!process.env.REDIS_URL) {
    fastify.log.info("Redis disabled (set REDIS_URL to enable)");
    fastify.decorate("redis", null);
    return;
  }

  const redis = new Redis(process.env.REDIS_URL, {
    maxRetriesPerRequest: 3,
    lazyConnect: true,
    retryStrategy: () => null,
  });

  redis.on("error", () => {});

  try {
    await redis.connect();
    fastify.decorate("redis", redis);
    fastify.log.info("Redis connected");

    fastify.addHook("onClose", async () => {
      await redis.quit();
    });
  } catch (err) {
    fastify.log.warn("Redis connection failed - running without cache");
    redis.disconnect();
    fastify.decorate("redis", null);
  }
}

export default fp(redisPlugin, { name: "redis" });
