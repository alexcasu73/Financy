import { FastifyInstance } from "fastify";
import fp from "fastify-plugin";
import cors from "@fastify/cors";

async function corsPlugin(fastify: FastifyInstance) {
  await fastify.register(cors, {
    origin: process.env.NODE_ENV === "production"
      ? ["https://financy.app"]
      : true,
    credentials: true,
  });
}

export default fp(corsPlugin, { name: "cors" });
