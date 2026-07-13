# Suraksha App — Code Improvement Plan

## Executive Summary

**Project:** Sakhi Suraksha — A React Native safety app for women with SOS alerts, live location sharing, community reporting, and AI chat.

**Stack:** 
- Frontend: React Native (Expo) with Expo Router, React Query
- Backend: Express.js with Drizzle ORM
- Database: Supabase (PostgreSQL) + Firebase Auth
- Libraries: Shared APIs, Zod validation, OpenAI integration

---

## 1. ARCHITECTURE & CODE ORGANIZATION 🏗️

### Current State
✅ Good:
- Clear monorepo structure with workspace separation
- Proper library abstraction (api-client-react, api-zod, db, integrations)
- Context-based state management
- Expo Router for navigation

⚠️ Issues:
- Multiple auth systems (Firebase + Supabase) causing confusion in some files
- Missing API contract layer between frontend and backend
- No clear separation between domain logic and UI
- Limited component composition patterns

### Recommendations

1. **Create a unified data layer** (HIGH PRIORITY)
   - File: `lib/api-client-react/src/hooks/useApiQuery.ts`
   - Use React Query consistently across all data fetching
   - Create typed query hooks for each resource (contacts, reports, sessions)
   - Example structure:
     ```typescript
     // lib/api-client-react/src/queries
     ├── contacts.ts
     ├── reports.ts
     ├── sessions.ts
     └── auth.ts
     ```

2. **Define API contracts** (HIGH PRIORITY)
   - Create OpenAPI/GraphQL schema documentation
   - Use Zod for runtime validation of all API responses
   - File: `lib/api-zod/src/routes/` — organize by resource
   - This ensures type safety end-to-end

3. **Migrate legacy auth files** (MEDIUM)
   - [artifacts/suraksha/lib/auth.ts](artifacts/suraksha/lib/auth.ts) has both Firebase and Supabase references
   - Standardize on Firebase for auth, remove duplicate Supabase auth code
   - Document why both systems exist (audit trail for auth events)

4. **Extract business logic** (MEDIUM)
   - Move SOS alert orchestration out of SafetyContext into a service
   - File: `artifacts/suraksha/lib/sosAlertService.ts`
   - File: `artifacts/suraksha/lib/journeyService.ts`
   - Keep context for UI state only

---

## 2. ERROR HANDLING & RESILIENCE 🛡️

### Current State
✅ Good:
- Network error graceful fallback (SOS alert → Twilio → SMS app)
- Try-catch in critical paths
- Error boundary component
- Crash reporting via Sentry

⚠️ Issues:
- Inconsistent error handling across routes (backend)
- No retry logic for failed API calls
- Missing request timeout validation
- Silent failures in some data sync operations
- Limited error context/logging

### Recommendations

1. **Standardize error handling** (HIGH)
   - Create unified error types:
     ```typescript
     // lib/errors.ts
     type AppError = 
       | { kind: 'network'; retryable: true }
       | { kind: 'auth'; retryable: false }
       | { kind: 'validation'; retryable: false }
       | { kind: 'server'; retryable: true }
       | { kind: 'unknown'; retryable: false }
     ```
   - Apply to all `apiFetch()` calls (currently returns `null` on error)
   - Update [artifacts/suraksha/lib/apiClient.ts](artifacts/suraksha/lib/apiClient.ts) to return typed errors

2. **Add exponential backoff retry logic** (HIGH)
   - File: `lib/api-client-react/src/utils/retryWithBackoff.ts`
   - Wrap all React Query mutations with automatic retry
   - Example: SOS alert should retry up to 3 times with 2s intervals

3. **Enhanced error logging** (MEDIUM)
   - Create error logger that captures:
     - Error type, message, stack
     - Request details (method, endpoint, auth status)
     - Device/app info
     - User action context
   - File: `artifacts/suraksha/lib/errorLogger.ts`
   - Integration with Sentry for critical errors

4. **Handle network errors gracefully** (MEDIUM)
   - Create offline queue for failed mutations
   - Sync when connectivity returns
   - File: `lib/api-client-react/src/offline/offlineQueue.ts`
   - Especially important for SOS alerts

5. **Add input validation at boundaries** (MEDIUM)
   - Backend routes: use Zod middleware to validate request bodies
   - Frontend: validate before sending
   - File: `artifacts/api-server/src/middlewares/validateRequest.ts`

---

## 3. TESTING & QUALITY 🧪

### Current State
✅ Good:
- Unit tests for utilities (emergencyMessage, validate)
- TypeScript strict mode

⚠️ Issues:
- Only 3 test files for entire app
- No integration tests
- No API endpoint tests
- No E2E tests
- 0% test coverage for business logic

### Recommendations

1. **Expand unit testing** (HIGH)
   - Target 70%+ coverage for utility/service functions
   - Files to test:
     - `lib/validate.ts` (phone, email normalization)
     - `lib/sosAlert.ts` (SOS orchestration logic)
     - `lib/emergencyMessage.ts` ✓ (already done)
     - `lib/liveSession.ts` (session management)
     - `lib/contactsSync.ts` (contact sync)

2. **Add integration tests** (MEDIUM)
   - Test context + hooks together
   - Example: `components/__tests__/SafetyProvider.integration.test.ts`
   - Setup: Use `@react-native-testing-library` + `@testing-library/react-hooks`

3. **Add backend route tests** (MEDIUM)
   - Test each endpoint with valid/invalid inputs
   - File: `artifacts/api-server/src/__tests__/routes/`
   - Setup: Use `supertest` for HTTP assertions
   - Example: Test SOS alert rate limiting, phone normalization

4. **API contract testing** (MEDIUM)
   - Use Zod to validate responses match expected schema
   - File: `lib/api-zod/src/__tests__/`
   - Ensures frontend and backend don't drift

5. **Setup CI pipeline** (MEDIUM)
   - Run tests on every PR
   - Fail if coverage drops
   - Lint/type-check pass required

---

## 4. PERFORMANCE & OPTIMIZATION ⚡

### Current State
✅ Good:
- React Compiler enabled (`babel-plugin-react-compiler`)
- Reanimated for smooth animations
- Memoization in contexts

⚠️ Issues:
- Multiple contexts re-render on any state change
- No code splitting strategy
- Location polling every 5s even when not needed
- Contacts sync runs on every app launch
- No image optimization

### Recommendations

1. **Optimize re-renders** (MEDIUM)
   - Split large contexts into smaller, focused ones
   - Current: AppContext handles contacts + profile + settings
   - Split into: ProfileContext, SettingsContext, ContactsContext
   - Example refactor:
     ```typescript
     // Before: all in AppContext
     const { contacts, profile, settings } = useApp();
     
     // After: separate hooks
     const { contacts } = useContacts();
     const { profile } = useProfile();
     const { settings } = useSettings();
     ```

2. **Memoize expensive computations** (MEDIUM)
   - Wrap context values with `useMemo`
   - Memoize selector functions
   - File: `artifacts/suraksha/hooks/useContextSelector.ts` (new)

3. **Smart location polling** (MEDIUM)
   - Only request location when:
     - SOS is active
     - Live session is active
     - User explicitly requests it
   - Current: Always polls once per 5s during tracking

4. **Lazy load screens** (LOW)
   - Use Expo Router's `lazy` export for less-used screens
   - Screens to defer: premium, helpline, data, privacy, terms

5. **Image optimization** (LOW)
   - Add `expo-image` optimization
   - Compress avatar images on upload
   - Use AVIF format where supported

---

## 5. SECURITY & DATA PROTECTION 🔒

### Current State
✅ Good:
- Firebase + Supabase for auth
- Row-level security (RLS) on database
- Secure store for PII
- HTTPS required
- Security headers in place

⚠️ Issues:
- Firebase config exposed in env (OK for public key but verify)
- Phone numbers stored as plaintext in contacts
- No encryption of sensitive data at rest
- SOS event history not cleared properly
- No audit logging for sensitive operations

### Recommendations

1. **Audit environment variables** (HIGH)
   - Verify EXPO_PUBLIC_* variables don't contain secrets
   - Check: Firebase config is correct (public-only keys)
   - Document what each env var does
   - File: Create `docs/ENVIRONMENT_VARS.md`

2. **Encrypt sensitive data** (MEDIUM)
   - Encrypt phone numbers in local storage
   - Encrypt location history before storing
   - Use libsodium or TweetNaCl for encryption
   - Package: `@esm2cjs/tweetnacl`

3. **Add audit logging** (MEDIUM)
   - Log all sensitive operations:
     - Account creation/deletion
     - Contact add/remove
     - SOS triggered
     - Community report submitted
   - File: `artifacts/api-server/src/lib/auditLog.ts`
   - Store in database with user, action, timestamp

4. **Implement account lockout** (LOW)
   - After N failed login attempts, lock account temporarily
   - Firebase already handles this, verify it's enabled

5. **Add data export/GDPR compliance** (MEDIUM)
   - Implement `/auth/export` endpoint
   - Returns all user data as JSON
   - File: `artifacts/api-server/src/routes/auth.ts` (add export)

---

## 6. BACKEND RELIABILITY 📡

### Current State
✅ Good:
- Express middleware for CORS, security headers
- Graceful shutdown on unhandled errors
- Rate limiting on SOS alerts
- Twilio integration with fallback

⚠️ Issues:
- No database transaction handling
- Missing input validation middleware
- Inconsistent error responses
- No health checks
- Limited monitoring/observability

### Recommendations

1. **Add request validation middleware** (HIGH)
   - File: `artifacts/api-server/src/middlewares/validateRequest.ts`
   - Use Zod to validate request bodies
   - Return 400 with error details if validation fails

2. **Implement health checks** (MEDIUM)
   - File: Add to `artifacts/api-server/src/routes/health.ts`
   - Check: Database connection, external services (Twilio, OpenAI)
   - Endpoint: `GET /health` → `{ ok: true, checks: { db, twilio, openai } }`

3. **Add database transaction support** (MEDIUM)
   - For multi-step operations (e.g., delete account = delete profile + user)
   - Use Drizzle transactions
   - File: `lib/db/src/transactions.ts`

4. **Standardize error responses** (MEDIUM)
   - All errors should follow schema:
     ```json
     { "error": "NOT_FOUND", "message": "User not found", "code": 404 }
     ```
   - File: `artifacts/api-server/src/lib/errorResponse.ts`

5. **Add request/response logging** (MEDIUM)
   - Use pino with request ID tracing
   - Already using pino-http, ensure it logs request/response bodies
   - Be careful not to log PII

---

## 7. DOCUMENTATION & MAINTAINABILITY 📚

### Current State
✅ Good:
- Code comments in key files
- Privacy policy document
- Some inline documentation

⚠️ Issues:
- No API documentation
- No architecture decision records (ADRs)
- No setup/deployment guide
- Missing error code reference
- No contribution guidelines

### Recommendations

1. **Create API documentation** (HIGH)
   - Generate from code using `@internal` tags
   - File: `docs/API.md`
   - List all endpoints, request/response shapes, error codes
   - Manual: Use OpenAPI comments (JSDoc)

2. **Document architecture** (HIGH)
   - File: `docs/ARCHITECTURE.md`
   - Explain: project structure, data flow, auth system, db schema
   - Diagrams: Components, data flow, auth flow

3. **Create setup guide** (MEDIUM)
   - File: `docs/SETUP.md`
   - Steps to: install, configure env vars, run locally, deploy
   - Troubleshooting section

4. **Document error codes** (MEDIUM)
   - File: `docs/ERROR_CODES.md`
   - List all possible error codes and what they mean
   - How to handle each one

5. **Create CONTRIBUTING.md** (MEDIUM)
   - PR process, code style, testing requirements
   - File: `CONTRIBUTING.md`

---

## 8. FEATURE-SPECIFIC IMPROVEMENTS 🎯

### SOS Alert System
**Issues:**
- Retry logic is simple (one 2s retry)
- No idempotency guarantees (could send duplicate SMS)
- Alert status UI doesn't update in real-time

**Fixes:**
- Add idempotency key (UUID) to all SOS requests
- Store in database to prevent duplicates
- Add request-level rate limiting (per user, per minute)
- Update alert status via WebSocket or polling

### Live Location Sharing
**Issues:**
- Session data doesn't handle network gaps
- No encryption of location in transit
- 24-hour expiry is hardcoded

**Fixes:**
- Add resumable session handling
- Use TLS only (already done)
- Make expiry configurable per app
- Add session encryption option

### Community Reports
**Issues:**
- No moderation workflow
- Reports auto-published after review
- Spam/abuse not handled

**Fixes:**
- Add manual approval workflow
- Create report moderation queue
- Add report flags for abuse (report of report)
- Implement spam detection

### Chat with Sakhi (AI)
**Issues:**
- Message count limit per user not enforced
- No conversation history management
- No content filtering

**Fixes:**
- Implement strict message counting
- Add conversation deletion after N days
- Add content safety filter (OpenAI moderation)
- Rate limit per user per hour

### Contacts System
**Issues:**
- Max contacts hardcoded to 1
- No sync failure recovery
- Contact deletion doesn't sync

**Fixes:**
- Make max contacts configurable
- Implement conflict resolution for sync
- Add delete sync endpoint
- Add contact verification (call/SMS)

---

## 9. DEPLOYMENT & OPERATIONS 🚀

### Current State
✅ Good:
- Expo for easy mobile deployment
- Replit hosting

⚠️ Issues:
- No staging environment
- No blue-green deployment
- No rollback strategy
- Limited monitoring
- No load testing

### Recommendations

1. **Setup staging environment** (MEDIUM)
   - Separate Supabase project for staging
   - Staging API server deployment
   - Pre-release testing before production

2. **Implement blue-green deployments** (MEDIUM)
   - Zero-downtime deployments
   - Easy rollback if needed

3. **Add comprehensive monitoring** (MEDIUM)
   - Sentry for errors (already done)
   - Add performance monitoring (Sentry Performance)
   - Database query monitoring (explain plans)
   - API latency tracking

4. **Create runbooks** (LOW)
   - Escalation procedures
   - Common issues and fixes
   - File: `docs/RUNBOOKS.md`

---

## 10. TECHNICAL DEBT CLEANUP 🧹

### High Priority
- [ ] Remove unused dependencies
- [ ] Upgrade packages with security advisories
- [ ] Fix TypeScript strict violations
- [ ] Remove commented-out code

### Medium Priority
- [ ] Consolidate duplicate auth logic
- [ ] Migrate all API calls to use `apiFetch()`
- [ ] Standardize file naming (camelCase vs kebab-case)
- [ ] Remove `any` types

### Low Priority
- [ ] Update README with features
- [ ] Add example .env file
- [ ] Create VS Code settings (prettier, eslint)

---

## Implementation Roadmap

### Phase 1: Foundation (Weeks 1-2)
1. Create unified data layer (React Query hooks)
2. Add error handling types and utilities
3. Setup basic test infrastructure
4. Create API documentation

### Phase 2: Quality (Weeks 3-4)
1. Expand test coverage to 50%+
2. Refactor contexts to smaller pieces
3. Add request validation middleware
4. Implement health checks

### Phase 3: Hardening (Weeks 5-6)
1. Add encryption for sensitive data
2. Implement audit logging
3. Add performance monitoring
4. Create architecture documentation

### Phase 4: Polish (Weeks 7+)
1. Optimize re-renders
2. Add E2E tests
3. Setup staging environment
4. Complete documentation

---

## Quick Wins (Can do immediately)
- [ ] Add `.env.example` file
- [ ] Add missing JSDoc comments to public functions
- [ ] Run `npm audit fix` for dependencies
- [ ] Add `CONTRIBUTING.md`
- [ ] Create issue templates for bug reports/features
- [ ] Setup GitHub Actions for linting/tests on PR

---

## Metrics to Track
- Test coverage (target: 70%)
- API response time (target: <200ms p95)
- Error rate (target: <0.1%)
- SOS alert delivery time (target: <3s)
- App crash rate (target: <0.01%)
- Build time (target: <5m)

---

## Questions for Product Team
1. What's the max contacts limit we need to support?
2. Should SOS alerts be encrypted end-to-end?
3. How long should we retain SOS event history?
4. Do we need offline support (caching)?
5. What's the scale target (users, daily active users)?

