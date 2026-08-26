import { Badge } from "@/components/ui/badge";
import { BarChart3, Clock3, ShieldCheck, Sparkles } from "lucide-react";

type AuditRow = { eventType: string; outcome: string; metadata: string | null };
type TaskRow = { status: string };

function readMetadata(value: string | null) {
  try { return value ? JSON.parse(value) as Record<string, unknown> : {}; } catch { return {}; }
}

export function QualityInsightsPanel({ tasks, audit }: { tasks: TaskRow[]; audit: AuditRow[] }) {
  const completed = audit.filter(item => item.eventType === "task.completed");
  const failed = audit.filter(item => item.eventType === "task.failed");
  const sourced = completed.filter(item => Array.isArray(readMetadata(item.metadata).trustedSourceUrls) && (readMetadata(item.metadata).trustedSourceUrls as unknown[]).length > 0);
  const latencies = completed.map(item => Number(readMetadata(item.metadata).latencyMs)).filter(value => Number.isFinite(value) && value >= 0);
  const successRate = completed.length + failed.length ? Math.round((completed.length / (completed.length + failed.length)) * 100) : null;
  const averageLatency = latencies.length ? Math.round(latencies.reduce((sum, value) => sum + value, 0) / latencies.length) : null;
  const queued = tasks.filter(task => task.status === "queued" || task.status === "running").length;
  const metrics = [
    { label: "نجاح الردود", value: successRate === null ? "—" : `${successRate}%`, detail: completed.length + failed.length ? `${completed.length} مكتمل · ${failed.length} متعذر` : "بانتظار ردود مقاسة", icon: ShieldCheck },
    { label: "استجابة موثقة", value: `${sourced.length}`, detail: "ردود استندت إلى نطاقات موثوقة", icon: Sparkles },
    { label: "متوسط زمن الرد", value: averageLatency === null ? "—" : averageLatency >= 1000 ? `${(averageLatency / 1000).toFixed(1)}ث` : `${averageLatency}مس`, detail: latencies.length ? `${latencies.length} استجابات مقاسة` : "يظهر بعد أول استجابة", icon: Clock3 },
    { label: "مهام قيد المعالجة", value: `${queued}`, detail: "حالة حالية من سجل المهام", icon: BarChart3 },
  ];
  return <section id="quality" className="harb-quality-panel mt-7 scroll-mt-6"><div className="glass-panel rounded-2xl p-5"><div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><p className="section-kicker">Quality & Reliability</p><h2 className="mt-1 text-xl font-bold">جودة Harb وموثوقيته</h2><p className="mt-1 text-sm text-muted-foreground">مؤشرات مستخرجة من سجل مهامك وتدقيقك فقط؛ لا تتضمن تقديرات أو بيانات تجريبية.</p></div><Badge variant="outline" className="w-fit border-primary/20 bg-primary/5 text-primary"><ShieldCheck className="ml-1.5 h-3.5 w-3.5" />قياس خاص بالمالك</Badge></div><div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{metrics.map(metric => { const Icon = metric.icon; return <article key={metric.label} className="rounded-xl border border-white/10 bg-black/10 p-4"><div className="flex items-start justify-between gap-3"><p className="text-xs text-muted-foreground">{metric.label}</p><Icon className="h-4 w-4 text-primary" /></div><p className="mt-3 text-2xl font-bold tracking-tight">{metric.value}</p><p className="mt-1 text-[11px] leading-5 text-muted-foreground">{metric.detail}</p></article>; })}</div></div></section>;
}
