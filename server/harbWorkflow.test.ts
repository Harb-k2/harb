import { beforeEach, describe, expect, it, vi } from "vitest";
import { createHash, createHmac } from "node:crypto";
import type { TrpcContext } from "./_core/context";
import { ENV } from "./_core/env";

const desktopToken = "A".repeat(32);
const desktopTokenHash = createHash("sha256").update(desktopToken).digest("hex");

const db = vi.hoisted(() => ({
  createApproval: vi.fn(),
  createAuditEntry: vi.fn(),
  createCyberAsset: vi.fn(),
  createCyberOperation: vi.fn(),
  createDesktopAgent: vi.fn(),
  createDesktopPairing: vi.fn(),
  createKnowledgeCollection: vi.fn(),
  createModelEvaluation: vi.fn(),
  createModelObjective: vi.fn(),
  completeModelEvaluation: vi.fn(),
  createRule: vi.fn(),
  createTask: vi.fn(),
  createWorkspaceFile: vi.fn(),
  approveBaseModelSelection: vi.fn(),
  ensureCyberOwnerPolicy: vi.fn(),
  ensureHarbDefaults: vi.fn(),
  findDesktopPairing: vi.fn(),
  getBaseModelSelection: vi.fn(),
  getDesktopAgentById: vi.fn(),
  getCyberAsset: vi.fn(),
  getCyberOperation: vi.fn(),
  getKnowledgeSource: vi.fn(),
  listApprovals: vi.fn(),
  listAuditEntries: vi.fn(),
  listDesktopAgents: vi.fn(),
  listCyberAssets: vi.fn(),
  listCyberOperations: vi.fn(),
  listFileAccessApprovals: vi.fn(),
  listFiles: vi.fn(),
  listKnowledgeCollections: vi.fn(),
  listKnowledgeSources: vi.fn(),
  listModelEvaluations: vi.fn(),
  listModelObjectives: vi.fn(),
  listRules: vi.fn(),
  listTasks: vi.fn(),
  resolveApproval: vi.fn(),
  resolveFileAccessApproval: vi.fn(),
  consumeDesktopPairing: vi.fn(),
  requestFileAccessApproval: vi.fn(),
  registerKnowledgeSource: vi.fn(),
  replaceKnowledgeChunks: vi.fn(),
  searchKnowledgeChunks: vi.fn(),
  saveBaseModelSelection: vi.fn(),
  updateDesktopAgent: vi.fn(),
  updateCyberOwnerPolicy: vi.fn(),
  updateCyberOperation: vi.fn(),
  updateKnowledgeSource: vi.fn(),
  updateRule: vi.fn(),
  updateWorkspaceFile: vi.fn(),
  updateTask: vi.fn(),
}));

vi.mock("./db", () => db);
const llm = vi.hoisted(() => ({ invokeLLM: vi.fn(), listLLMModels: vi.fn() }));
vi.mock("./_core/llm", () => llm);
const knowledgeIndex = vi.hoisted(() => ({ indexKnowledgeStorageObject: vi.fn() }));
vi.mock("./knowledgeIndex", () => knowledgeIndex);

import { appRouter } from "./routers";

function createContext(): TrpcContext {
  return {
    user: {
      id: 7,
      openId: "harb-owner",
      name: "Owner",
      email: "owner@example.com",
      loginMethod: "manus",
      role: "admin",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

describe("Harb permission workflows", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.listRules.mockResolvedValue([]);
    db.createTask.mockResolvedValue({ id: "task-01" });
    db.createApproval.mockResolvedValue({ id: "approval-01" });
    db.createCyberOperation.mockResolvedValue({ id: "cyber-operation-01" });
    db.getCyberAsset.mockResolvedValue({
      id: "cyber-asset-01",
      name: "بيئة اختبار",
      assetValue: "lab.example.local",
      assetType: "web_app",
      environment: "lab",
      authorizationRef: "AUTH-001",
      permittedScope: "تحليل واختبار تطبيق الويب ضمن التفويض.",
      status: "authorized",
      validUntil: new Date(Date.now() + 60_000),
    });
    db.ensureCyberOwnerPolicy.mockResolvedValue({
      id: "cyber-policy-01",
      ownerId: 7,
      analysisAction: "allow",
      passiveAction: "allow",
      activeAction: "approval",
      localAction: "approval",
      requireAuthorizationAcknowledgment: true,
    });
    db.requestFileAccessApproval.mockResolvedValue({ id: "file-approval-01", fileId: "file-01", action: "share" });
    db.resolveFileAccessApproval.mockResolvedValue({ id: "file-approval-01", fileId: "file-01", action: "share" });
    db.createModelObjective.mockResolvedValue({ id: "objective-01", title: "تحليل تنبيهات أمنية", category: "cyber_analysis" });
    db.createKnowledgeCollection.mockResolvedValue({ id: "collection-01", name: "مراجع الفريق", classification: "private" });
    db.registerKnowledgeSource.mockResolvedValue({ id: "source-01", name: "policy.pdf" });
    db.createModelEvaluation.mockResolvedValue({ id: "evaluation-01" });
    db.completeModelEvaluation.mockResolvedValue({ id: "evaluation-01", modelId: "gpt-5", status: "completed", score: 92 });
    db.getBaseModelSelection.mockResolvedValue(undefined);
    db.saveBaseModelSelection.mockResolvedValue({ id: "base-model-01", primaryModelId: "gpt-5", fallbackModelId: "gpt-5-mini", status: "draft" });
    db.approveBaseModelSelection.mockResolvedValue({ id: "base-model-01", primaryModelId: "gpt-5", fallbackModelId: null, status: "approved" });
    db.listModelEvaluations.mockResolvedValue([]);
    db.listModelObjectives.mockResolvedValue([{ id: "objective-01" }]);
    db.listKnowledgeCollections.mockResolvedValue([{ id: "collection-01" }]);
    db.listApprovals.mockResolvedValue([]);
    db.listFiles.mockResolvedValue([{ id: "file-01", name: "policy.pdf", storageKey: "owner/policy.pdf", mimeType: "application/pdf", size: 800 }]);
    db.searchKnowledgeChunks.mockResolvedValue([]);
    llm.listLLMModels.mockResolvedValue({ data: [{ id: "gpt-5" }, { id: "gpt-5-mini" }] });
    llm.invokeLLM.mockResolvedValue({ choices: [{ message: { content: "تحليل آمن ومقيد بالتفويض." } }] });
    db.getKnowledgeSource.mockResolvedValue({ id: "source-01", collectionId: "collection-01", sourceType: "workspace_file", storageKey: "owner/notes.txt", mimeType: "text/plain" });
    db.getDesktopAgentById.mockResolvedValue({ id: "agent-01", ownerId: 7, agentTokenHash: desktopTokenHash, status: "online", scopes: "read_files,run_commands" });
    knowledgeIndex.indexKnowledgeStorageObject.mockResolvedValue({ status: "ready", chunks: [{ excerpt: "تفويض الأصل قبل أي اختبار.", contentHash: "hash-01" }] });
  });

  it("ينشئ طلب موافقة قبل أي حذف ملف ولا يستدعي النموذج", async () => {
    const result = await appRouter.createCaller(createContext()).harb.tasks.submit({ request: "احذف الملف القديم" });

    expect(result.decision).toBe("approval");
    expect(db.ensureHarbDefaults).toHaveBeenCalledWith(7);
    expect(db.createTask).toHaveBeenCalledWith(7, expect.objectContaining({ status: "needs_approval", taskType: "file_change" }));
    expect(db.createApproval).toHaveBeenCalledWith(7, expect.objectContaining({ taskId: "task-01", action: "file_change", status: "requested" }));
    expect(db.createAuditEntry).toHaveBeenCalledWith(7, expect.objectContaining({ outcome: "approval_requested" }));
    expect(db.searchKnowledgeChunks).not.toHaveBeenCalled();
  });

  it("يسترجع مقتطفات معرفة للطلب التحليلي المسموح فقط", async () => {
    db.searchKnowledgeChunks.mockResolvedValue([{ id: "chunk-01", excerpt: "تحقق من التفويض قبل أي اختبار.", score: 2 }]);
    const result = await appRouter.createCaller(createContext()).harb.tasks.submit({ request: "حلل تقرير KEV وفق التفويض" });

    expect(result.decision).toBe("allow");
    expect(db.searchKnowledgeChunks).toHaveBeenCalledWith(7, "حلل تقرير KEV وفق التفويض", undefined, 3);
    expect(llm.invokeLLM).toHaveBeenCalledWith(expect.objectContaining({ messages: expect.arrayContaining([expect.objectContaining({ role: "system", content: expect.stringContaining("تحقق من التفويض قبل أي اختبار") })]) }));
  });

  it("يوثق قرار المالك عند الموافقة أو الرفض", async () => {
    const result = await appRouter.createCaller(createContext()).harb.approvals.resolve({ id: "approval-01", status: "approved" });

    expect(result).toEqual({ success: true });
    expect(db.resolveApproval).toHaveBeenCalledWith(7, "approval-01", "approved");
    expect(db.createAuditEntry).toHaveBeenCalledWith(7, expect.objectContaining({ eventType: "approval.resolved", outcome: "approved" }));
  });

  it("يحدّث تصنيف الملف ويسجل التعديل في سجل التدقيق", async () => {
    const result = await appRouter.createCaller(createContext()).harb.files.updateClassification({ id: "file-01", classification: "restricted" });

    expect(result).toEqual({ success: true });
    expect(db.updateWorkspaceFile).toHaveBeenCalledWith(7, "file-01", expect.objectContaining({
      classification: "restricted",
      permissionState: "restricted",
      approvalState: "not_required",
      lastApprovalAt: null,
    }));
    expect(db.createAuditEntry).toHaveBeenCalledWith(7, expect.objectContaining({ eventType: "file.classification_updated", requestId: "file-01" }));
  });

  it("ينشئ طلب موافقة ملف قبل مشاركته ويوثق الطلب", async () => {
    const result = await appRouter.createCaller(createContext()).harb.files.requestApproval({ id: "file-01", action: "share" });

    expect(result).toEqual(expect.objectContaining({ id: "file-approval-01" }));
    expect(db.requestFileAccessApproval).toHaveBeenCalledWith(7, "file-01", "share");
    expect(db.createAuditEntry).toHaveBeenCalledWith(7, expect.objectContaining({ eventType: "file.approval_requested", outcome: "approval_requested" }));
  });

  it("يحسم موافقة الملف ويوثق القرار النهائي", async () => {
    const result = await appRouter.createCaller(createContext()).harb.files.resolveApproval({ id: "file-approval-01", status: "approved" });

    expect(result).toEqual({ success: true });
    expect(db.resolveFileAccessApproval).toHaveBeenCalledWith(7, "file-approval-01", "approved");
    expect(db.createAuditEntry).toHaveBeenCalledWith(7, expect.objectContaining({ eventType: "file.approval_resolved", requestId: "file-01", outcome: "approved" }));
  });

  it("يصدر رمز ربط سطح المكتب دون منح نطاقات تشغيل تلقائياً", async () => {
    const result = await appRouter.createCaller(createContext()).harb.desktop.createPairing();

    expect(result.code).toMatch(/^[A-Za-z0-9_-]{4}-[A-Za-z0-9_-]{4}$/);
    expect(result.expiresInMinutes).toBe(10);
    expect(db.createDesktopPairing).toHaveBeenCalledWith(7, expect.any(String), expect.any(Date));
    expect(db.createAuditEntry).toHaveBeenCalledWith(7, expect.objectContaining({ eventType: "desktop.pairing_issued", outcome: "pending" }));
  });

  it("يحدّث نطاقات الجهاز المسجل مع توثيق القرار", async () => {
    const result = await appRouter.createCaller(createContext()).harb.desktop.updateScopes({ id: "agent-01", scopes: ["read_files", "run_commands"] });

    expect(result).toEqual({ success: true });
    expect(db.updateDesktopAgent).toHaveBeenCalledWith(7, "agent-01", { scopes: "read_files,run_commands", status: "online" });
    expect(db.createAuditEntry).toHaveBeenCalledWith(7, expect.objectContaining({ eventType: "desktop.scopes_updated" }));
  });

  it("يسجل حدث العميل المحلي بالبيانات الوصفية فقط بعد تحقق الرمز", async () => {
    const result = await appRouter.createCaller(createContext()).harb.desktop.auditEvent({ agentId: "agent-01", agentToken: desktopToken, eventType: "read_file_preview", fileName: "inventory.txt", fileSize: 420 });

    expect(result).toEqual({ success: true });
    expect(db.createAuditEntry).toHaveBeenCalledWith(7, expect.objectContaining({ eventType: "desktop.local.read_file_preview", metadata: expect.stringContaining("inventory.txt") }));
  });

  it("يعيد قانون المالك والموافقات المعلقة للعميل ويوثق نبضاً وصفياً", async () => {
    db.getDesktopAgentById.mockResolvedValueOnce({ id: "agent-01", ownerId: 7, agentTokenHash: desktopTokenHash, status: "online", scopes: "read_files", lastSeenAt: new Date(Date.now() - 6 * 60 * 1000) });
    db.listApprovals.mockResolvedValue([{ id: "approval-local-01", status: "requested", action: "desktop:run_command", summary: "[desktop:agent-01] فحص محلي مفوض", expiresAt: new Date(Date.now() + 60_000) }]);
    const result = await appRouter.createCaller(createContext()).harb.desktop.heartbeat({ agentId: "agent-01", agentToken: desktopToken });

    expect(result.ownerPolicy.localAction).toBe("approval");
    expect(result.pendingApprovals).toHaveLength(1);
    expect(result.pendingApprovals[0]?.summary).toBe("فحص محلي مفوض");
    expect(db.createAuditEntry).toHaveBeenCalledWith(7, expect.objectContaining({ eventType: "desktop.local.heartbeat" }));
  });

  it("ينشئ طلب موافقة لإجراء محلي ولا ينفذ العملية", async () => {
    const result = await appRouter.createCaller(createContext()).harb.desktop.requestLocalApproval({ agentId: "agent-01", agentToken: desktopToken, operation: "run_command", summary: "تنفيذ فحص محلي مصرح به ضمن النطاق." });

    expect(result.decision).toBe("approval");
    expect(db.createTask).toHaveBeenCalledWith(7, expect.objectContaining({ status: "needs_approval", taskType: "command" }));
    expect(db.createApproval).toHaveBeenCalledWith(7, expect.objectContaining({ action: "desktop:run_command", status: "requested" }));
  });

  it("يرفض طلب موافقة محلي عندما لا يملك العميل النطاق المطلوب", async () => {
    db.getDesktopAgentById.mockResolvedValueOnce({ id: "agent-01", ownerId: 7, agentTokenHash: desktopTokenHash, status: "online", scopes: "read_files" });
    const result = await appRouter.createCaller(createContext()).harb.desktop.requestLocalApproval({ agentId: "agent-01", agentToken: desktopToken, operation: "run_program", summary: "تشغيل أداة محلية ضمن النطاق." });

    expect(result.decision).toBe("deny");
    expect(db.createApproval).not.toHaveBeenCalled();
  });

  it("يتحقق خادم Harb من تذكرة موافقة سطح المكتب الموقعة قبل إتاحتها للبوابة المحلية", async () => {
    const expiresAt = new Date(Date.now() + 60_000);
    const payload = Buffer.from(JSON.stringify({ agentId: "agent-01", approvalId: "approval-local-01", action: "desktop:run_command", expiresAt: expiresAt.getTime() })).toString("base64url");
    const ticket = `${payload}.${createHmac("sha256", ENV.cookieSecret).update(payload).digest("base64url")}`;
    db.listApprovals.mockResolvedValue([{ id: "approval-local-01", status: "approved", action: "desktop:run_command", summary: "[desktop:agent-01] فحص محلي مفوض", expiresAt }]);

    const result = await appRouter.createCaller(createContext()).harb.desktop.validateLocalApprovalTicket({ agentId: "agent-01", agentToken: desktopToken, operation: "run_command", ticket });
    const tampered = await appRouter.createCaller(createContext()).harb.desktop.validateLocalApprovalTicket({ agentId: "agent-01", agentToken: desktopToken, operation: "run_command", ticket: `${ticket}tampered` });

    expect(result).toEqual(expect.objectContaining({ valid: true, approval: expect.objectContaining({ id: "approval-local-01", action: "desktop:run_command" }) }));
    expect(tampered).toEqual({ valid: false });
  });

  it("يحسم موافقة عميل سطح المكتب من جلسة المالك المصادق عليها", async () => {
    const result = await appRouter.createCaller(createContext()).harb.approvals.resolve({ id: "approval-local-01", status: "approved" });

    expect(result).toEqual({ success: true });
    expect(db.resolveApproval).toHaveBeenCalledWith(7, "approval-local-01", "approved");
    expect(db.createAuditEntry).toHaveBeenCalledWith(7, expect.objectContaining({ eventType: "approval.resolved", outcome: "approved" }));
  });

  it("يطلب موافقة صريحة قبل التخطيط لاختبار سيبراني نشط", async () => {
    const result = await appRouter.createCaller(createContext()).harb.cyber.operations.plan({
      assetId: "cyber-asset-01",
      operationType: "active_test",
      requestSummary: "خطة اختبار نشط ضمن نافذة التفويض المعتمدة.",
      authorizationAcknowledged: true,
    });

    expect(result.policy.decision).toBe("approval");
    expect(db.createCyberOperation).toHaveBeenCalledWith(7, expect.objectContaining({ status: "awaiting_approval", decision: "approval" }));
    expect(db.createApproval).toHaveBeenCalledWith(7, expect.objectContaining({ action: "cyber:active_test", status: "requested" }));
    expect(db.updateCyberOperation).toHaveBeenCalledWith(7, "cyber-operation-01", expect.objectContaining({ approvalId: "approval-01" }));
  });

  it("يحظر التخطيط السيبراني على أصل خارج سجل التفويض", async () => {
    db.getCyberAsset.mockResolvedValueOnce(undefined);
    const result = await appRouter.createCaller(createContext()).harb.cyber.operations.plan({
      assetId: "unknown-asset",
      operationType: "analysis",
      requestSummary: "تحليل أصل غير مسجل في سجل التفويض.",
      authorizationAcknowledged: true,
    });

    expect(result.policy.decision).toBe("deny");
    expect(db.createCyberOperation).toHaveBeenCalledWith(7, expect.objectContaining({ status: "blocked", decision: "deny" }));
  });

  it("يمنع التخطيط قبل إقرار التفويض ويسجل سبب الحظر", async () => {
    await expect(appRouter.createCaller(createContext()).harb.cyber.operations.plan({
      assetId: "cyber-asset-01",
      operationType: "analysis",
      requestSummary: "تحليل سجلات ضمن الأصل المفوض.",
      authorizationAcknowledged: false,
    })).rejects.toThrow("يجب إقرار امتلاك التفويض");

    expect(db.createCyberOperation).not.toHaveBeenCalled();
    expect(db.createAuditEntry).toHaveBeenCalledWith(7, expect.objectContaining({ eventType: "cyber.authorization_acknowledgment_missing", outcome: "blocked" }));
  });

  it("يسجل هدف تطوير قابل للقياس في مختبر النموذج", async () => {
    const result = await appRouter.createCaller(createContext()).harb.lab.objectives.create({
      title: "تحليل تنبيهات أمنية",
      category: "cyber_analysis",
      description: "تحليل تنبيهات الفريق ضمن سياق الأصول والتفويض.",
      successCriteria: "دقة تتجاوز تسعين بالمئة مع تبرير قابل للتدقيق.",
    });

    expect(result).toEqual(expect.objectContaining({ id: "objective-01" }));
    expect(db.createModelObjective).toHaveBeenCalledWith(7, expect.objectContaining({ isActive: true }));
    expect(db.createAuditEntry).toHaveBeenCalledWith(7, expect.objectContaining({ eventType: "lab.objective_created" }));
  });

  it("يسجل مرجع ملف المعرفة دون تخزين محتواه في قاعدة البيانات", async () => {
    const result = await appRouter.createCaller(createContext()).harb.lab.sources.registerWorkspaceFile({ collectionId: "collection-01", workspaceFileId: "file-01" });

    expect(result).toEqual(expect.objectContaining({ id: "source-01" }));
    expect(db.registerKnowledgeSource).toHaveBeenCalledWith(7, expect.objectContaining({ storageKey: "owner/policy.pdf", indexingStatus: "registered", chunkCount: 0 }));
    expect(db.createAuditEntry).toHaveBeenCalledWith(7, expect.objectContaining({ eventType: "lab.source_registered" }));
  });

  it("يسجل مرجعاً عاماً موثقاً للتقييم دون تنزيل أو فهرسة تلقائية", async () => {
    const result = await appRouter.createCaller(createContext()).harb.lab.sources.registerPublicReference({ collectionId: "collection-01", sourceId: "cisa_kev" });

    expect(result).toEqual(expect.objectContaining({ id: "source-01" }));
    expect(db.registerKnowledgeSource).toHaveBeenCalledWith(7, expect.objectContaining({ sourceType: "public_reference", indexingStatus: "registered", chunkCount: 0, sourceUrl: expect.stringContaining("cisa.gov"), licenseNote: expect.any(String) }));
    expect(db.createAuditEntry).toHaveBeenCalledWith(7, expect.objectContaining({ eventType: "lab.public_source_registered" }));
  });

  it("يفهرس مصدراً نصياً إلى مقتطفات محدودة قابلة للاسترجاع", async () => {
    const result = await appRouter.createCaller(createContext()).harb.lab.sources.index({ sourceId: "source-01" });

    expect(result).toEqual({ status: "ready", chunkCount: 1 });
    expect(db.replaceKnowledgeChunks).toHaveBeenCalledWith(7, "source-01", "collection-01", [{ excerpt: "تفويض الأصل قبل أي اختبار.", contentHash: "hash-01" }]);
    expect(db.updateKnowledgeSource).toHaveBeenCalledWith(7, "source-01", expect.objectContaining({ indexingStatus: "ready", chunkCount: 1 }));
  });

  it("يعلّم المصدر غير المدعوم ولا ينشئ مقاطع معرفة", async () => {
    knowledgeIndex.indexKnowledgeStorageObject.mockResolvedValueOnce({ status: "unsupported", chunks: [] });
    const result = await appRouter.createCaller(createContext()).harb.lab.sources.index({ sourceId: "source-01" });

    expect(result).toEqual({ status: "unsupported", chunkCount: 0 });
    expect(db.replaceKnowledgeChunks).not.toHaveBeenCalled();
    expect(db.updateKnowledgeSource).toHaveBeenCalledWith(7, "source-01", expect.objectContaining({ indexingStatus: "unsupported" }));
  });

  it("ينشئ مسودة تقييم ولا يبدأ التجربة من دون حالات اختبار مصرح بها", async () => {
    const result = await appRouter.createCaller(createContext()).harb.lab.evaluations.create({ objectiveId: "objective-01", collectionId: "collection-01", modelId: "gpt-5", notes: "تقييم أولي" });

    expect(result).toEqual(expect.objectContaining({ id: "evaluation-01" }));
    expect(db.createModelEvaluation).toHaveBeenCalledWith(7, expect.objectContaining({ status: "draft", sampleCount: 0, passedCount: 0 }));
    expect(db.createAuditEntry).toHaveBeenCalledWith(7, expect.objectContaining({ eventType: "lab.evaluation_drafted" }));
  });

  it("يرفض مسودة تقييم لنموذج غير موجود في الكتالوج الحي", async () => {
    await expect(appRouter.createCaller(createContext()).harb.lab.evaluations.create({ objectiveId: "objective-01", modelId: "unknown-model" })).rejects.toThrow("معرف النموذج غير متاح");
    expect(db.createModelEvaluation).not.toHaveBeenCalled();
  });

  it("يسجل نتيجة تقييم فعلية بدليل مرجعي قبل اعتماد النموذج", async () => {
    db.listModelEvaluations.mockResolvedValue([{ id: "evaluation-01", modelId: "gpt-5", status: "draft", notes: "حالات اختبار مؤسسية" }]);

    const result = await appRouter.createCaller(createContext()).harb.lab.evaluations.recordCompletion({ evaluationId: "evaluation-01", sampleCount: 50, passedCount: 46, score: 92, evidenceReference: "report://harb/baseline-001" });

    expect(result).toEqual(expect.objectContaining({ id: "evaluation-01", status: "completed" }));
    expect(db.completeModelEvaluation).toHaveBeenCalledWith(7, "evaluation-01", expect.objectContaining({ sampleCount: 50, passedCount: 46, score: 92, notes: expect.stringContaining("baseline-001") }));
    expect(db.createAuditEntry).toHaveBeenCalledWith(7, expect.objectContaining({ eventType: "lab.evaluation_completed" }));
  });

  it("يرفض نتيجة تقييم عندما يتجاوز المجتاز إجمالي الحالات", async () => {
    await expect(appRouter.createCaller(createContext()).harb.lab.evaluations.recordCompletion({ evaluationId: "evaluation-01", sampleCount: 5, passedCount: 6, score: 80, evidenceReference: "report://harb/invalid" })).rejects.toThrow("يتجاوز عدد الحالات");
    expect(db.completeModelEvaluation).not.toHaveBeenCalled();
  });

  it("يحفظ ترشيح نموذج أساس وبديل بانتظار التقييم واعتماد المالك", async () => {
    const result = await appRouter.createCaller(createContext()).harb.lab.baseModelSelection.saveDraft({ primaryModelId: "gpt-5", fallbackModelId: "gpt-5-mini", rationale: "تجربة مقارنة منظمة وفق قانون المالك." });

    expect(result).toEqual(expect.objectContaining({ id: "base-model-01", status: "draft" }));
    expect(db.saveBaseModelSelection).toHaveBeenCalledWith(7, expect.objectContaining({ primaryModelId: "gpt-5", fallbackModelId: "gpt-5-mini", status: "draft" }));
    expect(db.createAuditEntry).toHaveBeenCalledWith(7, expect.objectContaining({ eventType: "lab.base_model_drafted" }));
  });

  it("يرفض نموذجاً بديلاً مطابقاً للنموذج الرئيسي", async () => {
    await expect(appRouter.createCaller(createContext()).harb.lab.baseModelSelection.saveDraft({ primaryModelId: "gpt-5", fallbackModelId: "gpt-5", rationale: "مبرر صالح نصياً لاختبار حظر التكرار." })).rejects.toThrow("النموذج البديل مختلف");
    expect(db.saveBaseModelSelection).not.toHaveBeenCalled();
  });

  it("يعتمد نموذج Harb بعد اكتمال تقييمه المرتبط", async () => {
    db.getBaseModelSelection.mockResolvedValue({ id: "base-model-01", primaryModelId: "gpt-5", fallbackModelId: null, primaryEvaluationId: "evaluation-01", fallbackEvaluationId: null, status: "draft" });
    db.listModelEvaluations.mockResolvedValue([{ id: "evaluation-01", modelId: "gpt-5", status: "completed" }]);

    const result = await appRouter.createCaller(createContext()).harb.lab.baseModelSelection.approve();

    expect(result).toEqual(expect.objectContaining({ id: "base-model-01", status: "approved" }));
    expect(db.approveBaseModelSelection).toHaveBeenCalledWith(7);
    expect(db.createAuditEntry).toHaveBeenCalledWith(7, expect.objectContaining({ eventType: "lab.base_model_approved", outcome: "approved" }));
  });

  it("يمنع اعتماد نموذج Harb قبل اكتمال التقييم المرتبط", async () => {
    db.getBaseModelSelection.mockResolvedValue({ id: "base-model-01", primaryModelId: "gpt-5", fallbackModelId: null, primaryEvaluationId: "evaluation-01", fallbackEvaluationId: null, status: "draft" });
    db.listModelEvaluations.mockResolvedValue([{ id: "evaluation-01", modelId: "gpt-5", status: "draft" }]);

    await expect(appRouter.createCaller(createContext()).harb.lab.baseModelSelection.approve()).rejects.toThrow("قبل اكتمال تقييمه");
    expect(db.approveBaseModelSelection).not.toHaveBeenCalled();
  });
});
