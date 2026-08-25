import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { ArrowUp, Loader2, Sparkles, ThumbsDown, ThumbsUp, User } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Streamdown } from "streamdown";

export type Message = {
  id?: string;
  role: "system" | "user" | "assistant";
  content: string;
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
}: AIChatBoxProps) {
  const [input, setInput] = useState("");
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
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
      <form onSubmit={handleSubmit} className="mx-3 mb-3 flex items-end gap-2 rounded-2xl border border-white/12 bg-[#0b121c]/85 p-2 shadow-[0_12px_32px_oklch(0_0_0_/_18%)] sm:mx-5 sm:mb-5">
        <Textarea ref={textareaRef} value={input} onChange={event => setInput(event.target.value)} onKeyDown={handleKeyDown} placeholder={placeholder} className="min-h-11 flex-1 resize-none border-0 bg-transparent px-3 py-2.5 text-sm shadow-none focus-visible:ring-0" rows={1} aria-label="رسالة إلى Harb" />
        <button type="submit" disabled={!input.trim() || isLoading} aria-label="إرسال الرسالة" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground transition-transform duration-150 hover:bg-primary/90 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40">
          {isLoading ? <Loader2 className="size-4 animate-spin" /> : <ArrowUp className="size-5" />}
        </button>
      </form>
    </div>
  );
}
