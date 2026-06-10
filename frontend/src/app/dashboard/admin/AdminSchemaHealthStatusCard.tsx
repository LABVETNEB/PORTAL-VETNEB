"use client";

import { useEffect, useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getAdminSchemaHealth } from "@/lib/api";
import { formatDateTime } from "@/lib/utils";
import type { AdminSchemaHealthSnapshot } from "@/types";

function getSchemaStatusVariant(
  status: AdminSchemaHealthSnapshot["status"],
): "default" | "secondary" | "destructive" | "outline" {
  return status === "ok" ? "default" : "secondary";
}

function formatSchemaStatusLabel(
  status: AdminSchemaHealthSnapshot["status"],
) {
  return status === "ok" ? "Esquema compatible" : "Faltan columnas críticas";
}

function formatGeneratedAt(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return formatDateTime(date.toISOString());
}

function sanitizeSchemaHealthError(error: unknown) {
  const fallbackMessage =
    "No se pudo consultar el estado del esquema. Reintentá en unos segundos.";

  if (!(error instanceof Error)) {
    return fallbackMessage;
  }

  const message = error.message.trim();
  if (!message) {
    return fallbackMessage;
  }

  if (message.startsWith("HTTP ")) {
    return fallbackMessage;
  }

  return message;
}

export function AdminSchemaHealthStatusCard() {
  const [snapshot, setSnapshot] = useState<AdminSchemaHealthSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [isPending, startTransition] = useTransition();

  function loadSchemaHealth() {
    setError(null);

    startTransition(() => {
      void (async () => {
        try {
          const result = await getAdminSchemaHealth();
          setSnapshot(result);
        } catch (fetchError) {
          setSnapshot(null);
          setError(sanitizeSchemaHealthError(fetchError));
        } finally {
          setHasLoadedOnce(true);
        }
      })();
    });
  }

  useEffect(() => {
    loadSchemaHealth();
  }, []);

  const showLoadingState = !hasLoadedOnce && !snapshot && !error;
  const showDegradedState = snapshot?.status === "degraded";

  return (
    <Card id="admin-schema-health" className="dashboard-surface">
      <CardHeader className="flex flex-col gap-3 border-b border-vetneb-line/70 md:flex-row md:items-start md:justify-between">
        <div>
          <CardTitle className="text-base">Estado de esquema</CardTitle>
          <CardDescription>
            Validación de columnas críticas requeridas por el backend.
          </CardDescription>
        </div>
        <Button type="button" variant="outline" onClick={loadSchemaHealth} disabled={isPending} aria-busy={isPending ? true : undefined}>
          {isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
          {isPending ? "Consultando..." : "Reintentar"}
        </Button>
      </CardHeader>

      <CardContent className="space-y-4 pt-6">
        {showLoadingState ? (
          <div className="surface-empty">
            Consultando estado de esquema...
          </div>
        ) : null}

        {error ? (
          <div role="alert" className="clinical-alert-error">
            {error}
          </div>
        ) : null}

        {snapshot ? (
          <>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <div className="surface-soft">
                <p className="text-xs text-muted-foreground">Estado</p>
                <div className="mt-2">
                  <Badge variant={getSchemaStatusVariant(snapshot.status)}>
                    {formatSchemaStatusLabel(snapshot.status)}
                  </Badge>
                </div>
              </div>
              <div className="surface-soft">
                <p className="text-xs text-muted-foreground">Generado</p>
                <p className="mt-1 text-sm font-semibold text-vetneb-ink">
                  {formatGeneratedAt(snapshot.generatedAt)}
                </p>
              </div>
              <div className="surface-soft">
                <p className="text-xs text-muted-foreground">Revisado por</p>
                <p className="mt-1 text-sm font-semibold text-vetneb-ink">
                  {snapshot.checkedBy
                    ? `${snapshot.checkedBy.username} #${snapshot.checkedBy.adminUserId}`
                    : "—"}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
              <div className="surface-soft">
                <p className="text-xs text-muted-foreground">Tablas requeridas</p>
                <p className="mt-1 text-2xl font-bold text-vetneb-ink">
                  {snapshot.summary.requiredTables}
                </p>
              </div>
              <div className="surface-soft">
                <p className="text-xs text-muted-foreground">Columnas requeridas</p>
                <p className="mt-1 text-2xl font-bold text-vetneb-ink">
                  {snapshot.summary.requiredColumns}
                </p>
              </div>
              <div className="surface-soft">
                <p className="text-xs text-muted-foreground">Columnas presentes</p>
                <p className="mt-1 text-2xl font-bold text-vetneb-ink">
                  {snapshot.summary.presentColumns}
                </p>
              </div>
              <div className="surface-soft">
                <p className="text-xs text-muted-foreground">Columnas faltantes</p>
                <p className="mt-1 text-2xl font-bold text-vetneb-ink">
                  {snapshot.summary.missingColumns}
                </p>
              </div>
            </div>

            {showDegradedState ? (
              <div className="clinical-alert-warning">
                <p className="font-semibold">Faltan columnas críticas.</p>
                {snapshot.missing.length ? (
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
                    {snapshot.missing.map((missingColumn) => (
                      <li
                        key={`${missingColumn.schema}.${missingColumn.table}.${missingColumn.column}`}
                        className="font-mono"
                      >
                        {missingColumn.schema}.{missingColumn.table}.{missingColumn.column}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-sm">
                    No se recibió detalle de columnas faltantes.
                  </p>
                )}
              </div>
            ) : null}
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}
