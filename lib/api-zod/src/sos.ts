import * as zod from "zod";

/**
 * Hand-written (not orval-generated) request schema for POST /sos/alert.
 *
 * The SOS route fans each contact's phone number out to Twilio, so the request
 * shape must be validated and bounded to prevent an authenticated caller from
 * sending arbitrary text to unlimited arbitrary numbers on the account.
 */
export const sendSosAlertContactsMax = 25;
export const sendSosAlertMessageMax = 1000;

export const SosAlertContact = zod.object({
  id: zod.string().min(1).max(200),
  name: zod.string().max(200).optional(),
  phone: zod.string().min(3).max(32),
});

export const SendSosAlertBody = zod.object({
  contacts: zod.array(SosAlertContact).min(1).max(sendSosAlertContactsMax),
  message: zod.string().min(1).max(sendSosAlertMessageMax),
  idempotencyKey: zod.string().min(1).max(200).optional(),
});
