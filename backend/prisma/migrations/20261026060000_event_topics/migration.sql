-- AlterEnum
-- The admin events desk publishes more than festivals and meetups: socials,
-- travel and hiking outings, business conferences and seasonal celebrations.
-- These join the existing topics so the Events page can filter on them.

ALTER TYPE "EventTopic" ADD VALUE IF NOT EXISTS 'SOCIAL';
ALTER TYPE "EventTopic" ADD VALUE IF NOT EXISTS 'TRAVEL';
ALTER TYPE "EventTopic" ADD VALUE IF NOT EXISTS 'HIKING';
ALTER TYPE "EventTopic" ADD VALUE IF NOT EXISTS 'BUSINESS';
ALTER TYPE "EventTopic" ADD VALUE IF NOT EXISTS 'SEASONAL';
