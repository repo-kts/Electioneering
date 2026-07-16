-- Additional polling-station (booth) detail fields.
ALTER TABLE "PollingStation" ADD COLUMN "cityVillage" TEXT;
ALTER TABLE "PollingStation" ADD COLUMN "ward" TEXT;
ALTER TABLE "PollingStation" ADD COLUMN "tolaMohalla" TEXT;
ALTER TABLE "PollingStation" ADD COLUMN "postOffice" TEXT;
ALTER TABLE "PollingStation" ADD COLUMN "policeStation" TEXT;

-- Seat types on the constituency.
ALTER TABLE "Election" ADD COLUMN "assemblySeatType" TEXT;
ALTER TABLE "Election" ADD COLUMN "parlSeatType" TEXT;
