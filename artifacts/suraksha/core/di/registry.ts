import { contactsRepository } from "@/repositories/supabase/contactsRepository";
import { sosEventsRepository } from "@/repositories/supabase/sosEventsRepository";
import { liveSessionRepository } from "@/repositories/supabase/liveSessionRepository";
import { communityReportsRepository } from "@/repositories/api/communityReportsRepository";
import { authRepository } from "@/repositories/firebase/authRepository";
import { emailOtpRepository } from "@/repositories/api/emailOtpRepository";
import type {
  ContactsRepository,
  SosEventsRepository,
  LiveSessionRepository,
  CommunityReportsRepository,
  AuthRepository,
  EmailOtpRepository,
} from "@/domain/repositories";
import { Container } from "./container";

/**
 * Every injectable service in the app, keyed by name. Add a new entry here
 * (and register it in createAppContainer below) when a new repository joins
 * the DI layer — see docs/adr/0002-repository-pattern.md.
 */
export interface AppRegistry {
  contactsRepository: ContactsRepository;
  sosEventsRepository: SosEventsRepository;
  liveSessionRepository: LiveSessionRepository;
  communityReportsRepository: CommunityReportsRepository;
  authRepository: AuthRepository;
  emailOtpRepository: EmailOtpRepository;
}

/**
 * Builds the production container, wiring each domain contract to its
 * concrete Supabase/REST implementation. `overrides` lets tests (or a
 * future alternate backend) swap any subset of services without touching
 * consuming code — see docs/adr/0002-repository-pattern.md.
 */
export function createAppContainer(overrides?: Partial<AppRegistry>): Container<AppRegistry> {
  const container = new Container<AppRegistry>();
  container.register("contactsRepository", overrides?.contactsRepository ?? contactsRepository);
  container.register("sosEventsRepository", overrides?.sosEventsRepository ?? sosEventsRepository);
  container.register("liveSessionRepository", overrides?.liveSessionRepository ?? liveSessionRepository);
  container.register("communityReportsRepository", overrides?.communityReportsRepository ?? communityReportsRepository);
  container.register("authRepository", overrides?.authRepository ?? authRepository);
  container.register("emailOtpRepository", overrides?.emailOtpRepository ?? emailOtpRepository);
  return container;
}
