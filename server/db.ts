import { and, asc, desc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { nanoid } from "nanoid";
import {
  approvals,
  auditEntries,
  baseModelSelections,
  benchmarkCases,
  benchmarkResults,
  benchmarkRuns,
  conversationMessages,
  conversations,
  cyberAssets,
  cyberOwnerPolicies,
  cyberOperations,
  desktopAgents,
  desktopPairings,
  fileAccessApprovals,
  harbTasks,
  InsertUser,
  knowledgeCollections,
  knowledgeChunks,
  knowledgeSources,
  messageFeedback,
  modelEvaluations,
  modelObjectives,
  ownerRules,
  OwnerRule,
  users,
  workspaceFiles,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;

  const values: InsertUser = { openId: user.openId, lastSignedIn: new Date() };
  const updateSet: Record<string, unknown> = { lastSignedIn: new Date() };
  (["name", "email", "loginMethod"] as const).forEach(field => {
    if (user[field] !== undefined) {
      values[field] = user[field];
      updateSet[field] = user[field];
    }
  });
  values.role = user.role ?? (user.openId === ENV.ownerOpenId ? "admin" : "user");
  updateSet.role = values.role;
  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

const defaultRules = (ownerId: number) => [
  {
    id: `base-command-${ownerId}`,
    ownerId,
    title: "الأوامر المحلية تحتاج موافقة",
    description: "لا يُشغّل Harb أي أمر على جهاز متصل قبل موافقة صريحة من المالك.",
    matchTerms: "تشغيل,نفذ,نفّذ,command,terminal,cmd,powershell,bash,script",
    scope: "command" as const,
    action: "approval" as const,
    priority: 1000,
    isActive: true,
  },
  {
    id: `base-files-${ownerId}`,
    ownerId,
    title: "تعديل الملفات الحساسة يحتاج موافقة",
    description: "يتطلب الحذف أو التعديل أو النقل تأكيداً واضحاً قبل إرسال الطلب إلى عميل سطح المكتب.",
    matchTerms: "حذف,امسح,تعديل ملف,انقل ملف,delete,remove,modify file",
    scope: "file_change" as const,
    action: "approval" as const,
    priority: 950,
    isActive: true,
  },
  {
    id: `base-sharing-${ownerId}`,
    ownerId,
    title: "مشاركة البيانات تحتاج موافقة",
    description: "لا تُرسل الملفات أو البيانات إلى أي وجهة خارجية دون قبول المالك.",
    matchTerms: "مشاركة,أرسل,ارفع,share,send,upload,publish",
    scope: "data_share" as const,
    action: "approval" as const,
    priority: 900,
    isActive: true,
  },
];

export async function ensureHarbDefaults(ownerId: number) {
  const db = await getDb();
  if (!db) return;
  for (const rule of defaultRules(ownerId)) {
    await db.insert(ownerRules).values(rule).onDuplicateKeyUpdate({ set: { updatedAt: new Date() } });
  }
}

export async function listRules(ownerId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(ownerRules).where(eq(ownerRules.ownerId, ownerId)).orderBy(desc(ownerRules.priority));
}

export async function createRule(ownerId: number, values: Omit<OwnerRule, "id" | "ownerId" | "createdAt" | "updatedAt">) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  const record = { id: nanoid(), ownerId, ...values };
  await db.insert(ownerRules).values(record);
  return record;
}

export async function updateRule(ownerId: number, id: string, values: Partial<Omit<OwnerRule, "id" | "ownerId" | "createdAt" | "updatedAt">>) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  await db.update(ownerRules).set({ ...values, updatedAt: new Date() }).where(and(eq(ownerRules.id, id), eq(ownerRules.ownerId, ownerId)));
}

export async function listTasks(ownerId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(harbTasks).where(eq(harbTasks.ownerId, ownerId)).orderBy(desc(harbTasks.createdAt)).limit(12);
}

export async function createTask(ownerId: number, values: Omit<typeof harbTasks.$inferInsert, "id" | "ownerId" | "createdAt">) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  const record = { id: nanoid(), ownerId, ...values };
  await db.insert(harbTasks).values(record);
  return record;
}

export async function updateTask(ownerId: number, id: string, values: Partial<Omit<typeof harbTasks.$inferInsert, "id" | "ownerId" | "createdAt">>) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  await db.update(harbTasks).set(values).where(and(eq(harbTasks.id, id), eq(harbTasks.ownerId, ownerId)));
}

export async function createApproval(ownerId: number, values: Omit<typeof approvals.$inferInsert, "id" | "ownerId" | "createdAt">) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  const record = { id: nanoid(), ownerId, ...values };
  await db.insert(approvals).values(record);
  return record;
}

export async function listApprovals(ownerId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(approvals).where(eq(approvals.ownerId, ownerId)).orderBy(desc(approvals.createdAt)).limit(20);
}

export async function resolveApproval(ownerId: number, id: string, status: "approved" | "rejected") {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  await db.update(approvals).set({ status, resolvedAt: new Date() }).where(and(eq(approvals.id, id), eq(approvals.ownerId, ownerId)));
}

export async function listFiles(ownerId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(workspaceFiles).where(eq(workspaceFiles.ownerId, ownerId)).orderBy(desc(workspaceFiles.createdAt)).limit(50);
}

export async function createWorkspaceFile(ownerId: number, values: Omit<typeof workspaceFiles.$inferInsert, "id" | "ownerId" | "createdAt">) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  const record = { id: nanoid(), ownerId, ...values };
  await db.insert(workspaceFiles).values(record);
  return record;
}

export async function updateWorkspaceFile(ownerId: number, id: string, values: Partial<Pick<typeof workspaceFiles.$inferInsert, "classification" | "permissionState" | "approvalState" | "lastApprovalAt">>) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  await db.update(workspaceFiles).set(values).where(and(eq(workspaceFiles.id, id), eq(workspaceFiles.ownerId, ownerId)));
}

export async function requestFileAccessApproval(ownerId: number, fileId: string, action: "share" | "modify" | "delete") {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  const record = { id: nanoid(), ownerId, fileId, action, status: "requested" as const, resolvedAt: null };
  await db.insert(fileAccessApprovals).values(record);
  await updateWorkspaceFile(ownerId, fileId, { permissionState: "approval_required", approvalState: "pending", lastApprovalAt: null });
  return record;
}

export async function listFileAccessApprovals(ownerId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(fileAccessApprovals).where(eq(fileAccessApprovals.ownerId, ownerId)).orderBy(desc(fileAccessApprovals.requestedAt));
}

export async function resolveFileAccessApproval(ownerId: number, id: string, status: "approved" | "rejected") {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  const result = await db.select().from(fileAccessApprovals).where(and(eq(fileAccessApprovals.id, id), eq(fileAccessApprovals.ownerId, ownerId))).limit(1);
  const approval = result[0];
  if (!approval) throw new Error("طلب موافقة الملف غير موجود.");
  const now = new Date();
  await db.update(fileAccessApprovals).set({ status, resolvedAt: now }).where(and(eq(fileAccessApprovals.id, id), eq(fileAccessApprovals.ownerId, ownerId)));
  await updateWorkspaceFile(ownerId, approval.fileId, {
    permissionState: status === "approved" ? "allowed" : "restricted",
    approvalState: status,
    lastApprovalAt: now,
  });
  return approval;
}

export async function createAuditEntry(ownerId: number, values: Omit<typeof auditEntries.$inferInsert, "id" | "ownerId" | "createdAt">) {
  const db = await getDb();
  if (!db) return;
  await db.insert(auditEntries).values({ id: nanoid(), ownerId, ...values });
}

export async function listCyberAssets(ownerId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(cyberAssets).where(eq(cyberAssets.ownerId, ownerId)).orderBy(desc(cyberAssets.createdAt));
}

export async function ensureCyberOwnerPolicy(ownerId: number) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  const existing = await db.select().from(cyberOwnerPolicies).where(eq(cyberOwnerPolicies.ownerId, ownerId)).limit(1);
  if (existing[0]) return existing[0];
  const policy = {
    id: nanoid(),
    ownerId,
    analysisAction: "allow" as const,
    passiveAction: "allow" as const,
    activeAction: "approval" as const,
    localAction: "approval" as const,
    requireAuthorizationAcknowledgment: true,
  };
  await db.insert(cyberOwnerPolicies).values(policy);
  return policy;
}

export async function updateCyberOwnerPolicy(ownerId: number, values: Partial<Pick<typeof cyberOwnerPolicies.$inferInsert, "analysisAction" | "passiveAction" | "activeAction" | "localAction" | "requireAuthorizationAcknowledgment">>) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  await ensureCyberOwnerPolicy(ownerId);
  await db.update(cyberOwnerPolicies).set(values).where(eq(cyberOwnerPolicies.ownerId, ownerId));
  return ensureCyberOwnerPolicy(ownerId);
}

export async function getCyberAsset(ownerId: number, id: string) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  const result = await db.select().from(cyberAssets).where(and(eq(cyberAssets.ownerId, ownerId), eq(cyberAssets.id, id))).limit(1);
  return result[0];
}

export async function createCyberAsset(ownerId: number, values: Omit<typeof cyberAssets.$inferInsert, "id" | "ownerId" | "createdAt" | "updatedAt">) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  const record = { id: nanoid(), ownerId, ...values };
  await db.insert(cyberAssets).values(record);
  return record;
}

export async function listCyberOperations(ownerId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(cyberOperations).where(eq(cyberOperations.ownerId, ownerId)).orderBy(desc(cyberOperations.createdAt)).limit(50);
}

export async function createCyberOperation(ownerId: number, values: Omit<typeof cyberOperations.$inferInsert, "id" | "ownerId" | "createdAt">) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  const record = { id: nanoid(), ownerId, ...values };
  await db.insert(cyberOperations).values(record);
  return record;
}

export async function getCyberOperation(ownerId: number, id: string) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  const result = await db.select().from(cyberOperations).where(and(eq(cyberOperations.ownerId, ownerId), eq(cyberOperations.id, id))).limit(1);
  return result[0];
}

export async function updateCyberOperation(ownerId: number, id: string, values: Partial<Pick<typeof cyberOperations.$inferInsert, "status" | "approvalId" | "completedAt" | "resultSummary">>) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  await db.update(cyberOperations).set(values).where(and(eq(cyberOperations.ownerId, ownerId), eq(cyberOperations.id, id)));
}

export async function listModelObjectives(ownerId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(modelObjectives).where(eq(modelObjectives.ownerId, ownerId)).orderBy(desc(modelObjectives.createdAt));
}

export async function createModelObjective(ownerId: number, values: Omit<typeof modelObjectives.$inferInsert, "id" | "ownerId" | "createdAt" | "updatedAt">) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  const record = { id: nanoid(), ownerId, ...values };
  await db.insert(modelObjectives).values(record);
  return record;
}

export async function listKnowledgeCollections(ownerId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(knowledgeCollections).where(eq(knowledgeCollections.ownerId, ownerId)).orderBy(desc(knowledgeCollections.createdAt));
}

export async function createKnowledgeCollection(ownerId: number, values: Omit<typeof knowledgeCollections.$inferInsert, "id" | "ownerId" | "createdAt" | "updatedAt">) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  const record = { id: nanoid(), ownerId, ...values };
  await db.insert(knowledgeCollections).values(record);
  return record;
}

export async function listKnowledgeSources(ownerId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(knowledgeSources).where(eq(knowledgeSources.ownerId, ownerId)).orderBy(desc(knowledgeSources.createdAt));
}

export async function registerKnowledgeSource(ownerId: number, values: Omit<typeof knowledgeSources.$inferInsert, "id" | "ownerId" | "createdAt" | "indexedAt">) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  const record = { id: nanoid(), ownerId, ...values };
  await db.insert(knowledgeSources).values(record);
  return record;
}

export async function getKnowledgeSource(ownerId: number, id: string) {
  const db = await getDb();
  if (!db) return undefined;
  const records = await db.select().from(knowledgeSources).where(and(eq(knowledgeSources.ownerId, ownerId), eq(knowledgeSources.id, id))).limit(1);
  return records[0];
}

export async function updateKnowledgeSource(ownerId: number, id: string, values: Partial<Pick<typeof knowledgeSources.$inferInsert, "indexingStatus" | "chunkCount" | "indexedAt">>) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  await db.update(knowledgeSources).set(values).where(and(eq(knowledgeSources.ownerId, ownerId), eq(knowledgeSources.id, id)));
}

export async function replaceKnowledgeChunks(ownerId: number, sourceId: string, collectionId: string, chunks: Array<{ excerpt: string; contentHash: string }>) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  await db.delete(knowledgeChunks).where(and(eq(knowledgeChunks.ownerId, ownerId), eq(knowledgeChunks.sourceId, sourceId)));
  if (!chunks.length) return;
  await db.insert(knowledgeChunks).values(chunks.map((chunk, chunkIndex) => ({ id: nanoid(), ownerId, sourceId, collectionId, chunkIndex, excerpt: chunk.excerpt, contentHash: chunk.contentHash })));
}

export async function searchKnowledgeChunks(ownerId: number, query: string, collectionId?: string, limit = 4) {
  const db = await getDb();
  if (!db) return [];
  const rows = collectionId
    ? await db.select().from(knowledgeChunks).where(and(eq(knowledgeChunks.ownerId, ownerId), eq(knowledgeChunks.collectionId, collectionId))).limit(500)
    : await db.select().from(knowledgeChunks).where(eq(knowledgeChunks.ownerId, ownerId)).limit(500);
  const tokens = query.toLowerCase().split(/[^\w\u0600-\u06FF-]+/).filter(token => token.length >= 3).slice(0, 20);
  return rows.map(row => ({ ...row, score: tokens.reduce((score, token) => score + (row.excerpt.toLowerCase().includes(token) ? 1 : 0), 0) })).filter(row => row.score > 0).sort((a, b) => b.score - a.score).slice(0, limit);
}

export async function listModelEvaluations(ownerId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(modelEvaluations).where(eq(modelEvaluations.ownerId, ownerId)).orderBy(desc(modelEvaluations.createdAt));
}

export async function createModelEvaluation(ownerId: number, values: Omit<typeof modelEvaluations.$inferInsert, "id" | "ownerId" | "createdAt" | "completedAt">) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  const record = { id: nanoid(), ownerId, ...values };
  await db.insert(modelEvaluations).values(record);
  return record;
}

export async function completeModelEvaluation(ownerId: number, id: string, values: Pick<typeof modelEvaluations.$inferInsert, "sampleCount" | "passedCount" | "score" | "notes">) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  const completedAt = new Date();
  await db.update(modelEvaluations).set({ ...values, status: "completed", completedAt }).where(and(eq(modelEvaluations.ownerId, ownerId), eq(modelEvaluations.id, id)));
  return { id, ownerId, ...values, status: "completed" as const, completedAt };
}

export async function getBaseModelSelection(ownerId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(baseModelSelections).where(eq(baseModelSelections.ownerId, ownerId)).limit(1);
  return rows[0];
}

export async function isBaseModelSelectionStoreReady() {
  const db = await getDb();
  if (!db) return false;
  try {
    await db.select({ id: baseModelSelections.id }).from(baseModelSelections).limit(1);
    return true;
  } catch {
    return false;
  }
}

export async function saveBaseModelSelection(ownerId: number, values: Omit<typeof baseModelSelections.$inferInsert, "id" | "ownerId" | "createdAt" | "updatedAt">) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  const existing = await getBaseModelSelection(ownerId);
  if (existing) {
    await db.update(baseModelSelections).set(values).where(eq(baseModelSelections.ownerId, ownerId));
    return { ...existing, ...values };
  }
  const record = { id: nanoid(), ownerId, ...values };
  await db.insert(baseModelSelections).values(record);
  return record;
}

export async function approveBaseModelSelection(ownerId: number) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  const existing = await getBaseModelSelection(ownerId);
  if (!existing) throw new Error("لا توجد مسودة اختيار نموذج لاعتمادها.");
  const approvedAt = new Date();
  await db.update(baseModelSelections).set({ status: "approved", approvedAt }).where(eq(baseModelSelections.ownerId, ownerId));
  return { ...existing, status: "approved" as const, approvedAt };
}

export async function listConversations(ownerId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(conversations).where(eq(conversations.ownerId, ownerId)).orderBy(desc(conversations.updatedAt)).limit(40);
}

export async function getConversation(ownerId: number, id: string) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(conversations).where(and(eq(conversations.ownerId, ownerId), eq(conversations.id, id))).limit(1);
  return rows[0];
}

export async function createConversation(ownerId: number, values: Omit<typeof conversations.$inferInsert, "id" | "ownerId" | "createdAt" | "updatedAt">) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  const record = { id: nanoid(), ownerId, ...values };
  await db.insert(conversations).values(record);
  return record;
}

export async function updateConversation(ownerId: number, id: string, values: Partial<Omit<typeof conversations.$inferInsert, "id" | "ownerId" | "createdAt" | "updatedAt">>) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  await db.update(conversations).set({ ...values, updatedAt: new Date() }).where(and(eq(conversations.ownerId, ownerId), eq(conversations.id, id)));
}

export async function listConversationMessages(ownerId: number, conversationId: string) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(conversationMessages).where(and(eq(conversationMessages.ownerId, ownerId), eq(conversationMessages.conversationId, conversationId))).orderBy(asc(conversationMessages.createdAt)).limit(120);
}

export async function createConversationMessage(ownerId: number, values: Omit<typeof conversationMessages.$inferInsert, "id" | "ownerId" | "createdAt">) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  const record = { id: nanoid(), ownerId, ...values };
  await db.insert(conversationMessages).values(record);
  return record;
}

export async function listMessageFeedback(ownerId: number, messageIds: string[]) {
  const db = await getDb();
  if (!db || !messageIds.length) return [];
  const feedback = await db.select().from(messageFeedback).where(eq(messageFeedback.ownerId, ownerId)).orderBy(desc(messageFeedback.updatedAt)).limit(300);
  return feedback.filter(item => messageIds.includes(item.messageId));
}

export async function upsertMessageFeedback(ownerId: number, messageId: string, rating: "up" | "down", note: string | null) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  const rows = await db.select().from(messageFeedback).where(and(eq(messageFeedback.ownerId, ownerId), eq(messageFeedback.messageId, messageId))).limit(1);
  if (rows[0]) {
    await db.update(messageFeedback).set({ rating, note, updatedAt: new Date() }).where(eq(messageFeedback.id, rows[0].id));
    return { ...rows[0], rating, note, updatedAt: new Date() };
  }
  const record = { id: nanoid(), ownerId, messageId, rating, note };
  await db.insert(messageFeedback).values(record);
  return record;
}

export async function createBenchmarkCase(ownerId: number, values: Omit<typeof benchmarkCases.$inferInsert, "id" | "ownerId" | "createdAt" | "updatedAt">) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  const record = { id: nanoid(), ownerId, ...values };
  await db.insert(benchmarkCases).values(record);
  return record;
}

export async function listBenchmarkCases(ownerId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(benchmarkCases).where(eq(benchmarkCases.ownerId, ownerId)).orderBy(desc(benchmarkCases.updatedAt)).limit(80);
}

export async function createBenchmarkRun(ownerId: number, values: Omit<typeof benchmarkRuns.$inferInsert, "id" | "ownerId" | "createdAt" | "completedAt">) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  const record = { id: nanoid(), ownerId, ...values, completedAt: null };
  await db.insert(benchmarkRuns).values(record);
  return record;
}

export async function completeBenchmarkRun(ownerId: number, id: string, status: "completed" | "failed") {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  await db.update(benchmarkRuns).set({ status, completedAt: new Date() }).where(and(eq(benchmarkRuns.ownerId, ownerId), eq(benchmarkRuns.id, id)));
}

export async function listBenchmarkRuns(ownerId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(benchmarkRuns).where(eq(benchmarkRuns.ownerId, ownerId)).orderBy(desc(benchmarkRuns.createdAt)).limit(24);
}

export async function createBenchmarkResult(ownerId: number, values: Omit<typeof benchmarkResults.$inferInsert, "id" | "ownerId" | "createdAt">) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  const record = { id: nanoid(), ownerId, ...values };
  await db.insert(benchmarkResults).values(record);
  return record;
}

export async function listBenchmarkResults(ownerId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(benchmarkResults).where(eq(benchmarkResults.ownerId, ownerId)).orderBy(desc(benchmarkResults.createdAt)).limit(200);
}

export async function reviewBenchmarkResult(ownerId: number, id: string, reviewerScore: number, reviewerNotes: string | null) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  await db.update(benchmarkResults).set({ reviewerScore, reviewerNotes, reviewedAt: new Date() }).where(and(eq(benchmarkResults.ownerId, ownerId), eq(benchmarkResults.id, id)));
}

export async function listAuditEntries(ownerId: number, search = "") {
  const db = await getDb();
  if (!db) return [];
  const entries = await db.select().from(auditEntries).where(eq(auditEntries.ownerId, ownerId)).orderBy(desc(auditEntries.createdAt)).limit(100);
  const normalized = search.trim().toLocaleLowerCase();
  if (!normalized) return entries;
  return entries.filter(entry => `${entry.eventType} ${entry.summary} ${entry.outcome}`.toLocaleLowerCase().includes(normalized));
}

export async function listDesktopAgents(ownerId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select({
    id: desktopAgents.id,
    ownerId: desktopAgents.ownerId,
    name: desktopAgents.name,
    operatingSystem: desktopAgents.operatingSystem,
    status: desktopAgents.status,
    scopes: desktopAgents.scopes,
    lastSeenAt: desktopAgents.lastSeenAt,
    createdAt: desktopAgents.createdAt,
  }).from(desktopAgents).where(eq(desktopAgents.ownerId, ownerId)).orderBy(desc(desktopAgents.lastSeenAt));
}

export async function getDesktopAgentById(id: string) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  const result = await db.select().from(desktopAgents).where(eq(desktopAgents.id, id)).limit(1);
  return result[0];
}

export async function createDesktopPairing(ownerId: number, codeHash: string, expiresAt: Date) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  const record = { id: nanoid(), ownerId, codeHash, expiresAt, consumedAt: null };
  await db.insert(desktopPairings).values(record);
  return record;
}

export async function findDesktopPairing(codeHash: string) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  const result = await db.select().from(desktopPairings).where(eq(desktopPairings.codeHash, codeHash)).limit(1);
  return result[0];
}

export async function consumeDesktopPairing(ownerId: number, id: string) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  await db.update(desktopPairings).set({ consumedAt: new Date() }).where(and(eq(desktopPairings.id, id), eq(desktopPairings.ownerId, ownerId)));
}

export async function createDesktopAgent(ownerId: number, values: Omit<typeof desktopAgents.$inferInsert, "id" | "ownerId" | "createdAt">) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  const record = { id: nanoid(), ownerId, ...values };
  await db.insert(desktopAgents).values(record);
  return record;
}

export async function updateDesktopAgent(ownerId: number, id: string, values: Partial<Pick<typeof desktopAgents.$inferInsert, "scopes" | "status" | "lastSeenAt">>) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  await db.update(desktopAgents).set(values).where(and(eq(desktopAgents.id, id), eq(desktopAgents.ownerId, ownerId)));
}
