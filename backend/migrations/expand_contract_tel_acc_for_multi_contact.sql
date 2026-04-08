-- รองรับหลายผู้ติดต่อ: ค่าคั่นบรรทัดใน sale_account / email_acc / tel_acc
-- เดิม tel_acc มักเป็น varchar(13) → บันทึกหลายเบอร์แล้ว ER_DATA_TOO_LONG
-- รันคำสั่งนี้บน MySQL ของโปรเจกต์ (phpMyAdmin / CLI / Workbench ก็ได้)

ALTER TABLE contract MODIFY COLUMN tel_acc TEXT DEFAULT NULL;
ALTER TABLE contract MODIFY COLUMN sale_account TEXT DEFAULT NULL;
ALTER TABLE contract MODIFY COLUMN email_acc TEXT DEFAULT NULL;
