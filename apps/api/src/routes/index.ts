import { Router } from "express";

import authRoutes from "@/modules/auth/auth.routes";
import usersRoutes from "@/modules/users/users.routes";
import uploadsRoutes from "@/modules/uploads/uploads.routes";
import novelsRoutes from "@/modules/novels/novels.routes";
import chaptersRoutes from "@/modules/chapters/chapters.routes";
import libraryRoutes from "@/modules/library/library.routes";
import trashBinRoutes from "@/modules/trash-bin/trash-bin.routes";
import { charactersRouter, characterEdgesRouter } from "@/modules/characters/characters.routes";
import locationsRoutes, { locationEdgesRouter } from "@/modules/locations/locations.routes";
import mapVersionsRoutes from "@/modules/novels/map-versions.routes";
import timelineRoutes from "@/modules/timeline/timeline.routes";
import recommendationsRoutes from "@/modules/recommendations/recommendations.routes";
import donationsRoutes from "@/modules/donations/donations.routes";
import walletRoutes from "@/modules/wallet/wallet.routes";
import notificationsRoutes from "@/modules/notifications/notifications.routes";
import adminRoutes, { publicAdminRouter } from "@/modules/admin/admin.routes";
import internalRoutes from "@/modules/internal/internal.routes";

/**
 * Router รวมทุกโมดูล mount ใต้ /api/v1 (ดู app.ts)
 * ลำดับ mount อ้างอิงตาม 5 โมดูลใน API_Endpoints.md
 */
const router = Router();

// 1. Authentication & Onboarding
router.use("/auth", authRoutes);
router.use("/users", usersRoutes);
// ส่วนขยายนอก API_Endpoints.md เดิม — Cloudinary signed upload (ดู lib/cloudinary.ts)
router.use("/uploads", uploadsRoutes);

// 2. Reader Features
router.use("/novels", novelsRoutes);
router.use("/chapters", chaptersRoutes);
router.use("/library", libraryRoutes);
router.use("/recommendations", recommendationsRoutes);
router.use("/donations", donationsRoutes);
router.use("/wallet", walletRoutes);
router.use("/notifications", notificationsRoutes);

// 3. Writer Workspace
router.use("/trash-bin", trashBinRoutes);
router.use("/characters", charactersRouter);
router.use("/character-edges", characterEdgesRouter);
router.use("/locations", locationsRoutes);
router.use("/location-edges", locationEdgesRouter);
router.use("/map-versions", mapVersionsRoutes);
router.use("/timeline-events", timelineRoutes);

// 4. System / Background Services (internal service token, ไม่ใช่ JWT ผู้ใช้)
router.use("/internal", internalRoutes);

// 5. Admin & System Management (publicAdminRouter ต้อง mount ก่อน adminRoutes)
router.use("/admin", publicAdminRouter);
router.use("/admin", adminRoutes);

export default router;
