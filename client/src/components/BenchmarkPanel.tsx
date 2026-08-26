import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { BarChart3, Beaker, CheckCircle2, ClipboardCheck, Loader2, Play, Plus, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

function BenchmarkCaseDialog({ onSaved }: { onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [prompt, setPrompt] = useState("");
  const [criteria, setCriteria] = useState("");
  const [evidenceReference, setEvidenceReference] = useState("");
  const createCase = trpc.harb.lab.benchmarks.cases.create.useMutation({
    onSuccess: () => { toast.success("تم حفظ الحالة المعيارية الموثقة."); setOpen(false); setTitle(""); setPrompt(""); setCriteria(""); setEvidenceReference(""); onSaved(); },
    onError: error => toast.error(error.message),
  });
  const save = () => {
    if (title.trim().length < 3 || prompt.trim().length < 8 || criteria.trim().length < 8 || evidenceReference.trim().length < 3) return toast.error("أدخل عنواناً وحالة حقيقية ومعيار نجاح ودليل مرجعي.");
    createCase.mutate({ title, prompt, successCriteria: criteria, evidenceReference });
  };
  return <Dialog open={open} onOpenChange={setOpen}><DialogTrigger asChild><Button className="rounded-xl bg-primary text-primary-foreground"><Plus className="ml-2 h-4 w-4" />حالة معيارية</Button></DialogTrigger><DialogContent className="border-white/10 bg-[#111b28] text-foreground sm:max-w-xl" dir="rtl"><DialogHeader><DialogTitle>حالة مقارنة موثقة</DialogTitle><DialogDescription>أضف حالة واقعية مصرحاً بها، مع معيار مراجعة ودليل. لا ينشئ Harb بيانات أو نتائج معيارية من تلقاء نفسه.</DialogDescription></DialogHeader><div className="grid gap-3"><Input value={title} onChange={event => setTitle(event.target.value)} placeholder="عنوان الحالة الواقعية" /><Textarea value={prompt} onChange={event => setPrompt(event.target.value)} placeholder="نص الحالة أو السؤال الذي ستقارن عليه النماذج" /><Textarea value={criteria} onChange={event => setCriteria(event.target.value)} placeholder="كيف يحكم المراجع على الإجابة؟" /><Input value={evidenceReference} onChange={event => setEvidenceReference(event.target.value)} placeholder="مرجع الدليل أو التفويض أو التقرير" /></div><DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>إلغاء</Button><Button onClick={save} disabled={createCase.isPending}>{createCase.isPending && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}حفظ الحالة</Button></DialogFooter></DialogContent></Dialog>;
}

function ReviewResultDialog({ result, onSaved }: { result: { id: string; modelId: string; response: string | null; reviewerScore: number | null; reviewerNotes: string | null }; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [score, setScore] = useState(result.reviewerScore?.toString() ?? "");
  const [notes, setNotes] = useState(result.reviewerNotes ?? "");
  const review = trpc.harb.lab.benchmarks.results.review.useMutation({ onSuccess: () => { toast.success("تم تسجيل مراجعة النتيجة."); setOpen(false); onSaved(); }, onError: error => toast.error(error.message) });
  const save = () => {
    const reviewerScore = Number(score);
    if (!Number.isInteger(reviewerScore) || reviewerScore < 0 || reviewerScore > 100) return toast.error("أدخل درجة صحيحة بين 0 و100.");
    review.mutate({ id: result.id, reviewerScore, reviewerNotes: notes.trim() || undefined });
  };
  return <Dialog open={open} onOpenChange={setOpen}><DialogTrigger asChild><Button size="sm" variant="outline" className="border-primary/20 text-xs text-primary hover:bg-primary/10"><ClipboardCheck className="ml-1.5 h-3.5 w-3.5" />مراجعة</Button></DialogTrigger><DialogContent className="border-white/10 bg-[#111b28] text-foreground sm:max-w-2xl" dir="rtl"><DialogHeader><DialogTitle>مراجعة نتيجة {result.modelId}</DialogTitle><DialogDescription>تقييم المراجع هو مصدر المقارنة؛ لا يمنح Harb درجة تلقائية غير موثقة.</DialogDescription></DialogHeader><div className="max-h-60 overflow-y-auto rounded-xl border border-white/10 bg-black/15 p-4 text-sm leading-7 text-muted-foreground whitespace-pre-wrap">{result.response || "لم تنتج استجابة قابلة للمراجعة."}</div><div className="mt-3 grid gap-3 sm:grid-cols-[130px_1fr]"><Input value={score} onChange={event => setScore(event.target.value)} inputMode="numeric" placeholder="الدرجة 0–100" /><Textarea value={notes} onChange={event => setNotes(event.target.value)} placeholder="ملاحظات المراجع: الدقة، الالتزام بالقانون، اللغة، الوضوح…" /></div><DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>إلغاء</Button><Button onClick={save} disabled={review.isPending}>{review.isPending && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}حفظ المراجعة</Button></DialogFooter></DialogContent></Dialog>;
}

export function BenchmarkPanel() {
  const utils = trpc.useUtils();
  const benchmark = trpc.harb.lab.benchmarks.dashboard.useQuery();
  const [selectedCaseIds, setSelectedCaseIds] = useState<string[]>([]);
  const refresh = () => void utils.harb.lab.benchmarks.dashboard.invalidate();
  const startRun = trpc.harb.lab.benchmarks.runs.start.useMutation({ onSuccess: result => { toast.success(`اكتملت ${result.successCount} من ${result.expectedCount} استجابة بانتظار المراجعة.`); setSelectedCaseIds([]); refresh(); }, onError: error => toast.error(error.message) });
  const data = benchmark.data;
  const cases = data?.cases ?? [];
  const runs = data?.runs ?? [];
  const results = data?.results ?? [];
  const selection = data?.selection;
  const reviewedByModel = useMemo(() => {
    const map = new Map<string, { total: number; count: number }>();
    results.filter(item => item.reviewerScore !== null).forEach(item => { const current = map.get(item.modelId) ?? { total: 0, count: 0 }; map.set(item.modelId, { total: current.total + (item.reviewerScore ?? 0), count: current.count + 1 }); });
    return Array.from(map.entries()).map(([modelId, value]) => ({ modelId, average: Math.round(value.total / value.count), count: value.count }));
  }, [results]);
  const toggleCase = (caseId: string) => setSelectedCaseIds(current => current.includes(caseId) ? current.filter(id => id !== caseId) : [...current, caseId]);
  const canRun = selection?.status === "approved" && Boolean(selection.fallbackModelId) && selectedCaseIds.length > 0;

  return <section id="benchmarks" className="mt-7 scroll-mt-6"><div className="overflow-hidden rounded-[1.7rem] border border-cyan-300/15 bg-[radial-gradient(circle_at_10%_0%,oklch(0.72_0.13_205_/_12%),transparent_32rem),linear-gradient(135deg,#0f1d2a,#101722)] p-5 sm:p-7"><div className="flex flex-col gap-4 border-b border-white/10 pb-5 lg:flex-row lg:items-end lg:justify-between"><div><p className="section-kicker text-cyan-200">Evidence-led comparison</p><h2 className="mt-1 text-2xl font-bold">المقارنة المعيارية المحكومة</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">تُشغَّل فقط على حالات يضيفها المالك بدليل، وبين النموذجين المعتمدين. تبقى النتائج بلا درجة مقارنة حتى يراجعها شخص مفوض.</p></div><BenchmarkCaseDialog onSaved={refresh} /></div>
    <div className="mt-6 grid gap-5 xl:grid-cols-[0.9fr_1.1fr]"><div className="rounded-2xl border border-white/10 bg-black/10 p-4"><div className="flex items-center justify-between"><div><p className="section-kicker">Benchmark cases</p><h3 className="mt-1 font-bold">حالات واقعية موثقة</h3></div><Badge variant="outline" className="border-cyan-200/20 text-cyan-100">{cases.length} حالات</Badge></div><div className="mt-4 max-h-72 space-y-2 overflow-y-auto">{cases.length ? cases.map(item => <label key={item.id} className="flex cursor-pointer items-start gap-3 rounded-xl border border-white/8 bg-background/35 p-3 transition-colors hover:border-cyan-200/25"><input type="checkbox" checked={selectedCaseIds.includes(item.id)} onChange={() => toggleCase(item.id)} className="mt-1 accent-[oklch(0.79_0.144_169)]" /><span className="min-w-0"><span className="block text-sm font-semibold">{item.title}</span><span className="mt-1 block line-clamp-2 text-xs leading-5 text-muted-foreground">{item.successCriteria}</span><span className="mt-2 block text-[10px] text-cyan-100/75">دليل: {item.evidenceReference}</span></span></label>) : <div className="rounded-xl border border-dashed border-white/15 p-6 text-center"><Beaker className="mx-auto h-6 w-6 text-muted-foreground" /><p className="mt-2 text-sm font-medium">لا توجد حالات بعد</p><p className="mt-1 text-xs leading-5 text-muted-foreground">أضف حالات مؤسسية حقيقية ودليلاً قبل طلب أي مقارنة.</p></div>}</div><Button onClick={() => startRun.mutate({ caseIds: selectedCaseIds })} disabled={!canRun || startRun.isPending} className="mt-4 w-full bg-cyan-200 text-cyan-950 hover:bg-cyan-100">{startRun.isPending ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <Play className="ml-2 h-4 w-4" />}{selection?.status === "approved" ? "تشغيل المقارنة على الحالات المختارة" : "اعتمد نموذجاً رئيسياً وبديلًا أولاً"}</Button>{selection?.status === "approved" && !selection.fallbackModelId && <p className="mt-2 text-center text-[11px] text-amber-100">يلزم نموذج بديل معتمد لإجراء مقارنة فعلية.</p>}</div>
      <div className="rounded-2xl border border-cyan-200/15 bg-cyan-300/5 p-4"><div className="flex items-center justify-between"><div><p className="section-kicker text-cyan-200">Reviewed results</p><h3 className="mt-1 font-bold">لوحة المراجعة والنتائج</h3></div><BarChart3 className="h-5 w-5 text-cyan-200" /></div><div className="mt-4 grid gap-2 sm:grid-cols-2">{reviewedByModel.length ? reviewedByModel.map(item => <article key={item.modelId} className="rounded-xl border border-cyan-200/15 bg-black/10 p-3"><p className="truncate text-xs font-semibold">{item.modelId}</p><p className="mt-2 text-2xl font-bold text-cyan-100">{item.average}<span className="mr-1 text-xs font-normal text-muted-foreground">/100</span></p><p className="mt-1 text-[11px] text-muted-foreground">{item.count} نتائج راجعها المالك</p></article>) : <div className="rounded-xl border border-dashed border-white/15 p-5 text-center sm:col-span-2"><Sparkles className="mx-auto h-5 w-5 text-muted-foreground" /><p className="mt-2 text-xs text-muted-foreground">لا توجد درجات مراجعة بعد؛ لا يعرض Harb ترتيباً بلا دليل.</p></div>}</div><div className="mt-4 max-h-72 space-y-2 overflow-y-auto">{results.length ? results.map(result => <article key={result.id} className="rounded-xl border border-white/8 bg-background/35 p-3"><div className="flex flex-wrap items-center justify-between gap-2"><div><p className="text-sm font-semibold">{result.modelId}</p><p className="mt-1 text-[11px] text-muted-foreground">{result.status === "completed" ? "استجابة بانتظار المراجعة" : "تعذر تشغيل هذه الاستجابة"}</p></div>{result.status === "completed" ? <ReviewResultDialog result={result} onSaved={refresh} /> : <Badge className="border border-rose-200/20 bg-rose-400/10 text-[10px] text-rose-100">تعذّر</Badge>}</div>{result.reviewerScore !== null && <div className="mt-2 flex items-center gap-2 text-xs text-cyan-100"><CheckCircle2 className="h-3.5 w-3.5" />درجة المراجع: {result.reviewerScore}/100</div>}</article>) : <p className="rounded-xl border border-dashed border-white/15 p-5 text-center text-xs text-muted-foreground">ستظهر الاستجابات الحقيقية هنا بعد تشغيل مقارنة مصرح بها.</p>}</div></div></div>
    <div className="mt-5 flex items-center justify-between rounded-xl border border-white/10 bg-black/10 px-4 py-3 text-xs text-muted-foreground"><span>عمليات مقارنة مسجلة: {runs.length}</span><span>{runs[0]?.status === "completed" ? "آخر تشغيل اكتمل ويحتاج مراجعة النتائج." : "لا يوجد تشغيل مكتمل بعد."}</span></div>
  </div></section>;
}
