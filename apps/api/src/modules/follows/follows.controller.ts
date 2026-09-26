import type { Request, Response } from "express";
import { z } from "zod";
import * as followsService from "@/modules/follows/follows.service";

const userIdParamSchema = z.object({ user_id: z.string().uuid() });

export async function follow(req: Request, res: Response) {
  const { user_id } = userIdParamSchema.parse(req.params);
  res.status(200).json(await followsService.followAuthor(req.user!.user_id, user_id));
}

export async function unfollow(req: Request, res: Response) {
  const { user_id } = userIdParamSchema.parse(req.params);
  res.status(200).json(await followsService.unfollowAuthor(req.user!.user_id, user_id));
}

export async function status(req: Request, res: Response) {
  const { user_id } = userIdParamSchema.parse(req.params);
  res.status(200).json(await followsService.getFollowStatus(user_id, req.user?.user_id));
}

export async function listFollowing(req: Request, res: Response) {
  res.status(200).json(await followsService.listFollowing(req.user!.user_id));
}
