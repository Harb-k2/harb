import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

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
  createRule: vi.fn(),
  createTask: vi.fn(),
  createWorkspaceFile: vi.fn(),
  ensureCyberOwnerPolicy: vi.fn(),
  ensureHarbDefaults: vi.fn(),
  findDesktopPairing: vi.fn(),
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
    db.listModelObjectives.mockResolvedValue([{ id: "objective-01" }]);
    db.listKnowledgeCollections.mockResolvedValue([{ id: "collection-01" }]);
    db.listFiles.mockResolvedValue([{ id: "file-01", name: "policy.pdf", storageKey: "owner/policy.pdf", mimeType: "application/pdf", size: 800 }]);
    db.searchKnowledgeChunks.mockResolvedValue([]);
    llm.listLLMModels.mockResolvedValue({ data: [{ id: "gpt-5" }] });
    llm.invokeLLM.mockResolvedValue({ choices: [{ message: { content: "تحليل آمن ومقيد بالتفويض." } }] });
    db.getKnowledgeSource.mockResolvedValue({ id: "source-01", collectionId: "collection-01", sourceType: "workspace_file", storageKey: "owner/notes.txt", mimeType: "text/plain" });
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
    const result = await appRouter.createCaller(createContext()).harb.lab.evaluations.create({ objectiveId: "objective-01", collectionId: "collection-01", modelId: "gpt-test", notes: "تقييم أولي" });

    expect(result).toEqual(expect.objectContaining({ id: "evaluation-01" }));
    expect(db.createModelEvaluation).toHaveBeenCalledWith(7, expect.objectContaining({ status: "draft", sampleCount: 0, passedCount: 0 }));
    expect(db.createAuditEntry).toHaveBeenCalledWith(7, expect.objectContaining({ eventType: "lab.evaluation_drafted" }));
  });
});
