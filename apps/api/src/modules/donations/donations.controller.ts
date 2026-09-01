import type { Request, Response } from "express";
import { z } from "zod";
import * as donationsService from "@/modules/donations/donations.service";

const createDonationBodySchema = z.object({
  to_user_id: z.string().uuid(),
  novel_id: z.string().uuid().optional(),
  amount: z.number().positive().max(999999.99),
  message: z.string().trim().max(1000).optional(),
});

export async function create(req: Request, res: Response) {
  const body = createDonationBodySchema.parse(req.body);
  const donation = await donationsService.createDonation(req.user!.user_id, body);
  res.status(201).json(donation);
}
