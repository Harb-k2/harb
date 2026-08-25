import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { getAttachmentProgressDetails, type AttachmentUploadProgressDetails } from "@/lib/attachment-progress";
import { cn } from "@/lib/utils";
import { ArrowUp, CheckCircle2, FileText, Image, Loader2, Paperclip, Sparkles, ThumbsDown, ThumbsUp, UploadCloud, User, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Streamdown } from "streamdown";

export type ChatAttachment = {
  id: string;
  originalName: string;
  mimeType: string;
  size: number;
  kind: "image" | "document";
  analysisStatus?: "ready" | "unsupported" | "failed";
  storageUrl?: string;
  previewUrl?: string;
};

export type AttachmentUploadProgress = AttachmentUploadProgressDetails;

export type Message = {
  id?: string;
  role: "system" | "user" | "assistant";
  content: string;
  attachments?: ChatAttachment[];
};

export type AIChatBoxProps = {
  messages: Message[];
  onSendMessage: (content: string) => void;
  isLoading?: boolean;
  placeholder?: string;
  className?: string;
  height?: string | number;
  emptyStateMessage?: string;
  suggestedPrompts?: string[];
  feedbackByMessage?: Record<string, "up" | "down">;
  onRateMessage?: (messageId: string, rating: "up" | "down") => void;
  pendingAttachments?: ChatAttachment[];
  isUploadingAttachments?: boolean;
  attachmentProgress?: AttachmentUploadProgress | null;
  isAnalyzingAttachments?: boolean;
  onSelectFiles?: (files: File[]) => void;
  onCancelUpload?: () => void;
  onRemoveAttachment?: (attachmentId: string) => void;
};

export function AIChatBox({
  messages,
  onSendMessage,
  isLoading = false,
  placeholder = "اكتب رسالتك…",
  className,
  height = "600px",
  emptyStateMessage = "ابدأ محادثة جديدة مع Harb.",
  suggestedPrompts,
  feedbackByMessage = {},
  onRateMessage,
  pendingAttachments = [],
  isUploadingAttachments = false,
  attachmentProgress,
  isAnalyzingAttachments = false,
  onSelectFiles,
  onCancelUpload,
  onRemoveAttachment,
}: AIChatBoxProps) {
  const [input, setInput] = useState("");
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragDepthRef = useRef(0);
  const [isFileDragActive, setIsFileDragActive] = useState(false);
  const displayMessages = messages.filter(message => message.role !== "system");
  const progressDetails = attachmentProgress ? getAttachmentProgressDetails(attachmentProgress) : null;
  const canSelectFiles = Boolean(onSelectFiles) && !isUploadingAttachments && !isLoading;

  const scrollToBottom = () => {
    const viewport = scrollAreaRef.current?.querySelector("[data-radix-scroll-area-viewport]") as HTMLDivElement | null;
    if (viewport) requestAnimationFrame(() => viewport.scrollTo({ top: viewport.scrollHeight, behavior: "smooth" }));
  };

  useEffect(() => {
    scrollToBottom();
  }, [displayMessages.length, isLoading]);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const request = input.trim();
    if (!request || isLoading) return;
    onSendMessage(request);
    setInput("");
    textareaRef.current?.focus();
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSubmit(event);
    }
  };

  const handleFiles = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    if (files.length && canSelectFiles) onSelectFiles?.(files);
    event.target.value = "";
  };

  const isFileDrag = (event: React.DragEvent) => Array.from(event.dataTransfer.types).includes("Files");
  const openFilePicker = () => fileInputRef.current?.click();
  const handleDragEnter = (event: React.DragEvent<HTMLDivElement>) => {
    if (!isFileDrag(event)) return;
    event.preventDefault();
    dragDepthRef.current += 1;
    if (canSelectFiles) setIsFileDragActive(true);
  };
  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    if (!isFileDrag(event)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = canSelectFiles ? "copy" : "none";
  };
  const handleDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
    if (!isFileDrag(event)) return;
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
    if (dragDepthRef.current === 0) setIsFileDragActive(false);
  };
  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    if (!isFileDrag(event)) return;
    event.preventDefault();
    dragDepthRef.current = 0;
    setIsFileDragActive(false);
    const files = Array.from(event.dataTransfer.files ?? []);
    if (files.length && canSelectFiles) onSelectFiles?.(files);
  };

  return (
    <div
      className={cn("harb-chatbox relative flex min-h-0 flex-col bg-card text-card-foreground", isFileDragActive && "harb-chatbox-drag-active", className)}
      style={{ height }}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {isFileDragActive && <div className="harb-file-drop-overlay" role="status" aria-live="polite"><div className="harb-file-drop-card"><UploadCloud className="size-7 text-primary" /><p className="mt-3 text-sm font-semibold text-foreground">أفلت المرفقات لإضافتها بشكل خاص</p><p className="mt-1 text-xs leading-5 text-muted-foreground">صور JPEG وPNG وWebP أو PDF حتى 8 MiB. سيستمر فحص قانون المالك قبل التحليل.</p></div></div>}
      <div ref={scrollAreaRef} className="flex-1 overflow-hidden">
        {displayMessages.length === 0 ? (
          <div className="harb-chat-empty flex h-full min-h-[360px] flex-col p-5 sm:p-8">
            <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary shadow-[0_12px_30px_oklch(0.79_0.144_169_/_14%)]"><Sparkles className="size-6" /></div>
              <h2 className="mt-5 text-xl font-bold text-foreground">مساعد Harb جاهز</h2>
              <p className="mt-2 max-w-md text-sm leading-7 text-muted-foreground">{emptyStateMessage}</p>
              {suggestedPrompts && suggestedPrompts.length > 0 && (
                <div className="mt-7 grid w-full gap-2 text-right sm:grid-cols-2">
                  {suggestedPrompts.map((prompt, index) => (
                    <button key={index} type="button" onClick={() => onSendMessage(prompt)} disabled={isLoading} className="harb-suggestion-card rounded-xl border border-white/10 bg-white/[0.035] px-4 py-3 text-right text-sm leading-6 text-foreground transition-colors hover:border-primary/30 hover:bg-primary/5 disabled:cursor-not-allowed disabled:opacity-50">
                      {prompt}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <ScrollArea className="h-full">
            <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-6 sm:px-8">
              {displayMessages.map((message, index) => (
                <article key={`${message.role}-${index}`} className={cn("flex items-start gap-3", message.role === "user" ? "justify-start" : "justify-end")}>
                  {message.role === "assistant" && <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary/12 text-primary"><Sparkles className="size-4" /></div>}
                  <div className={cn("harb-message-bubble max-w-[min(88%,42rem)] rounded-2xl px-4 py-3 text-sm leading-7 sm:px-5", message.role === "user" ? "harb-user-bubble rounded-tr-sm bg-primary text-primary-foreground shadow-[0_10px_24px_oklch(0.79_0.144_169_/_13%)]" : "harb-assistant-bubble rounded-tl-sm border border-white/8 bg-white/[0.045] text-foreground")}>
                    {message.role === "assistant" ? <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-0 prose-li:my-1"><Streamdown>{message.content}</Streamdown></div> : <p className="whitespace-pre-wrap">{message.content}</p>}
                    {message.role === "user" && message.attachments && message.attachments.length > 0 && <div className="mt-3 flex flex-wrap gap-1.5 border-t border-primary-foreground/15 pt-2">{message.attachments.map(attachment => <span key={attachment.id} className="inline-flex max-w-full items-center gap-1 rounded-lg bg-primary-foreground/12 px-2 py-1 text-[11px] text-primary-foreground"><span>{attachment.kind === "image" ? <Image className="size-3" /> : <FileText className="size-3" />}</span><span className="max-w-40 truncate">{attachment.originalName}</span></span>)}</div>}
                    {message.role === "assistant" && message.id && onRateMessage && (
                      <div className="mt-3 flex items-center gap-1 border-t border-white/8 pt-2">
                        <span className="ml-1 text-[10px] text-muted-foreground">هل كان الرد مفيداً؟</span>
                        <button type="button" onClick={() => onRateMessage(message.id!, "up")} aria-label="تقييم الرد مفيد" className={cn("rounded-md p-1.5 transition-colors hover:bg-primary/10", feedbackByMessage[message.id] === "up" ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-primary")}><ThumbsUp className="h-3.5 w-3.5" /></button>
                        <button type="button" onClick={() => onRateMessage(message.id!, "down")} aria-label="تقييم الرد غير مفيد" className={cn("rounded-md p-1.5 transition-colors hover:bg-rose-400/10", feedbackByMessage[message.id] === "down" ? "bg-rose-400/15 text-rose-200" : "text-muted-foreground hover:text-rose-200")}><ThumbsDown className="h-3.5 w-3.5" /></button>
                      </div>
                    )}
                  </div>
                  {message.role === "user" && <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white/10 text-muted-foreground"><User className="size-4" /></div>}
                </article>
              ))}
              {isLoading && (
                <article className="flex items-start justify-end gap-3" aria-live="polite">
                  <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary/12 text-primary"><Sparkles className="size-4" /></div>
                  <div className="rounded-2xl rounded-tl-sm border border-white/8 bg-white/[0.045] px-4 py-3"><div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin text-primary" />{isAnalyzingAttachments ? "يحلّل Harb المرفقات ضمن قانون المالك…" : "يحضّر Harb الإجابة…"}</div></div>
                </article>
              )}
            </div>
          </ScrollArea>
        )}
      </div>
      <form onSubmit={handleSubmit} className="harb-composer mx-3 mb-3 rounded-2xl border border-white/12 bg-[#0b121c]/85 p-2 shadow-[0_12px_32px_oklch(0_0_0_/_18%)] sm:mx-5 sm:mb-5">
        {(pendingAttachments.length > 0 || isUploadingAttachments || attachmentProgress) && <div className="mb-2 border-b border-white/8 px-1 pb-2"><div className="flex flex-wrap gap-2">{pendingAttachments.map(attachment => <div key={attachment.id} className={cn("group relative overflow-hidden rounded-xl border", attachment.kind === "image" ? "h-16 w-16 border-primary/25 bg-primary/8" : "flex min-w-44 items-center gap-2 border-rose-300/20 bg-rose-400/5 px-2 py-2")} title={attachment.originalName}>{attachment.kind === "image" && attachment.previewUrl ? <img src={attachment.previewUrl} alt={`معاينة ${attachment.originalName}`} className="h-full w-full object-cover" /> : attachment.kind === "image" ? <span className="flex h-full w-full items-center justify-center text-primary"><Image className="size-5" /></span> : <><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-rose-400/12 text-rose-200"><FileText className="size-4" /></span><span className="min-w-0"><span className="block truncate text-[11px] font-medium text-foreground">{attachment.originalName}</span><span className="mt-0.5 block text-[9px] font-semibold tracking-wide text-rose-200">PDF</span></span></>}<button type="button" aria-label={`إزالة ${attachment.originalName}`} onClick={() => onRemoveAttachment?.(attachment.id)} className={cn("absolute flex h-5 w-5 items-center justify-center rounded-full border text-muted-foreground transition-colors hover:border-rose-300/40 hover:bg-rose-400/20 hover:text-rose-100", attachment.kind === "image" ? "left-1 top-1 border-black/25 bg-black/55" : "left-1.5 top-1.5 border-white/10 bg-black/20")}><X className="size-3" /></button></div>)}</div>{progressDetails ? <div className="harb-attachment-progress mt-2 rounded-xl border border-primary/15 bg-primary/5 px-3 py-2.5" role="status" aria-live="polite"><div className="flex items-center justify-between gap-3 text-[11px]"><span className="flex min-w-0 items-center gap-1.5 text-foreground">{attachmentProgress?.stage === "ready" ? <CheckCircle2 className="size-3.5 shrink-0 text-primary" /> : <Loader2 className="size-3.5 shrink-0 animate-spin text-primary" />}<span className="truncate font-medium">{progressDetails.stageLabel}</span></span><span className="shrink-0 font-semibold text-primary">{progressDetails.percent}%</span></div><p className="mt-1 truncate text-[10px] text-muted-foreground">{attachmentProgress?.fileName} · المرفق {progressDetails.normalizedCurrent} من {progressDetails.normalizedTotal}</p><div className="mt-2 flex items-center gap-2"><div className="h-1.5 flex-1 overflow-hidden rounded-full bg-black/25" role="progressbar" aria-label="تقدم رفع المرفق" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progressDetails.percent}><div className="h-full rounded-full bg-primary transition-[width] duration-300 ease-out" style={{ width: `${progressDetails.percent}%` }} /></div>{attachmentProgress?.stage !== "ready" && onCancelUpload ? <button type="button" onClick={onCancelUpload} className="shrink-0 rounded-lg border border-white/12 px-2 py-1 text-[10px] font-medium text-muted-foreground transition-colors hover:border-rose-300/30 hover:bg-rose-400/10 hover:text-rose-200">إلغاء</button> : null}</div><div className="mt-2 grid grid-cols-4 gap-1 text-[9px] text-muted-foreground"><span className={cn("harb-progress-step", progressDetails.pipelineStep >= 0 && "harb-progress-step-complete")}>تجهيز</span><span className={cn("harb-progress-step", progressDetails.pipelineStep >= 1 && "harb-progress-step-complete")}>رفع خاص</span><span className={cn("harb-progress-step", progressDetails.pipelineStep >= 2 && "harb-progress-step-complete")}>تحليل</span><span className={cn("harb-progress-step", progressDetails.pipelineStep >= 3 && "harb-progress-step-complete")}>جاهز</span></div></div> : isUploadingAttachments ? <span className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-white/5 px-2 py-1 text-[11px] text-muted-foreground"><Loader2 className="size-3 animate-spin text-primary" />يجري رفع المرفق…</span> : null}</div>}
        {!pendingAttachments.length && !isUploadingAttachments && !attachmentProgress && <button type="button" onClick={openFilePicker} disabled={!canSelectFiles} className="harb-file-drop-hint mb-2 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-white/12 px-3 py-2 text-[11px] text-muted-foreground transition-colors hover:border-primary/35 hover:bg-primary/5 hover:text-primary disabled:cursor-not-allowed disabled:opacity-45"><UploadCloud className="size-3.5" />اسحب ملفاتك هنا أو اضغط لاختيارها <span className="text-muted-foreground/75">JPEG، PNG، WebP، PDF · حتى 8 MiB</span></button>}
        <div className="flex items-end gap-2">
          <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,application/pdf" multiple style={{ display: "none" }} onChange={handleFiles} />
          <button type="button" onClick={openFilePicker} disabled={!canSelectFiles} aria-label="إرفاق صورة أو ملف PDF" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-white/8 hover:text-primary disabled:cursor-not-allowed disabled:opacity-40"><Paperclip className="size-4" /></button>
          <Textarea ref={textareaRef} value={input} onChange={event => setInput(event.target.value)} onKeyDown={handleKeyDown} placeholder={placeholder} className="min-h-11 flex-1 resize-none border-0 bg-transparent px-3 py-2.5 text-sm shadow-none focus-visible:ring-0" rows={1} aria-label="رسالة إلى Harb" />
          <button type="submit" disabled={!input.trim() || isLoading || isUploadingAttachments} aria-label="إرسال الرسالة" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground transition-transform duration-150 hover:bg-primary/90 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40">
            {isLoading ? <Loader2 className="size-4 animate-spin" /> : <ArrowUp className="size-5" />}
          </button>
        </div>
      </form>
    </div>
  );
}
