import { motion } from "framer-motion";
import { ArrowLeft, BadgeCheck, ShieldCheck, Truck } from "lucide-react";
import deliveryTruckSvg from "undraw-svg/delivery-truck.svg?raw";
import UndrawIllustration from "./UndrawIllustration";

const badges = [
  { icon: ShieldCheck, label: "جودة مضمونة 100%" },
  { icon: Truck, label: "توصيل سريع لجميع المناطق" },
  { icon: BadgeCheck, label: "أسعار جملة تنافسية" },
];

export default function Hero() {
  return (
    <section id="home" className="relative overflow-hidden bg-primary text-primary-foreground">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-24 -right-24 h-72 w-72 rounded-full bg-accent/20 blur-3xl" />
        <div className="absolute -bottom-32 -left-16 h-80 w-80 rounded-full bg-accent-light/10 blur-3xl" />
      </div>

      <div className="container-x relative grid gap-12 py-20 lg:grid-cols-2 lg:items-center lg:py-28">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: "easeOut" }}
        >
          <span className="inline-flex items-center rounded-full bg-white/10 px-4 py-1.5 text-xs font-bold text-accent-light ring-1 ring-white/20">
            الموزع الموثوق للمواد الغذائية بالجملة
          </span>

          <h1 className="mt-6 text-balance text-4xl font-extrabold leading-tight sm:text-5xl">
            نموّن متجرك ومطعمك بأفضل المواد الغذائية بالجملة
          </h1>

          <p className="mt-5 max-w-xl text-lg leading-relaxed text-slate-300">
            شركة واو تزوّد أصحاب المتاجر والمطاعم والفنادق بمواد غذائية متنوعة
            وطازجة بأسعار الجملة، مع توصيل سريع وشراكة طويلة الأمد تضمن استمرار
            نشاطك دون انقطاع.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-4">
            <a
              href="#contact"
              className="group inline-flex cursor-pointer items-center gap-2 rounded-xl bg-accent px-6 py-3.5 text-base font-bold text-accent-foreground shadow-lg shadow-accent/30 transition-all hover:bg-accent-light hover:shadow-accent-light/30"
            >
              اطلب عرض سعر الآن
              <ArrowLeft className="h-5 w-5 transition-transform group-hover:-translate-x-1" />
            </a>
            <a
              href="#categories"
              className="cursor-pointer rounded-xl border border-white/20 px-6 py-3.5 text-base font-bold text-white transition-colors hover:bg-white/10"
            >
              تصفّح المنتجات
            </a>
          </div>

          <div className="mt-10 flex flex-wrap gap-x-8 gap-y-4">
            {badges.map(({ icon: Icon, label }) => (
              <div key={label} className="flex items-center gap-2 text-sm font-semibold text-slate-200">
                <Icon className="h-5 w-5 text-accent-light" />
                {label}
              </div>
            ))}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.94 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, ease: "easeOut", delay: 0.15 }}
          className="flex justify-center lg:justify-start"
        >
          <UndrawIllustration
            html={deliveryTruckSvg}
            color="text-accent-light"
            className="max-w-xl drop-shadow-2xl"
          />
        </motion.div>
      </div>
    </section>
  );
}
