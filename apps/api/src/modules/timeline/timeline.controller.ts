import type { Request, Response } from "express";
import { z } from "zod";
import * as timelineService from "@/modules/timeline/timeline.service";

const novelIdParamSchema = z.object({ novel_id: z.string().uuid() });
const eventIdParamSchema = z.object({ event_id: z.string().uuid() });

const timelineColorSchema = z.string().trim().max(20).optional();
const timelineIntensitySchema = z.number().int().min(1).max(10).optional();

const createTimelineEventBodySchema = z.object({
  title: z.string().trim().min(1).max(255),
  description: z.string().max(10000).optional(),
  event_order: z.number().int(),
  event_date_in_story: z.string().trim().max(50).optional(),
  event_time: z.string().trim().max(20).optional(),
  thread: z.string().trim().max(100).optional(),
  color: timelineColorSchema,
  intensity: timelineIntensitySchema,
});

export async function create(req: Request, res: Response) {
  const { novel_id } = novelIdParamSchema.parse(req.params);
  const body = createTimelineEventBodySchema.parse(req.body);
  const event = await timelineService.createTimelineEvent(novel_id, req.user!.user_id, body);
  res.status(201).json(event);
}

const updateTimelineEventBodySchema = z
  .object({
    title: z.string().trim().min(1).max(255).optional(),
    description: z.string().max(10000).optional(),
    event_order: z.number().int().optional(),
    event_date_in_story: z.string().trim().max(50).optional(),
    event_time: z.string().trim().max(20).optional(),
    thread: z.string().trim().max(100).optional(),
    color: timelineColorSchema,
    intensity: timelineIntensitySchema,
  })
  .refine((v) => Object.keys(v).length > 0, { message: "At least one field is required" });

export async function update(req: Request, res: Response) {
  const { event_id } = eventIdParamSchema.parse(req.params);
  const body = updateTimelineEventBodySchema.parse(req.body);
  const event = await timelineService.updateTimelineEvent(event_id, req.user!.user_id, body);
  res.status(200).json(event);
}

export async function remove(req: Request, res: Response) {
  const { event_id } = eventIdParamSchema.parse(req.params);
  const trash = await timelineService.deleteTimelineEvent(event_id, req.user!.user_id);
  res.status(200).json(trash);
}
