import { FastifyInstance } from "fastify";

export async function indicatorRoutes(fastify: FastifyInstance) {
  fastify.get("/api/indicators", async () => {
    const indicators = await fastify.prisma.economicIndicator.findMany({
      orderBy: { date: "desc" },
      take: 20,
    });

    return indicators;
  });
}
