"use client";

import { useState } from "react";
import { Coins, Sparkles } from "lucide-react";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { CoinPackageRow, type CoinPackage } from "@/components/wallet/CoinPackageRow";
import { SlipUploadPanel } from "@/components/wallet/SlipUploadPanel";
import type { SessionUser } from "@/lib/api/session";

const packages: CoinPackage[] = [
  { id: "p25", coins: 25, priceLabel: "25 บาท" },
  { id: "p50", coins: 50, priceLabel: "50 บาท" },
  { id: "p100", coins: 100, priceLabel: "99 บาท" },
  { id: "p259", coins: 259, priceLabel: "250 บาท" },
  { id: "p410", coins: 410, priceLabel: "400 บาท" },
  { id: "p825", coins: 825, priceLabel: "800 บาท" },
];

interface WalletContentProps {
  user: SessionUser;
  initialBalance: number;
}

/** หน้าเติม coin — ต่อกับ GET /wallet/transactions + POST /wallet/topup/verify-slip จริงแล้ว
 *  (SlipOK ยังไม่ได้ตั้งค่า API key — จะเห็น error message ที่ชัดเจนแทนการเติมเงินหลอก ๆ)
 *  ดู wf_empty_states.png */
export function WalletContent({ user, initialBalance }: WalletContentProps) {
  const [balance, setBalance] = useState(initialBalance);
  const [selectedPkg, setSelectedPkg] = useState<CoinPackage | null>(null);

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <Navbar user={user} />

      <main className="flex-1">
        <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between border-b border-neutral-200 pb-6">
            <div className="flex items-center gap-3">
              <Coins className="h-9 w-9 text-amber-400" />
              <div>
                <h1 className="text-h3 text-neutral-900">เติม coin เข้าระบบ</h1>
                <p className="text-sm text-neutral-500">อัปโหลดสลิปโอนเงินเพื่อยืนยันอัตโนมัติ</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm text-neutral-500">coin ของฉัน</p>
              <p className="flex items-center justify-end gap-1 text-xl font-bold text-neutral-900">
                🪙 {balance.toLocaleString()}
              </p>
            </div>
          </div>

          <div className="mt-2">
            {packages.map((pkg) => (
              <CoinPackageRow key={pkg.id} pkg={pkg} onBuy={() => setSelectedPkg(pkg)} />
            ))}
          </div>
        </div>

        <div className="bg-brand-tan/20 px-4 py-6">
          <div className="mx-auto flex max-w-3xl items-center gap-4">
            <Sparkles className="h-10 w-10 shrink-0 text-brand-tan-dark" />
            <p className="text-lg font-bold text-brand-brown">ยิ่งเติมเยอะ coin ยิ่งถูกลง!</p>
          </div>
        </div>
      </main>

      {selectedPkg && (
        <SlipUploadPanel
          pkg={selectedPkg}
          onClose={() => setSelectedPkg(null)}
          onSuccess={(newBalance) => {
            setBalance(newBalance);
            setSelectedPkg(null);
          }}
        />
      )}

      <Footer />
    </div>
  );
}
