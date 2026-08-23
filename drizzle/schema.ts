import { boolean, int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const ownerRules = mysqlTable("owner_rules", {
  id: varchar("id", { length: 48 }).primaryKey(),
  ownerId: int("ownerId").notNull(),
  title: varchar("title", { length: 160 }).notNull(),
  description: text("description"),
  matchTerms: text("matchTerms").notNull(),
  scope: mysqlEnum("scope", ["all", "general", "command", "file_change", "data_share"]).default("all").notNull(),
  action: mysqlEnum("action", ["allow", "approval", "deny"]).default("approval").notNull(),
  priority: int("priority").default(100).notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const harbTasks = mysqlTable("harb_tasks", {
  id: varchar("id", { length: 48 }).primaryKey(),
  ownerId: int("ownerId").notNull(),
  request: text("request").notNull(),
  taskType: varchar("taskType", { length: 32 }).notNull(),
  status: mysqlEnum("status", ["queued", "needs_approval", "blocked", "completed", "failed"]).notNull(),
  decision: varchar("decision", { length: 32 }).notNull(),
  decisionReason: text("decisionReason").notNull(),
  response: text("response"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  completedAt: timestamp("completedAt"),
});

export const approvals = mysqlTable("approvals", {
  id: varchar("id", { length: 48 }).primaryKey(),
  ownerId: int("ownerId").notNull(),
  taskId: varchar("taskId", { length: 48 }).notNull(),
  action: varchar("action", { length: 64 }).notNull(),
  riskLevel: mysqlEnum("riskLevel", ["low", "medium", "high"]).default("high").notNull(),
  status: mysqlEnum("status", ["requested", "approved", "rejected"]).default("requested").notNull(),
  summary: text("summary").notNull(),
  expiresAt: timestamp("expiresAt"),
  resolvedAt: timestamp("resolvedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const workspaceFiles = mysqlTable("workspace_files", {
  id: varchar("id", { length: 48 }).primaryKey(),
  ownerId: int("ownerId").notNull(),
  name: varchar("name", { length: 320 }).notNull(),
  mimeType: varchar("mimeType", { length: 160 }).notNull(),
  size: int("size").notNull(),
  storageKey: varchar("storageKey", { length: 700 }).notNull(),
  storageUrl: varchar("storageUrl", { length: 1024 }).notNull(),
  classification: mysqlEnum("classification", ["private", "restricted", "shared"]).default("private").notNull(),
  permissionState: mysqlEnum("permissionState", ["allowed", "restricted", "approval_required"]).default("allowed").notNull(),
  approvalState: mysqlEnum("approvalState", ["not_required", "pending", "approved", "rejected"]).default("not_required").notNull(),
  lastApprovalAt: timestamp("lastApprovalAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const fileAccessApprovals = mysqlTable("file_access_approvals", {
  id: varchar("id", { length: 48 }).primaryKey(),
  ownerId: int("ownerId").notNull(),
  fileId: varchar("fileId", { length: 48 }).notNull(),
  action: mysqlEnum("action", ["share", "modify", "delete"]).notNull(),
  status: mysqlEnum("status", ["requested", "approved", "rejected"]).default("requested").notNull(),
  requestedAt: timestamp("requestedAt").defaultNow().notNull(),
  resolvedAt: timestamp("resolvedAt"),
});

export const cyberAssets = mysqlTable("cyber_assets", {
  id: varchar("id", { length: 48 }).primaryKey(),
  ownerId: int("ownerId").notNull(),
  name: varchar("name", { length: 160 }).notNull(),
  assetValue: varchar("assetValue", { length: 512 }).notNull(),
  assetType: mysqlEnum("assetType", ["domain", "ip", "web_app", "api", "host", "cloud", "repository", "local_device"]).notNull(),
  environment: mysqlEnum("environment", ["production", "staging", "development", "lab"]).default("lab").notNull(),
  authorizationRef: varchar("authorizationRef", { length: 320 }).notNull(),
  permittedScope: text("permittedScope").notNull(),
  status: mysqlEnum("status", ["authorized", "suspended", "expired"]).default("authorized").notNull(),
  validUntil: timestamp("validUntil"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const cyberOwnerPolicies = mysqlTable("cyber_owner_policies", {
  id: varchar("id", { length: 48 }).primaryKey(),
  ownerId: int("ownerId").notNull().unique(),
  analysisAction: mysqlEnum("analysisAction", ["allow", "approval", "deny"]).default("allow").notNull(),
  passiveAction: mysqlEnum("passiveAction", ["allow", "approval", "deny"]).default("allow").notNull(),
  activeAction: mysqlEnum("activeAction", ["allow", "approval", "deny"]).default("approval").notNull(),
  localAction: mysqlEnum("localAction", ["allow", "approval", "deny"]).default("approval").notNull(),
  requireAuthorizationAcknowledgment: boolean("requireAuthorizationAcknowledgment").default(true).notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const cyberOperations = mysqlTable("cyber_operations", {
  id: varchar("id", { length: 48 }).primaryKey(),
  ownerId: int("ownerId").notNull(),
  assetId: varchar("assetId", { length: 48 }).notNull(),
  operationType: mysqlEnum("operationType", ["analysis", "passive_validation", "active_test", "local_execution"]).notNull(),
  riskLevel: mysqlEnum("riskLevel", ["low", "medium", "high"]).notNull(),
  decision: mysqlEnum("decision", ["allow", "approval", "deny"]).notNull(),
  status: mysqlEnum("status", ["planned", "awaiting_approval", "blocked", "approved", "completed", "failed"]).notNull(),
  requestSummary: text("requestSummary").notNull(),
  decisionReason: text("decisionReason").notNull(),
  plan: text("plan").notNull(),
  approvalId: varchar("approvalId", { length: 48 }),
  authorizationAcknowledgedAt: timestamp("authorizationAcknowledgedAt"),
  resultSummary: text("resultSummary"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  completedAt: timestamp("completedAt"),
});

export const modelObjectives = mysqlTable("model_objectives", {
  id: varchar("id", { length: 48 }).primaryKey(),
  ownerId: int("ownerId").notNull(),
  title: varchar("title", { length: 160 }).notNull(),
  category: mysqlEnum("category", ["cyber_analysis", "authorization_decisions", "document_analysis", "code_review", "custom"]).notNull(),
  description: text("description").notNull(),
  successCriteria: text("successCriteria").notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const knowledgeCollections = mysqlTable("knowledge_collections", {
  id: varchar("id", { length: 48 }).primaryKey(),
  ownerId: int("ownerId").notNull(),
  name: varchar("name", { length: 160 }).notNull(),
  description: text("description").notNull(),
  classification: mysqlEnum("classification", ["private", "restricted", "shared"]).default("private").notNull(),
  status: mysqlEnum("status", ["draft", "ready", "archived"]).default("draft").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const knowledgeSources = mysqlTable("knowledge_sources", {
  id: varchar("id", { length: 48 }).primaryKey(),
  ownerId: int("ownerId").notNull(),
  collectionId: varchar("collectionId", { length: 48 }).notNull(),
  workspaceFileId: varchar("workspaceFileId", { length: 48 }),
  sourceType: mysqlEnum("sourceType", ["workspace_file", "public_reference"]).default("workspace_file").notNull(),
  name: varchar("name", { length: 320 }).notNull(),
  storageKey: varchar("storageKey", { length: 700 }),
  sourceUrl: varchar("sourceUrl", { length: 1024 }),
  licenseNote: varchar("licenseNote", { length: 1000 }),
  mimeType: varchar("mimeType", { length: 160 }),
  size: int("size"),
  indexingStatus: mysqlEnum("indexingStatus", ["registered", "ready", "unsupported", "failed"]).default("registered").notNull(),
  chunkCount: int("chunkCount").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  indexedAt: timestamp("indexedAt"),
});

export const knowledgeChunks = mysqlTable("knowledge_chunks", {
  id: varchar("id", { length: 48 }).primaryKey(),
  ownerId: int("ownerId").notNull(),
  collectionId: varchar("collectionId", { length: 48 }).notNull(),
  sourceId: varchar("sourceId", { length: 48 }).notNull(),
  chunkIndex: int("chunkIndex").notNull(),
  excerpt: text("excerpt").notNull(),
  contentHash: varchar("contentHash", { length: 64 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const modelEvaluations = mysqlTable("model_evaluations", {
  id: varchar("id", { length: 48 }).primaryKey(),
  ownerId: int("ownerId").notNull(),
  objectiveId: varchar("objectiveId", { length: 48 }).notNull(),
  collectionId: varchar("collectionId", { length: 48 }),
  modelId: varchar("modelId", { length: 160 }).notNull(),
  status: mysqlEnum("status", ["draft", "ready", "running", "completed", "failed"]).default("draft").notNull(),
  sampleCount: int("sampleCount").default(0).notNull(),
  passedCount: int("passedCount").default(0).notNull(),
  score: int("score"),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  completedAt: timestamp("completedAt"),
});

export const baseModelSelections = mysqlTable("base_model_selections", {
  id: varchar("id", { length: 48 }).primaryKey(),
  ownerId: int("ownerId").notNull().unique(),
  primaryModelId: varchar("primaryModelId", { length: 160 }).notNull(),
  fallbackModelId: varchar("fallbackModelId", { length: 160 }),
  status: mysqlEnum("status", ["draft", "approved", "superseded"]).default("draft").notNull(),
  rationale: text("rationale").notNull(),
  primaryEvaluationId: varchar("primaryEvaluationId", { length: 48 }),
  fallbackEvaluationId: varchar("fallbackEvaluationId", { length: 48 }),
  catalogObservedAt: timestamp("catalogObservedAt").notNull(),
  approvedAt: timestamp("approvedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const auditEntries = mysqlTable("audit_entries", {
  id: varchar("id", { length: 48 }).primaryKey(),
  ownerId: int("ownerId").notNull(),
  eventType: varchar("eventType", { length: 64 }).notNull(),
  requestId: varchar("requestId", { length: 48 }),
  outcome: varchar("outcome", { length: 32 }).notNull(),
  summary: text("summary").notNull(),
  ruleIds: text("ruleIds").notNull(),
  metadata: text("metadata").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const desktopAgents = mysqlTable("desktop_agents", {
  id: varchar("id", { length: 48 }).primaryKey(),
  ownerId: int("ownerId").notNull(),
  name: varchar("name", { length: 160 }).notNull(),
  operatingSystem: mysqlEnum("operatingSystem", ["windows", "kali_linux"]).notNull(),
  status: mysqlEnum("status", ["offline", "online", "approval_required"]).default("offline").notNull(),
  scopes: text("scopes").notNull(),
  agentTokenHash: varchar("agentTokenHash", { length: 128 }).notNull(),
  lastSeenAt: timestamp("lastSeenAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const desktopPairings = mysqlTable("desktop_pairings", {
  id: varchar("id", { length: 48 }).primaryKey(),
  ownerId: int("ownerId").notNull(),
  codeHash: varchar("codeHash", { length: 128 }).notNull().unique(),
  expiresAt: timestamp("expiresAt").notNull(),
  consumedAt: timestamp("consumedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type OwnerRule = typeof ownerRules.$inferSelect;
export type HarbTask = typeof harbTasks.$inferSelect;
export type Approval = typeof approvals.$inferSelect;
export type WorkspaceFile = typeof workspaceFiles.$inferSelect;
export type FileAccessApproval = typeof fileAccessApprovals.$inferSelect;
export type CyberAsset = typeof cyberAssets.$inferSelect;
export type CyberOwnerPolicy = typeof cyberOwnerPolicies.$inferSelect;
export type CyberOperation = typeof cyberOperations.$inferSelect;
export type ModelObjective = typeof modelObjectives.$inferSelect;
export type KnowledgeCollection = typeof knowledgeCollections.$inferSelect;
export type KnowledgeSource = typeof knowledgeSources.$inferSelect;
export type KnowledgeChunk = typeof knowledgeChunks.$inferSelect;
export type ModelEvaluation = typeof modelEvaluations.$inferSelect;
export type BaseModelSelection = typeof baseModelSelections.$inferSelect;
export type AuditEntry = typeof auditEntries.$inferSelect;
export type DesktopAgent = typeof desktopAgents.$inferSelect;
export type DesktopPairing = typeof desktopPairings.$inferSelect;
