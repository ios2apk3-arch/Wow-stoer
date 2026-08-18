export default function HeroIllustration() {
  return (
    <svg
      viewBox="0 0 560 460"
      fill="none"
      className="h-auto w-full max-w-xl"
      aria-hidden="true"
    >
      <ellipse cx="290" cy="410" rx="220" ry="24" fill="#0F172A" opacity="0.06" />

      {/* warehouse shelf */}
      <rect x="40" y="120" width="150" height="260" rx="10" fill="#E2E8F0" />
      <rect x="52" y="140" width="126" height="46" rx="8" fill="#0369A1" />
      <rect x="52" y="198" width="126" height="46" rx="8" fill="#38BDF8" />
      <rect x="52" y="256" width="126" height="46" rx="8" fill="#0F172A" />
      <rect x="52" y="314" width="126" height="46" rx="8" fill="#0369A1" opacity="0.85" />
      <circle cx="90" cy="163" r="9" fill="#F8FAFC" />
      <circle cx="90" cy="221" r="9" fill="#F8FAFC" />
      <circle cx="90" cy="279" r="9" fill="#F8FAFC" />
      <circle cx="90" cy="337" r="9" fill="#F8FAFC" />

      {/* stacked crates */}
      <g>
        <rect x="220" y="260" width="90" height="70" rx="8" fill="#0369A1" />
        <rect x="220" y="260" width="90" height="70" rx="8" fill="url(#crateGrad)" opacity="0.35" />
        <rect x="232" y="330" width="66" height="50" rx="6" fill="#0F172A" />
        <rect x="242" y="215" width="70" height="55" rx="8" fill="#38BDF8" />
        <path d="M220 270h90M265 260v70" stroke="#F8FAFC" strokeWidth="3" opacity="0.6" />
      </g>

      {/* forklift */}
      <g>
        <rect x="330" y="300" width="90" height="46" rx="8" fill="#0F172A" />
        <rect x="330" y="270" width="34" height="40" rx="6" fill="#334155" />
        <circle cx="350" cy="358" r="16" fill="#020617" />
        <circle cx="404" cy="358" r="16" fill="#020617" />
        <circle cx="350" cy="358" r="6" fill="#94A3B8" />
        <circle cx="404" cy="358" r="6" fill="#94A3B8" />
        <rect x="400" y="255" width="8" height="70" fill="#475569" />
        <rect x="404" y="278" width="34" height="8" fill="#475569" />
      </g>

      {/* delivery truck */}
      <g>
        <rect x="70" y="60" width="150" height="60" rx="10" fill="#0F172A" />
        <rect x="86" y="74" width="70" height="34" rx="6" fill="#38BDF8" />
        <rect x="164" y="74" width="40" height="34" rx="6" fill="#0369A1" />
        <circle cx="110" cy="126" r="12" fill="#020617" />
        <circle cx="180" cy="126" r="12" fill="#020617" />
        <circle cx="110" cy="126" r="4.5" fill="#94A3B8" />
        <circle cx="180" cy="126" r="4.5" fill="#94A3B8" />
      </g>

      {/* floating accent shapes */}
      <circle cx="470" cy="120" r="26" fill="#0369A1" opacity="0.15" />
      <circle cx="500" cy="200" r="14" fill="#38BDF8" opacity="0.3" />
      <rect x="440" y="330" width="46" height="46" rx="12" fill="#0369A1" opacity="0.12" />

      <defs>
        <linearGradient id="crateGrad" x1="220" y1="260" x2="310" y2="330" gradientUnits="userSpaceOnUse">
          <stop stopColor="#F8FAFC" />
          <stop offset="1" stopColor="#F8FAFC" stopOpacity="0" />
        </linearGradient>
      </defs>
    </svg>
  );
}
