import { CheckCircle2 } from "lucide-react";
import Reveal from "./Reveal";
import handshakeDealSvg from "undraw-svg/handshake-deal.svg?raw";
import UndrawIllustration from "./UndrawIllustration";

const points = [
  "شراكات مباشرة مع مصانع وموردين معتمدين لضمان أفضل الأسعار",
  "مخازن مجهزة بأنظمة تبريد وتخزين تحافظ على جودة المنتجات",
  "فريق مبيعات متخصص لمساعدتك في اختيار المخزون المناسب",
  "مرونة في كميات الطلب تناسب المتاجر الصغيرة والكبيرة",
];

export default function About() {
  return (
    <section id="about" className="bg-background py-20 lg:py-28">
      <div className="container-x grid gap-14 lg:grid-cols-2 lg:items-center">
        <Reveal>
          <UndrawIllustration html={handshakeDealSvg} className="max-w-md" />
        </Reveal>

        <Reveal delay={0.1}>
          <span className="text-sm font-bold text-accent">من نحن</span>
          <h2 className="mt-3 text-balance text-3xl font-extrabold text-primary sm:text-4xl">
            شريكك الموثوق في توريد المواد الغذائية بالجملة
          </h2>
          <p className="mt-4 leading-relaxed text-muted-foreground">
            منذ أكثر من 12 عامًا، تعمل شركة واو على توفير مواد غذائية متنوعة
            وعالية الجودة لأصحاب المتاجر والمطاعم والفنادق، مع التزام كامل
            بمعايير السلامة الغذائية ومواعيد التوصيل، لنكون الخيار الأول
            لتموين نشاطك التجاري.
          </p>

          <ul className="mt-6 space-y-3">
            {points.map((p) => (
              <li key={p} className="flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
                <span className="text-secondary">{p}</span>
              </li>
            ))}
          </ul>
        </Reveal>
      </div>
    </section>
  );
}
