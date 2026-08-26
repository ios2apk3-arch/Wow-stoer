import { Clock, HandCoins, PackageCheck, Headset, Truck, Warehouse } from "lucide-react";
import Reveal from "../../components/Reveal";

const features = [
  { icon: HandCoins, title: "أسعار جملة تنافسية", desc: "أسعار مباشرة من المصدر بدون وسطاء، تمنحك أعلى هامش ربح." },
  { icon: PackageCheck, title: "جودة موثوقة", desc: "منتجات مطابقة لمعايير السلامة الغذائية مع فحص دوري للجودة." },
  { icon: Truck, title: "توصيل سريع ومرن", desc: "شبكة توزيع تغطي جميع المناطق مع مواعيد توصيل دقيقة." },
  { icon: Warehouse, title: "مخزون دائم ومتجدد", desc: "مستودعات مجهزة تضمن توفر المنتجات دون انقطاع." },
  { icon: Headset, title: "دعم مخصص لعملك", desc: "فريق مبيعات يتابع طلباتك ويقترح الكميات المناسبة لنشاطك." },
  { icon: Clock, title: "التزام بالمواعيد", desc: "التزام تام بمواعيد التوريد المتفق عليها لضمان استمرار عملك." },
];

export default function WhyUs() {
  return (
    <section id="why-us" className="bg-background py-20 lg:py-28">
      <div className="container-x">
        <Reveal className="mx-auto max-w-2xl text-center">
          <span className="text-sm font-bold text-accent">لماذا واو</span>
          <h2 className="mt-3 text-balance text-3xl font-extrabold text-primary sm:text-4xl">
            نبني معك شراكة تجارية تدوم
          </h2>
        </Reveal>

        <div className="mt-14 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {features.map(({ icon: Icon, title, desc }, i) => (
            <Reveal key={title} delay={(i % 3) * 0.1}>
              <div className="flex gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary text-white">
                  <Icon className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-primary">{title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{desc}</p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
