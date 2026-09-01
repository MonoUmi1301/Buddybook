import { Coins } from "lucide-react";
import { Button } from "@/components/ui/Button";

export interface CoinPackage {
  id: string;
  coins: number;
  priceLabel: string;
}

/** แถวแพ็กเกจเติม coin — ไอคอนเหรียญ+จำนวน ซ้าย ปุ่มราคา ขวา ดู wf_empty_states.png (หน้าเติม coin) */
export function CoinPackageRow({ pkg, onBuy }: { pkg: CoinPackage; onBuy?: (id: string) => void }) {
  return (
    <div className="flex items-center justify-between border-b border-neutral-100 py-4 last:border-0">
      <div className="flex items-center gap-3">
        <Coins className="h-6 w-6 text-amber-400" />
        <span className="text-lg font-semibold text-neutral-900">{pkg.coins}</span>
      </div>
      <Button variant="tan" onClick={() => onBuy?.(pkg.id)}>
        {pkg.priceLabel}
      </Button>
    </div>
  );
}
