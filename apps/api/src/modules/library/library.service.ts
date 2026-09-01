import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/utils/ApiError";

/** Reference implementation — GET /library */
export async function listLibrary(user_id: string) {
  const items = await prisma.userLibrary.findMany({
    where: { user_id },
    orderBy: { added_at: "desc" },
    include: {
      novel: {
        select: { novel_id: true, title: true, cover_image_url: true, status: true, view_count: true },
      },
    },
  });

  return {
    library: items.map((item) => ({
      library_id: item.library_id,
      novel: { ...item.novel, view_count: Number(item.novel.view_count) },
      added_at: item.added_at,
    })),
  };
}

/** Reference implementation — POST /library */
export async function addToLibrary(user_id: string, novel_id: string) {
  const novel = await prisma.novel.findUnique({ where: { novel_id }, select: { novel_id: true } });
  if (!novel) throw ApiError.notFound("Novel not found");

  try {
    const entry = await prisma.userLibrary.create({
      data: { user_id, novel_id },
      select: { library_id: true, novel_id: true, added_at: true },
    });
    return entry;
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      throw ApiError.conflict("Novel already in library");
    }
    throw err;
  }
}

export async function removeFromLibrary(user_id: string, novel_id: string) {
  await prisma.userLibrary.deleteMany({ where: { user_id, novel_id } });
}
