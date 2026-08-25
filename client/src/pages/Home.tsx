import { useAuth } from "@/_core/hooks/useAuth";
import { AIChatBox, type ChatAttachment, type Message } from "@/components/AIChatBox";
import { HarbAssistantWorkspace, type ResponseMode } from "@/components/HarbAssistantWorkspace";
import { CyberOperationsPanel } from "@/components/CyberOperationsPanel";
import { ModelLabPanel } from "@/components/ModelLabPanel";
import { BenchmarkPanel } from "@/components/BenchmarkPanel";
import { KnowledgeControlPanel } from "@/components/KnowledgeControlPanel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { startLogin } from "@/const";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  Activity,
  ArrowDown,
  ArrowUp,
  Beaker,
  Bot,
  CheckCircle2,
  FileText,
  FolderOpen,
  Gavel,
  HardDriveUpload,
  KeyRound,
  Laptop,
  Loader2,
  LockKeyhole,
  LogOut,
  MessageSquare,
  Network,
  Plus,
  ScanLine,
  Search,
  ShieldAlert,
  ShieldCheck,
  TerminalSquare,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

type RuleScope = "all" | "general" | "command" | "file_change" | "data_share";
type RuleAction = "allow" | "approval" | "deny";
type DesktopScope = "read_files" | "run_programs" | "run_commands" | "modify_files";

type RuleDraft = {
  title: string;
  description: string;
  matchTerms: string;
  scope: RuleScope;
  action: RuleAction;
  priority: number;
};

const emptyDraft: RuleDraft = {
  title: "",
  description: "",
  matchTerms: "",
  scope: "all",
  action: "approval",
  priority: 500,
};

const scopeLabels: Record<RuleScope, string> = {
  all: "كافة الطلبات",
  general: "المهام العامة",
  command: "الأوامر والبرامج",
  file_change: "تعديل الملفات",
  data_share: "مشاركة البيانات",
};

const actionLabels: Record<RuleAction, string> = {
  allow: "سماح",
  approval: "طلب موافقة",
  deny: "رفض",
};

const desktopScopeOptions: Array<{ id: DesktopScope; label: string }> = [
  { id: "read_files", label: "قراءة الملفات" },
  { id: "run_programs", label: "تشغيل البرامج" },
  { id: "run_commands", label: "تنفيذ الأوامر" },
  { id: "modify_files", label: "تعديل الملفات" },
];

const taskStatus = {
  queued: { label: "قيد المعالجة", className: "text-sky-200 bg-sky-400/10 border-sky-300/15" },
  needs_approval: { label: "بانتظار موافقة", className: "text-amber-200 bg-amber-400/10 border-amber-300/15" },
  blocked: { label: "مرفوض", className: "text-rose-200 bg-rose-400/10 border-rose-300/15" },
  completed: { label: "مكتمل", className: "text-emerald-200 bg-emerald-400/10 border-emerald-300/15" },
  failed: { label: "تعذّر", className: "text-rose-200 bg-rose-400/10 border-rose-300/15" },
};

function formatDate(value: Date | string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("ar", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} بايت`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} كيلوبايت`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} ميغابايت`;
}

function fileToBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("تعذر قراءة الملف."));
    reader.onload = () => {
      const base64 = String(reader.result).split(",")[1];
      if (base64) resolve(base64);
      else reject(new Error("تعذر تحويل الملف."));
    };
    reader.readAsDataURL(file);
  });
}

function classificationLabel(value: "private" | "restricted" | "shared") {
  return value === "private" ? "خاص" : value === "restricted" ? "مقيّد" : "مشترك";
}

function permissionStateLabel(value: "allowed" | "restricted" | "approval_required") {
  return value === "allowed" ? "مسموح" : value === "restricted" ? "مقيّد" : "يحتاج موافقة";
}

function approvalStateLabel(value: "not_required" | "pending" | "approved" | "rejected") {
  return value === "not_required" ? "لا تحتاج" : value === "pending" ? "بانتظار القرار" : value === "approved" ? "موافق عليها" : "مرفوضة";
}

function Metric({ label, value, hint, icon: Icon }: { label: string; value: number; hint: string; icon: typeof ShieldCheck }) {
  return (
    <div className="glass-panel rounded-2xl p-4 transition-transform duration-200 hover:-translate-y-0.5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="mt-2 text-3xl font-bold tracking-tight">{value}</p>
          <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
        </div>
        <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary"><Icon className="h-5 w-5" /></span>
      </div>
    </div>
  );
}

function PolicyDialog({ onCreate, isPending }: { onCreate: (draft: RuleDraft) => void; isPending: boolean }) {
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<RuleDraft>(emptyDraft);
  const utils = trpc.useUtils();
  const savedRules = trpc.harb.dashboard.useQuery(undefined, { enabled: open });
  const updateRule = trpc.harb.rules.update.useMutation({
    onSuccess: () => {
      toast.success("تم حفظ تعديلات القانون.");
      void utils.harb.dashboard.invalidate();
      void utils.harb.audit.list.invalidate();
    },
    onError: error => toast.error(error.message),
  });

  const reset = () => {
    setEditingId(null);
    setDraft(emptyDraft);
  };
  const openRule = (rule: NonNullable<typeof savedRules.data>["rules"][number]) => {
    setEditingId(rule.id);
    setDraft({
      title: rule.title,
      description: rule.description ?? "",
      matchTerms: rule.matchTerms,
      scope: rule.scope as RuleScope,
      action: rule.action as RuleAction,
      priority: rule.priority,
    });
  };
  const save = () => {
    if (draft.title.trim().length < 3) return toast.error("اكتب اسماً واضحاً للقاعدة.");
    if (editingId) updateRule.mutate({ id: editingId, ...draft });
    else onCreate(draft);
    reset();
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={value => { setOpen(value); if (!value) reset(); }}>
      <DialogTrigger asChild><Button className="rounded-xl bg-primary text-primary-foreground hover:bg-primary/90"><Gavel className="ml-2 h-4 w-4" />إدارة القوانين</Button></DialogTrigger>
      <DialogContent className="border-white/10 bg-[#152130] text-foreground sm:max-w-xl" dir="rtl">
        <DialogHeader>
          <DialogTitle>{editingId ? "تحرير قانون المالك" : "إضافة قانون للمالك"}</DialogTitle>
          <DialogDescription>تفحص المنصة القوانين من الأولوية الأعلى إلى الأدنى قبل معالجة الطلب.</DialogDescription>
        </DialogHeader>
        <div className="rounded-xl border border-white/10 bg-black/10 p-3">
          <div className="flex items-center justify-between gap-3"><p className="text-xs font-semibold text-muted-foreground">القواعد الحالية</p>{editingId ? <Button variant="ghost" size="sm" onClick={reset}>قاعدة جديدة</Button> : null}</div>
          <div className="mt-2 max-h-28 space-y-1 overflow-y-auto">
            {savedRules.data?.rules.length ? savedRules.data.rules.map(rule => <button key={rule.id} onClick={() => openRule(rule)} className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-right text-xs transition-colors hover:bg-white/5"><span className="truncate">{rule.title}</span><span className="text-primary">تحرير</span></button>) : <p className="text-xs text-muted-foreground">اختر «قاعدة جديدة» أو انتظر تحميل القواعد.</p>}
          </div>
        </div>
        <div className="grid gap-4 py-2">
          <Input value={draft.title} onChange={event => setDraft({ ...draft, title: event.target.value })} placeholder="اسم القاعدة" />
          <Textarea value={draft.description} onChange={event => setDraft({ ...draft, description: event.target.value })} placeholder="اشرح الهدف وحدود القاعدة" />
          <Input value={draft.matchTerms} onChange={event => setDraft({ ...draft, matchTerms: event.target.value })} placeholder="كلمات المطابقة، مفصولة بفواصل" />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <select className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={draft.scope} onChange={event => setDraft({ ...draft, scope: event.target.value as RuleScope })}>{Object.entries(scopeLabels).map(([key, value]) => <option key={key} value={key}>{value}</option>)}</select>
            <select className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={draft.action} onChange={event => setDraft({ ...draft, action: event.target.value as RuleAction })}>{Object.entries(actionLabels).map(([key, value]) => <option key={key} value={key}>{value}</option>)}</select>
            <Input type="number" min={0} max={10000} value={draft.priority} onChange={event => setDraft({ ...draft, priority: Number(event.target.value) })} aria-label="الأولوية" />
          </div>
        </div>
        <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>إلغاء</Button><Button onClick={save} disabled={isPending || updateRule.isPending}>{(isPending || updateRule.isPending) && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}{editingId ? "حفظ التعديلات" : "حفظ القانون"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function Home() {
  const { user, loading, isAuthenticated, logout } = useAuth();
  const utils = trpc.useUtils();
  const [messages, setMessages] = useState<Message[]>([]);
  const [workspace, setWorkspace] = useState<"assistant" | "control">("assistant");
  const [responseMode, setResponseMode] = useState<ResponseMode>("balanced");
  const [activeConversationId, setActiveConversationId] = useState<string | undefined>();
  const [pendingAttachments, setPendingAttachments] = useState<ChatAttachment[]>([]);
  const [isUploadingChatAttachments, setIsUploadingChatAttachments] = useState(false);
  const [auditSearch, setAuditSearch] = useState("");
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dashboard = trpc.harb.dashboard.useQuery(undefined, { enabled: isAuthenticated });
  const audit = trpc.harb.audit.list.useQuery({ search: auditSearch }, { enabled: isAuthenticated });
  const conversations = trpc.harb.conversations.list.useQuery(undefined, { enabled: isAuthenticated });
  const conversationInput = useMemo(() => ({ conversationId: activeConversationId ?? "unselected" }), [activeConversationId]);
  const activeConversation = trpc.harb.conversations.get.useQuery(conversationInput, { enabled: isAuthenticated && Boolean(activeConversationId) });
  const refresh = () => { void utils.harb.dashboard.invalidate(); void utils.harb.audit.list.invalidate(); };

  useEffect(() => {
    if (!activeConversation.data) return;
    const attachmentsByMessage = new Map<string, ChatAttachment[]>();
    activeConversation.data.attachments.forEach(attachment => {
      if (!attachment.messageId) return;
      const items = attachmentsByMessage.get(attachment.messageId) ?? [];
      items.push(attachment);
      attachmentsByMessage.set(attachment.messageId, items);
    });
    setMessages(activeConversation.data.messages.map(message => ({ id: message.id, role: message.role, content: message.content, attachments: attachmentsByMessage.get(message.id) })));
  }, [activeConversation.data]);

  const submitTask = trpc.harb.tasks.submit.useMutation({
    onSuccess: result => {
      setActiveConversationId(result.conversationId);
      setMessages(current => [...current.filter(message => Boolean(message.id)), { id: result.userMessage.id, role: "user", content: result.userMessage.content, attachments: result.attachments }, { id: result.assistantMessage.id, role: "assistant", content: result.message }]);
      setPendingAttachments([]);
      void utils.harb.conversations.list.invalidate();
      void utils.harb.conversations.get.invalidate();
      refresh();
    },
    onError: error => setMessages(current => [...current, { role: "assistant", content: `**تعذر إكمال الطلب.**\n\n${error.message}` }]),
  });
  const createConversation = trpc.harb.conversations.create.useMutation({
    onSuccess: conversation => { setActiveConversationId(conversation.id); setMessages([]); setPendingAttachments([]); void utils.harb.conversations.list.invalidate(); },
    onError: error => toast.error(error.message),
  });
  const rateMessage = trpc.harb.conversations.feedback.useMutation({
    onSuccess: () => { toast.success("تم تسجيل تقييمك لتحسين مراجعة الردود."); void utils.harb.conversations.get.invalidate(); },
    onError: error => toast.error(error.message),
  });
  const uploadConversationAttachment = trpc.harb.conversations.attachments.upload.useMutation({ onError: error => toast.error(error.message) });
  const createRule = trpc.harb.rules.create.useMutation({ onSuccess: () => { toast.success("تمت إضافة القاعدة."); refresh(); }, onError: error => toast.error(error.message) });
  const updateRule = trpc.harb.rules.update.useMutation({ onSuccess: () => { toast.success("تم تحديث القانون."); refresh(); }, onError: error => toast.error(error.message) });
  const resolveApproval = trpc.harb.approvals.resolve.useMutation({ onSuccess: () => { toast.success("تم تسجيل القرار في سجل التدقيق."); refresh(); }, onError: error => toast.error(error.message) });
  const uploadFile = trpc.harb.files.upload.useMutation({ onSuccess: () => { toast.success("تم حفظ الملف في مساحة العمل الخاصة."); refresh(); }, onError: error => toast.error(error.message) });
  const updateFileClassification = trpc.harb.files.updateClassification.useMutation({ onSuccess: () => { toast.success("تم تحديث تصنيف الملف وتسجيل القرار."); refresh(); }, onError: error => toast.error(error.message) });
  const requestFileApproval = trpc.harb.files.requestApproval.useMutation({ onSuccess: () => { toast.success("أُضيف طلب الموافقة إلى سجل الملف."); refresh(); }, onError: error => toast.error(error.message) });
  const resolveFileApproval = trpc.harb.files.resolveApproval.useMutation({ onSuccess: () => { toast.success("تم تسجيل قرار الملف."); refresh(); }, onError: error => toast.error(error.message) });
  const pairing = trpc.harb.desktop.createPairing.useMutation({ onSuccess: result => setPairingCode(result.code), onError: error => toast.error(error.message) });
  const updateAgentScopes = trpc.harb.desktop.updateScopes.useMutation({ onSuccess: () => { toast.success("تم تحديث نطاقات الجهاز المتصل."); refresh(); }, onError: error => toast.error(error.message) });

  const handleSend = (request: string) => {
    const conversation = messages
      .filter(message => message.role === "user" || message.role === "assistant")
      .slice(-8)
      .map(message => ({ role: message.role as "user" | "assistant", content: message.content }));
    setMessages(current => [...current, { role: "user", content: request, attachments: pendingAttachments }]);
    submitTask.mutate({ request, responseMode, conversationId: activeConversationId, attachmentIds: pendingAttachments.map(attachment => attachment.id), conversation });
  };
  const handleChatAttachments = async (files: File[]) => {
    const allowedMimeTypes = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);
    const remaining = 3 - pendingAttachments.length;
    if (!remaining) return toast.error("يمكن إرفاق ثلاثة عناصر كحد أقصى مع الرسالة الواحدة.");
    const selected = files.slice(0, remaining);
    if (files.length > selected.length) toast.error("احتُفظ بأول ثلاثة مرفقات فقط.");
    if (selected.some(file => !allowedMimeTypes.has(file.type))) return toast.error("يدعم صندوق المحادثة صور JPEG وPNG وWebP وملفات PDF فقط.");
    if (selected.some(file => file.size > 8 * 1024 * 1024)) return toast.error("الحد الأقصى للمرفق الواحد هو 8 ميغابايت.");
    setIsUploadingChatAttachments(true);
    try {
      let conversationId = activeConversationId;
      if (!conversationId) {
        const conversation = await createConversation.mutateAsync({ title: "محادثة جديدة" });
        conversationId = conversation.id;
      }
      for (const file of selected) {
        const attachment = await uploadConversationAttachment.mutateAsync({ conversationId, name: file.name, mimeType: file.type, base64: await fileToBase64(file) });
        setPendingAttachments(current => [...current, attachment]);
      }
      void utils.harb.conversations.get.invalidate();
      void utils.harb.conversations.list.invalidate();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "تعذر رفع المرفق.");
    } finally {
      setIsUploadingChatAttachments(false);
    }
  };
  const handleUpload = (file?: File) => {
    if (!file) return;
    if (file.size > 10_000_000) return toast.error("يدعم الإصدار الأول ملفات حتى 10 ميغابايت.");
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = String(reader.result).split(",")[1];
      if (!base64) return toast.error("تعذر قراءة الملف.");
      uploadFile.mutate({ name: file.name, mimeType: file.type || "application/octet-stream", base64, classification: "private" });
    };
    reader.readAsDataURL(file);
  };

  if (loading) return <div className="harb-shell flex min-h-screen items-center justify-center"><Loader2 className="h-7 w-7 animate-spin text-primary" /></div>;
  if (!user) return (
    <main className="harb-shell flex min-h-screen items-center justify-center px-5" dir="rtl">
      <section className="glass-panel max-w-lg rounded-[2rem] p-8 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-primary/30 bg-primary/10"><ShieldCheck className="h-8 w-8 text-primary" /></div>
        <p className="section-kicker mt-7">Harb Control Center</p><h1 className="mt-3 text-3xl font-bold">مركز السيطرة الذكي</h1>
        <p className="mt-4 leading-7 text-muted-foreground">مساحة موثوقة لإدارة طلبات الذكاء الاصطناعي والملفات والقوانين والموافقات دون فقدان أثر القرار.</p>
        <Button size="lg" onClick={() => startLogin()} className="mt-7 w-full rounded-xl bg-primary text-primary-foreground">تسجيل الدخول الآمن</Button>
      </section>
    </main>
  );

  const data = dashboard.data;
  const tasks = data?.tasks ?? [];
  const rules = data?.rules ?? [];
  const approvals = data?.approvals ?? [];
  const files = data?.files ?? [];
  const fileApprovals = data?.fileApprovals ?? [];
  const agents = data?.agents ?? [];
  const auditEntries = audit.data ?? data?.audit ?? [];
  const activeRules = rules.filter(rule => rule.isActive).length;
  const pendingApprovals = approvals.filter(item => item.status === "requested").length;
  const feedbackByMessage = Object.fromEntries((activeConversation.data?.feedback ?? []).map(item => [item.messageId, item.rating])) as Record<string, "up" | "down">;

  if (workspace === "assistant") {
    return <HarbAssistantWorkspace
      userName={user.name || "المالك"}
      messages={messages}
      isLoading={submitTask.isPending}
      responseMode={responseMode}
      activeRules={activeRules}
      pendingApprovals={pendingApprovals}
      taskCount={tasks.length}
      onSendMessage={handleSend}
      onResponseModeChange={setResponseMode}
      onNewConversation={() => createConversation.mutate({ title: "محادثة جديدة" })}
      onOpenControlCenter={() => setWorkspace("control")}
      conversations={conversations.data ?? []}
      activeConversationId={activeConversationId}
      feedbackByMessage={feedbackByMessage}
      onSelectConversation={conversationId => { setActiveConversationId(conversationId); setMessages([]); setPendingAttachments([]); }}
      onRateMessage={(messageId, rating) => {
        if (!activeConversationId) return;
        rateMessage.mutate({ messageId, conversationId: activeConversationId, rating });
      }}
      pendingAttachments={pendingAttachments}
      isUploadingAttachments={isUploadingChatAttachments}
      onSelectFiles={files => { void handleChatAttachments(files); }}
      onRemoveAttachment={attachmentId => setPendingAttachments(current => current.filter(attachment => attachment.id !== attachmentId))}
    />;
  }

  return (
    <div className="harb-shell min-h-screen" dir="rtl">
      <div className="mx-auto grid min-h-screen max-w-[1600px] grid-cols-1 lg:grid-cols-[270px_minmax(0,1fr)]">
        <aside className="border-b border-white/10 bg-[#101924]/70 p-5 backdrop-blur-xl lg:border-b-0 lg:border-l">
          <div className="flex items-center gap-3 px-2"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-lg font-black text-primary-foreground">ح</div><div><p className="font-bold tracking-tight">Harb</p><p className="text-xs text-muted-foreground">مركز السيطرة</p></div></div>
          <nav className="mt-9 grid gap-1 text-sm">
            {[{ href: "#overview", label: "نظرة عامة", icon: Activity }, { href: "#cyber", label: "العمليات السيبرانية", icon: ShieldCheck }, { href: "#lab", label: "مختبر النموذج", icon: Beaker }, { href: "#tasks", label: "محادثة المهام", icon: MessageSquare }, { href: "#files", label: "مساحة الملفات", icon: FolderOpen }, { href: "#rules", label: "قوانين المالك", icon: Gavel }, { href: "#audit", label: "سجل التدقيق", icon: ScanLine }, { href: "#desktop", label: "عميل سطح المكتب", icon: Laptop }].map(item => <a key={item.href} href={item.href} className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground"><item.icon className="h-4 w-4" />{item.label}</a>)}
          </nav>
          <div className="mt-9 rounded-2xl border border-primary/15 bg-primary/5 p-4"><div className="flex items-center gap-2 text-sm font-semibold text-primary"><ShieldCheck className="h-4 w-4" />حماية Harb مفعّلة</div><p className="mt-2 text-xs leading-5 text-muted-foreground">لا تُرسل العمليات الحساسة إلى الأجهزة المتصلة دون تقييم قانوني وموافقة عند اللزوم.</p></div>
          <div className="mt-6 flex items-center gap-3 border-t border-white/10 pt-5"><div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-sm font-bold">{user.name?.slice(0, 1) || "م"}</div><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{user.name || "المالك"}</p><p className="truncate text-xs text-muted-foreground">مالك النظام</p></div><button onClick={logout} aria-label="تسجيل الخروج" className="rounded-lg p-2 text-muted-foreground hover:bg-white/5 hover:text-foreground"><LogOut className="h-4 w-4" /></button></div>
        </aside>

        <main className="min-w-0 p-4 sm:p-7">
          <header className="mb-7 flex flex-col gap-4 border-b border-white/10 pb-6 sm:flex-row sm:items-center sm:justify-between"><div><p className="section-kicker">Harb / Operations</p><h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">أهلاً بك، {user.name || "المالك"}</h1><p className="mt-1 text-sm text-muted-foreground">قرارات قابلة للتفسير قبل التنفيذ، وسجل موثوق بعده.</p></div><div className="flex flex-wrap items-center gap-2 self-start"><Button variant="outline" onClick={() => setWorkspace("assistant")} className="rounded-full border-white/15 bg-white/5 text-xs"><MessageSquare className="ml-1.5 h-4 w-4" />فتح المحادثة</Button><div className="flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-2 text-xs text-primary"><span className="status-dot" />Harb Core متصل <span className="text-primary/60">•</span> وضع محمي</div></div></header>

          <section id="overview" className="scroll-mt-6"><div className="mb-4 flex items-center justify-between"><div><p className="section-kicker">الحالة التشغيلية</p><h2 className="mt-1 text-xl font-bold">نظرة عامة</h2></div><Badge variant="outline" className="border-primary/20 bg-primary/5 text-primary">آخر مزامنة الآن</Badge></div><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Metric label="قوانين فعالة" value={activeRules} hint="تُفحص حسب الأولوية" icon={Gavel} /><Metric label="مهام مسجلة" value={tasks.length} hint="تشمل القرارات والنتائج" icon={Activity} /><Metric label="موافقات معلقة" value={pendingApprovals} hint="لن تنفذ قبل القرار" icon={KeyRound} /><Metric label="ملفات خاصة" value={files.length} hint="محفوظة مع بياناتها الوصفية" icon={FolderOpen} /></div></section>

          <CyberOperationsPanel />

          <ModelLabPanel />

          <BenchmarkPanel />

          <KnowledgeControlPanel />

          <section id="tasks" className="mt-7 grid scroll-mt-6 gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(300px,0.65fr)]">
            <div className="glass-panel overflow-hidden rounded-2xl"><div className="flex items-center justify-between border-b border-white/10 p-5"><div><p className="section-kicker">Task Console</p><h2 className="mt-1 text-lg font-bold">محادثة المهام</h2></div><Badge variant="outline" className="border-primary/20 text-primary"><Bot className="ml-1 h-3.5 w-3.5" />فحص قبل التنفيذ</Badge></div><div className="p-3"><AIChatBox messages={messages} onSendMessage={handleSend} isLoading={submitTask.isPending} height="430px" className="border-0 bg-transparent shadow-none" placeholder="صف المهمة التي تريد من Harb تحليلها أو تنظيمها…" emptyStateMessage="ابدأ بطلب واضح؛ سيعرض Harb القرار قبل أي عملية حساسة." suggestedPrompts={["لخّص الملفات الموجودة في مساحة العمل", "أنشئ خطة لمراجعة مشروع برمجي", "احذف الملف القديم من جهازي"]} /></div></div>
            <div className="glass-panel rounded-2xl p-5"><div className="flex items-center justify-between"><div><p className="section-kicker">Execution</p><h2 className="mt-1 text-lg font-bold">حالة التنفيذ</h2></div><Activity className="h-5 w-5 text-primary" /></div><div className="mt-5 space-y-3">{tasks.length ? tasks.slice(0, 5).map(task => { const status = taskStatus[task.status]; return <article key={task.id} className="rounded-xl border border-white/8 bg-black/10 p-3"><div className="flex items-start justify-between gap-3"><p className="line-clamp-2 text-sm font-medium leading-6">{task.request}</p><Badge className={cn("shrink-0 border text-[10px]", status.className)}>{status.label}</Badge></div><p className="mt-2 line-clamp-2 text-xs leading-5 text-muted-foreground">{task.decisionReason}</p><p className="mt-2 text-[11px] text-muted-foreground">{formatDate(task.createdAt)}</p></article>; }) : <div className="rounded-xl border border-dashed border-white/15 p-5 text-center"><TerminalSquare className="mx-auto h-6 w-6 text-muted-foreground" /><p className="mt-2 text-sm font-medium">لا توجد مهام بعد</p><p className="mt-1 text-xs leading-5 text-muted-foreground">ستظهر هنا كل مهمة مع قرار القوانين وحالتها.</p></div>}</div></div>
          </section>

          <section id="files" className="mt-7 grid scroll-mt-6 gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(310px,0.8fr)]">
            <div className="glass-panel rounded-2xl p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="section-kicker">Workspace</p><h2 className="mt-1 text-lg font-bold">مساحة الملفات</h2></div><input ref={fileInputRef} type="file" className="hidden" onChange={event => handleUpload(event.target.files?.[0])} /><Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={uploadFile.isPending} className="rounded-xl border-white/15 bg-white/5"><HardDriveUpload className="ml-2 h-4 w-4" />{uploadFile.isPending ? "جارٍ الحفظ…" : "رفع ملف"}</Button></div><p className="mt-2 text-xs text-muted-foreground">تُخزّن الملفات خاصةً افتراضياً، ويمكن للمالك إعادة تصنيفها. لا يعني التصنيف المشترك إرسال الملف تلقائياً؛ تبقى المشاركة خاضعة للقوانين والموافقة.</p><div className="mt-5 space-y-2">{files.length ? files.map(file => <article key={file.id} className="flex flex-col gap-3 rounded-xl border border-white/8 bg-black/10 p-3 sm:flex-row sm:items-center"><a href={file.storageUrl} target="_blank" rel="noreferrer" className="flex min-w-0 flex-1 items-center gap-3 transition-colors hover:text-primary"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/5"><FileText className="h-4 w-4 text-primary" /></span><span className="min-w-0"><span className="block truncate text-sm font-medium">{file.name}</span><span className="mt-1 block text-xs text-muted-foreground">{file.mimeType} · {formatBytes(file.size)} · {formatDate(file.createdAt)}</span></span></a><div className="flex items-center gap-2 self-end sm:self-auto"><select aria-label={`تصنيف ${file.name}`} value={file.classification} onChange={event => updateFileClassification.mutate({ id: file.id, classification: event.target.value as "private" | "restricted" | "shared" })} className="h-8 rounded-md border border-white/15 bg-background px-2 text-xs"><option value="private">خاص</option><option value="restricted">مقيّد</option><option value="shared">مشترك</option></select><Badge variant="outline" className="border-white/10 text-[10px] text-muted-foreground">{classificationLabel(file.classification)}</Badge></div><p className="w-full text-[11px] text-muted-foreground sm:hidden">{file.classification === "private" ? "محمي داخل مساحة العمل" : file.classification === "restricted" ? "أي تعديل أو مشاركة يحتاج موافقة" : "لا يزال الإرسال الخارجي خاضعاً للقوانين"}</p></article>) : <div className="rounded-xl border border-dashed border-white/15 p-7 text-center"><FolderOpen className="mx-auto h-7 w-7 text-muted-foreground" /><p className="mt-3 text-sm font-medium">مساحة عمل فارغة</p><p className="mt-1 text-xs text-muted-foreground">ارفع ملفاً لربطه بمهام Harb وسجل التدقيق.</p></div>}</div></div>
            <div className="glass-panel rounded-2xl p-5"><div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-300/10 text-amber-200"><LockKeyhole className="h-5 w-5" /></span><div><p className="section-kicker text-amber-200">Consent Queue</p><h2 className="mt-1 text-lg font-bold">موافقات صريحة</h2></div></div><div className="mt-5 space-y-3">{approvals.filter(item => item.status === "requested").length ? approvals.filter(item => item.status === "requested").map(item => <article key={item.id} className="rounded-xl border border-amber-200/15 bg-amber-300/5 p-3"><p className="text-sm font-medium leading-6">{item.summary}</p><p className="mt-2 text-xs text-muted-foreground">نوع العملية: {scopeLabels[item.action as RuleScope] || item.action} · تنتهي {formatDate(item.expiresAt)}</p><div className="mt-3 flex gap-2"><Button size="sm" onClick={() => resolveApproval.mutate({ id: item.id, status: "approved" })} className="h-8 bg-primary text-primary-foreground"><CheckCircle2 className="ml-1 h-3.5 w-3.5" />موافقة</Button><Button size="sm" variant="outline" onClick={() => resolveApproval.mutate({ id: item.id, status: "rejected" })} className="h-8 border-rose-200/20 text-rose-200 hover:bg-rose-400/10">رفض</Button></div></article>) : <div className="rounded-xl border border-dashed border-white/15 p-5 text-center"><ShieldCheck className="mx-auto h-6 w-6 text-primary" /><p className="mt-2 text-sm font-medium">لا توجد موافقات معلقة</p><p className="mt-1 text-xs text-muted-foreground">تظهر هنا العمليات الحساسة فقط.</p></div>}</div></div>
          </section>

          <section id="rules" className="mt-7 scroll-mt-6"><div className="glass-panel rounded-2xl p-5"><div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="section-kicker">Owner Policies</p><h2 className="mt-1 text-xl font-bold">محرك قوانين المالك</h2><p className="mt-1 text-sm text-muted-foreground">تقرر القاعدة الأعلى أولوية؛ ويُحفظ سبب القرار مع كل طلب.</p></div><PolicyDialog onCreate={draft => createRule.mutate({ ...draft, description: draft.description || undefined, isActive: true })} isPending={createRule.isPending} /></div><div className="mt-5 divide-y divide-white/8 rounded-xl border border-white/8 bg-black/10">{rules.map((rule, index) => <article key={rule.id} className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center"><div className="flex min-w-0 flex-1 gap-3"><span className={cn("mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", rule.action === "deny" ? "bg-rose-400/10 text-rose-200" : rule.action === "approval" ? "bg-amber-300/10 text-amber-200" : "bg-primary/10 text-primary")}><Gavel className="h-4 w-4" /></span><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="font-semibold">{rule.title}</p><Badge variant="outline" className="border-white/10 text-[10px] text-muted-foreground">{scopeLabels[rule.scope as RuleScope]}</Badge><Badge variant="outline" className="border-white/10 text-[10px] text-muted-foreground">{actionLabels[rule.action as RuleAction]}</Badge></div><p className="mt-1 text-sm leading-6 text-muted-foreground">{rule.description}</p><p className="mt-1 truncate text-xs text-muted-foreground">مطابقة: {rule.matchTerms || "على كامل النطاق"}</p></div></div><div className="flex items-center justify-between gap-3 lg:justify-end"><span className="text-xs text-muted-foreground">أولوية {rule.priority}</span><div className="flex items-center gap-1"><button onClick={() => { const before = rules[index - 1]; if (before) { updateRule.mutate({ id: rule.id, priority: before.priority }); updateRule.mutate({ id: before.id, priority: rule.priority }); } }} disabled={!index} className="rounded-md p-1.5 text-muted-foreground hover:bg-white/5 disabled:opacity-30" aria-label="رفع الأولوية"><ArrowUp className="h-4 w-4" /></button><button onClick={() => { const after = rules[index + 1]; if (after) { updateRule.mutate({ id: rule.id, priority: after.priority }); updateRule.mutate({ id: after.id, priority: rule.priority }); } }} disabled={index === rules.length - 1} className="rounded-md p-1.5 text-muted-foreground hover:bg-white/5 disabled:opacity-30" aria-label="خفض الأولوية"><ArrowDown className="h-4 w-4" /></button><Switch checked={rule.isActive} onCheckedChange={isActive => updateRule.mutate({ id: rule.id, isActive })} aria-label={`تفعيل ${rule.title}`} /></div></div></article>)}</div></div></section>

          <section id="audit" className="mt-7 scroll-mt-6"><div className="glass-panel rounded-2xl p-5"><div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="section-kicker">Traceability</p><h2 className="mt-1 text-xl font-bold">سجل التدقيق</h2><p className="mt-1 text-sm text-muted-foreground">بحث قابل للتتبع في الطلبات والقوانين والقرارات والموافقات.</p></div><div className="relative w-full sm:w-72"><Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={auditSearch} onChange={event => setAuditSearch(event.target.value)} className="pr-9" placeholder="ابحث في السجل…" /></div></div><div className="mt-5 space-y-2">{auditEntries.length ? auditEntries.slice(0, 10).map(entry => <article key={entry.id} className="flex items-start gap-3 rounded-xl border border-white/8 bg-black/10 p-3"><span className={cn("mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", entry.outcome.includes("blocked") || entry.outcome === "rejected" ? "bg-rose-400/10 text-rose-200" : entry.outcome.includes("approval") || entry.outcome === "pending" ? "bg-amber-300/10 text-amber-200" : "bg-primary/10 text-primary")}><ScanLine className="h-4 w-4" /></span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="text-sm font-medium">{entry.summary}</p><Badge variant="outline" className="border-white/10 text-[10px] text-muted-foreground">{entry.eventType}</Badge></div><p className="mt-1 text-xs text-muted-foreground">النتيجة: {entry.outcome} · {formatDate(entry.createdAt)}{entry.ruleIds ? ` · قوانين: ${entry.ruleIds}` : ""}</p></div></article>) : <div className="rounded-xl border border-dashed border-white/15 p-7 text-center"><ScanLine className="mx-auto h-7 w-7 text-muted-foreground" /><p className="mt-3 text-sm font-medium">لا توجد أحداث مطابقة</p><p className="mt-1 text-xs text-muted-foreground">ستُسجل كل عملية مهمة فور استخدامها.</p></div>}</div></div></section>

          <section id="desktop" className="mt-7 scroll-mt-6 pb-8"><div className="overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-l from-primary/10 via-[#152334]/90 to-[#111a26]/90 p-5 sm:p-7"><div className="grid gap-6 lg:grid-cols-[1fr_auto]"><div><div className="flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-xl border border-primary/25 bg-primary/10 text-primary"><Laptop className="h-5 w-5" /></span><div><p className="section-kicker">Desktop Gateway</p><h2 className="mt-1 text-xl font-bold">عميل Harb لسطح المكتب</h2></div></div><p className="mt-4 max-w-2xl leading-7 text-muted-foreground">تكامل مخصص لـ Windows وKali Linux. يسجل العميل نفسه برمز مؤقت لمرة واحدة، ثم لا يحصل على أي نطاق محلي حتى يفعّله المالك أدناه؛ وكل عمل حساس يمرّ أيضاً عبر قوانين Harb والموافقات.</p><div className="mt-5 flex flex-wrap gap-2">{desktopScopeOptions.map(scope => <Badge key={scope.id} variant="outline" className="border-white/12 bg-black/10 px-3 py-1.5 text-muted-foreground"><ShieldAlert className="ml-1.5 h-3.5 w-3.5 text-amber-200" />{scope.label} بموافقة</Badge>)}</div></div><div className="flex min-w-[250px] flex-col justify-center rounded-2xl border border-white/10 bg-black/15 p-5"><div className="flex items-center gap-2 text-sm font-semibold"><Network className="h-4 w-4 text-primary" />ربط جهاز جديد</div><p className="mt-2 text-xs leading-5 text-muted-foreground">أنشئ رمزاً مؤقتاً وأدخله في عميل Harb. الرمز لا يمنح صلاحيات تلقائية وينتهي خلال عشر دقائق.</p>{pairingCode ? <div className="mt-4 rounded-xl border border-primary/20 bg-primary/5 p-3 text-center"><p className="text-xs text-muted-foreground">رمز الربط المؤقت</p><p className="mt-1 font-mono text-lg font-bold tracking-widest text-primary" dir="ltr">{pairingCode}</p></div> : <Button onClick={() => pairing.mutate()} disabled={pairing.isPending} className="mt-4 bg-primary text-primary-foreground">{pairing.isPending ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <KeyRound className="ml-2 h-4 w-4" />}إنشاء رمز ربط</Button>}</div></div><div className="mt-6 rounded-2xl border border-white/10 bg-black/10 p-4"><div className="flex items-center justify-between"><div><p className="section-kicker">Connected Agents</p><h3 className="mt-1 font-bold">الأجهزة المسجلة</h3></div><Badge variant="outline" className="border-white/10 text-muted-foreground">{agents.length} جهاز</Badge></div><div className="mt-4 grid gap-3 lg:grid-cols-2">{agents.length ? agents.map(agent => { const granted = agent.scopes ? agent.scopes.split(",").filter(Boolean) as DesktopScope[] : []; return <article key={agent.id} className="rounded-xl border border-white/10 bg-background/40 p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-semibold">{agent.name}</p><p className="mt-1 text-xs text-muted-foreground">{agent.operatingSystem === "windows" ? "Windows" : "Kali Linux"} · آخر نبضة {formatDate(agent.lastSeenAt)}</p></div><Badge className={cn("border text-[10px]", agent.status === "online" ? "border-primary/20 bg-primary/10 text-primary" : "border-amber-200/20 bg-amber-300/10 text-amber-200")}>{agent.status === "online" ? "مهيأ" : "بلا صلاحيات"}</Badge></div><div className="mt-3 flex flex-wrap gap-2">{desktopScopeOptions.map(scope => <button key={scope.id} onClick={() => { const next = granted.includes(scope.id) ? granted.filter(item => item !== scope.id) : [...granted, scope.id]; updateAgentScopes.mutate({ id: agent.id, scopes: next }); }} disabled={updateAgentScopes.isPending} className={cn("rounded-lg border px-2.5 py-1.5 text-xs transition-colors", granted.includes(scope.id) ? "border-primary/30 bg-primary/10 text-primary" : "border-white/10 text-muted-foreground hover:bg-white/5")}>{granted.includes(scope.id) ? "✓ " : "+ "}{scope.label}</button>)}</div><p className="mt-3 text-[11px] text-muted-foreground">تعديل النطاقات لا يتجاوز قوانين المالك أو شرط الموافقة للعمليات الحساسة.</p></article>; }) : <div className="rounded-xl border border-dashed border-white/15 p-6 text-center lg:col-span-2"><Laptop className="mx-auto h-6 w-6 text-muted-foreground" /><p className="mt-2 text-sm font-medium">لا توجد أجهزة مسجلة</p><p className="mt-1 text-xs text-muted-foreground">ثبّت عميل Harb على Windows أو Kali Linux ثم استخدم رمز الربط المؤقت.</p></div>}</div></div></div></section>
          <section id="file-security" className="mt-7 pb-8 scroll-mt-6">
            <div className="glass-panel rounded-2xl p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div><p className="section-kicker">File Permissions</p><h2 className="mt-1 text-xl font-bold">صلاحيات وموافقات الملفات</h2><p className="mt-1 text-sm text-muted-foreground">تُعرض هنا حالة الاستخدام الحالية وآخر قرار موافقة مسجل لكل ملف.</p></div>
                <Badge variant="outline" className="border-primary/20 bg-primary/5 text-primary">بيانات حية من سجل Harb</Badge>
              </div>
              <div className="mt-5 grid gap-3 xl:grid-cols-2">
                {files.length ? files.map(file => {
                  const latestApproval = fileApprovals.find(approval => approval.fileId === file.id);
                  const approvalPending = latestApproval?.status === "requested" && file.approvalState === "pending";
                  return <article key={file.id} className="rounded-xl border border-white/10 bg-black/10 p-4">
                    <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate font-semibold">{file.name}</p><p className="mt-1 text-xs text-muted-foreground">تصنيف {classificationLabel(file.classification)} · آخر تحديث {formatDate(file.createdAt)}</p></div><LockKeyhole className="h-4 w-4 shrink-0 text-primary" /></div>
                    <div className="mt-3 flex flex-wrap gap-2"><Badge className={cn("border text-[10px]", file.permissionState === "allowed" ? "border-primary/20 bg-primary/10 text-primary" : "border-amber-200/20 bg-amber-300/10 text-amber-200")}>الوصول: {permissionStateLabel(file.permissionState)}</Badge><Badge className={cn("border text-[10px]", file.approvalState === "approved" ? "border-primary/20 bg-primary/10 text-primary" : file.approvalState === "rejected" ? "border-rose-200/20 bg-rose-400/10 text-rose-200" : "border-white/10 text-muted-foreground")}>الموافقة: {approvalStateLabel(file.approvalState)}</Badge></div>
                    <p className="mt-3 text-xs text-muted-foreground">{file.lastApprovalAt ? `آخر قرار: ${formatDate(file.lastApprovalAt)}` : latestApproval ? `آخر طلب: ${latestApproval.status === "requested" ? "بانتظار القرار" : latestApproval.status === "approved" ? "تمت الموافقة" : "تم الرفض"} · ${formatDate(latestApproval.resolvedAt ?? latestApproval.requestedAt)}` : "لا توجد موافقات مسجلة لهذا الملف."}</p>
                    <div className="mt-4 flex flex-wrap gap-2">{!approvalPending && <Button size="sm" variant="outline" onClick={() => requestFileApproval.mutate({ id: file.id, action: "share" })} disabled={requestFileApproval.isPending} className="border-white/15 bg-white/5">طلب موافقة مشاركة</Button>}{approvalPending && latestApproval ? <><Button size="sm" onClick={() => resolveFileApproval.mutate({ id: latestApproval.id, status: "approved" })} disabled={resolveFileApproval.isPending} className="bg-primary text-primary-foreground"><CheckCircle2 className="ml-1 h-3.5 w-3.5" />اعتماد</Button><Button size="sm" variant="outline" onClick={() => resolveFileApproval.mutate({ id: latestApproval.id, status: "rejected" })} disabled={resolveFileApproval.isPending} className="border-rose-200/20 text-rose-200 hover:bg-rose-400/10">رفض</Button></> : null}</div>
                  </article>;
                }) : <div className="rounded-xl border border-dashed border-white/15 p-6 text-center xl:col-span-2"><LockKeyhole className="mx-auto h-6 w-6 text-muted-foreground" /><p className="mt-2 text-sm font-medium">لا توجد ملفات لمراجعة صلاحياتها</p><p className="mt-1 text-xs text-muted-foreground">ارفع ملفاً من مساحة العمل لتظهر حالته وموافقاته هنا.</p></div>}
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
