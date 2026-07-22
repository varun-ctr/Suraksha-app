import type { User as FirebaseUser } from "firebase/auth";
import type { AuthUser } from "@/domain/entities/AuthUser";

export function toAuthUser(user: FirebaseUser): AuthUser {
  return {
    uid: user.uid,
    email: user.email,
    phoneNumber: user.phoneNumber,
    isAnonymous: user.isAnonymous,
    emailVerified: user.emailVerified,
  };
}
