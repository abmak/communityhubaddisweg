-- AlterEnum
-- Hospitals, pharmacies, filling stations and schools join the nearby directory
-- so everyday errands sit next to cinemas and cafés.

ALTER TYPE "PlaceKind" ADD VALUE 'HOSPITAL';
ALTER TYPE "PlaceKind" ADD VALUE 'PHARMACY';
ALTER TYPE "PlaceKind" ADD VALUE 'GAS_STATION';
ALTER TYPE "PlaceKind" ADD VALUE 'SCHOOL';
