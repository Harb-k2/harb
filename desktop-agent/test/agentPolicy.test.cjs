const test = require("node:test");
const assert = require("node:assert/strict");
const { evaluateLocalOperation, hasPendingLocalApproval } = require("../src/agentPolicy.cjs");

test("يرفض العميل القراءة من دون نطاق read_files", () => {
  const result = evaluateLocalOperation({ scopes: [], operation: "read_file", explicitUserApproval: true });
  assert.equal(result.allowed, false);
});

test("يسمح بمعاينة الملف بعد النطاق والتأكيد المحلي", () => {
  const result = evaluateLocalOperation({ scopes: ["read_files"], operation: "read_file", explicitUserApproval: true });
  assert.equal(result.allowed, true);
});

test("يحوّل التشغيل المحلي إلى مسار موافقة حتى مع النطاق", () => {
  const result = evaluateLocalOperation({ scopes: ["run_commands"], operation: "run_command", explicitUserApproval: true });
  assert.equal(result.allowed, false);
  assert.equal(result.requiresApproval, true);
});

test("يحجب قانون المالك المحلي العملية حتى عند وجود النطاق", () => {
  const result = evaluateLocalOperation({ scopes: ["read_files"], operation: "read_file", explicitUserApproval: true, ownerPolicy: { localAction: "allow", rules: [{ isActive: true, scope: "general", action: "deny", priority: 100 }] } });
  assert.equal(result.allowed, false);
  assert.match(result.reason, /قانون المالك/);
});

test("يطلب قانون المالك موافقة قبل الإجراء المحلي التنفيذي", () => {
  const result = evaluateLocalOperation({ scopes: ["run_commands"], operation: "run_command", explicitUserApproval: true, ownerPolicy: { localAction: "approval", rules: [] } });
  assert.equal(result.allowed, false);
  assert.equal(result.requiresApproval, true);
});

test("يحوّل كل نوع تنفيذي مفوض إلى موافقة قبل إنشاء أي طلب خادمي", () => {
  const cases = [["run_program", "run_programs"], ["run_command", "run_commands"], ["modify_file", "modify_files"]];
  for (const [operation, scope] of cases) {
    const result = evaluateLocalOperation({ scopes: [scope], operation, explicitUserApproval: true, ownerPolicy: { localAction: "allow", rules: [] } });
    assert.equal(result.allowed, false, operation);
    assert.equal(result.requiresApproval, true, operation);
  }
});

test("يمنع إنشاء طلب تنفيذي مكرر عند وجود تذكرة معلقة للعميل", () => {
  assert.equal(hasPendingLocalApproval([{ action: "desktop:run_command" }], "run_command"), true);
  assert.equal(hasPendingLocalApproval([{ action: "desktop:run_command" }], "modify_file"), false);
});
