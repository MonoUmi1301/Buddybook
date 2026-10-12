// หมีน้ำตาลขนฟูใส่แว่นนั่งหันข้าง (สามส่วนสี่) ถือหนังสืออ่าน พลิกหน้ากระดาษวนไปเรื่อย ๆ — ใช้เป็นหน้าโหลดของทั้งเว็บ (app/loading.tsx)
// เป็น SVG ล้วน + keyframes ใน globals.css (.bb-bear-*) ไม่ต้องโหลด JS เพิ่ม จึงขึ้นได้ทันทีที่กดเปลี่ยนหน้า
// ขนฟู = filter feTurbulence + feDisplacementMap ทำขอบตัวหมีให้หยัก ๆ เหมือนขนนุ่ม
// prefers-reduced-motion: หยุดแอนิเมชันทั้งหมด เหลือแค่หมีนิ่ง ๆ

type BearLoaderProps = {
  label?: string;
  className?: string;
};

const FUR = "#8A5A3F";
const FUR_DARK = "#5B3A29";
const TAN = "#D9A879";
const INK = "#3B2418";
const PAPER = "#FFF8EE";

export function BearLoader({ label = "กำลังโหลด", className = "" }: BearLoaderProps) {
  return (
    <div role="status" aria-live="polite" className={`flex flex-col items-center gap-3 ${className}`}>
      <svg viewBox="0 0 200 220" className="bb-bear h-44 w-40 sm:h-52 sm:w-48" aria-hidden="true">
        <defs>
          <filter id="bb-bear-fur" x="-10%" y="-10%" width="120%" height="120%">
            <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="7" result="noise" />
            <feDisplacementMap in="SourceGraphic" in2="noise" scale="5" xChannelSelector="R" yChannelSelector="G" />
          </filter>
        </defs>

        {/* เงาบนพื้น */}
        <ellipse cx="104" cy="209" rx="74" ry="7" fill={FUR_DARK} opacity="0.15" />

        {/* ตัวนั่งหันข้าง (สามส่วนสี่ หันไปทางขวา) + ต้นขา + หัว + หู — filter ขนฟูทั้งกลุ่ม */}
        <g filter="url(#bb-bear-fur)">
          <ellipse cx="88" cy="150" rx="54" ry="54" fill={FUR} />
          <ellipse cx="96" cy="184" rx="48" ry="22" fill={FUR} />
          <circle cx="58" cy="36" r="18" fill={FUR} />
          <circle cx="138" cy="28" r="15" fill={FUR_DARK} />
          <ellipse cx="102" cy="72" rx="52" ry="46" fill={FUR} />
        </g>
        <circle cx="58" cy="37" r="9" fill={TAN} />
        <ellipse cx="78" cy="152" rx="26" ry="30" fill={TAN} opacity="0.55" />

        {/* หน้า — เลื่อนไปทางขวา ตาข้างไกลเล็กกว่าเล็กน้อยให้ดูมีมิติ */}
        <path d="M100 55 q7 -5 14 -1 M130 52 q6 -4 12 0" stroke={FUR_DARK} strokeWidth="3" fill="none" strokeLinecap="round" />
        <ellipse cx="98" cy="92" rx="8" ry="4.5" fill="#F4A6A0" opacity="0.5" />
        <ellipse cx="128" cy="92" rx="19" ry="13" fill={TAN} />
        <ellipse cx="139" cy="85" rx="6.5" ry="4.5" fill={INK} />
        <path d="M137 89.5 q-1 4 -4 5 q-5 1 -8 -2" stroke={INK} strokeWidth="1.8" fill="none" strokeLinecap="round" />

        {/* ตา — มองลงหนังสือ กวาดซ้ายขวาเหมือนกำลังอ่าน + กะพริบเป็นระยะ */}
        <g className="bb-bear-eyes">
          <g className="bb-bear-blink">
            <circle cx="108" cy="74" r="3.8" fill={INK} />
            <circle cx="138" cy="71" r="3.3" fill={INK} />
          </g>
        </g>

        {/* แว่นกลม — ขาแว่นข้างใกล้พาดไปหาหู */}
        <g stroke={INK} strokeWidth="2.6" fill="none" strokeLinecap="round">
          <circle cx="108" cy="73" r="13" fill="#ffffff" fillOpacity="0.22" />
          <circle cx="139" cy="70" r="10.5" fill="#ffffff" fillOpacity="0.22" />
          <path d="M121 71 q4 -4 8 -2" />
          <path d="M95 71 L64 62 q-5 -1 -5 4" />
        </g>
        <path d="M101 66 q3 -3 7 -2" stroke="#ffffff" strokeWidth="1.6" fill="none" strokeLinecap="round" opacity="0.8" />
        <path d="M134 64 q3 -2 5 -1" stroke="#ffffff" strokeWidth="1.4" fill="none" strokeLinecap="round" opacity="0.8" />

        {/* หนังสือ — ถือเอียงขึ้นไว้ด้านหน้าขวา */}
        <g className="bb-bear-book" transform="translate(132 148) rotate(-15) scale(0.74) translate(-100 -160)">
          <path d="M48 134 L100 140 L152 134 L152 180 L100 186 L48 180 Z" fill="#DB6B28" />
          <path d="M100 142 Q76 132 53 137 L53 176 Q76 171 100 181 Z" fill={PAPER} />
          <path d="M100 142 Q124 132 147 137 L147 176 Q124 171 100 181 Z" fill={PAPER} />
          <g stroke="#E3D2BC" strokeWidth="2.4" strokeLinecap="round">
            <path d="M60 147 q16 -3 32 2 M60 155 q16 -3 32 2 M60 163 q16 -3 32 2" />
            <path d="M108 149 q16 -5 32 -2 M108 157 q16 -5 32 -2 M108 165 q16 -5 32 -2" />
          </g>
          {/* หน้าที่กำลังพลิก — หมุนรอบสันหนังสือ (ขอบซ้ายของหน้าขวา) */}
          <path className="bb-bear-page" d="M100 142 Q124 132 147 137 L147 176 Q124 171 100 181 Z" fill={PAPER} stroke="#EADBC6" strokeWidth="1" />
          <path d="M100 141 V182" stroke="#C9B49A" strokeWidth="2" />
        </g>

        {/* แขน: ข้างใกล้โอบมาจับขอบซ้ายของหนังสือ ข้างไกลโผล่แค่อุ้งมือที่ขอบขวา */}
        <g filter="url(#bb-bear-fur)">
          <ellipse cx="88" cy="146" rx="12" ry="26" fill={FUR} transform="rotate(-48 88 146)" />
          <circle cx="168" cy="138" r="10" fill={FUR} />
        </g>
        <path d="M103 160 q4 -3 8 -1 M163 136 q3 -2 7 0" stroke={FUR_DARK} strokeWidth="1.5" fill="none" strokeLinecap="round" opacity="0.7" />

        {/* เท้าหันฝ่าเท้าออกมาทางขวา */}
        <g filter="url(#bb-bear-fur)">
          <ellipse cx="124" cy="194" rx="15" ry="17" fill={FUR} />
          <ellipse cx="166" cy="186" rx="13" ry="15" fill={FUR} />
        </g>
        <g fill={FUR_DARK} opacity="0.75">
          <ellipse cx="125" cy="198" rx="7.5" ry="8.5" />
          <circle cx="118" cy="184" r="2.8" />
          <circle cx="125" cy="181" r="2.8" />
          <circle cx="132" cy="184" r="2.8" />
          <ellipse cx="167" cy="190" rx="6.5" ry="7.5" />
          <circle cx="161" cy="177" r="2.5" />
          <circle cx="167" cy="174.5" r="2.5" />
          <circle cx="173" cy="177" r="2.5" />
        </g>
      </svg>

      <p className="text-sm font-medium text-neutral-500">
        {label}
        <span className="bb-bear-dots" aria-hidden="true" />
      </p>
    </div>
  );
}
