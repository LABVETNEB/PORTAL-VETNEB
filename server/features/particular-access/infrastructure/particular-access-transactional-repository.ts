import { eq } from "drizzle-orm";
import { db } from "../../../db.ts";
import { particularTokens } from "../../../../drizzle/schema.ts";

type ParticularTokenExecutor = Pick<typeof db, "update">;

/** Escrituras de token ligadas a una transaccion existente. */
export function createTransactionalParticularTokenRepository(
  executor: ParticularTokenExecutor,
) {
  return {
    async updateParticularTokenReport(id: number, reportId: number | null) {
      const result = await executor
        .update(particularTokens)
        .set({ reportId, updatedAt: new Date() })
        .where(eq(particularTokens.id, id))
        .returning();

      return result[0];
    },
  };
}
