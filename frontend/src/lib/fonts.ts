// First 16 hex digits of the SHA-256 of the font file. The hash is part of
// the file name, so new bytes always get a new URL and next.config.ts lets
// that exact path be cached for good. globals.css repeats the path in its
// @font-face rule and must change with it.
export const INTER_FONT_VERSION = "693b77d4f32ee9b8";
export const INTER_FONT_PATH = `/fonts/InterVariable.${INTER_FONT_VERSION}.woff2`;
