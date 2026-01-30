-- Migration: แก้ไข table report ที่มีอยู่แล้ว (จาก schema เก่า)
-- รันทีละคำสั่ง ถ้า column มีอยู่แล้วจะ error ให้ข้ามไปคำสั่งถัดไป

-- เพิ่ม task_type
ALTER TABLE `report` ADD COLUMN `task_type` enum('PM','MA') NOT NULL DEFAULT 'PM' AFTER `id`;

-- เพิ่ม created_at
ALTER TABLE `report` ADD COLUMN `created_at` timestamp NOT NULL DEFAULT current_timestamp();

-- เพิ่ม index
ALTER TABLE `report` ADD KEY `idx_task_type` (`task_type`);
