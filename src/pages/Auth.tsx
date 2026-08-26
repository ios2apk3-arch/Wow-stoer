import { useState } from "react";
import { Sparkles } from "lucide-react";
import { Link, useRouter } from "../app/router";
import { useDatabase } from "../app/usePlatform";
import { useI18n } from "../i18n";
import { auth } from "../platform/api";
import { countries } from "../platform/data/catalog";
import { Badge, Button, Card, Field, Input, Select, cx, useToast } from "../ui";
import { ApiError } from "../platform/remote/http";

/** Every seeded demo account shares this password. */
const DEMO_PASSWORD = "WawDemo!2026";

const describeError = (err: unknown, fallback: string) =>
  err instanceof ApiError && err.message ? err.message : fallback;

function AuthShell({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  const { d, t } = useI18n();
  return (
    <div className="container-x max-w-5xl py-12">
      <div className="grid gap-8 lg:grid-cols-2 lg:items-center">
        <div className="hidden lg:block">
          <Badge tone="accent">
            <Sparkles className="h-3 w-3" />
            {t(d.brandFull)}
          </Badge>
          <h2 className="mt-5 text-3xl font-extrabold leading-tight text-foreground">{t(d.home.heroTitle)}</h2>
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{t(d.home.heroSub)}</p>
          <ul className="mt-8 space-y-3">
            {[d.home.buyerPitch, d.home.supplierPitch].map((p, i) => (
              <li key={i} className="flex gap-3 rounded-xl border border-border bg-card p-4">
                <span className="text-lg">{i === 0 ? "🛒" : "🏭"}</span>
                <p className="text-xs leading-relaxed text-muted-foreground">{t(p)}</p>
              </li>
            ))}
          </ul>
        </div>

        <Card className="p-7">
          <h1 className="text-xl font-extrabold text-foreground">{title}</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">{subtitle}</p>
          <div className="mt-6">{children}</div>
        </Card>
      </div>
    </div>
  );
}

export function LoginPage() {
  const { d, t } = useI18n();
  const { navigate } = useRouter();
  const toast = useToast();
  const db = useDatabase();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState(DEMO_PASSWORD);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  const demoUsers = [
    db.users.find((u) => u.id === "u-buy-1"),
    db.users.find((u) => u.id === "u-sup-1"),
    db.users.find((u) => u.id === "u-admin"),
  ].filter((u): u is NonNullable<typeof u> => u != null);

  const signIn = async (value: string, secret: string) => {
    setPending(true);
    setError("");
    try {
      const session = await auth.login(value, secret);
      toast.push(`${t(d.auth.signedInAs)} ${session.user.name}`);
      const role = session.user.role;
      navigate(role === "admin" ? "/admin" : role === "supplier" ? "/supplier" : "/dashboard");
    } catch (err) {
      setError(err instanceof ApiError && err.status === 401 ? t(d.auth.invalidEmail) : describeError(err, t(d.auth.invalidEmail)));
    } finally {
      setPending(false);
    }
  };

  return (
    <AuthShell title={t(d.auth.signInTitle)} subtitle={t(d.auth.signInSub)}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          void signIn(email, password);
        }}
      >
        <Field label={t(d.auth.email)} error={error} required>
          <Input type="email" value={email} onChange={(e) => { setEmail(e.target.value); setError(""); }} required placeholder="buy-1@waw.example.com" />
        </Field>
        <Field label={t(d.auth.password)} required>
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
          />
        </Field>
        <Button type="submit" fullWidth size="lg" disabled={pending}>
          {pending ? t(d.common.loading) : t(d.action.signIn)}
        </Button>
      </form>

      <div className="mt-6 border-t border-border pt-5">
        <p className="text-xs font-extrabold text-foreground">{t(d.auth.demoAccounts)}</p>
        <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{t(d.auth.demoHint)}</p>
        <div className="mt-3 space-y-2">
          {demoUsers.map((u) => (
            <button
              key={u.id}
              type="button"
              onClick={() => void signIn(u.email, DEMO_PASSWORD)}
              className="flex w-full cursor-pointer items-center gap-3 rounded-xl border border-border p-3 text-start transition-colors hover:border-accent hover:bg-accent-soft/40"
            >
              <span
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-extrabold text-white"
                style={{ background: u.avatarColor }}
              >
                {u.name.slice(0, 1)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs font-extrabold text-foreground">{u.name}</span>
                <span className="block truncate text-[10px] text-muted-foreground">{u.email}</span>
              </span>
              <Badge tone="accent">{t(d.auth.roles[u.role])}</Badge>
            </button>
          ))}
        </div>
      </div>

      <p className="mt-6 text-center text-xs text-muted-foreground">
        {t(d.auth.noAccount)}{" "}
        <Link to="/register" className="font-bold text-accent hover:underline">{t(d.action.register)}</Link>
      </p>
    </AuthShell>
  );
}

export function RegisterPage() {
  const { d, t } = useI18n();
  const { navigate } = useRouter();
  const toast = useToast();
  useDatabase();

  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    role: "buyer" as "buyer" | "supplier",
    companyName: "",
    countryCode: "SA",
    city: "",
  });
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  const cities = countries.find((c) => c.code === form.countryCode)?.cities ?? [];

  const submit = async () => {
    setPending(true);
    setError("");
    try {
      const session = await auth.register({ ...form, city: form.city || cities[0].ar });
      toast.push(`${t(d.auth.signedInAs)} ${session.user.name}`);
      navigate(session.user.role === "supplier" ? "/supplier" : "/dashboard");
    } catch (err) {
      setError(describeError(err, t(d.auth.registerTitle)));
    } finally {
      setPending(false);
    }
  };

  return (
    <AuthShell title={t(d.auth.registerTitle)} subtitle={t(d.auth.registerSub)}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <Field label={t(d.auth.accountType)} required>
          <div className="grid grid-cols-2 gap-2.5">
            {(["buyer", "supplier"] as const).map((role) => (
              <button
                key={role}
                type="button"
                onClick={() => setForm((f) => ({ ...f, role }))}
                className={cx(
                  "cursor-pointer rounded-xl border p-3.5 text-center text-xs font-extrabold transition-colors",
                  form.role === role ? "border-accent bg-accent-soft text-accent" : "border-border text-muted-foreground hover:border-border-strong",
                )}
              >
                <span className="mb-1.5 block text-xl">{role === "buyer" ? "🛒" : "🏭"}</span>
                {t(d.auth.roles[role])}
              </button>
            ))}
          </div>
        </Field>

        <Field label={t(d.auth.fullName)} required>
          <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required />
        </Field>

        <Field label={t(d.auth.companyName)} required>
          <Input value={form.companyName} onChange={(e) => setForm((f) => ({ ...f, companyName: e.target.value }))} required />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t(d.auth.email)} required>
            <Input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} required />
          </Field>
          <Field label={t(d.auth.phone)} required>
            <Input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} className="num" required />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t(d.auth.country)} required>
            <Select value={form.countryCode} onChange={(e) => setForm((f) => ({ ...f, countryCode: e.target.value, city: "" }))}>
              {countries.map((c) => (
                <option key={c.code} value={c.code}>{t(c.name)}</option>
              ))}
            </Select>
          </Field>
          <Field label={t(d.auth.city)} required>
            <Select value={form.city} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}>
              <option value="">—</option>
              {cities.map((c) => (
                <option key={c.en} value={c.ar}>{t(c)}</option>
              ))}
            </Select>
          </Field>
        </div>

        <Field
          label={t(d.auth.password)}
          hint={t({ ar: "10 أحرف على الأقل", en: "At least 10 characters" })}
          error={error || undefined}
          required
        >
          <Input
            type="password"
            value={form.password}
            onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
            minLength={10}
            placeholder="••••••••"
            required
          />
        </Field>

        <Button type="submit" fullWidth size="lg" disabled={pending}>
          {pending ? t(d.common.loading) : t(d.action.register)}
        </Button>
      </form>

      <p className="mt-6 text-center text-xs text-muted-foreground">
        {t(d.auth.haveAccount)}{" "}
        <Link to="/login" className="font-bold text-accent hover:underline">{t(d.action.signIn)}</Link>
      </p>
    </AuthShell>
  );
}
