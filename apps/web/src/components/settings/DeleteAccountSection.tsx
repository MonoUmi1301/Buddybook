"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { DeleteAccountModal } from "@/components/settings/DeleteAccountModal";

export function DeleteAccountSection({ hasPassword }: { hasPassword: boolean }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        type="button"
        variant="outline"
        className="border-red-300 text-red-600 hover:bg-red-50"
        onClick={() => setOpen(true)}
      >
        ลบบัญชี
      </Button>

      {open && <DeleteAccountModal hasPassword={hasPassword} onClose={() => setOpen(false)} />}
    </>
  );
}
