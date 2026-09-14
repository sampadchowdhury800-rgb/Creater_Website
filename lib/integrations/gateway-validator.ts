/**
 * lib/integrations/gateway-validator.ts
 *
 * Strict request parameter validation for Chowdhury Duo Integration Gateway.
 * Ensures the gateway acts as a capability-restricted API, not an arbitrary proxy.
 * SERVER-SIDE ONLY.
 */

import type {
  SupportedCapability,
  GmailSendParameters,
  GmailReadListParameters,
  GmailGetMessageParameters,
  GmailModifyParameters,
} from "./types";

const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
const MESSAGE_ID_REGEX = /^[a-zA-Z0-9_-]{10,64}$/;
const RFC2822_MSG_ID_HEADER_REGEX = /^<[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+>$/;

export interface ValidationResult<T> {
  valid: boolean;
  errors: string[];
  data?: T;
}

/**
 * Validates GMAIL_SEND parameters.
 */
export function validateGmailSendParameters(
  raw: unknown
): ValidationResult<GmailSendParameters> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { valid: false, errors: ["Parameters must be a JSON object."] };
  }

  const obj = raw as Record<string, unknown>;
  const errors: string[] = [];

  // Reject unknown keys
  const allowedKeys = new Set(["to", "cc", "bcc", "subject", "bodyHtml", "inReplyTo", "references"]);
  for (const key of Object.keys(obj)) {
    if (!allowedKeys.has(key)) {
      errors.push(`Unknown parameter "${key}" is not permitted for GMAIL_SEND.`);
    }
  }

  // 1. to
  if (!Array.isArray(obj.to) || obj.to.length === 0) {
    errors.push("'to' must be a non-empty array of email strings.");
  } else if (obj.to.length > 10) {
    errors.push("'to' cannot exceed 10 email addresses.");
  } else {
    for (const email of obj.to) {
      if (typeof email !== "string" || !EMAIL_REGEX.test(email.trim())) {
        errors.push(`Invalid email address in 'to': "${email}"`);
      }
    }
  }

  // 2. cc (optional)
  if (obj.cc !== undefined && obj.cc !== null) {
    if (!Array.isArray(obj.cc)) {
      errors.push("'cc' must be an array of email strings.");
    } else if (obj.cc.length > 5) {
      errors.push("'cc' cannot exceed 5 email addresses.");
    } else {
      for (const email of obj.cc) {
        if (typeof email !== "string" || !EMAIL_REGEX.test(email.trim())) {
          errors.push(`Invalid email address in 'cc': "${email}"`);
        }
      }
    }
  }

  // 3. bcc (optional)
  if (obj.bcc !== undefined && obj.bcc !== null) {
    if (!Array.isArray(obj.bcc)) {
      errors.push("'bcc' must be an array of email strings.");
    } else if (obj.bcc.length > 5) {
      errors.push("'bcc' cannot exceed 5 email addresses.");
    } else {
      for (const email of obj.bcc) {
        if (typeof email !== "string" || !EMAIL_REGEX.test(email.trim())) {
          errors.push(`Invalid email address in 'bcc': "${email}"`);
        }
      }
    }
  }

  // 4. subject
  if (typeof obj.subject !== "string" || !obj.subject.trim()) {
    errors.push("'subject' is required and must be a string.");
  } else if (obj.subject.length > 200) {
    errors.push("'subject' cannot exceed 200 characters.");
  }

  // 5. bodyHtml
  if (typeof obj.bodyHtml !== "string" || !obj.bodyHtml.trim()) {
    errors.push("'bodyHtml' is required and must be a string.");
  } else if (Buffer.byteLength(obj.bodyHtml, "utf8") > 250000) {
    errors.push("'bodyHtml' exceeds maximum allowed size of 250 KB.");
  }

  // 6. inReplyTo & references (optional)
  if (obj.inReplyTo !== undefined && obj.inReplyTo !== null) {
    if (typeof obj.inReplyTo !== "string" || !RFC2822_MSG_ID_HEADER_REGEX.test(obj.inReplyTo.trim())) {
      errors.push("'inReplyTo' must be in RFC 2822 Message-ID format: <id@domain>.");
    }
  }

  if (obj.references !== undefined && obj.references !== null) {
    if (typeof obj.references !== "string" || obj.references.length > 500) {
      errors.push("'references' must be a string <= 500 characters.");
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    errors: [],
    data: {
      to: (obj.to as string[]).map((e) => e.trim().toLowerCase()),
      cc: obj.cc ? (obj.cc as string[]).map((e) => e.trim().toLowerCase()) : undefined,
      bcc: obj.bcc ? (obj.bcc as string[]).map((e) => e.trim().toLowerCase()) : undefined,
      subject: (obj.subject as string).trim(),
      bodyHtml: obj.bodyHtml as string,
      inReplyTo: obj.inReplyTo ? (obj.inReplyTo as string).trim() : undefined,
      references: obj.references ? (obj.references as string).trim() : undefined,
    },
  };
}

/**
 * Validates GMAIL_READ_LIST parameters.
 */
export function validateGmailReadListParameters(
  raw: unknown
): ValidationResult<GmailReadListParameters> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { valid: false, errors: ["Parameters must be a JSON object."] };
  }

  const obj = raw as Record<string, unknown>;
  const errors: string[] = [];

  const allowedKeys = new Set(["maxResults", "query", "labelIds", "pageToken"]);
  for (const key of Object.keys(obj)) {
    if (!allowedKeys.has(key)) {
      errors.push(`Unknown parameter "${key}" is not permitted for GMAIL_READ_LIST.`);
    }
  }

  let maxResults = 20;
  if (obj.maxResults !== undefined && obj.maxResults !== null) {
    const num = Number(obj.maxResults);
    if (!Number.isInteger(num) || num < 1 || num > 50) {
      errors.push("'maxResults' must be an integer between 1 and 50.");
    } else {
      maxResults = num;
    }
  }

  let query: string | undefined = undefined;
  if (obj.query !== undefined && obj.query !== null) {
    if (typeof obj.query !== "string") {
      errors.push("'query' must be a string.");
    } else if (obj.query.length > 200) {
      errors.push("'query' cannot exceed 200 characters.");
    } else {
      // Strip null bytes
      query = obj.query.replace(/\0/g, "").trim();
    }
  }

  let labelIds: string[] | undefined = undefined;
  if (obj.labelIds !== undefined && obj.labelIds !== null) {
    if (!Array.isArray(obj.labelIds)) {
      errors.push("'labelIds' must be an array of strings.");
    } else {
      for (const label of obj.labelIds) {
        if (typeof label !== "string" || !/^[a-zA-Z0-9_-]{1,64}$/.test(label)) {
          errors.push(`Invalid label ID: "${label}"`);
        }
      }
      labelIds = obj.labelIds as string[];
    }
  }

  let pageToken: string | undefined = undefined;
  if (obj.pageToken !== undefined && obj.pageToken !== null) {
    if (typeof obj.pageToken !== "string" || obj.pageToken.length > 128) {
      errors.push("'pageToken' must be a string <= 128 characters.");
    } else {
      pageToken = obj.pageToken.trim();
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    errors: [],
    data: { maxResults, query, labelIds, pageToken },
  };
}

/**
 * Validates GMAIL_GET_MESSAGE parameters.
 */
export function validateGmailGetMessageParameters(
  raw: unknown
): ValidationResult<GmailGetMessageParameters> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { valid: false, errors: ["Parameters must be a JSON object."] };
  }

  const obj = raw as Record<string, unknown>;
  const errors: string[] = [];

  const allowedKeys = new Set(["messageId", "format"]);
  for (const key of Object.keys(obj)) {
    if (!allowedKeys.has(key)) {
      errors.push(`Unknown parameter "${key}" is not permitted for GMAIL_GET_MESSAGE.`);
    }
  }

  if (typeof obj.messageId !== "string" || !MESSAGE_ID_REGEX.test(obj.messageId)) {
    errors.push("'messageId' is invalid. Must be an alphanumeric Gmail message ID.");
  }

  let format: "full" | "metadata" = "metadata";
  if (obj.format !== undefined && obj.format !== null) {
    if (obj.format !== "full" && obj.format !== "metadata") {
      errors.push("'format' must be either 'full' or 'metadata'.");
    } else {
      format = obj.format;
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    errors: [],
    data: { messageId: obj.messageId as string, format },
  };
}

/**
 * Validates GMAIL_MODIFY parameters.
 */
export function validateGmailModifyParameters(
  raw: unknown
): ValidationResult<GmailModifyParameters> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { valid: false, errors: ["Parameters must be a JSON object."] };
  }

  const obj = raw as Record<string, unknown>;
  const errors: string[] = [];

  const allowedKeys = new Set(["messageId", "addLabelIds", "removeLabelIds"]);
  for (const key of Object.keys(obj)) {
    if (!allowedKeys.has(key)) {
      errors.push(`Unknown parameter "${key}" is not permitted for GMAIL_MODIFY.`);
    }
  }

  if (typeof obj.messageId !== "string" || !MESSAGE_ID_REGEX.test(obj.messageId)) {
    errors.push("'messageId' is invalid.");
  }

  const checkLabels = (arr: unknown, name: string) => {
    if (arr !== undefined && arr !== null) {
      if (!Array.isArray(arr)) {
        errors.push(`'${name}' must be an array.`);
      } else {
        for (const item of arr) {
          if (typeof item !== "string" || !/^[a-zA-Z0-9_-]{1,64}$/.test(item)) {
            errors.push(`Invalid label in '${name}': "${item}"`);
          }
        }
      }
    }
  };

  checkLabels(obj.addLabelIds, "addLabelIds");
  checkLabels(obj.removeLabelIds, "removeLabelIds");

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    errors: [],
    data: {
      messageId: obj.messageId as string,
      addLabelIds: obj.addLabelIds as string[] | undefined,
      removeLabelIds: obj.removeLabelIds as string[] | undefined,
    },
  };
}

/**
 * Dispatcher: routes validation to the appropriate capability validator.
 */
export function validateGatewayParameters(
  action: SupportedCapability,
  parameters: unknown
): ValidationResult<any> {
  switch (action) {
    case "GMAIL_SEND":
      return validateGmailSendParameters(parameters);
    case "GMAIL_READ_LIST":
      return validateGmailReadListParameters(parameters);
    case "GMAIL_GET_MESSAGE":
      return validateGmailGetMessageParameters(parameters);
    case "GMAIL_MODIFY":
      return validateGmailModifyParameters(parameters);
    default:
      return { valid: false, errors: [`Unsupported capability action: "${action}"`] };
  }
}

/**
 * Validates the outer gateway request envelope.
 * Rejects any arbitrary target URLs, methods, or unapproved fields.
 */
export function validateGatewayRequest(raw: unknown): ValidationResult<{
  executionGrant: string;
  action: SupportedCapability;
  parameters: Record<string, unknown>;
  stepId?: string;
}> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { valid: false, errors: ["Request body must be a JSON object."] };
  }

  const obj = raw as Record<string, unknown>;
  const errors: string[] = [];

  // Reject arbitrary proxy fields
  const allowedKeys = new Set(["executionGrant", "action", "parameters", "stepId"]);
  for (const key of Object.keys(obj)) {
    if (!allowedKeys.has(key)) {
      errors.push(`Disallowed gateway field "${key}". Arbitrary proxy fields are prohibited.`);
    }
  }

  if (typeof obj.executionGrant !== "string" || !obj.executionGrant.trim()) {
    errors.push("'executionGrant' must be a non-empty string.");
  }

  const validActions = ["GMAIL_SEND", "GMAIL_READ_LIST", "GMAIL_GET_MESSAGE", "GMAIL_MODIFY"];
  if (typeof obj.action !== "string" || !validActions.includes(obj.action)) {
    errors.push(`'action' must be one of: ${validActions.join(", ")}.`);
  }

  if (!obj.parameters || typeof obj.parameters !== "object" || Array.isArray(obj.parameters)) {
    errors.push("'parameters' must be a JSON object.");
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    errors: [],
    data: {
      executionGrant: obj.executionGrant as string,
      action: obj.action as SupportedCapability,
      parameters: obj.parameters as Record<string, unknown>,
      stepId: typeof obj.stepId === "string" ? obj.stepId : undefined,
    },
  };
}
