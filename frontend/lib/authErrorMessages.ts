/**
 * Shared auth-surface error normalization for email delivery and password reset flows.
 */
const RESET_EMAIL_RATE_LIMIT_MESSAGE =
  "Too many reset emails were requested. Wait a few minutes, then try again. Check your inbox and spam for the latest email before requesting another.";
const SIGNUP_EMAIL_RATE_LIMIT_MESSAGE =
  "Too many confirmation emails were requested. Wait a few minutes, then try again. Check your inbox and spam for the latest email before requesting another.";
const EMAIL_CHANGE_RATE_LIMIT_MESSAGE =
  "Too many email confirmation requests were made. Wait a few minutes, then try again. Check your inbox and spam for the latest email before requesting another.";
const GENERIC_CONFIRMATION_EMAIL_FAILURE_MESSAGE =
  "Confirmation email could not be sent right now. Try again in a few minutes.";
const INVALID_SIGNIN_CREDENTIALS_MESSAGE =
  "Email or password is incorrect. Check your login details or reset your password.";
const EMAIL_NOT_CONFIRMED_SIGNIN_MESSAGE =
  "Confirm your email before signing in. Check your inbox for the confirmation link.";
const SIGNIN_RATE_LIMIT_MESSAGE = "Too many sign-in attempts. Wait a few minutes, then try again.";

const includesNormalized = (value: string, candidate: string): boolean =>
  value.toLowerCase().includes(candidate.toLowerCase());

const isEmailRateLimitMessage = (normalizedMessage: string): boolean =>
  includesNormalized(normalizedMessage, "email rate limit exceeded") ||
  (includesNormalized(normalizedMessage, "rate limit") &&
    includesNormalized(normalizedMessage, "email"));

const isEmailDeliveryFailureMessage = (normalizedMessage: string): boolean =>
  isEmailRateLimitMessage(normalizedMessage) ||
  includesNormalized(normalizedMessage, "error sending confirmation mail") ||
  includesNormalized(normalizedMessage, "error sending recovery mail") ||
  includesNormalized(normalizedMessage, "error sending email") ||
  (includesNormalized(normalizedMessage, "smtp") &&
    includesNormalized(normalizedMessage, "error")) ||
  includesNormalized(normalizedMessage, "mailbox unavailable");

export const resolvePasswordResetErrorMessage = (error: unknown, fallback: string): string => {
  if (!(error instanceof Error)) {
    return fallback;
  }

  const message = error.message.trim();
  if (!message) {
    return fallback;
  }

  const normalizedMessage = message.toLowerCase();
  if (isEmailRateLimitMessage(normalizedMessage)) {
    return RESET_EMAIL_RATE_LIMIT_MESSAGE;
  }

  return message;
};

export const resolveSignupEmailErrorMessage = (error: unknown, fallback: string): string => {
  if (!(error instanceof Error)) {
    return fallback;
  }

  const message = error.message.trim();
  if (!message) {
    return fallback;
  }

  const normalizedMessage = message.toLowerCase();
  if (isEmailRateLimitMessage(normalizedMessage)) {
    return SIGNUP_EMAIL_RATE_LIMIT_MESSAGE;
  }
  if (isEmailDeliveryFailureMessage(normalizedMessage)) {
    return GENERIC_CONFIRMATION_EMAIL_FAILURE_MESSAGE;
  }

  return message;
};

export const resolveSignInErrorMessage = (error: unknown, fallback: string): string => {
  if (!(error instanceof Error)) {
    return fallback;
  }

  const message = error.message.trim();
  if (!message) {
    return fallback;
  }

  const normalizedMessage = message.toLowerCase();
  if (
    includesNormalized(normalizedMessage, "invalid login credentials") ||
    includesNormalized(normalizedMessage, "invalid credentials") ||
    includesNormalized(normalizedMessage, "invalid grant")
  ) {
    return INVALID_SIGNIN_CREDENTIALS_MESSAGE;
  }
  if (
    includesNormalized(normalizedMessage, "email not confirmed") ||
    includesNormalized(normalizedMessage, "email_not_confirmed") ||
    includesNormalized(normalizedMessage, "email not verified")
  ) {
    return EMAIL_NOT_CONFIRMED_SIGNIN_MESSAGE;
  }
  if (
    includesNormalized(normalizedMessage, "rate limit") ||
    includesNormalized(normalizedMessage, "too many requests") ||
    includesNormalized(normalizedMessage, "over request rate limit")
  ) {
    return SIGNIN_RATE_LIMIT_MESSAGE;
  }

  return message;
};

export const resolveEmailChangeErrorMessage = (error: unknown, fallback: string): string => {
  if (!(error instanceof Error)) {
    return fallback;
  }

  const message = error.message.trim();
  if (!message) {
    return fallback;
  }

  const normalizedMessage = message.toLowerCase();
  if (isEmailRateLimitMessage(normalizedMessage)) {
    return EMAIL_CHANGE_RATE_LIMIT_MESSAGE;
  }
  if (isEmailDeliveryFailureMessage(normalizedMessage)) {
    return GENERIC_CONFIRMATION_EMAIL_FAILURE_MESSAGE;
  }

  return message;
};
