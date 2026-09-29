import assert from "node:assert/strict";
import test from "node:test";
import { readSourceFile as read } from "../../../helpers/tracked-source-files.ts";

const VISUAL_ACCENTS_PATH = "frontend/src/components/public/VisualAccents.tsx";
const HOME_PAGE_PATH = "frontend/src/app/page.tsx";

test("public visual accents render clinical eyebrow chips without legacy decorative pills", () => {
  const source = read(VISUAL_ACCENTS_PATH);

  assert.ok(source.includes("export function Eyebrow({ children, className }: EyebrowProps)"));
  assert.ok(source.includes("border border-vetneb-line bg-card/80"));
  assert.equal(source.includes("return null;"), false);
  assert.equal(source.includes("rounded-full border border-white/50"), false);
  assert.equal(source.includes("tracking-[0.22em]"), false);
  assert.equal(source.includes("render-orb"), false);
});

test("home page no longer renders the hero eyebrow pill", () => {
  const source = read(HOME_PAGE_PATH);

  assert.equal(source.includes("Servicio patológico veterinario"), false);
  assert.equal(
    source.includes("rounded-full border border-white/30 bg-black/35"),
    false,
  );
});
