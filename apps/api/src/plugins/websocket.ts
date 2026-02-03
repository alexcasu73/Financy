import { FastifyInstance } from "fastify";
import fp from "fastify-plugin";
import { Server } from "socket.io";

declare module "fastify" {
  interface FastifyInstance {
    io: Server;
  }
}

async function websocketPlugin(fastify: FastifyInstance) {
  const io = new Server(fastify.server, {
    cors: {
      origin: process.env.CORS_ORIGIN || "http://localhost:3000",
      credentials: true,
    },
    path: "/ws",
  });

  // Authentication middleware
  io.use(async (socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) {
      return next(new Error("Authentication required"));
    }

    try {
      const decoded = fastify.jwt.verify<{ id: string }>(token);
      socket.data.userId = decoded.id;
      next();
    } catch {
      next(new Error("Invalid token"));
    }
  });

  io.on("connection", (socket) => {
    const userId = socket.data.userId;
    fastify.log.info({ userId, socketId: socket.id }, "WebSocket connected");

    // Join user-specific room
    socket.join(`user:${userId}`);

    socket.on("disconnect", () => {
      fastify.log.info({ userId, socketId: socket.id }, "WebSocket disconnected");
    });
  });

  fastify.decorate("io", io);

  fastify.addHook("onClose", () => {
    io.close();
  });
}

export default fp(websocketPlugin, {
  name: "websocket",
  dependencies: ["auth"],
});
