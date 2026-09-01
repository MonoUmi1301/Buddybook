import { prisma } from "@/lib/prisma";
import { moveToTrash } from "@/lib/trash";
import { ApiError } from "@/utils/ApiError";

async function assertNovelOwner(novel_id: string, user_id: string) {
  const novel = await prisma.novel.findUnique({ where: { novel_id }, select: { author_id: true } });
  if (!novel) throw ApiError.notFound("Novel not found");
  if (novel.author_id !== user_id) throw ApiError.forbidden("Forbidden");
}

interface CreateTimelineEventInput {
  title: string;
  description?: string;
  event_order: number;
  event_date_in_story?: string;
  event_time?: string;
  thread?: string;
  color?: string;
  intensity?: number;
}

/** Reference implementation — POST /novels/:novel_id/timeline-events */
export async function createTimelineEvent(novel_id: string, user_id: string, input: CreateTimelineEventInput) {
  await assertNovelOwner(novel_id, user_id);

  const event = await prisma.timelineEvent.create({
    data: {
      novel_id,
      title: input.title,
      description: input.description,
      event_order: input.event_order,
      event_date_in_story: input.event_date_in_story,
      event_time: input.event_time,
      thread: input.thread,
      color: input.color,
      intensity: input.intensity,
    },
    select: {
      event_id: true,
      title: true,
      description: true,
      event_order: true,
      event_date_in_story: true,
      event_time: true,
      thread: true,
      color: true,
      intensity: true,
    },
  });

  return event;
}

async function getOwnedEvent(event_id: string, user_id: string) {
  const event = await prisma.timelineEvent.findUnique({
    where: { event_id },
    include: { novel: { select: { author_id: true } } },
  });
  if (!event) throw ApiError.notFound("Timeline event not found");
  if (event.novel.author_id !== user_id) throw ApiError.forbidden("Forbidden");
  return event;
}

interface UpdateTimelineEventInput {
  title?: string;
  description?: string;
  event_order?: number;
  event_date_in_story?: string;
  event_time?: string;
  thread?: string;
  color?: string;
  intensity?: number;
}

export async function updateTimelineEvent(event_id: string, user_id: string, input: UpdateTimelineEventInput) {
  await getOwnedEvent(event_id, user_id);

  const updated = await prisma.timelineEvent.update({
    where: { event_id },
    data: input,
    select: {
      event_id: true,
      title: true,
      description: true,
      event_order: true,
      event_date_in_story: true,
      event_time: true,
      thread: true,
      color: true,
      intensity: true,
    },
  });

  return updated;
}

export async function deleteTimelineEvent(event_id: string, user_id: string) {
  const event = await getOwnedEvent(event_id, user_id);
  const { novel: _novel, ...snapshot } = event;

  const trash = await prisma.$transaction(async (tx) => {
    const created = await moveToTrash(tx, {
      novel_id: event.novel_id,
      content_type: "timeline_event",
      content_ref_id: event.event_id,
      content_snapshot: snapshot,
      deleted_by: user_id,
    });
    await tx.timelineEvent.delete({ where: { event_id } });
    return created;
  });

  return trash;
}
