# BuddyBook — API Endpoints Reference

อ้างอิงจาก `prisma/schema.prisma` (18 models) และ `BuddyBook_UseCase_Diagram.md` (28 Use Cases, 5 โมดูล)
Base URL: `/api/v1` (Node.js/Express API Gateway) · Auth: `Authorization: Bearer <access_token>` (ทุก endpoint ยกเว้นที่ระบุว่า Public)

---

## 1. Authentication & Onboarding

| Method | URL Path | Request Body (JSON) | Response (JSON) | Status |
|---|---|---|---|---|
| POST | `/auth/register` | `{"username","email","password"}` | `{"user_id","username","email","role","created_at"}` | 201 |
| POST | `/auth/login` | `{"email","password"}` | `{"access_token","refresh_token","user":{"user_id","username","role"}}` | 200 |
| POST | `/auth/login` | `{"email","password"}` (invalid) | `{"error":"Invalid credentials"}` | 401 |
| GET | `/auth/oauth/:provider` (Public, provider = google\|facebook\|line) | — | `302 Redirect → OAuth Provider` | 302 |
| POST | `/auth/oauth/:provider/callback` | `{"code"}` | `{"access_token","refresh_token","user","is_new_user"}` | 200 |
| POST | `/auth/refresh` | `{"refresh_token"}` | `{"access_token"}` | 200 |
| POST | `/auth/logout` | `{"refresh_token"}` | `{}` | 204 |
| GET | `/users/me` | — | `{"user_id","username","email","role","avatar_url","bio","age_verified"}` | 200 |
| PATCH | `/users/me` | `{"username?","bio?","avatar_url?"}` | `{"user_id",...updated fields}` | 200 |
| PATCH | `/users/me/age-verification` | `{"birth_date"}` | `{"age_verified":true}` | 200 |
| POST | `/users/me/interests` | `{"tag_ids":[1,4,9]}` | `{"user_interests":[{"tag_id","name"}]}` | 201 |

---

## 2. Reader Features

| Method | URL Path | Request Body (JSON) | Response (JSON) | Status |
|---|---|---|---|---|
| GET | `/novels/search?q=&tag_id=&status=&page=` (Public) | — | `{"novels":[{"novel_id","title","cover_image_url","status"}],"total","page"}` | 200 |
| GET | `/novels/:novel_id` (Public) | — | `{"novel_id","title","synopsis","status","legal_status","author":{},"tags":[]}` | 200 |
| GET | `/novels/:novel_id` (ไม่พบ) | — | `{"error":"Novel not found"}` | 404 |
| GET | `/novels/:novel_id/chapters` (Public) | — | `{"chapters":[{"chapter_id","chapter_number","title","status"}]}` | 200 |
| GET | `/chapters/:chapter_id` (Public, published เท่านั้น) | — | `{"chapter_id","title","content","word_count","published_at"}` | 200 |
| GET | `/library` | — | `{"library":[{"library_id","novel":{},"added_at"}]}` | 200 |
| POST | `/library` | `{"novel_id"}` | `{"library_id","novel_id","added_at"}` | 201 |
| POST | `/library` (ซ้ำ) | `{"novel_id"}` | `{"error":"Novel already in library"}` | 409 |
| DELETE | `/library/:novel_id` | — | `{}` | 204 |
| GET | `/chapters/:chapter_id/comments` (Public) | — | `{"comments":[{"comment_id","user","content","sentiment_label","replies":[]}]}` | 200 |
| POST | `/chapters/:chapter_id/comments` | `{"content","parent_comment_id?"}` | `{"comment_id","content","sentiment_label":null,"created_at"}` | 201 |
| GET | `/novels/:novel_id/reviews` (Public) | — | `{"reviews":[{"review_id","user","rating","comment_text","sentiment_label"}]}` | 200 |
| POST | `/novels/:novel_id/reviews` | `{"rating","comment_text?"}` | `{"review_id","rating","sentiment_label":null,"created_at"}` | 201 |
| POST | `/novels/:novel_id/reviews` (รีวิวซ้ำ) | `{"rating"}` | `{"error":"You have already reviewed this novel"}` | 409 |
| GET | `/recommendations` | — | `{"novels":[{"novel_id","title","score"}]}` (จาก Neo4j) | 200 |
| POST | `/donations` | `{"to_user_id","novel_id?","amount","message?"}` | `{"donation_id","amount","created_at"}` | 201 |
| GET | `/wallet/transactions` | — | `{"transactions":[{"transaction_id","type","amount","balance_after"}]}` | 200 |
| GET | `/notifications` | — | `{"notifications":[{"notification_id","type","content","is_read"}]}` | 200 |
| PATCH | `/notifications/:notification_id/read` | `{}` | `{"notification_id","is_read":true}` | 200 |

---

## 3. Writer Workspace

| Method | URL Path | Request Body (JSON) | Response (JSON) | Status |
|---|---|---|---|---|
| POST | `/novels` | `{"title","synopsis?","cover_image_url?","legal_status","tag_ids":[]}` | `{"novel_id","title","status":"ongoing","created_at"}` | 201 |
| PATCH | `/novels/:novel_id` | `{"title?","synopsis?","status?","visibility?","tag_ids?"}` | `{"novel_id",...updated fields}` | 200 |
| PATCH | `/novels/:novel_id` (ไม่ใช่เจ้าของ) | `{"title"}` | `{"error":"Forbidden"}` | 403 |
| DELETE | `/novels/:novel_id` | — | `{}` | 204 |
| POST | `/novels/:novel_id/chapters` | `{"chapter_number","title","content?","status"}` | `{"chapter_id","chapter_number","title","status","created_at"}` | 201 |
| PATCH | `/chapters/:chapter_id` | `{"title?","content?","status?"}` | `{"chapter_id",...updated fields,"updated_at"}` | 200 |
| PATCH | `/chapters/:chapter_id/autosave` (ทุก 30 วินาที) | `{"content_snapshot"}` | `{"version_id","version_number","is_autosave":true,"created_at"}` | 200 |
| GET | `/chapters/:chapter_id/versions` | — | `{"versions":[{"version_id","version_number","is_autosave","created_at"}]}` | 200 |
| POST | `/chapters/:chapter_id/versions/:version_id/restore` | `{}` | `{"chapter_id","content","updated_at"}` | 200 |
| DELETE | `/chapters/:chapter_id` (ย้ายลงถังขยะ) | — | `{"trash_id","content_type":"chapter","auto_delete_at"}` | 200 |
| GET | `/novels/:novel_id/trash-bin` | — | `{"items":[{"trash_id","content_type","content_snapshot","deleted_at","auto_delete_at"}]}` | 200 |
| POST | `/trash-bin/:trash_id/restore` | `{}` | `{"content_type","restored_id","restored_at"}` | 200 |
| POST | `/trash-bin/:trash_id/restore` (เกิน 30 วัน) | `{}` | `{"error":"Item already purged"}` | 410 |
| DELETE | `/trash-bin/:trash_id` (ลบถาวร) | — | `{}` | 204 |
| GET | `/novels/:novel_id/print-preview` | — | `{"novel":{},"chapters":[{"chapter_number","title","content"}]}` | 200 |
| GET | `/novels/:novel_id/world-building` (โหลด React Flow) | — | `{"nodes":[{}],"edges":[{}],"locations":[{}],"timeline_events":[{}]}` | 200 |
| POST | `/novels/:novel_id/characters` | `{"character_name","description?","character_role?","position_x","position_y"}` | `{"node_id","character_name","position_x","position_y"}` | 201 |
| PATCH | `/characters/:node_id` | `{"character_name?","description?","position_x?","position_y?"}` | `{"node_id",...updated fields}` | 200 |
| DELETE | `/characters/:node_id` (ย้ายลงถังขยะ) | — | `{"trash_id","content_type":"character_node"}` | 200 |
| POST | `/novels/:novel_id/character-edges` | `{"source_node_id","target_node_id","relationship_type?","edge_label?"}` | `{"edge_id","source_node_id","target_node_id"}` | 201 |
| POST | `/novels/:novel_id/character-edges` (source = target) | `{"source_node_id":"x","target_node_id":"x"}` | `{"error":"A character cannot be linked to itself"}` | 422 |
| PATCH | `/character-edges/:edge_id` | `{"relationship_type?","edge_label?","description?"}` | `{"edge_id",...updated fields}` | 200 |
| DELETE | `/character-edges/:edge_id` (ย้ายลงถังขยะ) | — | `{"trash_id","content_type":"character_edge"}` | 200 |
| POST | `/novels/:novel_id/locations` | `{"name","description?","map_icon_url?","pos_x","pos_y"}` | `{"location_id","name","pos_x","pos_y"}` | 201 |
| PATCH | `/locations/:location_id` | `{"name?","description?","pos_x?","pos_y?"}` | `{"location_id",...updated fields}` | 200 |
| DELETE | `/locations/:location_id` (ย้ายลงถังขยะ) | — | `{"trash_id","content_type":"location"}` | 200 |
| POST | `/novels/:novel_id/timeline-events` | `{"title","description?","event_order","event_date_in_story?"}` | `{"event_id","title","event_order"}` | 201 |
| PATCH | `/timeline-events/:event_id` | `{"title?","description?","event_order?"}` | `{"event_id",...updated fields}` | 200 |
| DELETE | `/timeline-events/:event_id` (ย้ายลงถังขยะ) | — | `{"trash_id","content_type":"timeline_event"}` | 200 |

---

## 4. System / Background Services (Service-to-Service, ไม่เปิด public)

| Method | URL Path | Request Body (JSON) | Response (JSON) | Status |
|---|---|---|---|---|
| POST | `/internal/nlp/sentiment-callback` (Python NLP Worker → Gateway) | `{"target_type":"comment\|review","target_id","sentiment_label","sentiment_score"}` | `{"target_id","sentiment_label","sentiment_score"}` | 200 |
| GET | `/internal/nlp/pending-queue` (NLP Worker polling) | — | `{"items":[{"target_type","target_id","content"}]}` | 200 |
| POST | `/internal/trash-bin/purge` (Cron รายวัน) | `{}` | `{"purged_count"}` | 200 |
| POST | `/internal/recommendations/sync` (Cron/Event → sync Neo4j) | `{"user_id?","novel_id?"}` | `{}` | 202 |

---

## 5. Admin & System Management

| Method | URL Path | Request Body (JSON) | Response (JSON) | Status |
|---|---|---|---|---|
| GET | `/admin/novels/pending` | — | `{"novels":[{"novel_id","title","author","legal_status"}]}` | 200 |
| PATCH | `/admin/novels/:novel_id/approve` | `{}` | `{"novel_id","visibility":"published"}` | 200 |
| PATCH | `/admin/novels/:novel_id/reject` | `{"reason"}` | `{"novel_id","visibility":"private","reason"}` | 200 |
| GET | `/admin/users?page=` | — | `{"users":[{"user_id","username","email","role","created_at"}],"total"}` | 200 |
| PATCH | `/admin/users/:user_id/role` | `{"role":"admin\|user"}` | `{"user_id","role"}` | 200 |
| PATCH | `/admin/users/:user_id/suspend` | `{}` | `{"user_id","suspended":true}` | 200 |
| GET | `/admin/tags` (Public) | — | `{"tags":[{"tag_id","name","category"}]}` | 200 |
| POST | `/admin/tags` | `{"name","category?"}` | `{"tag_id","name","category"}` | 201 |
| PATCH | `/admin/tags/:tag_id` | `{"name?","category?"}` | `{"tag_id","name","category"}` | 200 |
| DELETE | `/admin/tags/:tag_id` | — | `{}` | 204 |
| GET | `/admin/reports/stats` | — | `{"total_users","total_novels","total_chapters","pending_review_count"}` | 200 |

---

## หมายเหตุ

1. Endpoint กลุ่ม **DELETE ที่ย้ายลงถังขยะ** (chapters/characters/character-edges/locations/timeline-events) ไม่ใช่การลบถาวร — บันทึกลง `trash_bin` พร้อม `auto_delete_at = deleted_at + 30 วัน` ตาม Data Dictionary; การลบถาวรจริงทำผ่าน `DELETE /trash-bin/:trash_id` เท่านั้น
2. กลุ่ม 4 (System/Background) ไม่ผ่าน JWT ผู้ใช้ทั่วไป — ใช้ internal service token/mTLS ระหว่าง Node.js Gateway ↔ Python NLP Worker ↔ Cron Scheduler
3. `sentiment_label`/`sentiment_score` เป็น `null` ตอนสร้าง comment/review เสมอ (async NLP pipeline) แล้วถูก `PATCH` ผ่าน `/internal/nlp/sentiment-callback` ภายหลัง
4. Endpoint ที่ทำเครื่องหมาย **(Public)** ไม่ต้องแนบ `Authorization` header; ที่เหลือทั้งหมดต้องแนบ Bearer token
5. Path/field naming สอดคล้องกับ 18 models ใน `prisma/schema.prisma` และ 28 Use Case ใน `BuddyBook_UseCase_Diagram.md`
