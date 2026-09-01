import type { Request, Response } from "express";
import { z } from "zod";
import * as walletService from "@/modules/wallet/wallet.service";

export async function listTransactions(req: Request, res: Response) {
  const result = await walletService.listTransactions(req.user!.user_id);
  res.status(200).json(result);
}

const verifySlipBodySchema = z.object({
  package_id: z.string().min(1),
  slip_image_url: z.string().url(),
});

export async function verifyTopupSlip(req: Request, res: Response) {
  const body = verifySlipBodySchema.parse(req.body);
  const transaction = await walletService.verifyTopupSlip(req.user!.user_id, body.package_id, body.slip_image_url);
  res.status(201).json(transaction);
}
