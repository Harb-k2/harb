export type CyberOperationType = "analysis" | "passive_validation" | "active_test" | "local_execution";
export type CyberDecision = "allow" | "approval" | "deny";
export type CyberRisk = "low" | "medium" | "high";

export type CyberAssetPolicy = {
  id: string;
  name: string;
  assetValue: string;
  assetType: string;
  environment: string;
  authorizationRef: string;
  permittedScope: string;
  status: "authorized" | "suspended" | "expired";
  validUntil: Date | null;
};

export type CyberPolicyDecision = {
  decision: CyberDecision;
  riskLevel: CyberRisk;
  reason: string;
  plan: string;
};

export type CyberOwnerPolicyConfig = {
  analysisAction: CyberDecision;
  passiveAction: CyberDecision;
  activeAction: CyberDecision;
  localAction: CyberDecision;
  requireAuthorizationAcknowledgment: boolean;
};

const operationDetails: Record<CyberOperationType, { riskLevel: CyberRisk; plan: string }> = {
  analysis: { riskLevel: "low", plan: "تحليل معلومات وملفات وسجلات مصرّح بها فقط، مع تلخيص الملاحظات والأدلة دون تنفيذ أوامر على الأصل." },
  passive_validation: { riskLevel: "medium", plan: "تحقق غير تدخلي من إعدادات أو آثار مكشوفة ضمن النطاق، دون تغيير الحالة أو محاولة تجاوز أي ضوابط." },
  active_test: { riskLevel: "high", plan: "إعداد خطة اختبار نشط محصورة بالنطاق والتفويض، ولا يبدأ أي إرسال أو فحص فعلي قبل الموافقة المطلوبة وتأكيد نافذة الاختبار." },
  local_execution: { riskLevel: "high", plan: "إعداد إجراء محلي واضح على جهاز مسجل ومصرح، ولا ينفذ أي أمر أو تغيير قبل تحقق قانون المالك وسجل التنفيذ." },
};

const defaultOwnerPolicy: CyberOwnerPolicyConfig = {
  analysisAction: "allow",
  passiveAction: "allow",
  activeAction: "approval",
  localAction: "approval",
  requireAuthorizationAcknowledgment: true,
};

function ownerActionFor(operationType: CyberOperationType, ownerPolicy: CyberOwnerPolicyConfig): CyberDecision {
  if (operationType === "analysis") return ownerPolicy.analysisAction;
  if (operationType === "passive_validation") return ownerPolicy.passiveAction;
  if (operationType === "active_test") return ownerPolicy.activeAction;
  return ownerPolicy.localAction;
}

export function evaluateCyberOperation(asset: CyberAssetPolicy | undefined, operationType: CyberOperationType, configuredPolicy: CyberOwnerPolicyConfig = defaultOwnerPolicy): CyberPolicyDecision {
  const details = operationDetails[operationType];
  if (!asset) return { decision: "deny", riskLevel: details.riskLevel, reason: "الأصل غير موجود في سجل التفويض؛ لا يمكن إنشاء عملية سيبرانية خارجه.", plan: "أضف الأصل والتفويض والنطاق أولاً." };
  if (asset.status !== "authorized") return { decision: "deny", riskLevel: details.riskLevel, reason: "حالة تفويض الأصل ليست نشطة؛ لا يمكن متابعة العملية.", plan: "حدّث التفويض أو أعد تفعيل الأصل قبل الطلب." };
  if (asset.validUntil && asset.validUntil.getTime() <= Date.now()) return { decision: "deny", riskLevel: details.riskLevel, reason: "انتهت مدة التفويض المسجلة لهذا الأصل.", plan: "أضف تفويضاً جديداً قبل متابعة العمل." };

  const ownerDecision = ownerActionFor(operationType, configuredPolicy);
  if (ownerDecision === "deny") return { decision: "deny", riskLevel: details.riskLevel, reason: "قانون المالك السيبراني يحظر هذا النوع من العمليات على جميع الأصول المسجلة.", plan: "عدّل قانون المالك أو اختر مساراً مسموحاً ضمن التفويض." };
  if (ownerDecision === "allow") return { decision: "allow", riskLevel: details.riskLevel, reason: "الأصل ضمن التفويض وقانون المالك يسمح بهذا النوع من العمليات ضمن النطاق المسجل.", plan: details.plan };
  return { decision: "approval", riskLevel: details.riskLevel, reason: "قانون المالك يطلب موافقة صريحة لهذه العملية قبل إحالتها إلى أي منفذ مصرح.", plan: details.plan };
}
