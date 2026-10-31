import crypto from "node:crypto";

export const CONTRACT_VERSION = 1;
export const LAW_KINDS = ["empirical", "effective_mapping", "formal_constraint", "protocol"];
export const LAW_STATUSES = [
  "CONJECTURED", "SCREENING", "LIMITED_SUPPORT", "DOMAIN_VALIDATED",
  "REFUTED", "DEMONSTRATED", "DESIGN_READY", "RETIRED",
];
export const PARAMETER_SOURCES = [
  "DERIVED", "CONDITIONAL", "BOUNDARY", "MEASURED", "FITTED", "CONJECTURED", "REFUTED", "RETIRED",
];
export const VALIDATION_STATUSES = ["PASS", "LIMITED", "FAIL", "PENDING", "NOT_APPLICABLE"];
const ID_PATTERN = /^[A-Z0-9]+(?:-[A-Z0-9]+)*$/;

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function text(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function stringArray(value) {
  return Array.isArray(value) && value.every(text);
}

export function assertWidgetId(id) {
  if (!text(id) || id.length > 80 || !ID_PATTERN.test(id)) {
    throw new Error("id must contain 1–80 uppercase letters, digits, or single hyphens between segments");
  }
  return id;
}

/** Keep the public adapter compatible with the garden evidence contract. */
export function validateLawPackage(input) {
  if (!isRecord(input)) return ["package must be an object"];
  const issues = [];
  try { assertWidgetId(input.id); } catch (error) { issues.push(error.message); }
  if (!Number.isInteger(input.version) || input.version < 1) issues.push("version must be a positive integer");
  if (!LAW_KINDS.includes(input.kind)) issues.push("kind is invalid");
  if (!LAW_STATUSES.includes(input.status)) issues.push("status is invalid");
  for (const field of ["title", "domain", "statement", "summary", "nextAction"]) {
    if (!text(input[field])) issues.push(`${field} is required`);
  }
  if (!Array.isArray(input.metrics) || input.metrics.length === 0) issues.push("metrics must be non-empty");
  if (!Array.isArray(input.parameters) || input.parameters.length === 0) issues.push("parameters must be non-empty");
  input.parameters?.forEach((parameter, index) => {
    if (!isRecord(parameter)) return issues.push(`parameters[${index}] must be an object`);
    for (const field of ["name", "meaning", "unit", "status"]) if (!text(parameter[field])) issues.push(`parameters[${index}].${field} is required`);
    if (!PARAMETER_SOURCES.includes(parameter.sourceType)) issues.push(`parameters[${index}].sourceType is invalid`);
  });
  if (!Array.isArray(input.validations) || input.validations.length === 0) issues.push("validations must be non-empty");
  input.validations?.forEach((validation, index) => {
    if (!isRecord(validation)) return issues.push(`validations[${index}] must be an object`);
    for (const field of ["level", "label", "evidence"]) if (!text(validation[field])) issues.push(`validations[${index}].${field} is required`);
    if (!VALIDATION_STATUSES.includes(validation.status)) issues.push(`validations[${index}].status is invalid`);
  });
  if (!stringArray(input.counterexamples)) issues.push("counterexamples must be an array of strings");
  if (!stringArray(input.limitations)) issues.push("limitations must be an array of strings");
  if (!Array.isArray(input.sources)) issues.push("sources must be an array");
  if (!Array.isArray(input.evidenceHistory)) issues.push("evidenceHistory must be an array");
  if (input.status === "DOMAIN_VALIDATED" && input.kind === "empirical") {
    const pass = input.validations?.some((item) => item.level === "independent_replication" && item.status === "PASS");
    if (!pass) issues.push("empirical DOMAIN_VALIDATED requires independent_replication=PASS");
  }
  return issues;
}

export function sha256Json(value) {
  return crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character]);
}
