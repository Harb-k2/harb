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
  createCyberAsset,
  createCyberOperation,
  createDesktopAgent,
  createDesktopPairing,
  createKnowledgeCollection,
  createModelEvaluation,
  createModelObjective,
  createRule,
  createTask,
  createWorkspaceFile,
  ensureCyberOwnerPolicy,
  ensureHarbDefaults,
  findDesktopPairing,
  getDesktopAgentById,
  getCyberAsset,
  getCyberOperation,
  getKnowledgeSource,
  listApprovals,
  listAuditEntries,
  listDesktopAgents,
  listCyberAssets,
  listCyberOperations,
  listFileAccessApprovals,
  listKnowledgeCollections,
  listKnowledgeSources,
  listModelEvaluations,
  listModelObjectives,
  listFiles,
  listRules,
  listTasks,
  resolveApproval,
  resolveFileAccessApproval,
  consumeDesktopPairing,
  requestFileAccessApproval,
  registerKnowledgeSource,
  replaceKnowledgeChunks,
  searchKnowledgeChunks,
  updateDesktopAgent,
  updateCyberOwnerPolicy,
  updateCyberOperation,
  updateKnowledgeSource,
  updateWorkspaceFile,
  updateRule,
  updateTask,
} from "./db";
import { evaluateOwnerRules, toPolicyPrompt, type HarbRuleAction, type HarbScope, type PolicyRule } from "./harbPolicy";
import { evaluateCyberOperation, type CyberOperationType } from "./cyberPolicy";
import { indexKnowledgeStorageObject } from "./knowledgeIndex";
import { storagePut } from "./storage";

const scopeSchema = z.enum(["all", "general", "command", "file_change", "data_share"]);
const actionSchema = z.enum(["allow", "approval", "deny"]);
const desktopScopeSchema = z.enum(["read_files", "run_programs", "run_commands", "modify_files"]);
const cyberAssetTypeSchema = z.enum(["domain", "ip", "web_app", "api", "host", "cloud", "repository", "local_device"]);
const cyberEnvironmentSchema = z.enum(["production", "staging", "development", "lab"]);
const cyberOperationTypeSchema = z.enum(["analysis", "passive_validation", "active_test", "local_execution"]);
const publicEvaluationSourceSchema = z.enum(["cisa_kev", "nvd", "mitre_attack", "owasp_wstg"]);
const publicEvaluationSources = {
  cisa_kev: { name: "CISA Known Exploited Vulnerabilities (KEV)", url: "https://www.cisa.gov/known-exploited-vulnerabilities-catalog", licenseNote: "يخضع لاستخدام الموقع لشروط CISA؛ راجع https://www.cisa.gov/terms-use عند كل استخدام أو أتمتة." },
  nvd: { name: "NVD CVE/CPE Data Feeds", url: "https://nvd.nist.gov/vuln/data-feeds", licenseNote: "خدمة عامة وفق شروط NVD؛ اعرض نسبة استخدام NVD المطلوبة ولا تنسب المحتوى المعدل إلى NVD." },
  mitre_attack: { name: "MITRE ATT&CK Data & Tools", url: "https://attack.mitre.org/resources/working-with-attack/", licenseNote: "ترخيص MITRE غير حصري وخالٍ من الإتاوة للبحث والتطوير والاستخدام التجاري مع إعادة إشعار الحقوق والترخيص." },
  owasp_wstg: { name: "OWASP Web Security Testing Guide", url: "https://owasp.org/www-project-web-security-testing-guide/", licenseNote: "CC BY-SA 4.0؛ استخدم الإصدار والرابط المناسبين عند الإسناد وألزم شروط النسبة والمشاركة بالمثل." },
} as const;
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
    lab: router({
      dashboard: protectedProcedure.query(async ({ ctx }) => {
        const [objectives, collections, sources, evaluations, files] = await Promise.all([
          listModelObjectives(ctx.user.id),
          listKnowledgeCollections(ctx.user.id),
          listKnowledgeSources(ctx.user.id),
          listModelEvaluations(ctx.user.id),
          listFiles(ctx.user.id),
        ]);
        return { objectives, collections, sources, evaluations, files };
      }),
      models: protectedProcedure.query(async () => {
        const catalog = await listLLMModels();
        return catalog.data.map(item => ({ id: item.id, name: item.id }));
      }),
      objectives: router({
        create: protectedProcedure.input(z.object({
          title: z.string().trim().min(3).max(160),
          category: z.enum(["cyber_analysis", "authorization_decisions", "document_analysis", "code_review", "custom"]),
          description: z.string().trim().min(10).max(4000),
          successCriteria: z.string().trim().min(10).max(4000),
        })).mutation(async ({ ctx, input }) => {
          const objective = await createModelObjective(ctx.user.id, { ...input, isActive: true });
          await createAuditEntry(ctx.user.id, {
            eventType: "lab.objective_created",
            requestId: objective.id,
            outcome: "recorded",
            summary: `تمت إضافة هدف تحسين للنموذج: «${objective.title}».`,
            ruleIds: "",
            metadata: JSON.stringify({ category: objective.category }),
          });
          return objective;
        }),
      }),
      collections: router({
        create: protectedProcedure.input(z.object({
          name: z.string().trim().min(3).max(160),
          description: z.string().trim().min(10).max(4000),
          classification: z.enum(["private", "restricted", "shared"]),
        })).mutation(async ({ ctx, input }) => {
          const collection = await createKnowledgeCollection(ctx.user.id, { ...input, status: "draft" });
          await createAuditEntry(ctx.user.id, {
            eventType: "lab.collection_created",
            requestId: collection.id,
            outcome: "recorded",
            summary: `تم إنشاء مجموعة معرفة «${collection.name}».`,
            ruleIds: "",
            metadata: JSON.stringify({ classification: collection.classification }),
          });
          return collection;
        }),
      }),
      sources: router({
        registerWorkspaceFile: protectedProcedure.input(z.object({ collectionId: z.string().min(1), workspaceFileId: z.string().min(1) })).mutation(async ({ ctx, input }) => {
          const [collections, files] = await Promise.all([listKnowledgeCollections(ctx.user.id), listFiles(ctx.user.id)]);
          const collection = collections.find(item => item.id === input.collectionId);
          const file = files.find(item => item.id === input.workspaceFileId);
          if (!collection) throw new Error("مجموعة المعرفة غير موجودة.");
          if (!file) throw new Error("ملف مساحة العمل غير موجود.");
          const source = await registerKnowledgeSource(ctx.user.id, {
            collectionId: collection.id,
            workspaceFileId: file.id,
            sourceType: "workspace_file",
            name: file.name,
            storageKey: file.storageKey,
            sourceUrl: null,
            licenseNote: null,
            mimeType: file.mimeType,
            size: file.size,
            indexingStatus: "registered",
            chunkCount: 0,
          });
          await createAuditEntry(ctx.user.id, {
            eventType: "lab.source_registered",
            requestId: source.id,
            outcome: "recorded",
            summary: `تم تسجيل «${file.name}» كمصدر معرفة بانتظار الفهرسة.`,
            ruleIds: "",
            metadata: JSON.stringify({ collectionId: collection.id, workspaceFileId: file.id }),
          });
          return source;
        }),
        registerPublicReference: protectedProcedure.input(z.object({ collectionId: z.string().min(1), sourceId: publicEvaluationSourceSchema })).mutation(async ({ ctx, input }) => {
          const collections = await listKnowledgeCollections(ctx.user.id);
          const collection = collections.find(item => item.id === input.collectionId);
          if (!collection) throw new Error("مجموعة المعرفة غير موجودة.");
          const publicSource = publicEvaluationSources[input.sourceId];
          const source = await registerKnowledgeSource(ctx.user.id, {
            collectionId: collection.id,
            workspaceFileId: null,
            sourceType: "public_reference",
            name: publicSource.name,
            storageKey: null,
            sourceUrl: publicSource.url,
            licenseNote: publicSource.licenseNote,
            mimeType: "text/html",
            size: null,
            indexingStatus: "registered",
            chunkCount: 0,
          });
          await createAuditEntry(ctx.user.id, {
            eventType: "lab.public_source_registered",
            requestId: source.id,
            outcome: "recorded",
            summary: `تم تسجيل المرجع العام «${publicSource.name}» للتقييم فقط دون فهرسة تلقائية.`,
            ruleIds: "",
            metadata: JSON.stringify({ collectionId: collection.id, sourceId: input.sourceId, url: publicSource.url }),
          });
          return source;
        }),
        index: protectedProcedure.input(z.object({ sourceId: z.string().min(1) })).mutation(async ({ ctx, input }) => {
          const source = await getKnowledgeSource(ctx.user.id, input.sourceId);
          if (!source) throw new Error("مصدر المعرفة غير موجود.");
          if (source.sourceType !== "workspace_file" || !source.storageKey) throw new Error("لا يمكن فهرسة هذا المرجع تلقائياً؛ لا يُفهرس المصدر العام قبل مراجعة الحقوق والمحتوى.");
          try {
            const result = await indexKnowledgeStorageObject(source.storageKey, source.mimeType);
            if (result.status === "unsupported") {
              await updateKnowledgeSource(ctx.user.id, source.id, { indexingStatus: "unsupported", chunkCount: 0, indexedAt: null });
              await createAuditEntry(ctx.user.id, { eventType: "lab.source_index_unsupported", requestId: source.id, outcome: "blocked", summary: "نوع ملف المصدر غير مدعوم للفهرسة في الإصدار الأول.", ruleIds: "", metadata: JSON.stringify({ mimeType: source.mimeType }) });
              return { status: "unsupported" as const, chunkCount: 0 };
            }
            await replaceKnowledgeChunks(ctx.user.id, source.id, source.collectionId, result.chunks);
            await updateKnowledgeSource(ctx.user.id, source.id, { indexingStatus: "ready", chunkCount: result.chunks.length, indexedAt: new Date() });
            await createAuditEntry(ctx.user.id, { eventType: "lab.source_indexed", requestId: source.id, outcome: "completed", summary: `تمت فهرسة ${result.chunks.length} مقتطفاً معرفياً محدوداً من المصدر.`, ruleIds: "", metadata: JSON.stringify({ chunkCount: result.chunks.length, mimeType: source.mimeType }) });
            return { status: "ready" as const, chunkCount: result.chunks.length };
          } catch (error) {
            await updateKnowledgeSource(ctx.user.id, source.id, { indexingStatus: "failed", chunkCount: 0, indexedAt: null });
            await createAuditEntry(ctx.user.id, { eventType: "lab.source_index_failed", requestId: source.id, outcome: "failed", summary: "تعذرت فهرسة مصدر المعرفة.", ruleIds: "", metadata: JSON.stringify({ error: error instanceof Error ? error.message : "unknown" }) });
            throw error;
          }
        }),
      }),
      knowledge: router({
        search: protectedProcedure.input(z.object({ query: z.string().trim().min(3).max(1200), collectionId: z.string().min(1).optional() })).query(({ ctx, input }) => searchKnowledgeChunks(ctx.user.id, input.query, input.collectionId)),
      }),
      evaluations: router({
        create: protectedProcedure.input(z.object({
          objectiveId: z.string().min(1),
          collectionId: z.string().min(1).optional(),
          modelId: z.string().trim().min(2).max(160),
          notes: z.string().trim().max(4000).optional(),
        })).mutation(async ({ ctx, input }) => {
          const objectives = await listModelObjectives(ctx.user.id);
          if (!objectives.some(item => item.id === input.objectiveId)) throw new Error("هدف النموذج غير موجود.");
          const evaluation = await createModelEvaluation(ctx.user.id, {
            objectiveId: input.objectiveId,
            collectionId: input.collectionId ?? null,
            modelId: input.modelId,
            status: "draft",
            sampleCount: 0,
            passedCount: 0,
            score: null,
            notes: input.notes ?? null,
          });
          await createAuditEntry(ctx.user.id, {
            eventType: "lab.evaluation_drafted",
            requestId: evaluation.id,
            outcome: "recorded",
            summary: "تم إعداد تجربة تقييم؛ لن تبدأ قبل إضافة حالات اختبار مصرح بها.",
            ruleIds: "",
            metadata: JSON.stringify({ objectiveId: input.objectiveId, modelId: input.modelId }),
          });
          return evaluation;
        }),
      }),
    }),
    cyber: router({
      dashboard: protectedProcedure.query(async ({ ctx }) => {
        const [assets, operations, ownerPolicy] = await Promise.all([listCyberAssets(ctx.user.id), listCyberOperations(ctx.user.id), ensureCyberOwnerPolicy(ctx.user.id)]);
        return { assets, operations, ownerPolicy };
      }),
      policy: router({
        get: protectedProcedure.query(({ ctx }) => ensureCyberOwnerPolicy(ctx.user.id)),
        update: protectedProcedure.input(z.object({
          analysisAction: actionSchema.optional(),
          passiveAction: actionSchema.optional(),
          activeAction: actionSchema.optional(),
          localAction: actionSchema.optional(),
          requireAuthorizationAcknowledgment: z.boolean().optional(),
        })).mutation(async ({ ctx, input }) => {
          const policy = await updateCyberOwnerPolicy(ctx.user.id, input);
          await createAuditEntry(ctx.user.id, {
            eventType: "cyber.owner_policy_updated",
            requestId: null,
            outcome: "recorded",
            summary: "تم تعديل قانون المالك السيبراني.",
            ruleIds: "cyber-owner-law",
            metadata: JSON.stringify(input),
          });
          return policy;
        }),
      }),
      assets: router({
        create: protectedProcedure.input(z.object({
          name: z.string().trim().min(2).max(160),
          assetValue: z.string().trim().min(2).max(512),
          assetType: cyberAssetTypeSchema,
          environment: cyberEnvironmentSchema,
          authorizationRef: z.string().trim().min(3).max(320),
          permittedScope: z.string().trim().min(10).max(4000),
          validUntil: z.coerce.date().optional(),
        })).mutation(async ({ ctx, input }) => {
          const asset = await createCyberAsset(ctx.user.id, {
            ...input,
            status: "authorized",
            validUntil: input.validUntil ?? null,
          });
          await createAuditEntry(ctx.user.id, {
            eventType: "cyber.asset_authorized",
            requestId: asset.id,
            outcome: "recorded",
            summary: `تم تسجيل الأصل «${asset.name}» ضمن نطاق تفويض سيبراني.`,
            ruleIds: "",
            metadata: JSON.stringify({ assetType: asset.assetType, environment: asset.environment, authorizationRef: asset.authorizationRef }),
          });
          return asset;
        }),
      }),
      operations: router({
        plan: protectedProcedure.input(z.object({
          assetId: z.string().min(1),
          operationType: cyberOperationTypeSchema,
          requestSummary: z.string().trim().min(10).max(4000),
          authorizationAcknowledged: z.boolean(),
        })).mutation(async ({ ctx, input }) => {
          const asset = await getCyberAsset(ctx.user.id, input.assetId);
          const ownerPolicy = await ensureCyberOwnerPolicy(ctx.user.id);
          if (ownerPolicy.requireAuthorizationAcknowledgment && !input.authorizationAcknowledged) {
            await createAuditEntry(ctx.user.id, {
              eventType: "cyber.authorization_acknowledgment_missing",
              requestId: input.assetId,
              outcome: "blocked",
              summary: "رُفض تخطيط عملية سيبرانية لغياب إقرار التفويض الصريح.",
              ruleIds: "cyber-owner-law",
              metadata: JSON.stringify({ operationType: input.operationType }),
            });
            throw new Error("يجب إقرار امتلاك التفويض والنطاق قبل إنشاء العملية.");
          }
          const policy = evaluateCyberOperation(asset, input.operationType as CyberOperationType, ownerPolicy);
          const operation = await createCyberOperation(ctx.user.id, {
            assetId: input.assetId,
            operationType: input.operationType,
            riskLevel: policy.riskLevel,
            decision: policy.decision,
            status: policy.decision === "allow" ? "planned" : policy.decision === "approval" ? "awaiting_approval" : "blocked",
            requestSummary: input.requestSummary,
            decisionReason: policy.reason,
            plan: policy.plan,
            approvalId: null,
            authorizationAcknowledgedAt: new Date(),
            resultSummary: null,
            completedAt: null,
          });
          if (policy.decision === "approval") {
            const approval = await createApproval(ctx.user.id, {
              taskId: operation.id,
              action: `cyber:${input.operationType}`,
              riskLevel: "high",
              status: "requested",
              summary: `${asset?.name ?? "أصل غير معروف"}: ${input.requestSummary}`,
              expiresAt: new Date(Date.now() + 10 * 60 * 1000),
              resolvedAt: null,
            });
            await updateCyberOperation(ctx.user.id, operation.id, { approvalId: approval.id });
            await createAuditEntry(ctx.user.id, {
              eventType: "cyber.operation_pending_approval",
              requestId: operation.id,
              outcome: "approval_requested",
              summary: policy.reason,
              ruleIds: "cyber-owner-law",
              metadata: JSON.stringify({ assetId: input.assetId, approvalId: approval.id, operationType: input.operationType }),
            });
            return { operation: { ...operation, approvalId: approval.id }, policy, approval };
          }
          await createAuditEntry(ctx.user.id, {
            eventType: "cyber.operation_planned",
            requestId: operation.id,
            outcome: policy.decision === "allow" ? "allowed" : "blocked",
            summary: policy.reason,
            ruleIds: "cyber-owner-law",
            metadata: JSON.stringify({ assetId: input.assetId, operationType: input.operationType }),
          });
          return { operation, policy };
        }),
        resolveApproval: protectedProcedure.input(z.object({ operationId: z.string().min(1), status: z.enum(["approved", "rejected"]) })).mutation(async ({ ctx, input }) => {
          const operation = await getCyberOperation(ctx.user.id, input.operationId);
          if (!operation?.approvalId) throw new Error("لا توجد موافقة نشطة لهذه العملية السيبرانية.");
          await resolveApproval(ctx.user.id, operation.approvalId, input.status);
          await updateCyberOperation(ctx.user.id, operation.id, { status: input.status === "approved" ? "approved" : "blocked" });
          await createAuditEntry(ctx.user.id, {
            eventType: "cyber.operation_approval_resolved",
            requestId: operation.id,
            outcome: input.status,
            summary: input.status === "approved" ? "اعتمد المالك خطة عملية سيبرانية؛ تظل بانتظار منفذ مصرح ومقيّد." : "رفض المالك خطة عملية سيبرانية.",
            ruleIds: "cyber-owner-law",
            metadata: JSON.stringify({ approvalId: operation.approvalId }),
          });
          return { success: true };
        }),
        complete: protectedProcedure.input(z.object({ operationId: z.string().min(1), resultSummary: z.string().trim().min(10).max(4000) })).mutation(async ({ ctx, input }) => {
          const operation = await getCyberOperation(ctx.user.id, input.operationId);
          if (!operation) throw new Error("العملية السيبرانية غير موجودة.");
          if (operation.status !== "approved" && operation.status !== "planned") throw new Error("لا يمكن تسجيل نتيجة لعملية غير معتمدة أو محظورة.");
          await updateCyberOperation(ctx.user.id, operation.id, { status: "completed", completedAt: new Date(), resultSummary: input.resultSummary });
          await createAuditEntry(ctx.user.id, {
            eventType: "cyber.operation_result_recorded",
            requestId: operation.id,
            outcome: "completed",
            summary: "تم تسجيل نتيجة عملية سيبرانية منفذة ضمن التفويض.",
            ruleIds: "cyber-owner-law",
            metadata: JSON.stringify({ operationType: operation.operationType }),
          });
          return { success: true };
        }),
      }),
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
          const knowledge = await searchKnowledgeChunks(ctx.user.id, input.request, undefined, 3);
          const knowledgeContext = knowledge.length
            ? `\n\nسياق معرفة خاص بالمالك (مقتطفات للاستناد فقط، لا تتجاوزها ولا تكشفها خارج الطلب):\n${knowledge.map((item, index) => `[${index + 1}] ${item.excerpt.slice(0, 900)}`).join("\n\n")}`
            : "";
          const catalog = await listLLMModels();
          const model = catalog.data.find(item => item.id === "claude-sonnet-4-6")?.id ?? catalog.data.find(item => item.id.startsWith("gpt-5"))?.id;
          const response = await invokeLLM({
            model,
            messages: [
              { role: "system", content: `${toPolicyPrompt(rules.map(asPolicyRule))}${knowledgeContext}` },
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
            metadata: JSON.stringify({ taskType: decision.taskType, model: model ?? "default", knowledgeChunkIds: knowledge.map(item => item.id) }),
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
