import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Code2, Copy, Download, Eye, FileCode2, Files, Loader2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

export type ProjectPreviewFile = { path: string; content: string; truncated: boolean; lineCount: number };

export function ProjectCodePreview({ files, workspaceFileId }: { files: ProjectPreviewFile[]; workspaceFileId: string }) {
  const [selectedPath, setSelectedPath] = useState<string | null>(files[0]?.path ?? null);
  const [activeAction, setActiveAction] = useState<"copy" | "download" | null>(null);

  useEffect(() => {
    setSelectedPath(files[0]?.path ?? null);
  }, [files]);

  const selected = files.find(file => file.path === selectedPath) ?? files[0];
  const lines = useMemo(() => selected?.content.split("\n").slice(0, 500) ?? [], [selected]);
  const fileQuery = trpc.harb.studio.readProjectFile.useQuery({ workspaceFileId, path: selected?.path ?? "README.md" }, { enabled: false, retry: false });
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
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 px-4 py-2.5"><p className="truncate font-mono text-xs text-primary" dir="ltr">{selected.path}</p><div className="flex items-center gap-2"><span className="text-[10px] text-muted-foreground">{selected.lineCount} سطر</span><Button type="button" size="sm" variant="outline" onClick={() => void handleCopy()} disabled={Boolean(activeAction)} className="h-7 px-2 text-[11px]"><>{activeAction === "copy" ? <Loader2 className="ml-1 h-3.5 w-3.5 animate-spin" /> : <Copy className="ml-1 h-3.5 w-3.5" />}نسخ</></Button><Button type="button" size="sm" onClick={() => void handleDownload()} disabled={Boolean(activeAction)} className="h-7 px-2 text-[11px]"><>{activeAction === "download" ? <Loader2 className="ml-1 h-3.5 w-3.5 animate-spin" /> : <Download className="ml-1 h-3.5 w-3.5" />}تنزيل</></Button></div></div>
          <div className="max-h-[420px] overflow-auto bg-[#09111a]" dir="ltr"><ol className="min-w-max py-3 font-mono text-xs leading-6 text-slate-200">{lines.map((line, index) => <li key={`${selected.path}-${index}`} className="grid grid-cols-[3.25rem_minmax(0,1fr)] px-4 hover:bg-white/[0.025]"><span className="select-none border-l border-white/5 pl-3 text-right text-slate-500">{index + 1}</span><code className="whitespace-pre pl-4">{line || " "}</code></li>)}</ol></div>
          {(selected.truncated || lines.length < selected.lineCount) && <p className="border-t border-amber-200/10 bg-amber-300/5 px-4 py-2 text-[11px] text-amber-100">تظهر معاينة آمنة ومحدودة للنص؛ الحزمة الأصلية تظل متاحة للتنزيل والمراجعة المحلية.</p>}
          <p className="border-t border-white/5 px-4 py-2 text-[10px] text-muted-foreground">تنسخ أدوات الملف وتنزّله من النسخة الكاملة الخاصة عند الطلب، ولا تعدّل ZIP الأصلي.</p>
        </div>
      </div>
    </section>
  );
}
