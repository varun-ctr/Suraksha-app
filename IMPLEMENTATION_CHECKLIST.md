# Suraksha — Implementation Checklist

## 🔴 Critical (Must Do)

### Error Handling & Resilience
- [ ] Create unified error types (`lib/errors.ts`)
  - Network, auth, validation, server, unknown
  - Each error type has `retryable` flag
- [ ] Update `apiFetch()` to return typed errors instead of null
- [ ] Add exponential backoff retry for React Query mutations
- [ ] Implement offline queue for failed mutations
- [ ] Add validation middleware to Express: `validateRequest.ts`

### Testing Foundation
- [ ] Setup Jest + React Testing Library
- [ ] Create test setup file with mocks for Firebase, Supabase
- [ ] Write tests for `lib/validate.ts` (phone, email)
- [ ] Write tests for `lib/sosAlert.ts` (SOS logic)
- [ ] Write tests for API routes (sos-alert, auth, reports)
- [ ] Aim for 50% coverage of util functions

### Backend Validation
- [ ] Add Zod schema for each route's request body
- [ ] Create validation middleware
- [ ] Standardize error response format
- [ ] Add rate limiting checks to all public endpoints
- [ ] Document all error codes

### API Documentation
- [ ] Create `docs/API.md` with all endpoints
- [ ] Document request/response schemas
- [ ] Document error codes and recovery
- [ ] Create examples for each endpoint
- [ ] Add OpenAPI comments to routes

---

## 🟠 High Priority (Do Next)

### State Management Refactor
- [ ] Split AppContext into: ProfileContext, SettingsContext, ContactsContext
- [ ] Split SafetyContext: separate SOS from Journey logic
- [ ] Add `useContextSelector()` hook to prevent unnecessary re-renders
- [ ] Memoize context values with `useMemo`

### Authentication Consolidation
- [ ] Remove Supabase auth references from all files
- [ ] Standardize on Firebase for auth, Supabase for data only
- [ ] Create `lib/firebaseAuth.ts` as single source of truth
- [ ] Update [artifacts/suraksha/lib/auth.ts](artifacts/suraksha/lib/auth.ts)

### SOS Alert Improvements
- [ ] Add idempotency key (UUID) to SOS requests
- [ ] Store idempotency key in database to prevent duplicate sends
- [ ] Implement retry with exponential backoff (3 attempts, 2s intervals)
- [ ] Add real-time alert status updates (WebSocket or polling)
- [ ] Test with Twilio sandbox before production

### Data Layer Unification
- [ ] Create React Query hooks for all resources
  - `useContacts()`, `useAddContact()`, `useDeleteContact()`
  - `useReports()`, `useSubmitReport()`
  - `useSessions()`, `useStartSession()`, `useEndSession()`
  - File: `lib/api-client-react/src/queries/`
- [ ] Replace direct Supabase calls with these hooks
- [ ] Add caching strategy for each resource type

### Monitoring & Observability
- [ ] Enable Sentry Performance monitoring
- [ ] Add custom metrics: SOS delivery time, API latency
- [ ] Create dashboard for error rates by type
- [ ] Setup alerts for critical errors

---

## 🟡 Medium Priority (This Quarter)

### Documentation
- [ ] Create `docs/ARCHITECTURE.md` (project structure, data flow)
- [ ] Create `docs/SETUP.md` (local dev setup, env vars)
- [ ] Create `docs/ENVIRONMENT_VARS.md` (all vars explained)
- [ ] Create `CONTRIBUTING.md` (PR process, code style)
- [ ] Add `.env.example` with all required vars
- [ ] Create `docs/ERROR_CODES.md` (all error codes)

### Security Hardening
- [ ] Audit all EXPO_PUBLIC_* variables (no secrets)
- [ ] Encrypt phone numbers in local storage
- [ ] Add audit logging for sensitive operations
  - Account creation/deletion
  - Contact modifications
  - SOS triggers
  - Community reports
- [ ] Implement data export (GDPR `/auth/export`)
- [ ] Review Firebase security rules

### Performance Optimization
- [ ] Implement smart location polling (only when needed)
- [ ] Optimize contact sync (don't run on every launch)
- [ ] Add image optimization for avatars
- [ ] Implement code splitting for large screens
- [ ] Profile app startup time
- [ ] Profile memory usage on long sessions

### Backend Reliability
- [ ] Implement health checks endpoint (`GET /health`)
  - Check: DB connection, Twilio, OpenAI
  - Return: { ok, checks: { db, twilio, openai } }
- [ ] Add database transaction support
- [ ] Implement structured request/response logging
- [ ] Add request ID tracing (pino)
- [ ] Create `lib/errorResponse.ts` for consistency

### Feature: Live Location Sharing
- [ ] Handle network gaps in session data
- [ ] Add session encryption option
- [ ] Make 24-hour expiry configurable
- [ ] Add real-time position updates via WebSocket
- [ ] Test multi-contact live sharing

### Feature: Community Reports
- [ ] Add moderation workflow (manual approval)
- [ ] Create report moderation queue
- [ ] Add report flags (report of report for spam)
- [ ] Implement spam detection
- [ ] Add report history to user dashboard

---

## 🔵 Low Priority (Polish & Nice-to-Have)

### Code Quality
- [ ] Remove all `any` types
- [ ] Add ESLint + Prettier config
- [ ] Fix TypeScript strict violations
- [ ] Remove commented-out code
- [ ] Consolidate duplicate utility functions
- [ ] Add JSDoc to public functions

### Testing (Advanced)
- [ ] Add E2E tests with Detox (native)
- [ ] Add E2E tests with Cypress (web)
- [ ] Add performance benchmarks
- [ ] Add load testing for backend
- [ ] Achieve 80%+ coverage

### DevOps & Deployment
- [ ] Setup staging environment (separate Supabase project)
- [ ] Implement blue-green deployments
- [ ] Create runbooks for common issues
- [ ] Add GitHub Actions CI/CD pipeline
- [ ] Setup automatic dependency updates
- [ ] Create deployment checklist

### UI/UX Polish
- [ ] Improve accessibility (a11y)
- [ ] Add dark mode properly (currently auto only)
- [ ] Improve error messages shown to users
- [ ] Add loading states to all async operations
- [ ] Add success/confirmation toasts
- [ ] Create design system documentation

### Monitoring & Analytics
- [ ] Add feature usage analytics
- [ ] Track SOS alert effectiveness
- [ ] Monitor user retention
- [ ] Create product dashboard
- [ ] Setup funnel analysis for onboarding

---

## 📋 Quick Wins (Can do Today)

- [ ] Add `.env.example` (5 min)
- [ ] Create `CONTRIBUTING.md` (15 min)
- [ ] Run `npm audit fix` (10 min)
- [ ] Add JSDoc to top 10 public functions (1 hour)
- [ ] Create issue templates (10 min)
- [ ] Add GitHub Actions lint job (1 hour)

---

## 🎯 Phase-Based Implementation

### Phase 1: Foundation (Weeks 1-2)
Goal: Make codebase maintainable and testable

- [ ] Setup testing infrastructure
- [ ] Create unified error types
- [ ] Consolidate auth
- [ ] Create React Query hooks
- [ ] Add API documentation

**Outcome:** 50% test coverage, clear error handling, unified data layer

### Phase 2: Quality (Weeks 3-4)
Goal: Improve reliability and performance

- [ ] Refactor large contexts
- [ ] Optimize re-renders
- [ ] Add validation middleware
- [ ] Implement health checks
- [ ] Expand test coverage to 70%

**Outcome:** Faster app, fewer re-renders, better backend error handling

### Phase 3: Hardening (Weeks 5-6)
Goal: Production-ready security and monitoring

- [ ] Add audit logging
- [ ] Implement encryption
- [ ] Setup performance monitoring
- [ ] Add SOS alert idempotency
- [ ] Create architecture docs

**Outcome:** Audit trail, encrypted sensitive data, clear architecture docs

### Phase 4: Polish (Weeks 7+)
Goal: Excellent DX and stability

- [ ] Setup staging/blue-green deployments
- [ ] Add E2E tests
- [ ] Complete all documentation
- [ ] Setup CI/CD pipeline
- [ ] Optimize performance metrics

**Outcome:** Safe deployments, comprehensive tests, complete docs

---

## 📊 Success Metrics

| Metric | Current | Target | Timeline |
|--------|---------|--------|----------|
| Test Coverage | ~5% | 70% | Phase 2 |
| Error Rate | Unknown | <0.1% | Phase 3 |
| SOS Delivery | ~1s | <3s (guaranteed) | Phase 3 |
| App Startup | Unknown | <2s | Phase 2 |
| API Response (p95) | Unknown | <200ms | Phase 2 |
| Zero-Downtime Deploy | No | Yes | Phase 4 |
| Documentation | 30% | 100% | Phase 3 |

---

## 🚀 Deployment Gates

**Phase 1 Complete:** Can begin Phase 2  
**Phase 2 Complete:** Ready for production hardening  
**Phase 3 Complete:** Can deploy to production with confidence  
**Phase 4 Complete:** Fully production-ready with observability  

---

## Questions for Product Team

1. [ ] What's the max contacts we need to support?
2. [ ] Should SOS be end-to-end encrypted?
3. [ ] How long retain SOS history? (currently 12 months)
4. [ ] Need offline support (caching)?
5. [ ] What's scale target (daily active users)?
6. [ ] Premium feature tier? (Currently basic)
7. [ ] Geographic expansion plans? (Currently India +91)

---

## 👥 Team Assignments

| Area | Owner | Phase | Effort |
|------|-------|-------|--------|
| Testing | TBD | 1-2 | 40h |
| Error Handling | TBD | 1-2 | 30h |
| State Management | TBD | 2 | 25h |
| Documentation | TBD | 3-4 | 20h |
| Security | TBD | 3 | 20h |
| DevOps | TBD | 4 | 25h |

---

**Last Updated:** 2026-07-13  
**Revision:** 1.0  
**Status:** Ready for Implementation

