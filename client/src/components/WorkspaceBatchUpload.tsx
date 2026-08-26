import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { Archive, CheckCircle2, Code2, FileCode2, FileText, FolderArchive, Image, Loader2, UploadCloud, XCircle } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

type QueueStatus = "queued" | "uploading" | "analyzing" | "completed" | "failed";
type Inspection = { kind: "image" | "document" | "archive" | "code" | "text"; summary: string; textPreview?: string; truncated?: boolean; archiveFiles?: Array<{ path: string; size: number; text: boolean }> };
type QueueItem = { id: string; file: File; status: QueueStatus; artifact?: { id: string; name: string }; inspection?: Inspection; error?: string };

const accepted = ".jpg,.jpeg,.png,.webp,.pdf,.zip,.txt,.md,.json,.yaml,.yml,.csv,.js,.jsx,.ts,.tsx,.py,.java,.go,.rs,.php,.c,.cpp,.h,.cs,.html,.css,.sql,.sh";

function fileToBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("تعذر قراءة الملف."));
    reader.onload = () => {
      const base64 = String(reader.result).split(",")[1];
      base64 ? resolve(base64) : reject(new Error("تعذر تحويل الملف."));
    };
    reader.readAsDataURL(file);
  });
}

function statusLabel(status: QueueStatus) {
  return status === "queued" ? "بانتظار الرفع" : status === "uploading" ? "جارٍ الرفع الخاص" : status === "analyzing" ? "جارٍ الفحص" : status === "completed" ? "جاهز" : "تعذر";
}

function statusIcon(status: QueueStatus) {
  return status === "completed" ? <CheckCircle2 className="h-4 w-4 text-primary" /> : status === "failed" ? <XCircle className="h-4 w-4 text-rose-200" /> : status === "uploading" || status === "analyzing" ? <Loader2 className="h-4 w-4 animate-spin text-primary" /> : <UploadCloud className="h-4 w-4 text-muted-foreground" />;
}

export function WorkspaceBatchUpload() {
  const utils = trpc.useUtils();
  const inputRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<QueueItem[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const upload = trpc.harb.files.upload.useMutation();
  const inspect = trpc.harb.files.inspect.useMutation();

  const updateItem = (id: string, update: Partial<QueueItem>) => setItems(current => current.map(item => item.id === id ? { ...item, ...update } : item));

  const processFiles = async (fileList: FileList | File[]) => {
    const selected = Array.from(fileList).slice(0, 8);
    if (!selected.length) return;
    if (Array.from(fileList).length > selected.length) toast.info("احتفظ Harb بأول 8 ملفات من الدفعة." );
    const queued = selected.map(file => ({ id: `${file.name}-${file.size}-${crypto.randomUUID()}`, file, status: "queued" as const }));
    setItems(queued);
    setIsRunning(true);
    for (const item of queued) {
      try {
        updateItem(item.id, { status: "uploading" });
        const base64 = await fileToBase64(item.file);
        const artifact = await upload.mutateAsync({ name: item.file.name, mimeType: item.file.type || "application/octet-stream", base64, classification: "private" });
        updateItem(item.id, { status: "analyzing", artifact: { id: artifact.id, name: artifact.name } });
        const inspection = await inspect.mutateAsync({ id: artifact.id });
        updateItem(item.id, { status: "completed", inspection });
      } catch (error) {
        updateItem(item.id, { status: "failed", error: error instanceof Error ? error.message : "تعذر رفع أو تحليل الملف." });
      }
    }
    setIsRunning(false);
    void utils.harb.dashboard.invalidate();
    void utils.harb.audit.list.invalidate();
  };

  return (
    <section className="rounded-2xl border border-white/10 bg-black/10 p-4">
      <input ref={inputRef} type="file" multiple accept={accepted} className="hidden" onChange={event => { if (event.target.files) void processFiles(event.target.files); event.target.value = ""; }} />
      <div
        onDragEnter={event => { event.preventDefault(); setIsDragging(true); }}
        onDragOver={event => event.preventDefault()}
        onDragLeave={event => { if (event.currentTarget === event.target) setIsDragging(false); }}
        onDrop={event => { event.preventDefault(); setIsDragging(false); void processFiles(event.dataTransfer.files); }}
        className={cn("rounded-xl border border-dashed px-4 py-5 text-center transition-colors", isDragging ? "border-primary bg-primary/10" : "border-white/15 bg-white/[0.02]")}
      >
        <span className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><UploadCloud className="h-5 w-5" /></span>
        <p className="mt-3 text-sm font-semibold">ارفع دفعة ملفات خاصة</p>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">اسحب حتى 8 صور أو PDF أو ZIP أو ملفات شيفرة ونصوص. يعالج Harb كل ملف بتتابع آمن ويعرض فحصه.</p>
        <Button type="button" variant="outline" size="sm" onClick={() => inputRef.current?.click()} disabled={isRunning} className="mt-3 border-white/15 bg-white/5">اختيار ملفات</Button>
      </div>
      {items.length > 0 && <div className="mt-4 space-y-3">{items.map(item => <article key={item.id} className="rounded-xl border border-white/10 bg-background/30 p-3"><div className="flex items-start gap-3"><span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/5">{item.inspection?.kind === "archive" ? <FolderArchive className="h-4 w-4 text-primary" /> : item.inspection?.kind === "code" ? <Code2 className="h-4 w-4 text-primary" /> : item.inspection?.kind === "image" ? <Image className="h-4 w-4 text-primary" /> : <FileCode2 className="h-4 w-4 text-primary" />}</span><div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-2"><p className="truncate text-sm font-medium">{item.file.name}</p><span className="flex shrink-0 items-center gap-1 text-[11px] text-muted-foreground">{statusIcon(item.status)}{statusLabel(item.status)}</span></div>{item.inspection && <p className="mt-1 text-xs leading-5 text-muted-foreground">{item.inspection.summary}</p>}{item.error && <p className="mt-1 text-xs leading-5 text-rose-200">{item.error}</p>}</div></div>{item.inspection?.archiveFiles?.length ? <div className="mt-3 rounded-lg border border-white/8 bg-black/15 p-2"><p className="text-[11px] font-semibold text-muted-foreground">محتويات الحزمة الآمنة</p><div className="mt-1.5 flex flex-wrap gap-1.5">{item.inspection.archiveFiles.slice(0, 8).map(file => <span key={file.path} className="rounded-md bg-white/5 px-2 py-1 font-mono text-[10px] text-muted-foreground">{file.path}</span>)}</div></div> : null}{item.inspection?.textPreview ? <pre dir="ltr" className="mt-3 max-h-32 overflow-auto rounded-lg border border-white/8 bg-black/25 p-2 text-left text-[10px] leading-5 text-primary/90">{item.inspection.textPreview}</pre> : null}</article>)}</div>}
    </section>
  );
}
