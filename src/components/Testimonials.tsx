import { Quote, Star } from "lucide-react";
import Reveal from "./Reveal";

const testimonials = [
  {
    name: "أبو خالد",
    role: "صاحب سوبر ماركت — جدة",
    quote:
      "منذ ما تعاملنا مع واو، صار توفير البضاعة أسهل بكثير. أسعار ممتازة والتوصيل دايم في وقته.",
  },
  {
    name: "م. سارة العتيبي",
    role: "مديرة مشتريات مطعم — الرياض",
    quote:
      "فريق واو متعاون جدًا ويفهم احتياجات المطعم. جودة المنتجات ثابتة ولا تختلف من طلبية لأخرى.",
  },
  {
    name: "أبو فهد",
    role: "صاحب محل مواد غذائية — الدمام",
    quote:
      "تنوع كبير بالمنتجات في مكان واحد، وفرت علي وقت وجهد التعامل مع أكثر من مورد.",
  },
];

export default function Testimonials() {
  return (
    <section id="testimonials" className="bg-muted/40 py-20 lg:py-28">
      <div className="container-x">
        <Reveal className="mx-auto max-w-2xl text-center">
          <span className="text-sm font-bold text-accent">آراء عملائنا</span>
          <h2 className="mt-3 text-balance text-3xl font-extrabold text-primary sm:text-4xl">
            ثقة أصحاب المتاجر والمطاعم هي رأس مالنا
          </h2>
        </Reveal>

        <div className="mt-14 grid grid-cols-1 gap-6 lg:grid-cols-3">
          {testimonials.map((t, i) => (
            <Reveal key={t.name} delay={i * 0.1}>
              <div className="flex h-full flex-col rounded-2xl border border-border bg-card p-7 shadow-sm">
                <Quote className="h-8 w-8 text-accent/30" />
                <div className="mt-3 flex gap-0.5 text-amber-400">
                  {Array.from({ length: 5 }).map((_, s) => (
                    <Star key={s} className="h-4 w-4 fill-current" />
                  ))}
                </div>
                <p className="mt-4 flex-1 leading-relaxed text-secondary">{t.quote}</p>
                <div className="mt-6 border-t border-border pt-4">
                  <div className="text-sm font-bold text-primary">{t.name}</div>
                  <div className="text-xs text-muted-foreground">{t.role}</div>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
