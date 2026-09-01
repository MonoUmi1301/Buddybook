import { Router } from "express";
import { requireAuth } from "@/middleware/auth.middleware";
import { asyncHandler } from "@/utils/asyncHandler";
import * as charactersController from "@/modules/characters/characters.controller";

// character_nodes — ผังตัวละครจาก @xyflow/react
export const charactersRouter = Router();
charactersRouter.use(requireAuth);
charactersRouter.patch("/:node_id", asyncHandler(charactersController.update));
charactersRouter.delete("/:node_id", asyncHandler(charactersController.remove));

// character_edges — เส้นความสัมพันธ์ระหว่างตัวละคร
export const characterEdgesRouter = Router();
characterEdgesRouter.use(requireAuth);
characterEdgesRouter.patch("/:edge_id", asyncHandler(charactersController.updateEdge));
characterEdgesRouter.delete("/:edge_id", asyncHandler(charactersController.removeEdge));
