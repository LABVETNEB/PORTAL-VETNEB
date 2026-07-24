import { ensureStudyTrackingCaseForToken } from "../domain/index.ts";

export type TokenStudyTrackingOperationsDeps = Parameters<
  typeof ensureStudyTrackingCaseForToken
>[0];

export type EnsureTokenStudyTrackingInput = Parameters<
  typeof ensureStudyTrackingCaseForToken
>[1];

export function createTokenStudyTrackingOperations(
  deps: TokenStudyTrackingOperationsDeps,
) {
  return {
    ensureTrackingForToken(input: EnsureTokenStudyTrackingInput) {
      return ensureStudyTrackingCaseForToken(deps, input);
    },
  };
}
