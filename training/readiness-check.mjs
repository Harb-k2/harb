import { readFile } from "node:fs/promises";

const parseArgs = args => Object.fromEntries(args.reduce((pairs, value, index) => value.startsWith("--") ? [...pairs, [value.slice(2), args[index + 1]]] : pairs, []));
const approvedRights = new Set(["license_notice_required", "approved_for_training"]);

export function assessReadiness({ manifest, baselineReport, gpuTarget }) {
  const blockers = [];
  if (!manifest?.reviewedAt || !manifest?.humanReviewer || manifest.humanReviewer === "pending_owner_review") blockers.push("سجل مصادر البيانات لم يراجع ويعتمد من المالك بعد.");
  for (const source of manifest?.sources ?? []) {
    if (!approvedRights.has(source.rightsStatus)) blockers.push(`المصدر ${source.id ?? "unknown"} لا يملك حالة حقوق تسمح بتجربة تدريب.`);
  }
  if (!baselineReport?.results?.length) blockers.push("لا يوجد تقرير خط أساس فعلي محفوظ من حالات اختبار معتمدة.");
  if (!gpuTarget?.provider || !gpuTarget?.approvedBy || !gpuTarget?.storageEncryption || !gpuTarget?.accessControl) blockers.push("هدف GPU المعتمد أو ضوابط التخزين والوصول غير مكتملة.");
  return { ready: blockers.length === 0, blockers };
}

export async function checkReadiness({ manifestPath, baselinePath, gpuTargetPath }) {
  const [manifest, baselineReport, gpuTarget] = await Promise.all([
    readFile(manifestPath, "utf8").then(JSON.parse),
    readFile(baselinePath, "utf8").then(JSON.parse),
    readFile(gpuTargetPath, "utf8").then(JSON.parse),
  ]);
  return assessReadiness({ manifest, baselineReport, gpuTarget });
}

if (process.argv[1] && new URL(`file://${process.argv[1]}`).href === import.meta.url) {
  const args = parseArgs(process.argv.slice(2));
  if (!args.manifest || !args.baseline || !args.gpu) throw new Error("الاستخدام: node readiness-check.mjs --manifest <manifest.json> --baseline <baseline.json> --gpu <gpu-target.json>");
  const result = await checkReadiness({ manifestPath: args.manifest, baselinePath: args.baseline, gpuTargetPath: args.gpu });
  console.log(JSON.stringify(result, null, 2));
  if (!result.ready) process.exitCode = 2;
}
