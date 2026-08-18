import { useState } from "react";
import { Mail, MapPin, MessageCircle, Phone, Send } from "lucide-react";
import Reveal from "./Reveal";
import packageArrivedSvg from "undraw-svg/package-arrived.svg?raw";
import UndrawIllustration from "./UndrawIllustration";

const info = [
  { icon: Phone, label: "اتصل بنا", value: "966 50 000 0000+", href: "tel:+966500000000" },
  { icon: MessageCircle, label: "واتساب", value: "966 50 000 0000+", href: "https://wa.me/966500000000" },
  { icon: Mail, label: "البريد الإلكتروني", value: "info@wow-wholesale.sa", href: "mailto:info@wow-wholesale.sa" },
  { icon: MapPin, label: "العنوان", value: "المنطقة الصناعية، الرياض، السعودية", href: "#" },
];

export default function Contact() {
  const [sent, setSent] = useState(false);

  return (
    <section id="contact" className="bg-background py-20 lg:py-28">
      <div className="container-x grid gap-12 lg:grid-cols-5">
        <Reveal className="lg:col-span-2">
          <UndrawIllustration html={packageArrivedSvg} className="mb-6 max-w-[220px]" />
          <span className="text-sm font-bold text-accent">تواصل معنا</span>
          <h2 className="mt-3 text-balance text-3xl font-extrabold text-primary sm:text-4xl">
            جاهزون لتوريد احتياجاتك بالجملة
          </h2>
          <p className="mt-4 leading-relaxed text-muted-foreground">
            تواصل معنا الآن للحصول على عرض سعر مخصص لمتجرك أو مطعمك، وسيقوم
            فريقنا بالرد خلال ساعات العمل.
          </p>

          <div className="mt-8 space-y-4">
            {info.map(({ icon: Icon, label, value, href }) => (
              <a
                key={label}
                href={href}
                className="flex items-center gap-4 rounded-xl border border-border bg-card p-4 transition-colors hover:border-accent"
              >
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent">
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-xs font-semibold text-muted-foreground">{label}</div>
                  <div dir="ltr" className="text-end text-sm font-bold text-primary">
                    {value}
                  </div>
                </div>
              </a>
            ))}
          </div>
        </Reveal>

        <Reveal delay={0.1} className="lg:col-span-3">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setSent(true);
            }}
            className="rounded-2xl border border-border bg-card p-8 shadow-sm"
          >
            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label htmlFor="name" className="mb-1.5 block text-sm font-semibold text-secondary">
                  الاسم الكامل
                </label>
                <input
                  id="name"
                  required
                  type="text"
                  className="w-full rounded-lg border border-border bg-background px-4 py-2.5 text-sm outline-none ring-accent/30 focus:border-accent focus:ring-4"
                  placeholder="اسمك الكامل"
                />
              </div>
              <div>
                <label htmlFor="business" className="mb-1.5 block text-sm font-semibold text-secondary">
                  اسم النشاط التجاري
                </label>
                <input
                  id="business"
                  type="text"
                  className="w-full rounded-lg border border-border bg-background px-4 py-2.5 text-sm outline-none ring-accent/30 focus:border-accent focus:ring-4"
                  placeholder="متجر / مطعم / فندق"
                />
              </div>
              <div>
                <label htmlFor="phone" className="mb-1.5 block text-sm font-semibold text-secondary">
                  رقم الجوال
                </label>
                <input
                  id="phone"
                  required
                  type="tel"
                  dir="ltr"
                  className="w-full rounded-lg border border-border bg-background px-4 py-2.5 text-end text-sm outline-none ring-accent/30 focus:border-accent focus:ring-4"
                  placeholder="05xxxxxxxx"
                />
              </div>
              <div>
                <label htmlFor="email" className="mb-1.5 block text-sm font-semibold text-secondary">
                  البريد الإلكتروني
                </label>
                <input
                  id="email"
                  type="email"
                  dir="ltr"
                  className="w-full rounded-lg border border-border bg-background px-4 py-2.5 text-end text-sm outline-none ring-accent/30 focus:border-accent focus:ring-4"
                  placeholder="example@email.com"
                />
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="message" className="mb-1.5 block text-sm font-semibold text-secondary">
                  تفاصيل الطلب
                </label>
                <textarea
                  id="message"
                  rows={4}
                  className="w-full resize-none rounded-lg border border-border bg-background px-4 py-2.5 text-sm outline-none ring-accent/30 focus:border-accent focus:ring-4"
                  placeholder="اذكر المنتجات والكميات التي تحتاجها"
                />
              </div>
            </div>

            <button
              type="submit"
              className="mt-6 flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-accent px-6 py-3.5 text-base font-bold text-accent-foreground transition-colors hover:bg-primary sm:w-auto"
            >
              <Send className="h-5 w-5" />
              إرسال الطلب
            </button>

            {sent && (
              <p role="status" className="mt-4 text-sm font-semibold text-emerald-600">
                تم استلام طلبك بنجاح، سيتواصل معك فريقنا قريبًا.
              </p>
            )}
          </form>
        </Reveal>
      </div>
    </section>
  );
}
