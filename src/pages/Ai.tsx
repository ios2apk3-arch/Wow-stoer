import { useEffect, useRef, useState } from "react";
import { Check, Send, Sparkles, X } from "lucide-react";
import { Link, useRouter } from "../app/router";
import { useDatabase } from "../app/usePlatform";
import { useI18n } from "../i18n";
import { cart } from "../platform/api";
import { respond, suggestedPrompts, type AiReply, type SupplierMatch } from "../platform/ai/assistant";
import { Badge, Button, Card, Progress, Rating, useToast } from "../ui";

interface Turn {
  id: number;
  question: string;
  reply: AiReply;
}

function MatchRow({ match }: { match: SupplierMatch }) {
  const { d, t, n, money } = useI18n();
  const toast = useToast();

  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-start gap-4">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-muted text-2xl">{match.product.image}</span>

        <div className="min-w-0 flex-1">
          <Link to={`/product/${match.product.id}`} className="line-clamp-1 text-sm font-extrabold text-foreground hover:text-accent">
            {t(match.product.name)}
          </Link>
          <Link to={`/supplier/${match.supplierId}`} className="mt-0.5 block truncate text-[11px] font-semibold text-muted-foreground hover:text-accent">
            {t(match.name)}
          </Link>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <Rating value={match.rating} />
            {match.verified && <Badge tone="success">{t(d.supplier.verified)}</Badge>}
            <span className="num text-[11px] text-muted-foreground">
              {n(match.leadTimeDays)} {t(d.product.days)}
            </span>
          </div>

          <ul className="mt-2.5 space-y-1">
            {match.reasons.map((r, i) => (
              <li key={i} className="flex items-start gap-1.5 text-[11px] leading-relaxed text-muted-foreground">
                <Check className="mt-0.5 h-3 w-3 shrink-0 text-success" />
                {t(r)}
              </li>
            ))}
          </ul>
        </div>

        <div className="shrink-0 text-end">
          <div className="num text-lg font-extrabold text-foreground">{money(match.unitPrice)}</div>
          <div className="num text-[11px] text-muted-foreground">{money(match.lineTotal)}</div>

          <div className="mt-2 w-28">
            <div className="mb-1 flex items-center justify-between text-[10px] font-bold">
              <span className="text-muted-foreground">{t(d.ai.matchScore)}</span>
              <span className="num text-foreground">{match.matchScore}</span>
            </div>
            <Progress
              value={match.matchScore}
              tone={match.matchScore >= 75 ? "success" : match.matchScore >= 50 ? "accent" : "warning"}
            />
          </div>

          <Button
            size="sm"
            className="mt-3"
            onClick={() => {
              cart.add(match.product.id, Math.max(match.product.moq, 1));
              toast.push(t(d.action.addToCart));
            }}
          >
            {t(d.action.addToCart)}
          </Button>
        </div>
      </div>
    </Card>
  );
}

function ReplyBlock({ turn }: { turn: Turn }) {
  const { d, t, n, locale } = useI18n();
  const { navigate } = useRouter();
  const toast = useToast();
  const { reply } = turn;
  const p = reply.parsed;

  const slots = [
    p.qty != null && { label: d.rfq.quantity, value: n(p.qty) },
    p.unit && { label: d.product.unit, value: p.unit },
    p.city && { label: d.rfq.deliveryLocation, value: p.city },
    p.withinDays != null && { label: d.rfq.neededBy, value: `${n(p.withinDays)} ${t(d.product.days)}` },
    p.budget != null && { label: d.rfq.targetPrice, value: n(p.budget) },
    p.paymentTerms && { label: d.rfq.paymentTerms, value: t(d.rfq.terms[p.paymentTerms as keyof typeof d.rfq.terms] ?? { ar: p.paymentTerms, en: p.paymentTerms }) },
  ].filter(Boolean) as { label: { ar: string; en: string }; value: string }[];

  return (
    <div className="space-y-4">
      {/* Question */}
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-2xl bg-accent px-4 py-3 text-sm font-semibold text-accent-foreground">
          {turn.question}
        </div>
      </div>

      {/* Understanding */}
      <Card className="border-accent/30 p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="flex items-center gap-2 text-sm font-extrabold text-foreground">
            <Sparkles className="h-4 w-4 text-accent" />
            {t(reply.headline)}
          </h3>
          <div className="flex items-center gap-2">
            <Badge tone="accent">{t(d.ai.intents[p.intent])}</Badge>
            <Badge tone={p.confidence >= 0.7 ? "success" : "warning"}>
              {t(d.ai.confidence)} <span className="num">{Math.round(p.confidence * 100)}%</span>
            </Badge>
          </div>
        </div>

        {slots.length > 0 && (
          <div className="mt-4 rounded-xl bg-muted/60 p-3.5">
            <p className="text-[11px] font-extrabold text-muted-foreground">{t(d.ai.understood)}</p>
            <dl className="mt-2.5 flex flex-wrap gap-x-6 gap-y-2">
              {slots.map((s, i) => (
                <div key={i}>
                  <dt className="text-[10px] font-semibold text-muted-foreground">{t(s.label)}</dt>
                  <dd className="num mt-0.5 text-xs font-extrabold text-foreground">{s.value}</dd>
                </div>
              ))}
              {p.keywords.length > 0 && (
                <div>
                  <dt className="text-[10px] font-semibold text-muted-foreground">{t(d.search.results)}</dt>
                  <dd className="mt-0.5 text-xs font-extrabold text-foreground">{p.keywords.join(" · ")}</dd>
                </div>
              )}
            </dl>
          </div>
        )}

        {reply.body.map((b, i) => (
          <p key={i} className="mt-3 text-sm leading-relaxed text-muted-foreground">
            {t(b)}
          </p>
        ))}

        {reply.actions.length > 0 && (
          <div className="mt-5 flex flex-wrap gap-2.5">
            {reply.actions.map((action, i) => (
              <Button
                key={i}
                size="sm"
                variant={i === 0 ? "primary" : "outline"}
                onClick={() => {
                  switch (action.kind) {
                    case "view_product":
                      navigate(`/product/${action.productId}`);
                      break;
                    case "add_to_cart":
                      cart.add(action.productId, action.qty);
                      toast.push(t(d.action.addToCart));
                      break;
                    case "create_rfq":
                      navigate(`/rfq/new?ai=${encodeURIComponent(p.raw)}`);
                      break;
                    case "negotiate":
                      navigate(`/product/${action.productId}`);
                      break;
                    case "navigate":
                      navigate(action.href);
                      break;
                  }
                }}
              >
                {t(action.label)}
              </Button>
            ))}
          </div>
        )}
      </Card>

      {reply.matches.length > 0 && (
        <div>
          <h4 className="mb-3 text-xs font-extrabold text-muted-foreground">{t(d.ai.matches)}</h4>
          <div className="space-y-2.5">
            {reply.matches.map((m) => (
              <MatchRow key={`${m.supplierId}-${m.product.id}`} match={m} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function AiPage() {
  const { d, t, locale } = useI18n();
  const { query, setQuery } = useRouter();
  useDatabase();

  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState("");
  const [thinking, setThinking] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const handledQuery = useRef<string | null>(null);

  const ask = (question: string) => {
    const q = question.trim();
    if (!q) return;
    setDraft("");
    setThinking(true);
    // A brief pause makes the extraction legible rather than instantaneous.
    setTimeout(() => {
      setTurns((prev) => [...prev, { id: Date.now(), question: q, reply: respond(q) }]);
      setThinking(false);
    }, 260);
  };

  // Honour ?q= from the header search box or a home-page prompt chip.
  useEffect(() => {
    const q = query.get("q");
    if (q && handledQuery.current !== q) {
      handledQuery.current = q;
      ask(q);
      setQuery({ q: null }, { replace: true });
    }
  }, [query]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [turns.length, thinking]);

  const prompts = suggestedPrompts(locale);

  return (
    <div className="container-x max-w-4xl py-8">
      <header className="mb-6">
        <h1 className="flex items-center gap-2.5 text-2xl font-extrabold text-foreground">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent text-accent-foreground">
            <Sparkles className="h-5 w-5" />
          </span>
          {t(d.ai.title)}
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">{t(d.ai.subtitle)}</p>
      </header>

      {turns.length === 0 && !thinking && (
        <Card className="p-6">
          <p className="text-xs font-extrabold text-muted-foreground">{t(d.ai.tryAsking)}</p>
          <div className="mt-4 space-y-2">
            {prompts.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => ask(p)}
                className="w-full cursor-pointer rounded-xl border border-border p-3.5 text-start text-sm font-semibold text-foreground transition-colors hover:border-accent hover:bg-accent-soft/40"
              >
                {p}
              </button>
            ))}
          </div>
        </Card>
      )}

      <div className="space-y-8">
        {turns.map((turn) => (
          <ReplyBlock key={turn.id} turn={turn} />
        ))}
        {thinking && (
          <div className="flex items-center gap-2.5 text-sm font-semibold text-muted-foreground">
            <Sparkles className="h-4 w-4 animate-pulse text-accent" />
            {t(d.ai.thinking)}
          </div>
        )}
        <div ref={endRef} />
      </div>

      <form
        className="sticky bottom-4 mt-8"
        onSubmit={(e) => {
          e.preventDefault();
          ask(draft);
        }}
      >
        <div className="flex items-center gap-2 rounded-2xl border border-border bg-card p-2 shadow-[var(--shadow-raised)]">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={t(d.ai.placeholder)}
            className="h-11 min-w-0 flex-1 bg-transparent px-3 text-sm text-foreground placeholder:text-ink-400 focus:outline-none"
          />
          {draft && (
            <button type="button" onClick={() => setDraft("")} className="cursor-pointer rounded-lg p-2 text-muted-foreground hover:bg-muted" aria-label={t(d.action.clear)}>
              <X className="h-4 w-4" />
            </button>
          )}
          <Button type="submit" disabled={!draft.trim() || thinking}>
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </form>
    </div>
  );
}
