import { useI18n } from "../i18n";
import { Badge } from "../ui";
import type { NegotiationStatus, OrderStatus, PaymentStatus, RfqStatus } from "../platform/types";

const orderTones: Record<OrderStatus, "neutral" | "accent" | "success" | "warning" | "danger" | "info"> = {
  pending: "warning",
  confirmed: "info",
  processing: "accent",
  shipped: "accent",
  delivered: "success",
  cancelled: "danger",
};

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const { d, t } = useI18n();
  return <Badge tone={orderTones[status]}>{t(d.order.statuses[status])}</Badge>;
}

const paymentTones: Record<PaymentStatus, "neutral" | "success" | "warning" | "danger" | "info"> = {
  unpaid: "warning",
  authorized: "info",
  paid: "success",
  refunded: "neutral",
  failed: "danger",
};

export function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  const { d, t } = useI18n();
  return <Badge tone={paymentTones[status]}>{t(d.order.payments[status])}</Badge>;
}

const rfqTones: Record<RfqStatus, "neutral" | "accent" | "success" | "warning" | "info"> = {
  open: "info",
  quoted: "accent",
  awarded: "success",
  closed: "neutral",
  expired: "warning",
};

export function RfqStatusBadge({ status }: { status: RfqStatus }) {
  const { d, t } = useI18n();
  return <Badge tone={rfqTones[status]}>{t(d.rfq.statuses[status])}</Badge>;
}

const negotiationTones: Record<NegotiationStatus, "accent" | "success" | "danger" | "info"> = {
  active: "accent",
  accepted: "success",
  rejected: "danger",
  converted: "info",
};

export function NegotiationStatusBadge({ status }: { status: NegotiationStatus }) {
  const { d, t } = useI18n();
  return <Badge tone={negotiationTones[status]}>{t(d.negotiation.statuses[status])}</Badge>;
}
