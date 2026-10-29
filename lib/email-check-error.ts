// Return only fixed messages. AWS exception messages can contain account details.
const permissionErrors = new Set(["AccessDenied", "AccessDeniedException", "ForbiddenException", "NotAuthorized"]);
const credentialErrors = new Set(["InvalidClientTokenId", "UnrecognizedClientException", "InvalidSignatureException", "SignatureDoesNotMatch", "IncompleteSignature", "IncompleteSignatureException", "ExpiredToken", "ExpiredTokenException"]);
const temporaryErrors = new Set(["TimeoutError", "RequestTimeout", "RequestTimeoutException", "TooManyRequestsException", "ThrottlingException", "ServiceUnavailable", "ServiceUnavailableException", "InternalFailure", "InternalServerErrorException"]);

export function emailCheckFailure(error: unknown): { error: string; code: string } {
  const name = error instanceof Error ? error.name : "";
  if (permissionErrors.has(name)) return {
    code: "ses_access_denied",
    error: "SES denied the account check. Give the app IAM user ses:GetAccount and ses:GetEmailIdentity access for the sender in Stockholm (eu-north-1). See EMAIL_SETUP.md.",
  };
  if (credentialErrors.has(name)) return {
    code: "ses_credentials_rejected",
    error: "AWS rejected the email credentials. Set both runtime secrets from the same active IAM API access key, not SES SMTP credentials, then deploy. Do not share the keys.",
  };
  if (temporaryErrors.has(name)) return {
    code: "ses_check_retry",
    error: "The SES check timed out or is temporarily unavailable. Wait a minute, then check again.",
  };
  if (name === "TypeError") return {
    code: "ses_request_failed",
    error: "The Worker could not complete the SES request. Check its network access and email client setup.",
  };
  return { code: "ses_check_failed", error: "Email account checks failed. Check sender access and settings. See EMAIL_SETUP.md." };
}
