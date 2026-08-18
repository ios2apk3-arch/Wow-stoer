import Reveal from "./Reveal";

const stats = [
  { value: "+12", label: "سنة خبرة في السوق" },
  { value: "+850", label: "عميل من متاجر ومطاعم" },
  { value: "+300", label: "منتج غذائي متنوع" },
  { value: "98%", label: "التزام بمواعيد التوصيل" },
];

export default function Stats() {
  return (
    <section className="border-b border-border bg-card">
      <div className="container-x py-10">
        <Reveal>
          <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
            {stats.map((s) => (
              <div key={s.label} className="text-center">
                <div className="text-3xl font-extrabold text-primary sm:text-4xl">{s.value}</div>
                <div className="mt-1 text-sm font-medium text-muted-foreground">{s.label}</div>
              </div>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}
