import { useState } from "react";
import { Bot, Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { askPolicyAssistantApi } from "@/lib/api";
import type { Policy } from "@/lib/types";
import { cn } from "@/lib/utils";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

interface PolicyAiAssistantProps {
  policy: Policy | null;
}

export default function PolicyAiAssistant({ policy }: PolicyAiAssistantProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);

  const handleSend = async () => {
    const question = input.trim();
    if (!question || !policy) return;

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: question,
    };

    setMessages((current) => [...current, userMessage]);
    setInput("");
    setIsSending(true);

    try {
      const response = await askPolicyAssistantApi(policy.id, question);
      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: response.answer,
        },
      ]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Assistant failed");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <aside className="flex h-full w-full flex-col border-l border-slate-200 bg-gradient-to-b from-slate-50/80 via-white to-violet-50/20 xl:w-[360px] xl:shrink-0">
      <div className="border-b border-slate-200 px-4 py-4">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-violet-100 text-violet-700">
            <Bot className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-slate-900">AI Assistant</h2>
            <p className="text-xs text-slate-500">
              {policy ? "Ask about the open policy" : "Select a policy first"}
            </p>
          </div>
        </div>
      </div>

      <ScrollArea className="flex-1 px-4 py-4">
        {messages.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-200 bg-white/70 px-4 py-6 text-sm text-slate-500">
            {policy
              ? `Ask questions about "${policy.name}" — scope, requirements, responsibilities, and more.`
              : "Choose a policy from the left sidebar to start chatting."}
          </div>
        ) : (
          <div className="space-y-3">
            {messages.map((message) => (
              <div
                key={message.id}
                className={cn(
                  "rounded-xl px-3 py-2 text-sm leading-relaxed",
                  message.role === "user"
                    ? "ml-6 bg-red-600 text-white"
                    : "mr-4 border border-slate-200 bg-white text-slate-700",
                )}
              >
                {message.content}
              </div>
            ))}
            {isSending ? (
              <div className="mr-4 flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                Thinking...
              </div>
            ) : null}
          </div>
        )}
      </ScrollArea>

      <div className="border-t border-slate-200 p-4">
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder={policy ? "Ask about this policy..." : "Select a policy first"}
            disabled={!policy || isSending}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void handleSend();
              }
            }}
          />
          <Button
            type="button"
            onClick={() => void handleSend()}
            disabled={!policy || isSending || !input.trim()}
            aria-label="Send message"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </aside>
  );
}
