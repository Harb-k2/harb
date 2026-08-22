import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { BookOpenCheck, DatabaseZap, FileSearch, Loader2, Search } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export function KnowledgeControlPanel() {
  const utils = trpc.useUtils();
  const lab = trpc.harb.lab.dashboard.useQuery();
  const [query, setQuery] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("");
  const search = trpc.harb.lab.knowledge.search.useQuery({ query: submittedQuery || "بحث" }, { enabled: submittedQuery.trim().length >= 3 });
  const indexSource = trpc.harb.lab.sources.index.useMutation({
    onSuccess: result => { toast.success(result.status === "ready" ? `تمت فهرسة ${result.chunkCount} مقتطفات معرفية.` : "نوع المصدر غير مدعوم للفهرسة في الإصدار الأول."); void utils.harb.lab.dashboard.invalidate(); },
    onError: error => toast.error(error.message),
  });
  const sources = lab.data?.sources ?? [];
  const runSearch = () => { if (query.trim().length < 3) return toast.error("أدخل ثلاث أحرف على الأقل للبحث في المعرفة المفهرسة."); setSubmittedQuery(query.trim()); };

  return <section id="knowledge" className="mt-7 scroll-mt-6"><div className="rounded-2xl border border-cyan-200/15 bg-gradient-to-l from-cyan-300/10 via-[#142432]/90 to-[#111a26]/90 p-5 sm:p-7"><div className="flex items-start gap-3 border-b border-white/10 pb-5"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cyan-200/10 text-cyan-200"><DatabaseZap className="h-5 w-5" /></span><div><p className="section-kicker text-cyan-200">Knowledge Retrieval Gate</p><h2 className="mt-1 text-2xl font-bold">فهرسة واسترجاع المعرفة</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">يفهرس Harb ملفات النص وJSON وCSV المسجلة فقط إلى مقتطفات محدودة. لا تُفهرس المراجع العامة تلقائياً، ولا تُضاف المعرفة إلى المحادثة إلا بعد اجتياز قوانين المالك.</p></div></div>
    <div className="mt-6 grid gap-5 xl:grid-cols-[1.05fr_.95fr]"><div className="rounded-2xl border border-white/10 bg-black/10 p-4"><div className="flex items-center justify-between"><div><p className="section-kicker">Indexing</p><h3 className="mt-1 font-bold">مصادر بانتظار الفهرسة</h3></div><BookOpenCheck className="h-5 w-5 text-cyan-200" /></div><div className="mt-4 space-y-2">{sources.length ? sources.map(source => <article key={source.id} className="flex flex-col gap-3 rounded-xl border border-white/8 bg-background/40 p-3 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><p className="truncate text-sm font-medium">{source.name}</p><p className="mt-1 text-xs text-muted-foreground">{source.sourceType === "public_reference" ? "مرجع عام — مراجعة يدوية مطلوبة" : `${source.mimeType ?? "نوع غير محدد"} · ${source.chunkCount} مقتطفات`}</p></div>{source.sourceType === "workspace_file" ? <Button size="sm" variant="outline" onClick={() => indexSource.mutate({ sourceId: source.id })} disabled={indexSource.isPending} className="border-cyan-200/25 text-cyan-100 hover:bg-cyan-200/10">{indexSource.isPending ? <Loader2 className="ml-1 h-3.5 w-3.5 animate-spin" /> : <FileSearch className="ml-1 h-3.5 w-3.5" />}{source.indexingStatus === "ready" ? "إعادة الفهرسة" : "فهرسة"}</Button> : <Badge variant="outline" className="border-amber-200/20 text-amber-200">يدوي فقط</Badge>}</article>) : <p className="rounded-xl border border-dashed border-white/15 p-5 text-center text-xs text-muted-foreground">سجل مصدراً من مختبر النموذج أولاً.</p>}</div></div>
      <div className="rounded-2xl border border-cyan-200/15 bg-cyan-200/5 p-4"><div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-200/10 text-cyan-200"><Search className="h-5 w-5" /></span><div><p className="section-kicker text-cyan-200">Retrieval Preview</p><h3 className="mt-1 font-bold">اختبار الاسترجاع</h3></div></div><div className="mt-5 flex gap-2"><Input value={query} onChange={event => setQuery(event.target.value)} onKeyDown={event => { if (event.key === "Enter") runSearch(); }} placeholder="ابحث في مقتطفات المعرفة المفهرسة" /><Button onClick={runSearch} className="bg-cyan-200 text-cyan-950 hover:bg-cyan-100">بحث</Button></div><div className="mt-4 space-y-2">{submittedQuery && search.isLoading ? <p className="text-sm text-muted-foreground">جارٍ الاسترجاع…</p> : search.data?.length ? search.data.map(item => <article key={item.id} className="rounded-xl border border-white/10 bg-background/40 p-3"><p className="text-xs leading-5 text-muted-foreground">{item.excerpt}</p><p className="mt-2 text-[11px] text-cyan-200">صلة: {item.score} · المصدر: {item.sourceId}</p></article>) : submittedQuery ? <p className="rounded-xl border border-dashed border-white/15 p-4 text-center text-xs text-muted-foreground">لا توجد مقتطفات مطابقة ضمن المعرفة المفهرسة الخاصة بك.</p> : <p className="text-xs leading-5 text-muted-foreground">استخدم هذا المعاين قبل الاعتماد على المعرفة في محادثة Harb؛ لا يعرض إلا مقتطفات من مصادر المالك المفهرسة.</p>}</div></div></div>
  </div></section>;
}
