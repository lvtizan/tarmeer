/**
 * Canonical tag taxonomy for portfolio filtering.
 * Shared by: frontend filters, Gemini vision tagging, migration scripts.
 *
 * ROOM_TAGS  — physical space type (detected from image content)
 * STYLE_TAGS — design aesthetic  (detected from image content)
 */

export const ROOM_TAGS = [
  'Living Room',
  'Bedroom',
  'Kitchen',
  'Bathroom',
  'Dining Room',
  'Home Office',
  'Majlis',
  'Hallway',
  'Nursery',
  'Outdoor',
] as const;

export const STYLE_TAGS = [
  'Modern',
  'Luxury',
  'Minimalist',
  'Classical',
  'Arabic',
  'Industrial',
  'Scandinavian',
  'Coastal',
  'Art Deco',
  'Bohemian',
] as const;

export type RoomTag = (typeof ROOM_TAGS)[number];
export type StyleTag = (typeof STYLE_TAGS)[number];
export type PortfolioTag = RoomTag | StyleTag;

/** All valid tags for portfolio filtering (room + style). */
export const ALL_PORTFOLIO_TAGS: readonly string[] = [...ROOM_TAGS, ...STYLE_TAGS];
