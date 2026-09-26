import type { Request, Response } from "express";
import { z } from "zod";
import * as reportsService from "@/modules/reports/reports.service";

const createReportSchema = z.object({
  target_type: z.enum(["novel", "chapter", "comment", "review", "user"]),
  target_id: z.string().uuid(),
  reason: z.enum(["spam", "harassment", "inappropriate", "copyright", "other"]),
  details: z.string().trim().max(1000).optional(),
});

export async function createReport(req: Request, res: Response) {
  const body = createReportSchema.parse(req.body);
  res.status(201).json(await reportsService.createReport(req.user!.user_id, body));
}

const listQuerySchema = z.object({
  status: z.enum(["open", "dismissed", "actioned"]).optional(),
  cursor: z.string().uuid().optional(),
});

export async function adminListReports(req: Request, res: Response) {
  const { status, cursor } = listQuerySchema.parse(req.query);
  res.status(200).json(await reportsService.listReports(status, cursor));
}

const reportIdParamSchema = z.object({ report_id: z.string().uuid() });
const resolveBodySchema = z.object({
  action: z.enum(["dismiss", "action"]),
  note: z.string().trim().max(500).optional(),
});

export async function adminResolveReport(req: Request, res: Response) {
  const { report_id } = reportIdParamSchema.parse(req.params);
  const { action, note } = resolveBodySchema.parse(req.body);
  res.status(200).json(await reportsService.resolveReport(report_id, req.user!.user_id, action, note));
}
