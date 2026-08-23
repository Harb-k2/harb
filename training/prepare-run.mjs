import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { validateRecords } from "./validate-dataset.mjs";

const sha256 = value => createHash("sha256").update(value).digest("hex");
const parseArgs = args => Object.fromEntries(args.reduce((pairs, value, index) => value.startsWith("--") ? [...pairs, [value.slice(2), args[index + 1]]] : pairs, []));

export async function prepareTrainingRun({ recordsPath, outputPath, baseModel, method, ownerApprovalRef, safetyGateVersion = "harb-owner-law-v1" }) {
  const raw = await readFile(recordsPath, "utf8");
  const records = raw.split(/\r?\n/).filter(Boolean).map((line, index) => {
    try { return JSON.parse(line); } catch { throw new Error(`السطر ${index + 1} ليس JSON صالحاً.`); }
  });
  const validation = validateRecords(records);
  if (!validation.valid) throw new Error(`رفض فاحص بيانات Harb السجل:\n${validation.errors.join("\n")}`);
  const splits = Object.fromEntries(["train", "validation", "test"].map(split => [split, records.filter(record => record.split === split)]));
  if (Object.values(splits).some(recordsForSplit => recordsForSplit.length === 0)) throw new Error("يلزم وجود سجل واحد على الأقل في كل من التدريب والتحقق والاختبار.");
  const metadata = {
    runId: `harb-${new Date().toISOString().replace(/[:.]/g, "-")}`,
    baseModel,
    method,
    datasetManifestHash: sha256(await readFile(resolve("training/data-manifest.json"), "utf8")),
    trainingDataHash: sha256(JSON.stringify(splits.train)),
    validationDataHash: sha256(JSON.stringify(splits.validation)),
    testDataHash: sha256(JSON.stringify(splits.test)),
    ownerApprovalRef,
    safetyGateVersion,
    status: "planned",
    recordCounts: Object.fromEntries(Object.entries(splits).map(([split, entries]) => [split, entries.length])),
    preparedAt: new Date().toISOString(),
  };
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(metadata, null, 2)}\n`, "utf8");
  return metadata;
}

if (process.argv[1] && new URL(`file://${process.argv[1]}`).href === import.meta.url) {
  const args = parseArgs(process.argv.slice(2));
  if (!args.records || !args.output || !args.model || !args.method || !args.approval) throw new Error("الاستخدام: node prepare-run.mjs --records <records.jsonl> --output <run.json> --model <base-model> --method <lora|qlora|full_finetune|other> --approval <owner-approval-ref>");
  const metadata = await prepareTrainingRun({ recordsPath: args.records, outputPath: args.output, baseModel: args.model, method: args.method, ownerApprovalRef: args.approval });
  console.log(JSON.stringify({ runId: metadata.runId, status: metadata.status, recordCounts: metadata.recordCounts }, null, 2));
}
