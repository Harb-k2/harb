import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { ArrowUp, FileText, Image, Loader2, Paperclip, Sparkles, ThumbsDown, ThumbsUp, User, X } from "lucide-react";
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
};

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
  onSelectFiles?: (files: File[]) => void;
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
  onSelectFiles,
  onRemoveAttachment,
}: AIChatBoxProps) {
  const [input, setInput] = useState("");
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const displayMessages = messages.filter(message => message.role !== "system");

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
    if (files.length) onSelectFiles?.(files);
    event.target.value = "";
  };

  return (
    <div className={cn("flex min-h-0 flex-col bg-card text-card-foreground", className)} style={{ height }}>
      <div ref={scrollAreaRef} className="flex-1 overflow-hidden">
        {displayMessages.length === 0 ? (
          <div className="flex h-full min-h-[360px] flex-col p-5 sm:p-8">
            <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary shadow-[0_12px_30px_oklch(0.79_0.144_169_/_14%)]"><Sparkles className="size-6" /></div>
              <h2 className="mt-5 text-xl font-bold text-foreground">مساعد Harb جاهز</h2>
              <p className="mt-2 max-w-md text-sm leading-7 text-muted-foreground">{emptyStateMessage}</p>
              {suggestedPrompts && suggestedPrompts.length > 0 && (
                <div className="mt-7 grid w-full gap-2 text-right sm:grid-cols-2">
                  {suggestedPrompts.map((prompt, index) => (
                    <button key={index} type="button" onClick={() => onSendMessage(prompt)} disabled={isLoading} className="rounded-xl border border-white/10 bg-white/[0.035] px-4 py-3 text-right text-sm leading-6 text-foreground transition-colors hover:border-primary/30 hover:bg-primary/5 disabled:cursor-not-allowed disabled:opacity-50">
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
                  <div className={cn("max-w-[min(88%,42rem)] rounded-2xl px-4 py-3 text-sm leading-7 sm:px-5", message.role === "user" ? "rounded-tr-sm bg-primary text-primary-foreground shadow-[0_10px_24px_oklch(0.79_0.144_169_/_13%)]" : "rounded-tl-sm border border-white/8 bg-white/[0.045] text-foreground")}>
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
                  <div className="rounded-2xl rounded-tl-sm border border-white/8 bg-white/[0.045] px-4 py-3"><div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin text-primary" />يحضّر Harb الإجابة…</div></div>
                </article>
              )}
            </div>
          </ScrollArea>
        )}
      </div>
      <form onSubmit={handleSubmit} className="mx-3 mb-3 rounded-2xl border border-white/12 bg-[#0b121c]/85 p-2 shadow-[0_12px_32px_oklch(0_0_0_/_18%)] sm:mx-5 sm:mb-5">
        {(pendingAttachments.length > 0 || isUploadingAttachments) && <div className="mb-2 flex flex-wrap gap-1.5 border-b border-white/8 px-1 pb-2">{pendingAttachments.map(attachment => <span key={attachment.id} className="inline-flex max-w-full items-center gap-1.5 rounded-lg border border-primary/20 bg-primary/8 px-2 py-1 text-[11px] text-foreground"><span className="text-primary">{attachment.kind === "image" ? <Image className="size-3.5" /> : <FileText className="size-3.5" />}</span><span className="max-w-40 truncate">{attachment.originalName}</span><button type="button" aria-label={`إزالة ${attachment.originalName}`} onClick={() => onRemoveAttachment?.(attachment.id)} className="rounded p-0.5 text-muted-foreground hover:bg-white/10 hover:text-foreground"><X className="size-3" /></button></span>)}{isUploadingAttachments && <span className="inline-flex items-center gap-1.5 rounded-lg bg-white/5 px-2 py-1 text-[11px] text-muted-foreground"><Loader2 className="size-3 animate-spin text-primary" />يجري رفع المرفق…</span>}</div>}
        <div className="flex items-end gap-2">
          <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,application/pdf" multiple style={{ display: "none" }} onChange={handleFiles} />
          <button type="button" onClick={() => fileInputRef.current?.click()} disabled={isLoading || isUploadingAttachments || !onSelectFiles} aria-label="إرفاق صورة أو ملف PDF" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-white/8 hover:text-primary disabled:cursor-not-allowed disabled:opacity-40"><Paperclip className="size-4" /></button>
          <Textarea ref={textareaRef} value={input} onChange={event => setInput(event.target.value)} onKeyDown={handleKeyDown} placeholder={placeholder} className="min-h-11 flex-1 resize-none border-0 bg-transparent px-3 py-2.5 text-sm shadow-none focus-visible:ring-0" rows={1} aria-label="رسالة إلى Harb" />
          <button type="submit" disabled={!input.trim() || isLoading || isUploadingAttachments} aria-label="إرسال الرسالة" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground transition-transform duration-150 hover:bg-primary/90 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40">
            {isLoading ? <Loader2 className="size-4 animate-spin" /> : <ArrowUp className="size-5" />}
          </button>
        </div>
      </form>
    </div>
  );
}
