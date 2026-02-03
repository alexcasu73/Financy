import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";

interface RateLimitOptions {
  max: number;
  windowMs: number;
}

export function createRateLimiter(fastify: FastifyInstance, options: RateLimitOptions) {
  const { max, windowMs } = options;

  return async function rateLimiter(request: FastifyRequest, reply: FastifyReply) {
    // Skip rate limiting if Redis is not available
    if (!fastify.redis) {
      return;
    }

    try {
      const key = `ratelimit:${request.ip}:${request.routeOptions.url}`;
      const current = await fastify.redis.incr(key);

      if (current === 1) {
        await fastify.redis.pexpire(key, windowMs);
      }

      reply.header("X-RateLimit-Limit", max);
      reply.header("X-RateLimit-Remaining", Math.max(0, max - current));

      if (current > max) {
        reply.status(429).send({
          error: "Too Many Requests",
          message: "Rate limit exceeded. Please try again later.",
        });
      }
    } catch {
      // If Redis fails, skip rate limiting
    }
  };
}
