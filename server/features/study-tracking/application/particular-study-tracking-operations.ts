import type { ParticularStudyTrackingCommandRepository } from "./ports/study-tracking-command-repository.ts";
import type { ParticularStudyTrackingQueryRepository } from "./ports/study-tracking-query-repository.ts";
import { createParticularStudyTrackingCommandUseCases } from "./study-tracking-command-use-cases.ts";
import { createParticularStudyTrackingQueryUseCases } from "./study-tracking-query-use-cases.ts";

export type ParticularStudyTrackingNotificationListParams = {
  particularTokenId: number;
  unreadOnly: boolean;
  limit: number;
  offset: number;
};

export function createParticularStudyTrackingOperations<
  TCase,
  TNotification,
>(deps: {
  queryRepository: ParticularStudyTrackingQueryRepository<
    TCase,
    TNotification,
    ParticularStudyTrackingNotificationListParams
  >;
  commandRepository: ParticularStudyTrackingCommandRepository<
    TNotification,
    { id: number; particularTokenId: number },
    { particularTokenId: number },
    { updatedCount: number }
  >;
}) {
  const queries = createParticularStudyTrackingQueryUseCases(
    deps.queryRepository,
  );
  const commands = createParticularStudyTrackingCommandUseCases(
    deps.commandRepository,
  );

  return {
    getParticularStudyTrackingForToken: (particularTokenId: number) =>
      queries.getParticularStudyTrackingCase(particularTokenId),

    listParticularStudyTrackingNotifications: (input: {
      particularTokenId: number;
      unreadOnly: boolean;
      limit: number;
      offset: number;
    }) => queries.listStudyTrackingNotifications(input),

    acknowledgeParticularStudyTrackingNotification: (input: {
      particularTokenId: number;
      notificationId: number;
    }) =>
      commands.markStudyTrackingNotificationReadScoped({
        id: input.notificationId,
        particularTokenId: input.particularTokenId,
      }),

    acknowledgeAllParticularStudyTrackingNotifications: (
      particularTokenId: number,
    ) =>
      commands.markAllStudyTrackingNotificationsReadScoped({
        particularTokenId,
      }),
  };
}
