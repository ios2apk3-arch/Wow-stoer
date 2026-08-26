import { Lock } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "../app/router";
import { useI18n } from "../i18n";
import { auth } from "../platform/api";
import { useSession } from "../platform/remote/useApi";
import { Button, EmptyState } from "../ui";
import type { Role } from "../platform/types";

/** Route guard: signs the visitor in, or explains why the page is closed. */
export default function RequireAuth({ roles, children }: { roles?: Role[]; children: ReactNode }) {
  const { d, t } = useI18n();
  useSession();
  const user = auth.currentUser();

  if (!user) {
    return (
      <div className="container-x py-20">
        <EmptyState
          icon={<Lock className="h-6 w-6" />}
          title={t(d.common.signInRequired)}
          hint={t(d.common.signInRequiredHint)}
          action={
            <Link to="/login">
              <Button>{t(d.action.signIn)}</Button>
            </Link>
          }
        />
      </div>
    );
  }

  if (roles && !roles.includes(user.role)) {
    return (
      <div className="container-x py-20">
        <EmptyState icon={<Lock className="h-6 w-6" />} title={t(d.common.noPermission)} />
      </div>
    );
  }

  return <>{children}</>;
}
