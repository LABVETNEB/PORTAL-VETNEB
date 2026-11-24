import { eq, sql } from "drizzle-orm";
import { db } from "../../../db.ts";
import { particularTokens } from "../../../../drizzle/schema.ts";

type ParticularTokenExecutor = Pick<typeof db, "select" | "update" | "execute">;

/**
 * Espera maxima por el lock de fila de un token. Acota el tiempo que una subida
 * retiene una conexion del pool esperando a otra subida del mismo token.
 */
export const PARTICULAR_TOKEN_LOCK_TIMEOUT_MS = 10_000;

/** Escrituras de token ligadas a una transaccion existente. */
export function createTransactionalParticularTokenRepository(
  executor: ParticularTokenExecutor,
) {
  return {
    /**
     * Bloquea la fila del token (FOR NO KEY UPDATE) hasta el fin de la
     * transaccion y devuelve su estado ya confirmado. Debe ser la PRIMERA
     * operacion de la unidad: dos subidas del mismo token se serializan aqui, y la
     * segunda lee el estado que dejo la primera. Se usa NO KEY UPDATE porque la
     * unica escritura es una columna que no es clave: asi no bloquea a las filas
     * que referencian al token por clave foranea (sesiones, notificaciones).
     */
    async lockParticularTokenForUpdate(id: number) {
      // SET LOCAL no admite parametros enlazados: el valor es una constante entera.
      await executor.execute(
        sql.raw(`set local lock_timeout = ${PARTICULAR_TOKEN_LOCK_TIMEOUT_MS}`),
      );

      const result = await executor
        .select()
        .from(particularTokens)
        .where(eq(particularTokens.id, id))
        .limit(1)
        .for("no key update");

      return result[0];
    },

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
