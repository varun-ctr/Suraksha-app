import { useDependency } from "./DependencyProvider";

export const useContactsRepository = () => useDependency("contactsRepository");
export const useSosEventsRepository = () => useDependency("sosEventsRepository");
export const useLiveSessionRepository = () => useDependency("liveSessionRepository");
export const useCommunityReportsRepository = () => useDependency("communityReportsRepository");
