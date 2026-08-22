import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const db = vi.hoisted(() => ({
  createApproval: vi.fn(),
  createAuditEntry: vi.fn(),
  createCyberAsset: vi.fn(),
  createCyberOperation: vi.fn(),
  createDesktopAgent: vi.fn(),
  createDesktopPairing: vi.fn(),
  createRule: vi.fn(),
  createTask: vi.fn(),
  createWorkspaceFile: vi.fn(),
  ensureCyberOwnerPolicy: vi.fn(),
  ensureHarbDefaults: vi.fn(),
  findDesktopPairing: vi.fn(),
  getDesktopAgentById: vi.fn(),
  getCyberAsset: vi.fn(),
  getCyberOperation: vi.fn(),
  listApprovals: vi.fn(),
  listAuditEntries: vi.fn(),
  listDesktopAgents: vi.fn(),
  listCyberAssets: vi.fn(),
  listCyberOperations: vi.fn(),
  listFileAccessApprovals: vi.fn(),
  listFiles: vi.fn(),
  listRules: vi.fn(),
  listTasks: vi.fn(),
  resolveApproval: vi.fn(),
  resolveFileAccessApproval: vi.fn(),
  consumeDesktopPairing: vi.fn(),
  requestFileAccessApproval: vi.fn(),
  updateDesktopAgent: vi.fn(),
  updateCyberOwnerPolicy: vi.fn(),
  updateCyberOperation: vi.fn(),
  updateRule: vi.fn(),
  updateWorkspaceFile: vi.fn(),
  updateTask: vi.fn(),
}));

vi.mock("./db", () => db);
vi.mock("./_core/llm", () => ({
  invokeLLM: vi.fn(),
  listLLMModels: vi.fn(),
}));

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
  });

  it("ينشئ طلب موافقة قبل أي حذف ملف ولا يستدعي النموذج", async () => {
    const result = await appRouter.createCaller(createContext()).harb.tasks.submit({ request: "احذف الملف القديم" });

    expect(result.decision).toBe("approval");
    expect(db.ensureHarbDefaults).toHaveBeenCalledWith(7);
    expect(db.createTask).toHaveBeenCalledWith(7, expect.objectContaining({ status: "needs_approval", taskType: "file_change" }));
    expect(db.createApproval).toHaveBeenCalledWith(7, expect.objectContaining({ taskId: "task-01", action: "file_change", status: "requested" }));
    expect(db.createAuditEntry).toHaveBeenCalledWith(7, expect.objectContaining({ outcome: "approval_requested" }));
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
});
