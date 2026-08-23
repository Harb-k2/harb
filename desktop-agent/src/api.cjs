const { createTRPCProxyClient, httpBatchLink } = require("@trpc/client");
const superjson = require("superjson").default;

function createHarbClient(serverUrl) {
  const url = new URL("/api/trpc", serverUrl).toString();
  return createTRPCProxyClient({ links: [httpBatchLink({ url, transformer: superjson })] });
}

async function claimPairing(serverUrl, payload) {
  return createHarbClient(serverUrl).harb.desktop.claimPairing.mutate(payload);
}

async function heartbeat(serverUrl, payload) {
  return createHarbClient(serverUrl).harb.desktop.heartbeat.mutate(payload);
}

async function auditEvent(serverUrl, payload) {
  return createHarbClient(serverUrl).harb.desktop.auditEvent.mutate(payload);
}

async function requestLocalApproval(serverUrl, payload) {
  return createHarbClient(serverUrl).harb.desktop.requestLocalApproval.mutate(payload);
}

async function validateLocalApprovalTicket(serverUrl, payload) {
  return createHarbClient(serverUrl).harb.desktop.validateLocalApprovalTicket.mutate(payload);
}

module.exports = { claimPairing, heartbeat, auditEvent, requestLocalApproval, validateLocalApprovalTicket };
