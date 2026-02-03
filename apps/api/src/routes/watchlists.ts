import { FastifyInstance } from "fastify";
import { z } from "zod";

const createSchema = z.object({
  name: z.string().min(1),
  assetIds: z.array(z.string()),
});

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  assetIds: z.array(z.string()).optional(),
});

export async function watchlistRoutes(fastify: FastifyInstance) {
  fastify.addHook("onRequest", fastify.authenticate);

  fastify.get("/api/watchlists", async (request) => {
    const watchlists = await fastify.prisma.watchlist.findMany({
      where: { userId: request.user.id },
      include: { assets: { include: { asset: true } } },
      orderBy: { createdAt: "desc" },
    });

    return watchlists.map((w) => ({
      id: w.id,
      name: w.name,
      assets: w.assets.map((wa) => wa.asset),
      createdAt: w.createdAt,
      updatedAt: w.updatedAt,
    }));
  });

  fastify.post("/api/watchlists", async (request, reply) => {
    const parsed = createSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "Validation error", message: parsed.error.message });
    }

    const { name, assetIds } = parsed.data;

    const watchlist = await fastify.prisma.watchlist.create({
      data: {
        name,
        userId: request.user.id,
        assets: {
          create: assetIds.map((assetId) => ({ assetId })),
        },
      },
      include: { assets: { include: { asset: true } } },
    });

    return reply.status(201).send(watchlist);
  });

  fastify.put("/api/watchlists/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = updateSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "Validation error", message: parsed.error.message });
    }

    const existing = await fastify.prisma.watchlist.findFirst({
      where: { id, userId: request.user.id },
    });
    if (!existing) {
      return reply.status(404).send({ error: "Not Found", message: "Watchlist not found" });
    }

    const { name, assetIds } = parsed.data;

    if (assetIds) {
      await fastify.prisma.watchlistAsset.deleteMany({
        where: { watchlistId: id },
      });
    }

    const watchlist = await fastify.prisma.watchlist.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(assetIds && {
          assets: { create: assetIds.map((assetId) => ({ assetId })) },
        }),
      },
      include: { assets: { include: { asset: true } } },
    });

    return watchlist;
  });
}
