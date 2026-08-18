import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";

const connectionString = `${process.env.DATABASE_URL}`;

const globalForPrisma = global as unknown as { prisma: PrismaClient };

let prisma: PrismaClient;

if (globalForPrisma.prisma) {
  prisma = globalForPrisma.prisma;
} else {
  const pool = new Pool({ 
    connectionString,
    max: 10,
    idleTimeoutMillis: 10000,
    connectionTimeoutMillis: 5000,
    keepAlive: true,
  });

  pool.on("error", (err) => {
    console.error("[PG Pool Error]: Unexpected error on idle client", err);
  });

  const adapter = new PrismaPg(pool);
  prisma = new PrismaClient({ adapter });
}

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export { prisma };
export default prisma;
