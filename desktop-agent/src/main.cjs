const { app, BrowserWindow, ipcMain, dialog, safeStorage, shell } = require("electron");
const crypto = require("node:crypto");
const fs = require("node:fs/promises");
const path = require("node:path");
const { claimPairing, heartbeat, auditEvent, requestLocalApproval } = require("./api.cjs");
const { evaluateLocalOperation, hasPendingLocalApproval } = require("./agentPolicy.cjs");

let mainWindow;
let heartbeatTimer;

const configPath = () => path.join(app.getPath("userData"), "harb-agent.json");
const auditPath = () => path.join(app.getPath("userData"), "harb-agent-audit.jsonl");

async function loadConfig() {
  try {
    const stored = JSON.parse(await fs.readFile(configPath(), "utf8"));
    if (stored.agentTokenEncrypted) {
      if (!safeStorage.isEncryptionAvailable()) throw new Error("مخزن نظام التشغيل الآمن غير متاح لرمز عميل Harb.");
      return { ...stored, agentToken: safeStorage.decryptString(Buffer.from(stored.agentTokenEncrypted, "base64")) };
    }
    return { ...stored, agentToken: "" };
  } catch (error) {
    if (error instanceof Error && error.message.includes("مخزن نظام التشغيل")) throw error;
    return { serverUrl: "", agentId: "", agentToken: "", scopes: [], status: "unpaired" };
  }
}

async function saveConfig(config) {
  const stored = { ...config };
  if (stored.agentToken) {
    if (!safeStorage.isEncryptionAvailable()) throw new Error("لا يمكن إقران العميل لأن مخزن نظام التشغيل الآمن غير متاح.");
    stored.agentTokenEncrypted = safeStorage.encryptString(stored.agentToken).toString("base64");
    delete stored.agentToken;
  }
  await fs.mkdir(app.getPath("userData"), { recursive: true });
  await fs.writeFile(configPath(), JSON.stringify(stored, null, 2), { encoding: "utf8", mode: 0o600 });
}

function publicStatus(config) {
  const { agentToken, agentTokenEncrypted, ...safeConfig } = config;
  return { ...safeConfig, secretConfigured: Boolean(agentToken) };
}

async function writeAudit(event, details = {}) {
  await fs.mkdir(app.getPath("userData"), { recursive: true });
  const record = { id: crypto.randomUUID(), at: new Date().toISOString(), event, details };
  await fs.appendFile(auditPath(), `${JSON.stringify(record)}\n`, { encoding: "utf8", mode: 0o600 });
  return record;
}

async function syncAuditEvent(eventType, details = {}) {
  const config = await loadConfig();
  if (!config.serverUrl || !config.agentId || !config.agentToken) return;
  const payload = { agentId: config.agentId, agentToken: config.agentToken, eventType, ...details };
  try { await auditEvent(config.serverUrl, payload); } catch (error) { await writeAudit("remote_audit_failed", { eventType, message: error.message }); }
}

function detectOperatingSystem() {
  return process.platform === "win32" ? "windows" : "kali_linux";
}

async function refreshHeartbeat() {
  const config = await loadConfig();
  if (!config.serverUrl || !config.agentId || !config.agentToken) return config;
  const result = await heartbeat(config.serverUrl, { agentId: config.agentId, agentToken: config.agentToken });
  const updated = { ...config, scopes: result.scopes ?? [], status: result.status ?? "approval_required", ownerPolicy: result.ownerPolicy ?? null, pendingApprovals: result.pendingApprovals ?? [], lastHeartbeatAt: new Date().toISOString() };
  await saveConfig(updated);
  await writeAudit("heartbeat", { status: updated.status, scopes: updated.scopes });
  return updated;
}

function startHeartbeat() {
  clearInterval(heartbeatTimer);
  heartbeatTimer = setInterval(() => refreshHeartbeat().catch(error => writeAudit("heartbeat_failed", { message: error.message })), 45_000);
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1120,
    height: 760,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: "#07111a",
    webPreferences: { preload: path.join(__dirname, "preload.cjs"), contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  await mainWindow.loadFile(path.join(__dirname, "renderer", "index.html"));
}

ipcMain.handle("agent:status", async () => {
  const config = await loadConfig();
  return { ...publicStatus(config), operatingSystem: detectOperatingSystem() };
});

ipcMain.handle("agent:pair", async (_event, input) => {
  const serverUrl = new URL(input.serverUrl).origin;
  const name = String(input.name || "Harb Desktop").trim();
  const result = await claimPairing(serverUrl, { code: String(input.code || "").trim().toUpperCase(), name, operatingSystem: detectOperatingSystem() });
  const config = { serverUrl, agentId: result.agentId, agentToken: result.agentToken, scopes: result.scopes ?? [], status: "approval_required", pairedAt: new Date().toISOString() };
  await saveConfig(config);
  await writeAudit("paired", { agentId: result.agentId, operatingSystem: detectOperatingSystem() });
  await syncAuditEvent("paired");
  await refreshHeartbeat();
  return { ...publicStatus(await loadConfig()), operatingSystem: detectOperatingSystem() };
});

ipcMain.handle("agent:heartbeat", async () => ({ ...publicStatus(await refreshHeartbeat()), operatingSystem: detectOperatingSystem() }));

ipcMain.handle("agent:select-and-preview-file", async () => {
  const config = await loadConfig();
  const policy = evaluateLocalOperation({ scopes: config.scopes, operation: "read_file", explicitUserApproval: true, ownerPolicy: config.ownerPolicy });
  if (!policy.allowed) { await writeAudit("read_file_blocked", { reason: policy.reason }); await syncAuditEvent("local_operation_blocked", { reason: policy.reason }); throw new Error(policy.reason); }
  const selected = await dialog.showOpenDialog(mainWindow, { title: "اختر ملفاً لمعاينة مقيدة", properties: ["openFile"] });
  if (selected.canceled || !selected.filePaths[0]) return { canceled: true };
  const filePath = selected.filePaths[0];
  const metadata = await fs.stat(filePath);
  const content = (await fs.readFile(filePath)).subarray(0, 64 * 1024).toString("utf8");
  await writeAudit("read_file_preview", { path: filePath, size: metadata.size, previewBytes: Buffer.byteLength(content) });
  await syncAuditEvent("read_file_preview", { fileName: path.basename(filePath), fileSize: metadata.size });
  return { canceled: false, name: path.basename(filePath), size: metadata.size, preview: content, notice: "تمت القراءة بعد اختيارك الصريح للملف وبحد أقصى 64 كيلوبايت للمعاينة." };
});

ipcMain.handle("agent:open-audit-folder", async () => shell.openPath(app.getPath("userData")));
ipcMain.handle("agent:request-local-approval", async (_event, input) => {
  const config = await loadConfig();
  if (!config.serverUrl || !config.agentId || !config.agentToken) throw new Error("يجب إقران العميل قبل طلب موافقة محلية.");
  const operation = String(input.operation || "");
  if (!["run_program", "run_command", "modify_file"].includes(operation)) throw new Error("نوع الإجراء المحلي غير مدعوم.");
  const policy = evaluateLocalOperation({ scopes: config.scopes, operation, explicitUserApproval: true, ownerPolicy: config.ownerPolicy });
  if (!policy.requiresApproval) {
    await writeAudit("local_operation_blocked", { operation, reason: policy.reason });
    await syncAuditEvent("local_operation_blocked", { reason: policy.reason });
    return { decision: "deny", reason: policy.reason };
  }
  if (hasPendingLocalApproval(config.pendingApprovals, operation)) {
    const reason = "يوجد طلب موافقة معلق من هذا العميل لنوع الإجراء نفسه؛ راجعه المالك في لوحة Harb قبل إنشاء طلب جديد.";
    await writeAudit("local_operation_blocked", { operation, reason });
    await syncAuditEvent("local_operation_blocked", { reason });
    return { decision: "deny", reason };
  }
  const result = await requestLocalApproval(config.serverUrl, { agentId: config.agentId, agentToken: config.agentToken, operation, summary: String(input.summary || "").trim() });
  await writeAudit("local_approval_requested", { operation: input.operation, decision: result.decision });
  await refreshHeartbeat();
  return result;
});
ipcMain.handle("agent:open-dashboard", async () => {
  const config = await loadConfig();
  if (!config.serverUrl) throw new Error("لا يوجد رابط منصة Harb محفوظ.");
  return shell.openExternal(config.serverUrl);
});

app.whenReady().then(async () => { await createWindow(); startHeartbeat(); });
app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
app.on("before-quit", () => clearInterval(heartbeatTimer));
