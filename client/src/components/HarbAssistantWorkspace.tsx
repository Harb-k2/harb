import { AIChatBox, type AttachmentUploadProgress, type ChatAttachment, type Message } from "@/components/AIChatBox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  BarChart3,
  Bot,
  ChevronLeft,
  FileCheck2,
  Gavel,
  History,
  LayoutDashboard,
  Languages,
  MessageSquarePlus,
  PanelRightOpen,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { useEffect, useState } from "react";

export type ResponseMode = "brief" | "balanced" | "deep";

type HarbAssistantWorkspaceProps = {
  userName: string;
  messages: Message[];
  isLoading: boolean;
  responseMode: ResponseMode;
  activeRules: number;
  pendingApprovals: number;
  taskCount: number;
  onSendMessage: (message: string) => void;
  onResponseModeChange: (mode: ResponseMode) => void;
  onNewConversation: () => void;
  onOpenControlCenter: () => void;
  conversations: Array<{ id: string; title: string; detectedLanguage: string; updatedAt: Date | string }>;
  activeConversationId?: string;
  feedbackByMessage: Record<string, "up" | "down">;
  onSelectConversation: (conversationId: string) => void;
  onRateMessage: (messageId: string, rating: "up" | "down") => void;
  pendingAttachments: ChatAttachment[];
  isUploadingAttachments: boolean;
  attachmentProgress: AttachmentUploadProgress | null;
  isAnalyzingAttachments: boolean;
  onSelectFiles: (files: File[]) => void;
  onCancelUpload: () => void;
  onRemoveAttachment: (attachmentId: string) => void;
};

const responseModes: Array<{ id: ResponseMode; label: string; description: string }> = [
  { id: "brief", label: "مختصر", description: "إجابة مباشرة وسريعة" },
  { id: "balanced", label: "متوازن", description: "التفاصيل المناسبة لمعظم الطلبات" },
  { id: "deep", label: "تحليل عميق", description: "تفكير أوسع للطلبات المعقدة" },
];

const suggestedPrompts = [
  "حلّل هذا الطلب وحدد ما يحتاج إلى موافقة قبل المتابعة",
  "أنشئ خطة آمنة لمراجعة مشروع برمجي",
  "لخّص آخر القرارات المسجلة وما الخطوة التالية؟",
  "اقترح أسئلة توضيحية قبل بدء مهمة حساسة",
];

function NavigationItem({
  icon: Icon,
  label,
  active,
  onClick,
}: {
  icon: typeof Bot;
  label: string;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-right text-sm transition-colors",
        active
          ? "bg-primary/12 text-primary"
          : "text-muted-foreground hover:bg-white/5 hover:text-foreground",
      )}
    >
      <Icon className="h-4 w-4" />
      <span>{label}</span>
    </button>
  );
}

export function HarbAssistantWorkspace({
  userName,
  messages,
  isLoading,
  responseMode,
  activeRules,
  pendingApprovals,
  taskCount,
  onSendMessage,
  onResponseModeChange,
  onNewConversation,
  onOpenControlCenter,
  conversations,
  activeConversationId,
  feedbackByMessage,
  onSelectConversation,
  onRateMessage,
  pendingAttachments,
  isUploadingAttachments,
  attachmentProgress,
  isAnalyzingAttachments,
  onSelectFiles,
  onCancelUpload,
  onRemoveAttachment,
}: HarbAssistantWorkspaceProps) {
  const selectedMode = responseModes.find(item => item.id === responseMode) ?? responseModes[1];
  const [isCompactViewport, setIsCompactViewport] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 1023px)");
    const update = () => setIsCompactViewport(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  return (
    <div className="harb-shell min-h-screen" dir="rtl">
      <div className="harb-assistant-layout mx-auto max-w-[1720px]">
        <aside className="harb-sidebar harb-command-sidebar min-w-0 flex-col border-l border-white/10 bg-[#0d1520]/80 px-4 py-5 backdrop-blur-xl">
          <div className="flex items-center gap-3 px-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary text-lg font-black text-primary-foreground shadow-[0_12px_28px_oklch(0.79_0.144_169_/_18%)]">ح</div>
            <div>
              <p className="font-bold tracking-tight">Harb</p>
              <p className="text-xs text-muted-foreground">مساعدك المؤسسي</p>
            </div>
          </div>

          <Button onClick={onNewConversation} className="mt-8 h-11 w-full justify-start rounded-xl bg-primary text-primary-foreground hover:bg-primary/90">
            <MessageSquarePlus className="ml-2 h-4 w-4" />
            محادثة جديدة
          </Button>

          <nav className="mt-6 space-y-1">
            <NavigationItem icon={Bot} label="المحادثة" active />
            <NavigationItem icon={LayoutDashboard} label="مركز العمليات" onClick={onOpenControlCenter} />
          </nav>

          <div className="mt-7 min-h-0 flex-1 border-t border-white/10 pt-5">
            <div className="flex items-center justify-between px-2"><p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">المحادثات الأخيرة</p><History className="h-3.5 w-3.5 text-muted-foreground" /></div>
            <div className="mt-3 max-h-56 space-y-1 overflow-y-auto pr-1">
              {conversations.length ? conversations.slice(0, 8).map(conversation => (
                <button key={conversation.id} type="button" onClick={() => onSelectConversation(conversation.id)} className={cn("w-full rounded-xl px-3 py-2 text-right transition-colors", activeConversationId === conversation.id ? "bg-primary/10 text-foreground" : "text-muted-foreground hover:bg-white/5 hover:text-foreground")}>
                  <span className="block truncate text-xs font-medium">{conversation.title}</span>
                  <span className="mt-1 block text-[10px] text-muted-foreground">{conversation.detectedLanguage === "arabic" ? "العربية" : conversation.detectedLanguage === "latin" ? "لغة لاتينية" : conversation.detectedLanguage === "mixed" ? "متعددة اللغات" : "لغة مكتشفة تلقائياً"}</span>
                </button>
              )) : <p className="rounded-xl border border-dashed border-white/10 p-3 text-center text-[11px] leading-5 text-muted-foreground">تظهر محادثاتك هنا بعد إرسال أول طلب.</p>}
            </div>
          </div>

          <div className="mt-5 border-t border-white/10 pt-5">
            <p className="px-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">سياق محكوم</p>
            <div className="mt-3 space-y-1">
              <NavigationItem icon={Gavel} label={`${activeRules} قوانين فعّالة`} onClick={onOpenControlCenter} />
              <NavigationItem icon={FileCheck2} label={`${pendingApprovals} موافقات معلّقة`} onClick={onOpenControlCenter} />
              <NavigationItem icon={BarChart3} label={`${taskCount} مهام مسجّلة`} onClick={onOpenControlCenter} />
            </div>
          </div>

          <div className="mt-auto rounded-2xl border border-primary/20 bg-primary/5 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-primary"><ShieldCheck className="h-4 w-4" />حماية Harb مفعّلة</div>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">يُفحص كل طلب بقانون المالك قبل استدعاء النموذج أو طلب أي موافقة.</p>
          </div>
        </aside>

        <main className="harb-workspace-main flex w-full min-w-0 flex-1 flex-col">
          <header className="harb-workspace-header flex min-h-16 items-center justify-between border-b border-white/10 bg-[#0d1520]/70 px-4 py-3 backdrop-blur-xl sm:px-7">
            <div className="min-w-0">
              <div className="harb-mobile-brand items-center gap-2"><span className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary text-sm font-black text-primary-foreground">ح</span><span className="font-bold">Harb</span></div>
              <div className="harb-desktop-greeting"><p className="text-sm font-semibold">مرحباً، {userName}</p><p className="mt-0.5 text-xs text-muted-foreground">مساعد واضح ومقيّد بقانون المالك</p></div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="harb-language-badge harb-command-label px-3 py-1.5"><Languages className="ml-1.5 h-3.5 w-3.5" />لغة الرد تلقائية</Badge>
              <Button variant="outline" size="sm" onClick={onOpenControlCenter} className="rounded-xl border-white/15 bg-white/5 text-xs hover:bg-white/10"><PanelRightOpen className="ml-1.5 h-4 w-4" />مركز التحكم</Button>
            </div>
          </header>

          <section className="harb-assistant-content flex min-h-0 flex-1 flex-col px-3 py-4 sm:px-6 sm:py-6">
            <div className="mx-auto flex w-full min-h-0 max-w-[1200px] flex-1 flex-col">
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="section-kicker">Harb Assistant / Command Console</p>
                  <h1 className="mt-1 text-xl font-bold tracking-tight sm:text-2xl">كيف يمكنني مساعدتك اليوم؟</h1>
                </div>
                <div className="harb-response-mode flex w-full rounded-xl border border-white/10 bg-black/20 p-1 shadow-inner sm:w-auto" role="group" aria-label="مستوى عمق الإجابة">
                  {responseModes.map(mode => (
                    <button
                      key={mode.id}
                      type="button"
                      title={mode.description}
                      onClick={() => onResponseModeChange(mode.id)}
                      className={cn(
                        "flex-1 rounded-lg px-3 py-2 text-xs font-medium transition-colors sm:flex-none",
                        responseMode === mode.id ? "bg-white/10 text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                      )}
                    >{mode.label}</button>
                  ))}
                </div>
              </div>

              <div className="assistant-chat-frame harb-chat-surface min-h-0 flex-1 overflow-hidden rounded-[1.5rem] border border-white/10 bg-[#111b28]/85 shadow-[0_24px_60px_oklch(0_0_0_/_22%)]">
                <AIChatBox
                  messages={messages}
                  onSendMessage={onSendMessage}
                  isLoading={isLoading}
                  height="100%"
                  className="h-full border-0 bg-transparent shadow-none"
                  placeholder="اكتب بأي لغة… يراجع Harb القوانين قبل المتابعة"
                  emptyStateMessage="ابدأ من طلب واضح، وسأشرح ما يمكن فعله وما يحتاج إلى موافقة."
                  suggestedPrompts={suggestedPrompts}
                  feedbackByMessage={feedbackByMessage}
                  onRateMessage={onRateMessage}
                  pendingAttachments={pendingAttachments}
                  isUploadingAttachments={isUploadingAttachments}
                  attachmentProgress={attachmentProgress}
                  isAnalyzingAttachments={isAnalyzingAttachments}
                  onSelectFiles={onSelectFiles}
                  onCancelUpload={onCancelUpload}
                  onRemoveAttachment={onRemoveAttachment}
                />
              </div>

              <div className="harb-security-notice mt-3 flex items-center justify-between gap-3 px-1 text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5 text-primary" />لا تُنفّذ الإجراءات الحساسة تلقائياً.</span>
                <span className="harb-mode-label">نمط الإجابة: {selectedMode.label} · لغة الرد تتبع رسالتك</span>
              </div>
            </div>
          </section>

          {isCompactViewport && <div className="harb-mobile-actions harb-mobile-command-bar items-center gap-2 border-t border-white/10 bg-[#0d1520]/65 px-3 py-2">
            <Button variant="ghost" size="sm" className="flex-1 text-xs text-primary" onClick={onNewConversation}><MessageSquarePlus className="ml-1.5 h-4 w-4" />محادثة جديدة</Button>
            <Button variant="ghost" size="sm" className="flex-1 text-xs" onClick={onOpenControlCenter}>مركز العمليات<ChevronLeft className="mr-1.5 h-4 w-4" /></Button>
          </div>}
        </main>
      </div>
    </div>
  );
}
