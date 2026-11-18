-- CreateEnum
CREATE TYPE "SessionStatus" AS ENUM ('SCHEDULED', 'CANCELLED');

-- CreateTable
CREATE TABLE "ClassSchedule" (
    "id" UUID NOT NULL,
    "studentId" UUID NOT NULL,
    "weekday" INTEGER NOT NULL,
    "startMinute" INTEGER NOT NULL,
    "durationMinutes" INTEGER NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Karachi',
    "effectiveFrom" DATE NOT NULL,
    "effectiveTo" DATE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClassSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClassSession" (
    "id" UUID NOT NULL,
    "scheduleId" UUID NOT NULL,
    "studentId" UUID NOT NULL,
    "localDate" DATE NOT NULL,
    "startsAt" TIMESTAMPTZ(3) NOT NULL,
    "endsAt" TIMESTAMPTZ(3) NOT NULL,
    "status" "SessionStatus" NOT NULL DEFAULT 'SCHEDULED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClassSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClassScheduleException" (
    "id" UUID NOT NULL,
    "scheduleId" UUID NOT NULL,
    "localDate" DATE NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClassScheduleException_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ClassSchedule_studentId_idx" ON "ClassSchedule"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "ClassSchedule_studentId_weekday_startMinute_effectiveFrom_key" ON "ClassSchedule"("studentId", "weekday", "startMinute", "effectiveFrom");

-- CreateIndex
CREATE UNIQUE INDEX "ClassSchedule_id_studentId_key" ON "ClassSchedule"("id", "studentId");

-- CreateIndex
CREATE INDEX "ClassSession_studentId_startsAt_idx" ON "ClassSession"("studentId", "startsAt");

-- CreateIndex
CREATE INDEX "ClassSession_startsAt_idx" ON "ClassSession"("startsAt");

-- CreateIndex
CREATE UNIQUE INDEX "ClassSession_scheduleId_localDate_key" ON "ClassSession"("scheduleId", "localDate");

-- CreateIndex
CREATE UNIQUE INDEX "ClassScheduleException_scheduleId_localDate_key" ON "ClassScheduleException"("scheduleId", "localDate");

-- AddForeignKey
ALTER TABLE "ClassSchedule" ADD CONSTRAINT "ClassSchedule_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassSession" ADD CONSTRAINT "ClassSession_scheduleId_studentId_fkey" FOREIGN KEY ("scheduleId", "studentId") REFERENCES "ClassSchedule"("id", "studentId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassScheduleException" ADD CONSTRAINT "ClassScheduleException_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "ClassSchedule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE "ClassSchedule"
  ADD CONSTRAINT "ClassSchedule_weekday_check" CHECK ("weekday" BETWEEN 1 AND 7),
  ADD CONSTRAINT "ClassSchedule_startMinute_check" CHECK ("startMinute" BETWEEN 0 AND 1439),
  ADD CONSTRAINT "ClassSchedule_duration_check" CHECK ("durationMinutes" BETWEEN 5 AND 480),
  ADD CONSTRAINT "ClassSchedule_range_check" CHECK ("effectiveTo" IS NULL OR "effectiveTo" >= "effectiveFrom"),
  ADD CONSTRAINT "ClassSchedule_no_overlap" EXCLUDE USING gist (
    "studentId" WITH =,
    "weekday" WITH =,
    "startMinute" WITH =,
    daterange("effectiveFrom", "effectiveTo", '[]') WITH &&
  );

ALTER TABLE "ClassSession"
  ADD CONSTRAINT "ClassSession_time_check" CHECK ("endsAt" > "startsAt");