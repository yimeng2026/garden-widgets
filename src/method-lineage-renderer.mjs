import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { escapeHtml } from "./contracts.mjs";

const template = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "method-lineage-template.html"), "utf8");

function safeJson(value) {
  return JSON.stringify(value).replace(/&/g, "\\u0026").replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
}

export function renderMethodLineageWidget(snapshot) {
  const graph = snapshot.graph || snapshot;
  const summary = graph.summary;
  const replacements = {
    __DOCUMENT_COUNT__: summary.documentCount,
    __CONTEXT_EXCLUDED__: summary.externalContextExcluded,
    __COMPARISON_COUNT__: summary.comparisonCount,
    __COMPLETE_FINGERPRINTS__: summary.fingerprintCompleteCount,
    __EVIDENCE_COUNT__: summary.evidenceCount,
    __NODE_COUNT__: summary.nodeCount,
    __EDGE_COUNT__: summary.edgeCount,
    __INDEPENDENT_COUNT__: summary.independentWetExperimentCount,
    __GENERATED_AT__: escapeHtml(graph.generatedAt),
    __REQUEST_ID__: escapeHtml(graph.requestId),
    __GRAPH_JSON__: safeJson(graph),
  };
  return Object.entries(replacements).reduce((html, [key, value]) => html.replaceAll(key, String(value)), template);
}
