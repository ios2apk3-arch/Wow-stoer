import { Building2, Globe, Mail, MapPin, Phone, ShieldCheck } from "lucide-react";
import { useDatabase } from "../app/usePlatform";
import { useI18n } from "../i18n";
import { auth } from "../platform/api";
import { VerificationBadge } from "../components/SupplierCard";
import { Badge, Card, CardHeader, EmptyState } from "../ui";
import RequireAuth from "./RequireAuth";

function ProfileInner() {
  const { d, t, date } = useI18n();
  useDatabase();

  const user = auth.currentUser()!;
  const company = auth.currentCompany();

  return (
    <div className="container-x max-w-4xl py-8">
      <h1 className="mb-6 text-2xl font-extrabold text-foreground">{t(d.profile.title)}</h1>

      <div className="space-y-6">
        <Card>
          <CardHeader title={t(d.profile.personal)} />
          <div className="flex flex-wrap items-center gap-5 p-5">
            <span
              className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl text-2xl font-extrabold text-white"
              style={{ background: user.avatarColor }}
            >
              {user.name.slice(0, 1).toUpperCase()}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-extrabold text-foreground">{user.name}</h2>
                <Badge tone="accent">{t(d.auth.roles[user.role])}</Badge>
              </div>
              <dl className="mt-3 grid gap-3 sm:grid-cols-2">
                {[
                  { icon: Mail, label: d.auth.email, value: user.email },
                  { icon: Phone, label: d.auth.phone, value: user.phone },
                ].map(({ icon: Icon, label, value }, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0">
                      <dt className="text-[11px] font-semibold text-muted-foreground">{t(label)}</dt>
                      <dd className="num truncate text-xs font-bold text-foreground">{value}</dd>
                    </div>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        </Card>

        {company ? (
          <>
            <Card>
              <CardHeader title={t(d.profile.companyInfo)} action={<VerificationBadge status={company.verification} />} />
              <div className="p-5">
                <div className="flex items-center gap-4">
                  <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-muted text-2xl">{company.logo}</span>
                  <div className="min-w-0">
                    <h3 className="truncate text-base font-extrabold text-foreground">{t(company.name)}</h3>
                    <p className="text-xs text-muted-foreground">{company.legalName}</p>
                  </div>
                </div>

                {t(company.description) && (
                  <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{t(company.description)}</p>
                )}

                <dl className="mt-5 grid gap-4 border-t border-border pt-5 sm:grid-cols-2">
                  {[
                    { icon: Building2, label: d.profile.taxId, value: company.taxId || "—" },
                    { icon: MapPin, label: d.auth.city, value: `${company.city}, ${company.countryCode}` },
                    { icon: Phone, label: d.auth.phone, value: company.phone },
                    { icon: Mail, label: d.auth.email, value: company.email },
                    { icon: Globe, label: d.profile.website, value: company.website ?? "—" },
                    { icon: ShieldCheck, label: d.profile.memberSince, value: date(company.memberSince, { month: "long", year: "numeric" }) },
                  ].map(({ icon: Icon, label, value }, i) => (
                    <div key={i} className="flex items-start gap-2.5">
                      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                      <div className="min-w-0">
                        <dt className="text-[11px] font-semibold text-muted-foreground">{t(label)}</dt>
                        <dd className="num truncate text-xs font-bold text-foreground">{value}</dd>
                      </div>
                    </div>
                  ))}
                </dl>
              </div>
            </Card>

            <Card>
              <CardHeader title={t(d.profile.addresses)} />
              <div className="p-5">
                {company.addresses.length ? (
                  <ul className="grid gap-3 sm:grid-cols-2">
                    {company.addresses.map((a) => (
                      <li key={a.id} className="rounded-xl border border-border p-4">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-extrabold text-foreground">{t(a.label)}</span>
                          {a.isDefault && <Badge tone="accent">{t(d.common.yes)}</Badge>}
                        </div>
                        <p className="mt-1.5 text-[11px] text-muted-foreground">{a.line}</p>
                        <p className="num mt-0.5 text-[11px] text-muted-foreground">{a.city}, {a.countryCode}</p>
                        <p className="num mt-0.5 text-[11px] text-muted-foreground">{a.phone}</p>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <EmptyState title={t(d.common.none)} />
                )}
              </div>
            </Card>
          </>
        ) : (
          <Card className="p-5">
            <EmptyState title={t(d.profile.companyInfo)} hint={t(d.common.none)} />
          </Card>
        )}
      </div>
    </div>
  );
}

export default function ProfilePage() {
  return (
    <RequireAuth>
      <ProfileInner />
    </RequireAuth>
  );
}
