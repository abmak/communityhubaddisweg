import type { EventTopic } from "@prisma/client";

/**
 * The event taxonomy, in the order the admin events desk offers it. Kept in one
 * place so the public filters, the admin API and the source importer cannot
 * drift apart. FESTIVAL is labelled “Music festival” in the interface.
 */
export const EVENT_TOPIC_VALUES = [
  "FESTIVAL",
  "CINEMA",
  "THEATRE",
  "SOCIAL",
  "TRAVEL",
  "HIKING",
  "BUSINESS",
  "SEASONAL",
  "MUSIC",
  "SPORTS",
  "COMMUNITY",
  "OTHER",
] as const satisfies readonly EventTopic[];

export type EventTopicValue = (typeof EVENT_TOPIC_VALUES)[number];
