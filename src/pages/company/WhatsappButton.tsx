import { MessageCircle } from "lucide-react";

export default function WhatsappButton() {
  return (
    <a
      href="https://wa.me/966500000000"
      target="_blank"
      rel="noreferrer"
      aria-label="تواصل معنا عبر واتساب"
      className="fixed bottom-6 start-6 z-40 flex h-14 w-14 cursor-pointer items-center justify-center rounded-full bg-emerald-500 text-white shadow-lg shadow-emerald-500/40 transition-transform hover:scale-105"
    >
      <MessageCircle className="h-7 w-7" />
    </a>
  );
}
