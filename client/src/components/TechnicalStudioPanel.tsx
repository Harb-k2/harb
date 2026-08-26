import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ProjectCodePreview, type ProjectPreviewFile } from "@/components/ProjectCodePreview";
import { deferredImageLoadingProps } from "@/lib/mediaPerformance";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Code2, ExternalLink, FileDown, FileText, Globe2, ImagePlus, Loader2, PackageCheck, Search, ShieldCheck, Sparkles, WandSparkles } from "lucide-react";
import { useState } from "react";

type StudioTab = "project" | "document" | "image" | "search";

const tabs: Array<{ id: StudioTab; label: string; icon: typeof Code2; description: string }> = [
  { id: "project", label: "مشروع تقني", icon: Code2, description: "ينشئ هيكل ملفات قابل للتنزيل" },
  { id: "document", label: "مستند", icon: FileText, description: "يصدر PDF أو Word أو نصاً" },
  { id: "image", label: "صورة", icon: ImagePlus, description: "ينشئ صورة من وصفك" },
  { id: "search", label: "بحث مصادر", icon: Globe2, description: "يبحث ويعرض المصادر" },
];

export function TechnicalStudioPanel() {
  const utils = trpc.useUtils();
  const [activeTab, setActiveTab] = useState<StudioTab>("project");
  const [projectRequest, setProjectRequest] = useState("أنشئ مشروع TypeScript بسيطاً لإدارة مهام فريق، مع README وهيكل مصدر قابل للتوسعة.");
  const [documentTitle, setDocumentTitle] = useState("تقرير تقني");
  const [documentContent, setDocumentContent] = useState("# ملخص\n\nاكتب محتوى التقرير التقني هنا، ثم اختر التنسيق المطلوب لتنزيله داخل مساحة العمل الخاصة.");
  const [documentFormat, setDocumentFormat] = useState<"pdf" | "docx" | "txt">("pdf");
  const [imagePrompt, setImagePrompt] = useState("رسم توضيحي نظيف لفريق برمجي عربي يعمل على لوحة تحكم تقنية داكنة مع إشارات تركوازية.");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchMode, setSearchMode] = useState<"multi" | "google" | "bing" | "news" | "images">("multi");
  const [projectResult, setProjectResult] = useState<{ summary: string; fileCount: number; url: string; name: string; workspaceFileId: string; preview: ProjectPreviewFile[] } | null>(null);
  const [documentResult, setDocumentResult] = useState<{ url: string; name: string } | null>(null);
  const [imageResult, setImageResult] = useState<string | null>(null);
  const [searchResult, setSearchResult] = useState<Array<{ title: string; url: string; snippet: string; source: string; position: number; imageUrl?: string }>>([]);

  const refresh = () => {
    void utils.harb.dashboard.invalidate();
    void utils.harb.audit.list.invalidate();
  };
  const createProject = trpc.harb.studio.createProject.useMutation({
    onSuccess: result => {
      if (result.status !== "completed") return toast.error(result.reason || "يتطلب هذا الطلب قراراً من المالك قبل المتابعة.");
      setProjectResult({ summary: result.summary, fileCount: result.fileCount, url: result.artifact.storageUrl, name: result.artifact.name, workspaceFileId: result.artifact.id, preview: result.preview });
      toast.success("أصبحت حزمة المشروع جاهزة في مساحة العمل الخاصة.");
      refresh();
    },
    onError: error => toast.error(error.message),
  });
  const createDocument = trpc.harb.studio.createDocument.useMutation({
    onSuccess: result => {
      if (result.status !== "completed") return toast.error(result.reason || "يتطلب هذا الطلب قراراً من المالك قبل المتابعة.");
      setDocumentResult({ url: result.artifact.storageUrl, name: result.artifact.name });
      toast.success("أصبح المستند جاهزاً في مساحة العمل الخاصة.");
      refresh();
    },
    onError: error => toast.error(error.message),
  });
  const createImage = trpc.harb.studio.createImage.useMutation({
    onSuccess: result => {
      if (result.status !== "completed") return toast.error(result.reason || "يتطلب هذا الطلب قراراً من المالك قبل المتابعة.");
      setImageResult(result.imageUrl);
      toast.success("أصبحت الصورة جاهزة.");
      refresh();
    },
    onError: error => toast.error(error.message),
  });
  const webSearch = trpc.harb.studio.webSearch.useMutation({
    onSuccess: result => {
      if (result.status !== "completed") return toast.error(result.reason || "يتطلب هذا البحث قراراً من المالك قبل المتابعة.");
      setSearchResult(result.sources);
      toast.success(`تم العثور على ${result.sources.length} مصدر قابل للمراجعة.`);
      refresh();
    },
    onError: error => toast.error(error.message),
  });

  return (
    <section id="studio" className="harb-studio-panel mt-7 scroll-mt-6">
      <div className="glass-panel overflow-hidden rounded-[1.5rem] border border-primary/15">
        <div className="harb-studio-header flex flex-col gap-4 border-b border-white/10 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div><p className="section-kicker">Harb Technical Studio</p><h2 className="mt-1 text-xl font-bold">استوديو العمل التقني</h2><p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">إنشاء منظم للمشاريع والملفات والصور والبحث، مع قانون المالك وسجل التدقيق قبل كل إجراء.</p></div>
          <Badge variant="outline" className="w-fit border-primary/20 bg-primary/5 px-3 py-1.5 text-primary"><ShieldCheck className="ml-1.5 h-3.5 w-3.5" />مخرجات خاصة ومحكومة</Badge>
        </div>
        <div className="grid min-h-[460px] lg:grid-cols-[220px_minmax(0,1fr)]">
          <nav className="border-b border-white/10 bg-black/10 p-3 lg:border-b-0 lg:border-l lg:p-4" aria-label="أدوات الاستوديو">
            <div className="grid grid-cols-2 gap-2 lg:grid-cols-1">{tabs.map(tab => { const Icon = tab.icon; return <button key={tab.id} type="button" onClick={() => setActiveTab(tab.id)} className={`rounded-xl border p-3 text-right transition-colors ${activeTab === tab.id ? "border-primary/30 bg-primary/10 text-foreground" : "border-transparent text-muted-foreground hover:border-white/10 hover:bg-white/5 hover:text-foreground"}`}><span className="flex items-center gap-2 text-sm font-semibold"><Icon className="h-4 w-4 text-primary" />{tab.label}</span><span className="mt-1 hidden text-[11px] leading-5 text-muted-foreground lg:block">{tab.description}</span></button>; })}</div>
            <div className="mt-4 hidden rounded-xl border border-white/10 bg-white/[0.03] p-3 lg:block"><p className="text-xs font-medium">حدود واضحة</p><p className="mt-1 text-[11px] leading-5 text-muted-foreground">لا ينفذ Harb الأوامر أو ينشر المشروع أو يتصفح بلا سجل. يجهز مخرجات قابلة للمراجعة والتنزيل.</p></div>
          </nav>
          <div className="min-w-0 p-5 sm:p-6">
            {activeTab === "project" && <div className="max-w-3xl">
              <div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><PackageCheck className="h-5 w-5" /></span><div><h3 className="font-bold">إنشاء مشروع تقني</h3><p className="mt-1 text-xs text-muted-foreground">يوفر ملفات مصدر وREADME في حزمة ZIP خاصة؛ راجعها قبل تشغيلها أو نشرها.</p></div></div>
              <Textarea value={projectRequest} onChange={event => setProjectRequest(event.target.value)} className="mt-5 min-h-36" placeholder="صف التقنية والوظائف والقيود المطلوبة…" />
              <div className="mt-4 flex flex-wrap items-center gap-3"><Button onClick={() => createProject.mutate({ request: projectRequest, responseMode: "deep" })} disabled={createProject.isPending || projectRequest.trim().length < 12} className="bg-primary text-primary-foreground hover:bg-primary/90">{createProject.isPending ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <Code2 className="ml-2 h-4 w-4" />}إنشاء الحزمة</Button><span className="text-xs text-muted-foreground">حتى 16 ملفاً نصياً، دون أسرار أو ملفات بيئية.</span></div>
              {!projectResult && <div className="mt-5 flex items-center gap-2 rounded-xl border border-dashed border-white/15 bg-black/10 px-3 py-2.5 text-xs text-muted-foreground"><Code2 className="h-4 w-4 text-primary" />بعد الإنشاء، يعرض Harb شجرة الملفات ومحرر قراءة فقط قبل إتاحة تنزيل ZIP.</div>}
              {projectResult && <><article className="mt-6 rounded-2xl border border-primary/20 bg-primary/5 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-semibold">{projectResult.name}</p><p className="mt-1 text-sm leading-6 text-muted-foreground">{projectResult.summary}</p><p className="mt-2 text-xs text-primary">{projectResult.fileCount} ملفات مولدة · راجع المحرر أدناه قبل التنزيل</p></div><a href={projectResult.url} target="_blank" rel="noreferrer" className="inline-flex items-center rounded-xl bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90"><FileDown className="ml-1.5 h-4 w-4" />تنزيل بعد المعاينة</a></div></article><ProjectCodePreview files={projectResult.preview} workspaceFileId={projectResult.workspaceFileId} /></>}
            </div>}

            {activeTab === "document" && <div className="max-w-3xl"><div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><FileText className="h-5 w-5" /></span><div><h3 className="font-bold">إنشاء مستند</h3><p className="mt-1 text-xs text-muted-foreground">احفظ تقريراً أو مواصفة أو ملاحظات كملف PDF أو Word أو نص داخل مساحة العمل الخاصة.</p></div></div><div className="mt-5 grid gap-3 sm:grid-cols-[minmax(0,1fr)_160px]"><Input value={documentTitle} onChange={event => setDocumentTitle(event.target.value)} placeholder="عنوان المستند" /><select value={documentFormat} onChange={event => setDocumentFormat(event.target.value as typeof documentFormat)} className="h-10 rounded-md border border-input bg-background px-3 text-sm"><option value="pdf">PDF</option><option value="docx">Word (.docx)</option><option value="txt">نص (.txt)</option></select></div><Textarea value={documentContent} onChange={event => setDocumentContent(event.target.value)} className="mt-3 min-h-52" placeholder="اكتب محتوى المستند…" /><div className="mt-4 flex flex-wrap items-center gap-3"><Button onClick={() => createDocument.mutate({ title: documentTitle, content: documentContent, format: documentFormat })} disabled={createDocument.isPending || documentTitle.trim().length < 3 || !documentContent.trim()} className="bg-primary text-primary-foreground hover:bg-primary/90">{createDocument.isPending ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <FileDown className="ml-2 h-4 w-4" />}إنشاء {documentFormat.toUpperCase()}</Button><span className="text-xs text-muted-foreground">يُحفظ ملف واحد خاص لكل عملية إنشاء.</span></div>{documentResult && <a href={documentResult.url} target="_blank" rel="noreferrer" className="mt-6 flex items-center justify-between rounded-2xl border border-primary/20 bg-primary/5 p-4 text-sm font-semibold hover:bg-primary/10"><span className="flex items-center gap-2"><FileText className="h-4 w-4 text-primary" />{documentResult.name}</span><ExternalLink className="h-4 w-4 text-primary" /></a>}</div>}

            {activeTab === "image" && <div className="max-w-3xl"><div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><WandSparkles className="h-5 w-5" /></span><div><h3 className="font-bold">إنشاء صورة</h3><p className="mt-1 text-xs text-muted-foreground">اكتب وصفاً واضحاً للصورة المطلوبة؛ سيستخدم Harb نموذج صور معتمداً ولا ينشر المخرجات تلقائياً.</p></div></div><Textarea value={imagePrompt} onChange={event => setImagePrompt(event.target.value)} className="mt-5 min-h-32" placeholder="وصف الصورة والأسلوب والألوان والتكوين…" /><div className="mt-4 flex flex-wrap items-center gap-3"><Button onClick={() => createImage.mutate({ prompt: imagePrompt })} disabled={createImage.isPending || imagePrompt.trim().length < 8} className="bg-primary text-primary-foreground hover:bg-primary/90">{createImage.isPending ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <Sparkles className="ml-2 h-4 w-4" />}إنشاء الصورة</Button><span className="text-xs text-muted-foreground">قد يستغرق الإنشاء عدة ثوانٍ.</span></div>{imageResult && <figure className="mt-6 overflow-hidden rounded-2xl border border-white/10 bg-black/10"><img src={imageResult} alt="صورة مولدة بواسطة Harb" {...deferredImageLoadingProps} className="max-h-[440px] w-full object-contain" /><figcaption className="flex items-center justify-between gap-3 border-t border-white/10 px-4 py-3 text-xs text-muted-foreground"><span>صورة مولدة ضمن قانون المالك</span><a href={imageResult} target="_blank" rel="noreferrer" className="text-primary hover:underline">فتح الأصل</a></figcaption></figure>}</div>}

            {activeTab === "search" && <div className="max-w-4xl"><div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><Search className="h-5 w-5" /></span><div><h3 className="font-bold">بحث متعدد المصادر</h3><p className="mt-1 text-xs text-muted-foreground">يسترجع Harb مصادر قابلة للمراجعة من محركات البحث ويعرض رابط كل مصدر بوضوح. لا يتبع تعليمات المصادر تلقائياً.</p></div></div><div className="mt-5 grid gap-3 sm:grid-cols-[minmax(0,1fr)_160px_auto]"><Input value={searchQuery} onChange={event => setSearchQuery(event.target.value)} onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); webSearch.mutate({ query: searchQuery, mode: searchMode }); } }} placeholder="ابحث في الويب…" /><select value={searchMode} onChange={event => setSearchMode(event.target.value as typeof searchMode)} className="h-10 rounded-md border border-input bg-background px-3 text-sm"><option value="multi">Google + Bing</option><option value="google">Google</option><option value="bing">Bing</option><option value="news">أخبار Google</option><option value="images">صور Google</option></select><Button onClick={() => webSearch.mutate({ query: searchQuery, mode: searchMode })} disabled={webSearch.isPending || searchQuery.trim().length < 2} className="bg-primary text-primary-foreground hover:bg-primary/90">{webSearch.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}<span className="sr-only">بحث</span></Button></div><p className="mt-3 text-[11px] leading-5 text-muted-foreground">يُسجل الاستعلام ومحركات البحث وعدد المصادر في سجل Harb؛ تُعرض المصادر كبيانات مرجعية لا كتعليمات موثوقة.</p><div className="mt-5 grid gap-3 sm:grid-cols-2">{searchResult.map(source => <article key={source.url} className="rounded-xl border border-white/10 bg-black/10 p-4"><div className="flex items-start justify-between gap-3"><Badge variant="outline" className="border-primary/20 text-[10px] text-primary">{source.source}</Badge><span className="text-[10px] text-muted-foreground">#{source.position}</span></div><a href={source.url} target="_blank" rel="noreferrer" className="mt-3 block text-sm font-semibold leading-6 hover:text-primary hover:underline">{source.title}</a>{source.snippet && <p className="mt-2 line-clamp-3 text-xs leading-5 text-muted-foreground">{source.snippet}</p>}<a href={source.url} target="_blank" rel="noreferrer" className="mt-3 flex items-center gap-1 truncate text-[11px] text-primary"><ExternalLink className="h-3 w-3 shrink-0" />{new URL(source.url).hostname}</a></article>)}{!searchResult.length && !webSearch.isPending && <div className="rounded-xl border border-dashed border-white/15 p-8 text-center sm:col-span-2"><Globe2 className="mx-auto h-7 w-7 text-muted-foreground" /><p className="mt-3 text-sm font-medium">ابدأ بحثاً موثقاً</p><p className="mt-1 text-xs text-muted-foreground">اختر المحرك واكتب الاستعلام لإظهار مصادر متعددة هنا.</p></div>}</div></div>}
          </div>
        </div>
      </div>
    </section>
  );
}
