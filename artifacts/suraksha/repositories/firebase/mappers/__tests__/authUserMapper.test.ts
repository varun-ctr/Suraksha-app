import { test } from "node:test";
import assert from "node:assert/strict";
import type { User as FirebaseUser } from "firebase/auth";

import { toAuthUser } from "../authUserMapper.ts";

// authUserMapper.ts only imports types (both erased by --experimental-strip-types),
// so this module has zero runtime dependencies and a plain object satisfying
// the fields toAuthUser reads is enough to exercise it — no live Firebase
// SDK instance needed.
function fakeFirebaseUser(overrides: Partial<FirebaseUser> = {}): FirebaseUser {
  return {
    uid: "user-123",
    email: "person@example.com",
    phoneNumber: null,
    isAnonymous: false,
    emailVerified: true,
    ...overrides,
  } as FirebaseUser;
}

test("maps the fields AuthUser needs, one-to-one", () => {
  const user = fakeFirebaseUser();
  const authUser = toAuthUser(user);
  assert.deepEqual(authUser, {
    uid: "user-123",
    email: "person@example.com",
    phoneNumber: null,
    isAnonymous: false,
    emailVerified: true,
  });
});

test("preserves an anonymous, unverified, phone-only user", () => {
  const user = fakeFirebaseUser({
    email: null,
    phoneNumber: "+15551234567",
    isAnonymous: true,
    emailVerified: false,
  });
  const authUser = toAuthUser(user);
  assert.equal(authUser.email, null);
  assert.equal(authUser.phoneNumber, "+15551234567");
  assert.equal(authUser.isAnonymous, true);
  assert.equal(authUser.emailVerified, false);
});

test("does not leak extra Firebase User fields (refreshToken, providerData, etc.) onto AuthUser", () => {
  const user = fakeFirebaseUser({
    // Fields a real FirebaseUser carries that AuthUser must not expose.
    refreshToken: "super-secret-refresh-token",
    providerData: [],
  });
  const authUser = toAuthUser(user);
  assert.deepEqual(Object.keys(authUser).sort(), ["email", "emailVerified", "isAnonymous", "phoneNumber", "uid"]);
});
