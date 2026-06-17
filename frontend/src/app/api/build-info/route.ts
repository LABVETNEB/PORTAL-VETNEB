import { NextResponse } from "next/server";
import { VETNEB_APP_SHELL_RELEASE } from "@/lib/app-shell-release";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

function shortSha(value: string | undefined): string | null {
  if (!value) return null;
  const normalized = value.trim();
  if (!/^[a-f0-9]{7,40}$/i.test(normalized)) return null;
  return normalized.slice(0, 12);
}

export async function GET() {
  const commit =
    shortSha(process.env.NEXT_PUBLIC_VETNEB_BUILD_SHA) ??
    shortSha(process.env.RENDER_GIT_COMMIT) ??
    shortSha(process.env.VERCEL_GIT_COMMIT_SHA) ??
    shortSha(process.env.GITHUB_SHA) ??
    null;

  return NextResponse.json(
    {
      success: true,
      app: "portal-vetneb",
      surface: "frontend",
      appShellRelease: VETNEB_APP_SHELL_RELEASE,
      commit,
      commitAvailable: commit !== null,
      timestamp: new Date().toISOString(),
    },
    {
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    },
  );
}