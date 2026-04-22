'use client';

import { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Loader2 } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { Button, Input } from '@okun/ui';
import { cn } from '@okun/ui';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export default function CopilotPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: 'Hallo! Ich bin dein Okun Copilot. Frag mich nach deinen Leads, Kunden, Kampagnen oder Rechnungen. Wie kann ich helfen?',
    },
  ]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const { data: workspace } = trpc.workspaces.getCurrent.useQuery();

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || isStreaming || !workspace) return;

    const userMessage = input.trim();
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: userMessage }]);
    setIsStreaming(true);

    const apiMessages = [...messages, { role: 'user', content: userMessage }].map((m) => ({
      role: m.role,
      content: m.content,
    }));

    setMessages((prev) => [...prev, { role: 'assistant', content: '' }]);

    try {
      const res = await fetch('/api/copilot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: apiMessages, workspaceId: workspace.id }),
      });

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();

      while (reader) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const data = JSON.parse(line.slice(6));
            if (data.type === 'text') {
              setMessages((prev) => {
                const updated = [...prev];
                updated[updated.length - 1] = {
                  role: 'assistant',
                  content: updated[updated.length - 1].content + data.text,
                };
                return updated;
              });
            }
          } catch {}
        }
      }
    } catch (err) {
      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          role: 'assistant',
          content: 'Entschuldigung, es gab einen Fehler. Bitte versuche es erneut.',
        };
        return updated;
      });
    } finally {
      setIsStreaming(false);
    }
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 border-b border-surface-2 px-6 py-4 shrink-0">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-white">
          <Bot className="h-4 w-4" />
        </div>
        <div>
          <h1 className="text-base font-semibold text-content-primary">Okun Copilot</h1>
          <p className="text-xs text-content-tertiary">KI-Assistent mit Zugriff auf deine Daten</p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={cn('flex gap-3', msg.role === 'user' && 'justify-end')}
          >
            {msg.role === 'assistant' && (
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-600">
                <Bot className="h-3.5 w-3.5" />
              </div>
            )}
            <div
              className={cn(
                'max-w-[75%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed',
                msg.role === 'assistant'
                  ? 'bg-surface-1 text-content-primary rounded-tl-sm'
                  : 'bg-brand-600 text-white rounded-tr-sm',
              )}
            >
              {msg.content || (isStreaming && i === messages.length - 1 ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : '')}
            </div>
            {msg.role === 'user' && (
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface-2 text-content-secondary">
                <User className="h-3.5 w-3.5" />
              </div>
            )}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="border-t border-surface-2 px-6 py-4 shrink-0">
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
            placeholder="Frag den Copilot… (z.B. 'Wie viele Leads habe ich diese Woche?')"
            disabled={isStreaming}
            className="flex-1"
          />
          <Button onClick={sendMessage} disabled={isStreaming || !input.trim()}>
            {isStreaming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
        <p className="mt-2 text-xs text-content-tertiary">
          Copilot hat Lesezugriff auf deine Leads, Kunden, Kampagnen und Rechnungen.
        </p>
      </div>
    </div>
  );
}
