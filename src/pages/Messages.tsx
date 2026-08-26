import { useEffect, useRef, useState } from "react";
import { MessageSquare, Send, Sparkles } from "lucide-react";
import { useRouter } from "../app/router";
import { useDatabase } from "../app/usePlatform";
import { useI18n } from "../i18n";
import { auth, catalog, messaging } from "../platform/api";
import { respond } from "../platform/ai/assistant";
import { Button, Card, EmptyState, Input, cx } from "../ui";
import RequireAuth from "./RequireAuth";

function MessagesInner() {
  const { d, t, date } = useI18n();
  const { query, setQuery } = useRouter();
  useDatabase();

  const user = auth.currentUser();
  const company = auth.currentCompany();
  const side: "buyer" | "supplier" = user?.role === "supplier" ? "supplier" : "buyer";

  const threads =
    side === "supplier" && company
      ? messaging.threadsForSupplier(company.id.replace("co-", ""))
      : company
        ? messaging.threadsForBuyer(company.id)
        : [];

  const activeId = query.get("thread") ?? threads[0]?.id ?? "";
  const active = messaging.thread(activeId);
  const messages = activeId ? messaging.messages(activeId) : [];
  const [draft, setDraft] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (activeId) messaging.markRead(activeId);
  }, [activeId]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length, activeId]);

  const send = () => {
    const body = draft.trim();
    if (!body || !activeId || !user) return;
    messaging.send(activeId, user.id, user.name, side, body);
    setDraft("");
  };

  /** Draft a reply with the assistant, so the user can edit before sending. */
  const suggest = () => {
    if (!activeId) return;
    const lastIncoming = [...messages].reverse().find((m) => m.side !== side);
    const reply = respond(lastIncoming?.body ?? "");
    const text = [reply.headline, ...reply.body].map((b) => t(b)).filter(Boolean).join(" ");
    setDraft(text);
  };

  if (!threads.length) {
    return (
      <div className="container-x py-16">
        <EmptyState icon={<MessageSquare className="h-6 w-6" />} title={t(d.messages.noThreads)} />
      </div>
    );
  }

  return (
    <div className="container-x py-8">
      <h1 className="mb-6 text-2xl font-extrabold text-foreground">{t(d.messages.title)}</h1>

      <div className="grid gap-4 lg:grid-cols-[18rem_1fr]">
        <Card className="max-h-[70vh] overflow-y-auto p-2">
          {threads.map((thread) => {
            const other = side === "buyer" ? catalog.supplierCompany(thread.supplierId) : null;
            const unread = messaging.messages(thread.id).filter((m) => !m.read && m.side !== side).length;
            return (
              <button
                key={thread.id}
                type="button"
                onClick={() => setQuery({ thread: thread.id })}
                className={cx(
                  "flex w-full cursor-pointer items-center gap-3 rounded-xl p-3 text-start transition-colors",
                  thread.id === activeId ? "bg-accent-soft" : "hover:bg-muted",
                )}
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted text-xl">
                  {other?.logo ?? "💬"}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-extrabold text-foreground">{t(thread.subject)}</span>
                  <span className="block text-[10px] text-muted-foreground">{date(thread.lastMessageAt)}</span>
                </span>
                {unread > 0 && (
                  <span className="num flex h-5 min-w-5 items-center justify-center rounded-full bg-danger px-1.5 text-[10px] font-bold text-white">
                    {unread}
                  </span>
                )}
              </button>
            );
          })}
        </Card>

        <Card className="flex max-h-[70vh] flex-col">
          {active ? (
            <>
              <div className="border-b border-border px-5 py-4">
                <h2 className="text-sm font-extrabold text-foreground">{t(active.subject)}</h2>
              </div>

              <div className="flex-1 space-y-3 overflow-y-auto p-5">
                {messages.map((m) => {
                  const mine = m.side === side;
                  return (
                    <div key={m.id} className={cx("flex", mine ? "justify-end" : "justify-start")}>
                      <div
                        className={cx(
                          "max-w-[80%] rounded-2xl px-4 py-3",
                          m.side === "ai"
                            ? "border border-accent/30 bg-accent-soft"
                            : mine
                              ? "bg-accent text-accent-foreground"
                              : "bg-muted text-foreground",
                        )}
                      >
                        <div className={cx("mb-1 text-[10px] font-bold", mine ? "text-white/70" : "text-muted-foreground")}>
                          {m.senderName}
                        </div>
                        <p className="whitespace-pre-line text-sm leading-relaxed">{m.body}</p>
                        <div className={cx("mt-1.5 text-[10px]", mine ? "text-white/60" : "text-muted-foreground")}>
                          {date(m.at, { hour: "2-digit", minute: "2-digit", day: "numeric", month: "short" })}
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={endRef} />
              </div>

              <div className="border-t border-border p-4">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={suggest}
                    title={t(d.messages.aiSuggest)}
                    className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-xl bg-accent-soft text-accent hover:bg-accent hover:text-accent-foreground"
                  >
                    <Sparkles className="h-4.5 w-4.5" />
                  </button>
                  <Input
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        send();
                      }
                    }}
                    placeholder={t(d.messages.placeholder)}
                  />
                  <Button onClick={send} disabled={!draft.trim()} className="shrink-0">
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center p-10">
              <p className="text-sm text-muted-foreground">{t(d.messages.selectThread)}</p>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

export default function MessagesPage() {
  return (
    <RequireAuth>
      <MessagesInner />
    </RequireAuth>
  );
}
