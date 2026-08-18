// utils/normalizePhoneNumber.ts
import { parsePhoneNumberFromString, CountryCode } from "libphonenumber-js";

export function normalizePhoneNumber(rawPhone: string, defaultCountry: CountryCode = "IN"): string {
  let phoneInput = rawPhone;

  if (!phoneInput.startsWith("+")) {
    phoneInput = "+" + phoneInput;
  }

  const phoneNumberObj = parsePhoneNumberFromString(phoneInput, defaultCountry);

  if (!phoneNumberObj || !phoneNumberObj.isValid()) {
    throw new Error("Invalid phone number");
  }

  return phoneNumberObj.number;
}
