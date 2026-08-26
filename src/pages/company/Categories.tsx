import {
  Beef,
  Cookie,
  CupSoda,
  Milk,
  Package,
  SprayCan,
  Wheat,
  Wine,
} from "lucide-react";
import Reveal from "../../components/Reveal";

const categories = [
  { icon: Wheat, title: "المواد الغذائية الجافة", desc: "أرز، بقوليات، دقيق، سكر ومعكرونة" },
  { icon: Package, title: "المعلبات والمواد المحفوظة", desc: "معلبات خضار وفواكه وأسماك ولحوم" },
  { icon: Milk, title: "الألبان ومشتقاتها", desc: "حليب، أجبان، ألبان ومنتجات مبردة" },
  { icon: CupSoda, title: "المشروبات", desc: "عصائر، مياه ومشروبات غازية بالجملة" },
  { icon: Cookie, title: "الحلويات والمخبوزات", desc: "بسكويت، شوكولاتة ومواد مخبوزات" },
  { icon: Beef, title: "اللحوم والدواجن المجمدة", desc: "منتجات مجمدة بمعايير سلامة عالية" },
  { icon: Wine, title: "التوابل والزيوت", desc: "بهارات، زيوت طبخ وصلصات متنوعة" },
  { icon: SprayCan, title: "مستلزمات النظافة", desc: "منظفات ومستلزمات المطاعم والمتاجر" },
];

export default function Categories() {
  return (
    <section id="categories" className="bg-muted/40 py-20 lg:py-28">
      <div className="container-x">
        <Reveal className="mx-auto max-w-2xl text-center">
          <span className="text-sm font-bold text-accent">منتجاتنا</span>
          <h2 className="mt-3 text-balance text-3xl font-extrabold text-primary sm:text-4xl">
            تشكيلة واسعة تغطي احتياجات نشاطك بالكامل
          </h2>
          <p className="mt-4 text-muted-foreground">
            نوفر جميع فئات المواد الغذائية التي يحتاجها متجرك أو مطعمك من مورد
            واحد موثوق، بأسعار جملة تنافسية.
          </p>
        </Reveal>

        <div className="mt-14 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {categories.map(({ icon: Icon, title, desc }, i) => (
            <Reveal key={title} delay={(i % 4) * 0.08}>
              <div className="group h-full cursor-pointer rounded-2xl border border-border bg-card p-6 shadow-sm transition-all hover:-translate-y-1 hover:shadow-lg hover:shadow-accent/10">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent/10 text-accent transition-colors group-hover:bg-accent group-hover:text-white">
                  <Icon className="h-6 w-6" />
                </div>
                <h3 className="mt-4 text-base font-bold text-primary">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{desc}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
