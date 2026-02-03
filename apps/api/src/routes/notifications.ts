import { FastifyInstance } from "fastify";

export async function notificationRoutes(fastify: FastifyInstance) {
  // Protect all routes in this plugin
  fastify.addHook("onRequest", fastify.authenticate);

  // GET /api/notifications - lista notifiche (escluse dismissed)
  fastify.get("/api/notifications", async (request) => {
    const { limit } = request.query as { limit?: string };

    const notifications = await fastify.prisma.notification.findMany({
      where: { userId: request.user.id, dismissed: false },
      orderBy: { createdAt: "desc" },
      take: limit ? parseInt(limit) : 50,
    });

    return notifications;
  });

  // GET /api/notifications/unread-count - conteggio non lette (escluse dismissed)
  fastify.get("/api/notifications/unread-count", async (request) => {
    const count = await fastify.prisma.notification.count({
      where: { userId: request.user.id, read: false, dismissed: false },
    });

    return { count };
  });

  // PUT /api/notifications/read-all - segna tutte come lette
  fastify.put("/api/notifications/read-all", async (request) => {
    await fastify.prisma.notification.updateMany({
      where: { userId: request.user.id, read: false },
      data: { read: true },
    });

    return { success: true };
  });

  // PUT /api/notifications/:id/read - segna singola come letta
  fastify.put("/api/notifications/:id/read", async (request, reply) => {
    const { id } = request.params as { id: string };

    const notification = await fastify.prisma.notification.findUnique({
      where: { id },
    });

    if (!notification) {
      return reply.status(404).send({ error: "Not Found" });
    }

    await fastify.prisma.notification.update({
      where: { id },
      data: { read: true },
    });

    return { success: true };
  });

  // DELETE /api/notifications/:id - segna come dismissed (soft delete)
  fastify.delete("/api/notifications/:id", async (request, reply) => {
    const { id } = request.params as { id: string };

    try {
      await fastify.prisma.notification.update({
        where: { id },
        data: { dismissed: true, read: true },
      });
      return { success: true };
    } catch {
      return reply.status(404).send({ error: "Not Found" });
    }
  });
}
