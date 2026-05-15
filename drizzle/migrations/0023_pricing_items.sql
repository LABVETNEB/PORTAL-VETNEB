CREATE TABLE IF NOT EXISTS "pricing_items" (
  "id" serial PRIMARY KEY NOT NULL,
  "category" varchar(80) NOT NULL,
  "study_name" varchar(160) NOT NULL,
  "price_label" varchar(80),
  "display_order" integer NOT NULL,
  "is_active" boolean NOT NULL DEFAULT true,
  "updated_at" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "pricing_items_active_category_display_order_idx"
  ON "pricing_items" ("is_active", "category", "display_order");

INSERT INTO "pricing_items" (
  "category",
  "study_name",
  "price_label",
  "display_order",
  "is_active"
)
SELECT
  seed.category,
  seed.study_name,
  NULL,
  seed.display_order,
  true
FROM (
  VALUES
    ('CITOLOGÍAS', 'UNA LESIÓN (VARIOS VIDRIOS)', 1),
    ('CITOLOGÍAS', 'REPETICIÓN (DENTRO DE 15 DÍAS)', 2),
    ('CITOLOGÍAS', 'LESIÓN ADICIONAL (SOBRE SU VALOR)', 3),
    ('CITOLOGÍAS', 'MÉDULA ÓSEA', 4),
    ('CITOLOGÍAS', 'CITOLOGIA VAGINAL (PAP)', 5),
    ('CITOLOGÍAS', 'ZIEHL-NEELSEN', 6),
    ('CITOLOGÍAS', 'FROTIS CAPILAR', 7),
    ('HISTOPATOLOGÍAS', 'PIEZAS HASTA 10 CM', 1),
    ('HISTOPATOLOGÍAS', 'PIEZAS MÁS DE 10 CM', 2),
    ('HISTOPATOLOGÍAS', 'DERMATOPATOLOGÍA', 3),
    ('HISTOPATOLOGÍAS', 'LÍNEA MAMARIA COMPLETA', 4),
    ('HISTOPATOLOGÍAS', 'PIEZAS CON HUESO', 5),
    ('HISTOPATOLOGÍAS', 'PIEZA ADICIONAL (SOBRE SU VALOR)', 6),
    ('HISTOPATOLOGÍAS', 'TINCIONES ESPECIALES', 7),
    ('HISTOPATOLOGÍAS', 'URGENTES (ADICIONAL)', 8)
) AS seed(category, study_name, display_order)
WHERE NOT EXISTS (
  SELECT 1
  FROM "pricing_items" existing
  WHERE existing."category" = seed.category
    AND existing."study_name" = seed.study_name
);
