import { FileQuestion } from "lucide-react";
import { Link } from "../app/router";
import { useI18n } from "../i18n";
import { Button, EmptyState } from "../ui";

export default function NotFound() {
  const { d, t } = useI18n();
  return (
    <div className="container-x py-20">
      <EmptyState
        icon={<FileQuestion className="h-6 w-6" />}
        title={t(d.common.notFound)}
        hint={t(d.common.notFoundHint)}
        action={
          <Link to="/">
            <Button>{t(d.nav.home)}</Button>
          </Link>
        }
      />
    </div>
  );
}
