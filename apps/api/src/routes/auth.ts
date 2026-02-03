import { FastifyInstance } from "fastify";
import bcrypt from "bcryptjs";
import { z } from "zod";

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(2),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

export async function authRoutes(fastify: FastifyInstance) {
  fastify.post("/api/auth/register", async (request, reply) => {
    const parsed = registerSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "Validation error", message: parsed.error.message });
    }

    const { email, password, name } = parsed.data;

    const existing = await fastify.prisma.user.findUnique({ where: { email } });
    if (existing) {
      return reply.status(409).send({ error: "Conflict", message: "Email already registered" });
    }

    // Check user count before creating (for data migration)
    const userCountBefore = await fastify.prisma.user.count();

    const hashedPassword = await bcrypt.hash(password, 12);
    const user = await fastify.prisma.user.create({
      data: { email, password: hashedPassword, name },
      select: { id: true, email: true, name: true, createdAt: true },
    });

    // If this is the first user, migrate data from default-user
    if (userCountBefore === 0) {
      await fastify.prisma.$transaction([
        fastify.prisma.portfolio.updateMany({
          where: { userId: "default-user" },
          data: { userId: user.id },
        }),
        fastify.prisma.alert.updateMany({
          where: { userId: "default-user" },
          data: { userId: user.id },
        }),
        fastify.prisma.watchlist.updateMany({
          where: { userId: "default-user" },
          data: { userId: user.id },
        }),
        fastify.prisma.notification.updateMany({
          where: { userId: "default-user" },
          data: { userId: user.id },
        }),
      ]);
      fastify.log.info(`Migrated data from default-user to user ${user.id}`);
    }

    const token = fastify.jwt.sign({ id: user.id, email: user.email });

    return reply.status(201).send({ user, accessToken: token });
  });

  fastify.post("/api/auth/login", async (request, reply) => {
    const parsed = loginSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "Validation error", message: parsed.error.message });
    }

    const { email, password } = parsed.data;

    const user = await fastify.prisma.user.findUnique({ where: { email } });
    if (!user) {
      return reply.status(401).send({ error: "Unauthorized", message: "Invalid credentials" });
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return reply.status(401).send({ error: "Unauthorized", message: "Invalid credentials" });
    }

    const token = fastify.jwt.sign({ id: user.id, email: user.email });

    return {
      user: { id: user.id, email: user.email, name: user.name },
      accessToken: token,
    };
  });

  // GET /api/auth/me - get current authenticated user
  fastify.get("/api/auth/me", {
    onRequest: [fastify.authenticate],
  }, async (request, reply) => {
    const user = await fastify.prisma.user.findUnique({
      where: { id: request.user.id },
      select: { id: true, email: true, name: true },
    });

    if (!user) {
      return reply.status(404).send({ error: "Not Found", message: "User not found" });
    }

    return user;
  });
}
