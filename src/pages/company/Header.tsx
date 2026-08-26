import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, Phone, X } from "lucide-react";
import { WowMark } from "../../components/icons";

const links = [
  { href: "#home", label: "الرئيسية" },
  { href: "#about", label: "من نحن" },
  { href: "#categories", label: "المنتجات" },
  { href: "#why-us", label: "لماذا واو" },
  { href: "#testimonials", label: "آراء العملاء" },
  { href: "#contact", label: "تواصل معنا" },
];

export default function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`sticky top-0 z-50 transition-colors duration-300 ${
        scrolled ? "bg-card/95 shadow-sm backdrop-blur" : "bg-transparent"
      }`}
    >
      <div className="container-x flex h-20 items-center justify-between py-3">
        <a href="#home" className="flex items-center gap-3">
          <WowMark className="h-10 w-10 shrink-0" />
          <span className="flex flex-col leading-tight">
            <span className="text-lg font-extrabold text-primary">واو</span>
            <span className="text-[11px] font-medium text-muted-foreground">
              للمواد الغذائية بالجملة
            </span>
          </span>
        </a>

        <nav className="hidden items-center gap-8 lg:flex">
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="text-sm font-semibold text-secondary transition-colors hover:text-accent"
            >
              {l.label}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-4 lg:flex">
          <a
            href="tel:+966500000000"
            className="flex items-center gap-2 text-sm font-bold text-primary"
          >
            <Phone className="h-4 w-4 text-accent" />
            <span dir="ltr">966 50 000 0000+</span>
          </a>
          <a
            href="#contact"
            className="cursor-pointer rounded-xl bg-accent px-5 py-2.5 text-sm font-bold text-accent-foreground shadow-sm transition-all hover:bg-primary hover:shadow-md"
          >
            اطلب عرض سعر
          </a>
        </div>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="cursor-pointer rounded-lg p-2 text-primary lg:hidden"
          aria-label={open ? "إغلاق القائمة" : "فتح القائمة"}
          aria-expanded={open}
        >
          {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      <AnimatePresence>
        {open && (
          <motion.nav
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden border-t border-border bg-card lg:hidden"
          >
            <div className="container-x flex flex-col gap-1 py-4">
              {links.map((l) => (
                <a
                  key={l.href}
                  href={l.href}
                  onClick={() => setOpen(false)}
                  className="rounded-lg px-3 py-3 text-sm font-semibold text-secondary hover:bg-muted"
                >
                  {l.label}
                </a>
              ))}
              <a
                href="#contact"
                onClick={() => setOpen(false)}
                className="mt-2 rounded-xl bg-accent px-5 py-3 text-center text-sm font-bold text-accent-foreground"
              >
                اطلب عرض سعر
              </a>
            </div>
          </motion.nav>
        )}
      </AnimatePresence>
    </header>
  );
}
