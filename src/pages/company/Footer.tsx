import { WowMark } from "../../components/icons";
import { FacebookIcon, InstagramIcon, XIcon } from "../../components/SocialIcons";

const columns = [
  {
    title: "روابط سريعة",
    links: [
      { label: "من نحن", href: "#about" },
      { label: "المنتجات", href: "#categories" },
      { label: "لماذا واو", href: "#why-us" },
      { label: "آراء العملاء", href: "#testimonials" },
    ],
  },
  {
    title: "فئات المنتجات",
    links: [
      { label: "المواد الجافة", href: "#categories" },
      { label: "المعلبات", href: "#categories" },
      { label: "الألبان", href: "#categories" },
      { label: "المشروبات", href: "#categories" },
    ],
  },
];

export default function Footer() {
  return (
    <footer className="bg-primary text-slate-300">
      <div className="container-x grid gap-12 py-16 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <div className="flex items-center gap-3">
            <WowMark className="h-10 w-10" />
            <span className="text-lg font-extrabold text-white">واو للمواد الغذائية</span>
          </div>
          <p className="mt-4 max-w-xs text-sm leading-relaxed">
            موزع موثوق للمواد الغذائية بالجملة لأصحاب المتاجر والمطاعم
            والفنادق في جميع أنحاء المملكة.
          </p>
          <div className="mt-5 flex gap-3">
            {[InstagramIcon, XIcon, FacebookIcon].map((Icon, i) => (
              <a
                key={i}
                href="#"
                aria-label="تابعنا على وسائل التواصل الاجتماعي"
                className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg bg-white/10 text-white transition-colors hover:bg-accent"
              >
                <Icon className="h-4 w-4" />
              </a>
            ))}
          </div>
        </div>

        {columns.map((col) => (
          <div key={col.title}>
            <h3 className="text-sm font-bold text-white">{col.title}</h3>
            <ul className="mt-4 space-y-3">
              {col.links.map((l) => (
                <li key={l.label}>
                  <a href={l.href} className="text-sm transition-colors hover:text-accent-light">
                    {l.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ))}

        <div>
          <h3 className="text-sm font-bold text-white">تواصل معنا</h3>
          <ul className="mt-4 space-y-3 text-sm">
            <li dir="ltr" className="text-end">+966 50 000 0000</li>
            <li>info@wow-wholesale.sa</li>
            <li>المنطقة الصناعية، الرياض، السعودية</li>
          </ul>
        </div>
      </div>

      <div className="border-t border-white/10 py-6">
        <div className="container-x flex flex-col items-center justify-between gap-3 text-xs text-slate-400 sm:flex-row">
          <p>© {new Date().getFullYear()} شركة واو للمواد الغذائية بالجملة. جميع الحقوق محفوظة.</p>
          <p>صُنع بعناية لخدمة أصحاب الأعمال</p>
        </div>
      </div>
    </footer>
  );
}
