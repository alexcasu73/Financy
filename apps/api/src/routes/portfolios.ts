import { FastifyInstance } from "fastify";
import { z } from "zod";
import { PortfolioService } from "../services/portfolio.js";

const createSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
});

export async function portfolioRoutes(fastify: FastifyInstance) {
  const portfolioService = new PortfolioService(fastify);

  // Protect all routes in this plugin
  fastify.addHook("onRequest", fastify.authenticate);

  fastify.get("/api/portfolios", async (request) => {
    const portfolios = await fastify.prisma.portfolio.findMany({
      where: { userId: request.user.id },
      include: { holdings: { include: { asset: true } } },
      orderBy: { createdAt: "desc" },
    });

    return portfolios;
  });

  fastify.post("/api/portfolios", async (request, reply) => {
    const parsed = createSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "Validation error", message: parsed.error.message });
    }

    const portfolio = await fastify.prisma.portfolio.create({
      data: { ...parsed.data, userId: request.user.id },
    });

    return reply.status(201).send(portfolio);
  });

  fastify.get("/api/portfolios/:id", async (request, reply) => {
    const { id } = request.params as { id: string };

    const portfolio = await fastify.prisma.portfolio.findFirst({
      where: { id, userId: request.user.id },
      include: { holdings: { include: { asset: true } } },
    });

    if (!portfolio) {
      return reply.status(404).send({ error: "Not Found", message: "Portfolio not found" });
    }

    const performance = await portfolioService.calculatePerformance(id);

    return { ...portfolio, performance };
  });
}
