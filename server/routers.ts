import { nanoid } from "nanoid";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { invokeLLM, listLLMModels } from "./_core/llm";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import {
  createApproval,
  createAuditEntry,
  createDesktopAgent,
  createDesktopPairing,
  createRule,
  createTask,
  createWorkspaceFile,
  ensureHarbDefaults,
  findDesktopPairing,
  getDesktopAgentById,
  listApprovals,
  listAuditEntries,
  listDesktopAgents,
  listFileAccessApprovals,
  listFiles,
  listRules,
  listTasks,
  resolveApproval,
  resolveFileAccessApproval,
  consumeDesktopPairing,
  requestFileAccessApproval,
  updateDesktopAgent,
  updateWorkspaceFile,
  updateRule,
  updateTask,
} from "./db";
import { evaluateOwnerRules, toPolicyPrompt, type HarbRuleAction, type HarbScope, type PolicyRule } from "./harbPolicy";
import { storagePut } from "./storage";

const scopeSchema = z.enum(["all", "general", "command", "file_change", "data_share"]);
const actionSchema = z.enum(["allow", "approval", "deny"]);
const desktopScopeSchema = z.enum(["read_files", "run_programs", "run_commands", "modify_files"]);
const hashSecret = (value: string) => createHash("sha256").update(value).digest("hex");
const hasMatchingSecret = (provided: string, storedHash: string) => {
  const incoming = Buffer.from(hashSecret(provided), "hex");
  const stored = Buffer.from(storedHash, "hex");
  return incoming.length === stored.length && timingSafeEqual(incoming, stored);
};

const ruleInput = z.object({
  title: z.string().trim().min(3).max(160),
  description: z.string().trim().max(1200).optional(),
  matchTerms: z.string().trim().max(1000),
  scope: scopeSchema,
  action: actionSchema,
  priority: z.number().int().min(0).max(10000),
  isActive: z.boolean().default(true),
});

const asPolicyRule = (rule: Awaited<ReturnType<typeof listRules>>[number]): PolicyRule => ({
  id: rule.id,
  title: rule.title,
  description: rule.description,
  matchTerms: rule.matchTerms,
  scope: rule.scope as HarbScope,
  action: rule.action as HarbRuleAction,
  priority: rule.priority,
  isActive: rule.isActive,
});

async function getHarbSnapshot(ownerId: number) {
  await ensureHarbDefaults(ownerId);
  const [rules, tasks, approvalsList, files, audit, fileApprovals, agents] = await Promise.all([
    listRules(ownerId),
    listTasks(ownerId),
    listApprovals(ownerId),
    listFiles(ownerId),
    listAuditEntries(ownerId),
    listFileAccessApprovals(ownerId),
    listDesktopAgents(ownerId),
  ]);
  return { rules, tasks, approvals: approvalsList, files, audit, fileApprovals, agents };
}

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  harb: router({
    dashboard: protectedProcedure.query(({ ctx }) => getHarbSnapshot(ctx.user.id)),
    audit: router({
      list: protectedProcedure.input(z.object({ search: z.string().max(160).default("") })).query(({ ctx, input }) => listAuditEntries(ctx.user.id, input.search)),
    }),
    rules: router({
      create: protectedProcedure.input(ruleInput).mutation(async ({ ctx, input }) => {
        const rule = await createRule(ctx.user.id, { ...input, description: input.description ?? null });
        await createAuditEntry(ctx.user.id, {
          eventType: "policy.created",
          requestId: null,
          outcome: "recorded",
          summary: `تمت إضافة قاعدة المالك «${rule.title}».`,
          ruleIds: rule.id,
          metadata: JSON.stringify({ action: rule.action, scope: rule.scope, priority: rule.priority }),
        });
        return rule;
      }),
      update: protectedProcedure.input(ruleInput.partial().extend({ id: z.string().min(1) })).mutation(async ({ ctx, input }) => {
        const { id, ...values } = input;
        await updateRule(ctx.user.id, id, values);
        await createAuditEntry(ctx.user.id, {
          eventType: "policy.updated",
          requestId: null,
          outcome: "recorded",
          summary: "تم تعديل قاعدة من قواعد المالك.",
          ruleIds: id,
          metadata: JSON.stringify(values),
        });
        return { success: true };
      }),
    }),
    approvals: router({
      resolve: protectedProcedure.input(z.object({ id: z.string().min(1), status: z.enum(["approved", "rejected"]) })).mutation(async ({ ctx, input }) => {
        await resolveApproval(ctx.user.id, input.id, input.status);
        await createAuditEntry(ctx.user.id, {
          eventType: "approval.resolved",
          requestId: input.id,
          outcome: input.status,
          summary: input.status === "approved" ? "وافق المالك على عملية حساسة." : "رفض المالك عملية حساسة.",
          ruleIds: "",
          metadata: JSON.stringify({ approvalId: input.id }),
        });
        return { success: true };
      }),
    }),
    files: router({
      upload: protectedProcedure.input(z.object({
        name: z.string().trim().min(1).max(320),
        mimeType: z.string().trim().min(1).max(160),
        base64: z.string().min(1).max(14_000_000),
        classification: z.enum(["private", "restricted", "shared"]).default("private"),
      })).mutation(async ({ ctx, input }) => {
        const buffer = Buffer.from(input.base64, "base64");
        if (buffer.length > 10_000_000) throw new Error("الحد الأقصى للإصدار الأول هو 10 ميغابايت للملف الواحد.");
        const fileId = nanoid();
        const safeName = input.name.replace(/[^\w.\-\u0600-\u06FF]+/g, "-");
        const { key, url } = await storagePut(`${ctx.user.id}/harb/${fileId}-${safeName}`, buffer, input.mimeType);
        const file = await createWorkspaceFile(ctx.user.id, {
          name: input.name,
          mimeType: input.mimeType,
          size: buffer.length,
          storageKey: key,
          storageUrl: url,
          classification: input.classification,
          permissionState: "allowed",
          approvalState: "not_required",
          lastApprovalAt: null,
        });
        await createAuditEntry(ctx.user.id, {
          eventType: "file.uploaded",
          requestId: file.id,
          outcome: "stored",
          summary: `تم رفع الملف «${input.name}» إلى مساحة العمل الخاصة.`,
          ruleIds: "",
          metadata: JSON.stringify({ mimeType: input.mimeType, size: buffer.length, classification: input.classification }),
        });
        return file;
      }),
      updateClassification: protectedProcedure.input(z.object({ id: z.string().min(1), classification: z.enum(["private", "restricted", "shared"]) })).mutation(async ({ ctx, input }) => {
        const security = input.classification === "private"
          ? { permissionState: "allowed" as const, approvalState: "not_required" as const }
          : { permissionState: "restricted" as const, approvalState: "not_required" as const };
        await updateWorkspaceFile(ctx.user.id, input.id, { classification: input.classification, ...security, lastApprovalAt: null });
        await createAuditEntry(ctx.user.id, {
          eventType: "file.classification_updated",
          requestId: input.id,
          outcome: "recorded",
          summary: `تم تحديث تصنيف ملف في مساحة العمل إلى «${input.classification}».`,
          ruleIds: "",
          metadata: JSON.stringify({ classification: input.classification }),
        });
        return { success: true };
      }),
      requestApproval: protectedProcedure.input(z.object({ id: z.string().min(1), action: z.enum(["share", "modify", "delete"]) })).mutation(async ({ ctx, input }) => {
        const approval = await requestFileAccessApproval(ctx.user.id, input.id, input.action);
        const actionLabel = input.action === "share" ? "مشاركة" : input.action === "modify" ? "تعديل" : "حذف";
        await createAuditEntry(ctx.user.id, {
          eventType: "file.approval_requested",
          requestId: input.id,
          outcome: "approval_requested",
          summary: `طلب Harb موافقة المالك على ${actionLabel} ملف.`,
          ruleIds: "",
          metadata: JSON.stringify({ fileApprovalId: approval.id, action: input.action }),
        });
        return approval;
      }),
      resolveApproval: protectedProcedure.input(z.object({ id: z.string().min(1), status: z.enum(["approved", "rejected"]) })).mutation(async ({ ctx, input }) => {
        const approval = await resolveFileAccessApproval(ctx.user.id, input.id, input.status);
        await createAuditEntry(ctx.user.id, {
          eventType: "file.approval_resolved",
          requestId: approval.fileId,
          outcome: input.status,
          summary: input.status === "approved" ? "وافق المالك على عملية ملف حساسة." : "رفض المالك عملية ملف حساسة.",
          ruleIds: "",
          metadata: JSON.stringify({ fileApprovalId: input.id, action: approval.action }),
        });
        return { success: true };
      }),
    }),
    desktop: router({
      createPairing: protectedProcedure.mutation(async ({ ctx }) => {
        const code = `${nanoid(4).toUpperCase()}-${nanoid(4).toUpperCase()}`;
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
        await createDesktopPairing(ctx.user.id, hashSecret(code), expiresAt);
        await createAuditEntry(ctx.user.id, {
          eventType: "desktop.pairing_issued",
          requestId: null,
          outcome: "pending",
          summary: "تم إصدار رمز ربط مؤقت لعميل سطح المكتب؛ لا يمنح الرمز صلاحيات تلقائية.",
          ruleIds: "",
          metadata: JSON.stringify({ platform: "desktop" }),
        });
        return { code, expiresInMinutes: 10 };
      }),
      claimPairing: publicProcedure.input(z.object({
        code: z.string().trim().min(5).max(32),
        name: z.string().trim().min(2).max(160),
        operatingSystem: z.enum(["windows", "kali_linux"]),
      })).mutation(async ({ input }) => {
        const pairing = await findDesktopPairing(hashSecret(input.code.toUpperCase()));
        if (!pairing || pairing.consumedAt || pairing.expiresAt.getTime() < Date.now()) throw new Error("رمز الربط غير صالح أو انتهت صلاحيته.");
        const agentToken = randomBytes(32).toString("base64url");
        const agent = await createDesktopAgent(pairing.ownerId, {
          name: input.name,
          operatingSystem: input.operatingSystem,
          status: "approval_required",
          scopes: "",
          agentTokenHash: hashSecret(agentToken),
          lastSeenAt: new Date(),
        });
        await consumeDesktopPairing(pairing.ownerId, pairing.id);
        await createAuditEntry(pairing.ownerId, {
          eventType: "desktop.agent_registered",
          requestId: agent.id,
          outcome: "approval_required",
          summary: `تم تسجيل عميل سطح المكتب «${input.name}» دون صلاحيات محلية مفعلة.`,
          ruleIds: "",
          metadata: JSON.stringify({ operatingSystem: input.operatingSystem }),
        });
        return { agentId: agent.id, agentToken, scopes: [] as string[] };
      }),
      heartbeat: publicProcedure.input(z.object({ agentId: z.string().min(1), agentToken: z.string().min(24).max(128) })).mutation(async ({ input }) => {
        const agent = await getDesktopAgentById(input.agentId);
        if (!agent || !hasMatchingSecret(input.agentToken, agent.agentTokenHash)) throw new Error("تعذر التحقق من عميل سطح المكتب.");
        await updateDesktopAgent(agent.ownerId, agent.id, { lastSeenAt: new Date() });
        return { status: agent.status, scopes: agent.scopes ? agent.scopes.split(",").filter(Boolean) : [] };
      }),
      updateScopes: protectedProcedure.input(z.object({ id: z.string().min(1), scopes: z.array(desktopScopeSchema).max(4) })).mutation(async ({ ctx, input }) => {
        const status = input.scopes.length ? "online" : "approval_required";
        await updateDesktopAgent(ctx.user.id, input.id, { scopes: input.scopes.join(","), status });
        await createAuditEntry(ctx.user.id, {
          eventType: "desktop.scopes_updated",
          requestId: input.id,
          outcome: "recorded",
          summary: input.scopes.length ? "تم تحديث نطاقات عميل سطح المكتب." : "تم سحب جميع نطاقات عميل سطح المكتب.",
          ruleIds: "",
          metadata: JSON.stringify({ scopes: input.scopes }),
        });
        return { success: true };
      }),
    }),
    tasks: router({
      submit: protectedProcedure.input(z.object({ request: z.string().trim().min(2).max(12000) })).mutation(async ({ ctx, input }) => {
        await ensureHarbDefaults(ctx.user.id);
        const rules = await listRules(ctx.user.id);
        const decision = evaluateOwnerRules(input.request, rules.map(asPolicyRule));
        const task = await createTask(ctx.user.id, {
          request: input.request,
          taskType: decision.taskType,
          status: decision.outcome === "deny" ? "blocked" : decision.outcome === "approval" ? "needs_approval" : "queued",
          decision: decision.outcome,
          decisionReason: decision.reason,
          response: null,
          completedAt: null,
        });

        const ruleIds = decision.matchedRules.map(rule => rule.id).join(",");
        if (decision.outcome === "deny") {
          await createAuditEntry(ctx.user.id, {
            eventType: "task.preflight",
            requestId: task.id,
            outcome: "blocked",
            summary: decision.reason,
            ruleIds,
            metadata: JSON.stringify({ taskType: decision.taskType }),
          });
          return { decision: "deny" as const, task, message: `**تم رفض الطلب قبل التنفيذ.**\n\n${decision.reason}` };
        }

        if (decision.outcome === "approval") {
          const approval = await createApproval(ctx.user.id, {
            taskId: task.id,
            action: decision.taskType,
            riskLevel: "high",
            status: "requested",
            summary: input.request,
            expiresAt: new Date(Date.now() + 10 * 60 * 1000),
            resolvedAt: null,
          });
          await createAuditEntry(ctx.user.id, {
            eventType: "task.preflight",
            requestId: task.id,
            outcome: "approval_requested",
            summary: decision.reason,
            ruleIds,
            metadata: JSON.stringify({ approvalId: approval.id, taskType: decision.taskType }),
          });
          return { decision: "approval" as const, task, approval, message: `**يلزم تأكيد المالك قبل المتابعة.**\n\n${decision.reason}\n\nأُضيف الطلب إلى قائمة الموافقات ولم يُنفّذ أي إجراء محلي أو خارجي.` };
        }

        try {
          const catalog = await listLLMModels();
          const model = catalog.data.find(item => item.id === "claude-sonnet-4-6")?.id ?? catalog.data.find(item => item.id.startsWith("gpt-5"))?.id;
          const response = await invokeLLM({
            model,
            messages: [
              { role: "system", content: toPolicyPrompt(rules.map(asPolicyRule)) },
              { role: "user", content: input.request },
            ],
          });
          const responseContent = response.choices[0]?.message?.content;
          const message = typeof responseContent === "string" && responseContent.trim()
            ? responseContent.trim()
            : "لم يُنتج النموذج رداً نصياً لهذه المهمة.";
          await updateTask(ctx.user.id, task.id, { status: "completed", response: message, completedAt: new Date() });
          await createAuditEntry(ctx.user.id, {
            eventType: "task.completed",
            requestId: task.id,
            outcome: "completed",
            summary: "اجتاز الطلب فحص القواعد واكتمل الرد التحليلي.",
            ruleIds,
            metadata: JSON.stringify({ taskType: decision.taskType, model: model ?? "default" }),
          });
          return { decision: "allow" as const, task, message };
        } catch (error) {
          await updateTask(ctx.user.id, task.id, { status: "failed", response: "تعذر إنشاء رد النموذج حالياً.", completedAt: new Date() });
          await createAuditEntry(ctx.user.id, {
            eventType: "task.failed",
            requestId: task.id,
            outcome: "failed",
            summary: "تعذر إكمال استدعاء النموذج بعد اجتياز فحص القواعد.",
            ruleIds,
            metadata: JSON.stringify({ error: error instanceof Error ? error.message : "unknown" }),
          });
          throw new Error("تعذر تشغيل النموذج حالياً. لم يُنفّذ أي إجراء خارجي.");
        }
      }),
    }),
  }),
});

export type AppRouter = typeof appRouter;
