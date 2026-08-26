import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Code2, Copy, Download, Eye, FileCode2, Files, Loader2, Search, ShieldCheck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

export type ProjectPreviewFile = { path: string; content: string; truncated: boolean; lineCount: number };

function highlightLine(line: string) {
  const parts = line.split(/(\/\/.*$|\/\*[\s\S]*?\*\/|\b(?:const|let|var|function|return|export|import|from|class|interface|type|async|await|if|else|for|while|true|false|null|undefined)\b|(?:"[^"]*"|'[^']*'|`[^`]*`))/g);
  return parts.map((part, index) => {
    const className = part.startsWith("//") || part.startsWith("/*") ? "text-slate-500" : /^(?:const|let|var|function|return|export|import|from|class|interface|type|async|await|if|else|for|while|true|false|null|undefined)$/.test(part) ? "text-cyan-300" : /^(?:"|')/.test(part) || part.startsWith("`") ? "text-amber-200" : "";
    return <span key={`${part}-${index}`} className={className}>{part}</span>;
  });
}

export function ProjectCodePreview({ files, workspaceFileId }: { files: ProjectPreviewFile[]; workspaceFileId: string }) {
  const [selectedPath, setSelectedPath] = useState<string | null>(files[0]?.path ?? null);
  const [activeAction, setActiveAction] = useState<"copy" | "download" | null>(null);
  const [review, setReview] = useState<{ fileCount: number; languageCounts: Array<{ language: string; count: number }>; findings: string[]; warnings: string[] } | null>(null);
  const [codeQuery, setCodeQuery] = useState("");
  const [comparePath, setComparePath] = useState("");

  useEffect(() => {
    setSelectedPath(files[0]?.path ?? null);
  }, [files]);

  const selected = files.find(file => file.path === selectedPath) ?? files[0];
  const lines = useMemo(() => (selected?.content.split("\n").slice(0, 500) ?? []).map((content, index) => ({ content, line: index + 1 })).filter(item => !codeQuery.trim() || item.content.toLocaleLowerCase().includes(codeQuery.trim().toLocaleLowerCase())), [selected, codeQuery]);
  const compareFile = files.find(file => file.path === comparePath);
  const comparison = useMemo(() => {
    if (!selected || !compareFile) return [];
    const left = selected.content.split("\n");
    const right = compareFile.content.split("\n");
    return Array.from({ length: Math.max(left.length, right.length) }, (_, index) => ({ line: index + 1, left: left[index] ?? "", right: right[index] ?? "" })).filter(item => item.left !== item.right).slice(0, 80);
  }, [selected, compareFile]);
  const fileQuery = trpc.harb.studio.readProjectFile.useQuery({ workspaceFileId, path: selected?.path ?? "README.md" }, { enabled: false, retry: false });
  const reviewProject = trpc.harb.files.reviewProject.useMutation({ onSuccess: result => { setReview(result); toast.success("اكتملت المراجعة الساكنة للحزمة."); }, onError: error => toast.error(error.message) });
  if (!selected) return null;

  const readFullFile = async () => {
    const result = await fileQuery.refetch();
    if (result.error || !result.data) throw result.error ?? new Error("تعذر تحميل الملف الفردي.");
    return result.data;
  };
  const copyText = async (text: string) => {
    if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(text);
    const area = document.createElement("textarea");
    area.value = text;
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    document.execCommand("copy");
    area.remove();
  };
  const handleCopy = async () => {
    setActiveAction("copy");
    try { const file = await readFullFile(); await copyText(file.content); toast.success("نُسخ محتوى الملف الكامل."); }
    catch (error) { toast.error(error instanceof Error ? error.message : "تعذر نسخ الملف."); }
    finally { setActiveAction(null); }
  };
  const handleDownload = async () => {
    setActiveAction("download");
    try {
      const file = await readFullFile();
      const link = document.createElement("a");
      const href = URL.createObjectURL(new Blob([file.content], { type: "text/plain;charset=utf-8" }));
      link.href = href;
      link.download = file.path.split("/").at(-1) || "harb-file.txt";
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(href), 0);
      toast.success("بدأ تنزيل الملف الفردي.");
    } catch (error) { toast.error(error instanceof Error ? error.message : "تعذر تنزيل الملف."); }
    finally { setActiveAction(null); }
  };

  return (
    <section className="harb-project-preview mt-5 overflow-hidden rounded-2xl border border-white/10 bg-[#0b131e]/80" aria-label="محرر معاينة المشروع">
      <header className="flex flex-col gap-3 border-b border-white/10 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary"><Code2 className="h-4 w-4" /></span><div><p className="text-sm font-semibold">محرر معاينة الملفات</p><p className="text-[11px] text-muted-foreground">قراءة فقط؛ لا ينفذ Harb المحتوى ولا يغيّر الحزمة.</p></div></div>
        <Badge variant="outline" className="w-fit border-primary/20 text-[10px] text-primary"><Eye className="ml-1 h-3 w-3" />{files.length} ملفات</Badge>
      </header>
      <div className="grid min-h-[300px] lg:grid-cols-[210px_minmax(0,1fr)]">
        <aside className="border-b border-white/10 bg-black/15 p-2 lg:border-b-0 lg:border-l" aria-label="ملفات المشروع">
          <div className="mb-2 flex items-center gap-1.5 px-2 pt-1 text-[11px] font-semibold text-muted-foreground"><Files className="h-3.5 w-3.5" />ملفات الحزمة</div>
          <div className="max-h-44 space-y-1 overflow-y-auto lg:max-h-80">{files.map(file => <button key={file.path} type="button" onClick={() => { setSelectedPath(file.path); setActiveAction(null); }} className={cn("flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-right text-xs transition-colors", selected.path === file.path ? "bg-primary/12 text-foreground" : "text-muted-foreground hover:bg-white/5 hover:text-foreground")}><FileCode2 className="h-3.5 w-3.5 shrink-0 text-primary" /><span className="truncate" dir="ltr">{file.path}</span></button>)}</div>
        </aside>
        <div className="min-w-0">
          <div className="flex flex-col gap-2 border-b border-white/10 px-4 py-2.5"><div className="flex flex-wrap items-center justify-between gap-2"><p className="truncate font-mono text-xs text-primary" dir="ltr">{selected.path}</p><div className="flex items-center gap-2"><span className="text-[10px] text-muted-foreground">{selected.lineCount} سطر</span><Button type="button" size="sm" variant="outline" onClick={() => reviewProject.mutate({ id: workspaceFileId })} disabled={reviewProject.isPending} className="h-7 px-2 text-[11px]">{reviewProject.isPending ? <Loader2 className="ml-1 h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="ml-1 h-3.5 w-3.5" />}مراجعة</Button><Button type="button" size="sm" variant="outline" onClick={() => void handleCopy()} disabled={Boolean(activeAction)} className="h-7 px-2 text-[11px]"><>{activeAction === "copy" ? <Loader2 className="ml-1 h-3.5 w-3.5 animate-spin" /> : <Copy className="ml-1 h-3.5 w-3.5" />}نسخ</></Button><Button type="button" size="sm" onClick={() => void handleDownload()} disabled={Boolean(activeAction)} className="h-7 px-2 text-[11px]"><>{activeAction === "download" ? <Loader2 className="ml-1 h-3.5 w-3.5 animate-spin" /> : <Download className="ml-1 h-3.5 w-3.5" />}تنزيل</></Button></div></div><div className="relative"><Search className="pointer-events-none absolute right-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" /><Input value={codeQuery} onChange={event => setCodeQuery(event.target.value)} className="h-8 pr-8 text-xs" placeholder="ابحث داخل الملف المعروض…" /></div></div>
          <div className="max-h-[420px] overflow-auto bg-[#09111a]" dir="ltr"><ol className="min-w-max py-3 font-mono text-xs leading-6 text-slate-200">{lines.map(item => <li key={`${selected.path}-${item.line}`} className="grid grid-cols-[3.25rem_minmax(0,1fr)] px-4 hover:bg-white/[0.025]"><span className="select-none border-l border-white/5 pl-3 text-right text-slate-500">{item.line}</span><code className="whitespace-pre pl-4">{highlightLine(item.content || " ")}</code></li>)}</ol>{codeQuery && !lines.length ? <p className="px-4 py-6 text-center text-xs text-muted-foreground">لا توجد مطابقة داخل الجزء المعروض من الملف.</p> : null}</div>
          <div className="border-t border-white/5 px-4 py-3"><div className="flex flex-col gap-2 sm:flex-row sm:items-center"><p className="shrink-0 text-[11px] font-semibold text-muted-foreground">مقارنة ملفين</p><select value={comparePath} onChange={event => setComparePath(event.target.value)} className="h-8 min-w-0 rounded-md border border-white/15 bg-background px-2 font-mono text-[11px]" dir="ltr"><option value="">اختر ملفاً أو نسخة للمقارنة</option>{files.filter(file => file.path !== selected.path).map(file => <option key={file.path} value={file.path}>{file.path}</option>)}</select></div>{compareFile ? <div className="mt-3 overflow-auto rounded-lg border border-white/8 bg-black/15" dir="ltr"><div className="grid min-w-[600px] grid-cols-[3rem_minmax(0,1fr)_minmax(0,1fr)] border-b border-white/8 px-2 py-1.5 font-mono text-[10px] text-muted-foreground"><span>#</span><span className="truncate">{selected.path}</span><span className="truncate">{compareFile.path}</span></div>{comparison.length ? comparison.map(item => <div key={item.line} className="grid min-w-[600px] grid-cols-[3rem_minmax(0,1fr)_minmax(0,1fr)] gap-2 border-b border-white/[0.04] px-2 py-1 font-mono text-[10px] leading-5"><span className="text-slate-500">{item.line}</span><code className="whitespace-pre-wrap bg-rose-300/[0.04] px-1 text-rose-100">{item.left || " "}</code><code className="whitespace-pre-wrap bg-primary/[0.04] px-1 text-primary/90">{item.right || " "}</code></div>) : <p className="p-3 text-center text-[11px] text-primary">لا توجد فروقات ضمن الجزء المعروض.</p>}</div> : <p className="mt-2 text-[10px] text-muted-foreground">اختر ملفاً آخر أو نسخة محفوظة في الحزمة لمقارنة الفروقات؛ لا يُعدل Harb أياً من الملفين.</p>}</div>
          {(selected.truncated || lines.length < selected.lineCount) && <p className="border-t border-amber-200/10 bg-amber-300/5 px-4 py-2 text-[11px] text-amber-100">تظهر معاينة آمنة ومحدودة للنص؛ الحزمة الأصلية تظل متاحة للتنزيل والمراجعة المحلية.</p>}
          {review && <div className="border-t border-primary/15 bg-primary/[0.03] px-4 py-3"><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-xs font-semibold text-primary">مراجعة ساكنة للحزمة</p><span className="text-[10px] text-muted-foreground">{review.fileCount} ملفات · {review.languageCounts.map(item => `${item.language} ${item.count}`).join(" · ") || "لا توجد شيفرة مصنفة"}</span></div><ul className="mt-2 space-y-1 text-[11px] leading-5 text-muted-foreground">{review.findings.map(item => <li key={item}>• {item}</li>)}{review.warnings.map(item => <li key={item} className="text-amber-100">• {item}</li>)}</ul></div>}
          <p className="border-t border-white/5 px-4 py-2 text-[10px] text-muted-foreground">تنسخ أدوات الملف وتنزّله من النسخة الكاملة الخاصة عند الطلب، ولا تعدّل ZIP الأصلي.</p>
        </div>
      </div>
    </section>
  );
}
