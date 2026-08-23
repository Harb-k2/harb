const SCOPES = ["read_files", "run_programs", "run_commands", "modify_files"];

function canPerform(scopes, operation) {
  const allowed = new Set(scopes ?? []);
  const requiredScope = {
    read_file: "read_files",
    run_program: "run_programs",
    run_command: "run_commands",
    modify_file: "modify_files",
  }[operation];
  return Boolean(requiredScope && allowed.has(requiredScope));
}

function evaluateOwnerPolicy(ownerPolicy, operation) {
  const scope = operation === "modify_file" ? "file_change" : ["run_program", "run_command"].includes(operation) ? "command" : "general";
  const rules = ownerPolicy?.rules ?? [];
  const matching = rules.filter(rule => rule.isActive && (rule.scope === "all" || rule.scope === scope)).sort((a, b) => b.priority - a.priority);
  const action = matching[0]?.action;
  if (action === "deny") return { allowed: false, requiresApproval: false, reason: "قانون المالك يمنع هذه العملية المحلية." };
  if (action === "approval") return { allowed: false, requiresApproval: true, reason: "قانون المالك يتطلب موافقة صريحة قبل هذه العملية." };
  if (operation !== "read_file" && ownerPolicy?.localAction !== "allow") return { allowed: false, requiresApproval: true, reason: "سياسة الإجراءات المحلية تتطلب موافقة المالك قبل التنفيذ." };
  return { allowed: true, requiresApproval: false, reason: "قانون المالك يسمح بالتقييم المحلي ضمن النطاق." };
}

function evaluateLocalOperation({ scopes, operation, explicitUserApproval, ownerPolicy }) {
  if (!canPerform(scopes, operation)) return { allowed: false, reason: "لم يمنح المالك نطاق الصلاحية المطلوب لهذا العميل." };
  const ownerDecision = evaluateOwnerPolicy(ownerPolicy, operation);
  if (!ownerDecision.allowed) return ownerDecision;
  if (!explicitUserApproval) return { allowed: false, reason: "يلزم تأكيد المستخدم المحلي لهذه العملية قبل المتابعة." };
  if (["run_program", "run_command", "modify_file"].includes(operation)) return { allowed: false, requiresApproval: true, reason: "العمليات التنفيذية والتعديل تمر دائماً إلى موافقة المالك ولا تُنفذ تلقائياً في هذا الإصدار." };
  return { allowed: true, reason: "العملية مسموحة ضمن النطاق وبعد تأكيد المستخدم المحلي." };
}

function hasPendingLocalApproval(pendingApprovals, operation) {
  return (pendingApprovals ?? []).some(item => item?.action === `desktop:${operation}`);
}

function evaluateExecutionGate({ scopes, operation, explicitUserApproval, ownerPolicy, approvedTicket }) {
  const policy = evaluateLocalOperation({ scopes, operation, explicitUserApproval, ownerPolicy });
  if (!policy.requiresApproval) return { executable: false, state: "blocked", reason: policy.reason };
  if (!approvedTicket || approvedTicket.action !== `desktop:${operation}`) return { executable: false, state: "awaiting_owner_approval", reason: "لا توجد تذكرة موافقة سارية ومتحقق منها خادمياً لهذا الإجراء المحلي." };
  return { executable: false, state: "executor_disabled", approvalId: approvedTicket.id, reason: "تحققت بوابة التفويض وتذكرة المالك خادمياً، لكن منفذ النظام معطّل افتراضياً في هذا الإصدار ولا يشغّل أوامر أو برامج ولا يعدّل ملفات." };
}

module.exports = { SCOPES, canPerform, evaluateOwnerPolicy, evaluateLocalOperation, hasPendingLocalApproval, evaluateExecutionGate };
