export default function UndrawIllustration({
  html,
  className = "",
  color = "text-accent",
}: {
  html: string;
  className?: string;
  color?: string;
}) {
  return (
    <div
      className={`[&>svg]:h-auto [&>svg]:w-full ${color} ${className}`}
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
