-- แจ้งเตือนนักเขียนเมื่อมีรีวิวใหม่ (เดิมมีแค่คอมเมนต์)
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'review';
