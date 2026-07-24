import { useDependency } from "./DependencyProvider";

export const useContactsRepository = () => useDependency("contactsRepository");
export const useSosEventsRepository = () => useDependency("sosEventsRepository");
export const useLiveSessionRepository = () => useDependency("liveSessionRepository");
export const useJourneyRepository = () => useDependency("journeyRepository");
export const useCommunityReportsRepository = () => useDependency("communityReportsRepository");
export const useAuthRepository = () => useDependency("authRepository");
export const useEmailOtpRepository = () => useDependency("emailOtpRepository");
