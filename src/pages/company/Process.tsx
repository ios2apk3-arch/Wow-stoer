import { ClipboardList, MessageSquareText, PackageSearch, Truck } from "lucide-react";
import Reveal from "../../components/Reveal";

const steps = [
  { icon: MessageSquareText, title: "تواصل معنا", desc: "أرسل طلبك عبر الهاتف أو واتساب أو النموذج." },
  { icon: PackageSearch, title: "اختر منتجاتك", desc: "نساعدك في اختيار الكميات والفئات المناسبة." },
  { icon: ClipboardList, title: "تأكيد الطلب والسعر", desc: "عرض سعر واضح وتأكيد سريع بدون تعقيد." },
  { icon: Truck, title: "استلم توصيلك", desc: "توصيل سريع لمتجرك أو مطعمك في الموعد المحدد." },
];

export default function Process() {
  return (
    <section className="bg-primary py-20 text-primary-foreground lg:py-28">
      <div className="container-x">
        <Reveal className="mx-auto max-w-2xl text-center">
          <span className="text-sm font-bold text-accent-light">آلية العمل</span>
          <h2 className="mt-3 text-balance text-3xl font-extrabold sm:text-4xl">
            اطلب بالجملة في 4 خطوات بسيطة
          </h2>
        </Reveal>

        <div className="relative mt-16 grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div className="absolute top-7 hidden h-0.5 w-full bg-white/10 lg:block" />
          {steps.map(({ icon: Icon, title, desc }, i) => (
            <Reveal key={title} delay={i * 0.12} className="relative text-center">
              <div className="relative z-10 mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-accent text-white shadow-lg shadow-accent/40">
                <Icon className="h-6 w-6" />
              </div>
              <span className="mt-4 block text-xs font-bold text-accent-light">
                {`الخطوة ${["الأولى", "الثانية", "الثالثة", "الرابعة"][i]}`}
              </span>
              <h3 className="mt-1 text-lg font-bold">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-300">{desc}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
