# BuddyBook — API Endpoints Reference

อ้างอิงจาก `prisma/schema.prisma` (18 models) และ `BuddyBook_UseCase_Diagram.md` (28 Use Cases, 5 โมดูล)
Base URL: `/api/v1` (Node.js/Express API Gateway) · Auth: `Authorization: Bearer <access_token>` (ทุก endpoint ยกเว้นที่ระบุว่า Public)

---

## 1. Authentication & Onboarding

| Method | URL Path | Request Body (JSON) | Response (JSON) | Status |
|---|---|---|---|---|
| POST | `/auth/register/request-otp` | `{"username","email","password"}` | `{"email"}` (ส่ง OTP ทางอีเมล — ยังไม่สร้างบัญชี) | 200 |
| POST | `/auth/register/verify-otp` | `{"email","otp"}` | `{"access_token","refresh_token","user"}` | 201 |
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
| GET | `/novels/search?q=&author=&workType=&genre_ids=&sub_genre_ids=&pairing_ids=&fandom_ids=&tag_ids=&status=&page=` (Public) | — | `{"novels":[{"novel_id","title","cover_image_url","status"}],"total","page"}` | 200 |
| GET | `/novels/:novel_id` (Public) | — | `{"novel_id","title","synopsis","status","legal_status","author":{},"tags":[]}` | 200 |
| GET | `/novels/:novel_id` (ไม่พบ) | — | `{"error":"Novel not found"}` | 404 |
| GET | `/novels/:novel_id/chapters` (Public) | — | `{"chapters":[{"chapter_id","chapter_number","title","status"}]}` | 200 |
| GET | `/chapters/:chapter_id` (Public, published เท่านั้น) | — | `{"chapter_id","title","content","word_count","published_at","price_coins","locked","teaser"}` — ตอนติดเหรียญที่ยังไม่ได้ซื้อ: `content: null, locked: true, teaser: "<ตัวอย่าง plain text ≤200 ตัวอักษร>"` (ตอนที่อ่านได้: `teaser: null`) | 200 |
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
| POST | `/internal/chapters/publish-scheduled` (Cron ทุกนาที) | `{}` | `{"published_count"}` | 200 |
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
| PATCH | `/admin/users/:user_id/suspend` | `{}` | `{"user_id","suspended":true}` — มีผลทันที (access token ที่ออกไปแล้วใช้ไม่ได้) | 200 |
| PATCH | `/admin/users/:user_id/unsuspend` | `{}` | `{"user_id","suspended":false}` | 200 |
| GET | `/admin/tags` (Public) | — | `{"tags":[{"tag_id","name","category"}]}` | 200 |
| POST | `/admin/tags` | `{"name","category?"}` | `{"tag_id","name","category"}` | 201 |
| PATCH | `/admin/tags/:tag_id` | `{"name?","category?"}` | `{"tag_id","name","category"}` | 200 |
| DELETE | `/admin/tags/:tag_id` | — | `{}` | 204 |
| GET | `/admin/reports/stats` | — | `{"total_users","total_novels","total_chapters","pending_review_count"}` | 200 |

---

## 6. ส่วนขยายที่เพิ่มภายหลัง (นอกสเปกเดิม)

### 6.1 บัญชีผู้ใช้ / ความปลอดภัย

| Method | URL Path | Request Body (JSON) | Response (JSON) | Status |
|---|---|---|---|---|
| POST | `/auth/login/verify-2fa` | `{"challenge_token","code"}` | `{"access_token","refresh_token","user"}` | 200 |
| POST | `/auth/2fa/setup` · `/auth/2fa/confirm` · `/auth/2fa/disable` | ตาม controller | — | 200 |
| POST | `/auth/password/forgot` · `/auth/password/reset` | `{"email"}` · `{"token","new_password"}` | — | 200 |
| DELETE | `/users/me` | `{"password"}` | `{}` (anonymize บัญชี) | 204 |
| GET | `/users/:user_id` (Public) | — | โปรไฟล์สาธารณะ + ผลงาน | 200 |
| POST | `/uploads/sign` | `{"folder"}` | ลายเซ็น Cloudinary | 200 |

Rate limit: `login`, `register/*`, `login/verify-2fa`, `password/*` จำกัด `AUTH_RATE_LIMIT_PER_15MIN` ครั้ง/15 นาที **ต่อบัญชีเป้าหมาย** (อีเมล/โทเคน ไม่ใช่ IP เพราะทุก request มาผ่าน Next.js proxy) เกินแล้วตอบ 429

### 6.2 ติดตามนักเขียน

| Method | URL Path | Request Body (JSON) | Response (JSON) | Status |
|---|---|---|---|---|
| GET | `/users/:user_id/follow` (Public) | — | `{"author_id","follower_count","following"}` | 200 |
| POST | `/users/:user_id/follow` | — | เหมือนด้านบน (idempotent, แจ้งเตือนนักเขียน `new_follower`) | 200 |
| DELETE | `/users/:user_id/follow` | — | เหมือนด้านบน | 200 |
| GET | `/users/me/following` | — | `{"following":[{"user_id","username","pen_name","avatar_url","followed_at"}]}` | 200 |

ผู้ติดตามได้แจ้งเตือน `new_chapter` ทุกครั้งที่นักเขียนเผยแพร่ตอนใหม่ (รวมกับผู้ที่เก็บนิยายในชั้นหนังสือ ไม่ซ้ำคน)

### 6.3 ตอนติดเหรียญ

| Method | URL Path | Request Body (JSON) | Response (JSON) | Status |
|---|---|---|---|---|
| POST/PATCH | `/novels/:novel_id/chapters` · `/chapters/:chapter_id` | เพิ่ม `"price_coins"` (0–1000, 0 = ฟรี) | — | — |
| GET | `/novels/:novel_id/chapters` | — | แต่ละตอนมี `"price_coins","is_unlocked"` | 200 |
| POST | `/chapters/:chapter_id/purchase` | — | `{"purchase_id","chapter_id","price_coins","balance_after","already_owned","content"}` (`content` = เนื้อหาที่ปลดล็อกแล้ว) | 201 (ซื้อใหม่) / 200 (ซื้อแล้ว) |
| POST | `/chapters/:chapter_id/purchase` (coin ไม่พอ) | — | `{"error","details":{"balance","required","missing"}}` | 422 |

นักเขียนได้ `price − ค่าธรรมเนียม CHAPTER_PLATFORM_FEE_PERCENT` (ledger `chapter_purchase` / `chapter_sale`)

### 6.4 รายงานเนื้อหา

| Method | URL Path | Request Body (JSON) | Response (JSON) | Status |
|---|---|---|---|---|
| POST | `/reports` | `{"target_type":"novel\|chapter\|comment\|review\|user","target_id","reason":"spam\|harassment\|inappropriate\|copyright\|other","details?"}` | `{"report_id","status":"open",...}` | 201 |
| POST | `/reports` (ซ้ำ / ของตัวเอง / ไม่พบ) | — | `{"error"}` | 409 / 422 / 404 |
| GET | `/admin/content-reports?status=open\|dismissed\|actioned&cursor=` | — | `{"reports":[{...,"target":{"preview","link_url","owner_id"}\|null,"open_report_count"}],"next_cursor"}` | 200 |
| PATCH | `/admin/content-reports/:report_id` | `{"action":"dismiss\|action","note?"}` | `{"report_id","status","resolved_count"}` | 200 |

`action` = novel → private, chapter → hidden, comment/review → ลบ, user → ระงับบัญชี (ปิดทุกรายงานของเป้าหมายเดียวกัน + แจ้งผู้รายงาน)

### 6.5 ถอนรายได้นักเขียน

| Method | URL Path | Request Body (JSON) | Response (JSON) | Status |
|---|---|---|---|---|
| GET | `/wallet/withdrawals` | — | `{"withdrawals":[...],"balance","total_earned","total_withdrawn","withdrawable_coins","min_withdrawal_coins","coin_to_thb_rate"}` | 200 |
| POST | `/wallet/withdrawals` | `{"amount_coins","payout_method":"promptpay\|bank","account_name","account_number","bank_name?"}` | `{"withdrawal_id","status":"pending",...}` | 201 |
| GET | `/admin/withdrawals?status=pending\|paid\|rejected` | — | `{"withdrawals":[...+ user]}` | 200 |
| PATCH | `/admin/withdrawals/:withdrawal_id` | `{"action":"paid\|rejected","note?"}` | withdrawal ที่อัปเดตแล้ว | 200 |

ถอนได้เฉพาะรายได้ (ของขวัญที่ได้รับ + ขายตอน) ไม่รวม coin ที่เติมเอง, coin ถูกหักทันทีตอนขอ, `rejected` คืน coin อัตโนมัติ, มีคำขอค้างได้ครั้งละ 1 รายการ

### 6.6 อื่น ๆ ที่เพิ่มภายหลัง

- ชั้นหนังสือ/คอลเลกชัน: `GET /library/continue-reading`, `PATCH /library/:novel_id`, `GET|POST /collections`, `PATCH|DELETE /collections/:id`, `POST /collections/:id/items`, `DELETE /collections/:id/items/:novel_id`
- นิยาย: `GET /novels/:id/comments`, `POST|DELETE /novels/:id/like`, `PATCH /novels/:id/plot-notes|theme-notes|map-drawings`, `GET|POST /novels/:id/map-versions`, `POST /map-versions/:id/restore`, `POST /novels/:id/location-edges`, `DELETE /location-edges/:id`
- ของขวัญ: `GET /gifts/catalog`, `POST /gifts/send`, `GET /authors/:user_id/gifts/public`, `GET /me/gifts/received|sent|stats`, `POST /me/gifts/:id/thank`, `PATCH /me/gifts/:id`, `GET /users/:user_id/supporter-badges`, แอดมิน `/admin/gifts`, `/admin/gift-reports`
- เติมเงิน: `POST /wallet/topup/checkout-session`, `GET /wallet/topup/orders/:order_id/status`, `POST /wallet/topup/verify-slip`, `POST /webhooks/stripe` (ยืนยันด้วยลายเซ็น Stripe)

### 7. ปิดช่องว่างตาม Proposal (docs/gap-analysis-plan.md)

#### 7.1 ระบบแนะนำ v2 + Sentiment polarity

| Method | URL Path | Request Body (JSON) | Response (JSON) | Status |
|---|---|---|---|---|
| GET | `/recommendations?limit=1..50` (default 10) | — | `{"items":[{"novel_id","title","cover_image_url","view_count","author","reason":"interest\|similar_readers\|hidden_gem\|fresh\|popular","score","is_long_tail"}],"content_based","collaborative","underrated","meta":{"long_tail_share","rerank_lambda","graph_available"}}` | 200 |
| POST | `/internal/nlp/sentiment-callback` | เพิ่ม `"sentiment_polarity?"` (−1..1 = P(pos) − P(neg)); ไม่ส่ง = คำนวณจาก label+score | เพิ่ม `"sentiment_polarity"` | 200 |

`items` จัดอันดับด้วยคะแนนความตรงแนว/ผู้อ่านคล้ายกัน/ขั้วความรู้สึก/ความใหม่ (ไม่ใช้ยอดวิวเป็นสัญญาณบวก) แล้ว re-rank ดันสัดส่วน long-tail (`RECS_LONG_TAIL_LAMBDA`, `RECS_LONG_TAIL_TARGET`) — Neo4j ล่มยังได้ผลจาก Postgres (`graph_available:false`)

#### 7.2 ถังขยะนิยาย + Auto-save กันเขียนทับ

| Method | URL Path | Request Body (JSON) | Response (JSON) | Status |
|---|---|---|---|---|
| DELETE | `/novels/:novel_id` | — | `{"novel_id","deleted_at","auto_delete_at"}` (ย้ายลงถังขยะ 30 วัน — เดิมลบถาวร 204) | 200 / 409 (มีผู้ซื้อตอนแล้ว) |
| GET | `/novels/trash` | — | `{"retention_days":30,"novels":[{"novel_id","title","cover_image_url","chapter_count","deleted_at","auto_delete_at"}]}` | 200 |
| POST | `/novels/:novel_id/restore` | — | `{"novel_id","visibility"}` (กลับเป็น visibility เดิม) | 200 |
| DELETE | `/novels/:novel_id/permanent` | — | — (ต้องอยู่ในถังขยะก่อน) | 204 / 409 |
| PATCH | `/chapters/:chapter_id/autosave` | เพิ่ม `"base_updated_at?"` | เพิ่ม `"chapter_updated_at"`; ถูกแก้จากที่อื่นหลัง base → `{"error","details":{"code":"EDIT_CONFLICT","server_updated_at"}}` | 200 / 409 |

#### 7.3 สถิตินักเขียน + Social listening

| Method | URL Path | Request Body (JSON) | Response (JSON) | Status |
|---|---|---|---|---|
| GET | `/me/stats/novels` | — | `{"novels":[{"novel_id","title","views","views_7d","readers","likes","reviews","chapters","avg_rating","avg_polarity"}]}` | 200 |
| GET | `/me/stats/novels/:novel_id?days=7\|30\|90` | — | `{"totals":{...},"daily_views":[{"day","views"}],"chapters":[{"chapter_number","views","comments","purchases","readers_reached"}],"sentiment":{"counts":{"pos","neg","neutral","pending"},"avg_polarity","weekly":[...]},"keywords":{"positive","negative","all"}}` | 200 / 403 |

ยอดวิว: `GET /chapters/:id` นับผู้ชม (user หรือ IP) วันละครั้งต่อตอน ลง `chapter_view_daily` + `novels.view_count` (ไม่นับเจ้าของ/ตอนที่ยังล็อก) และจำกัด `CHAPTER_READ_RATE_LIMIT_PER_MIN` ครั้ง/นาทีต่อผู้ชม (กันบอทดูดเนื้อหา)

#### 7.4 แจ้งปัญหา (Support) + การแจ้งเตือน

| Method | URL Path | Request Body (JSON) | Response (JSON) | Status |
|---|---|---|---|---|
| POST | `/support/tickets` | `{"category":"account\|payment\|bug\|content\|other","subject","body","attachment_url?"}` (รูปจาก Cloudinary เท่านั้น) | ticket | 201 |
| GET | `/support/tickets` | — | `{"tickets":[{...,"message_count","awaiting_user"}]}` | 200 |
| GET | `/support/tickets/:ticket_id` | — | ticket + `messages` (ผู้ใช้ไม่เห็นชื่อแอดมิน) | 200 / 404 |
| POST | `/support/tickets/:ticket_id/messages` | `{"body","attachment_url?"}` | message (แอดมินตอบ → แจ้งเตือน `support_reply`) | 201 / 409 (ปิดแล้ว) |
| PATCH | `/support/tickets/:ticket_id/status` | `{"status":"open\|in_progress\|resolved\|closed"}` (ผู้ใช้ปิดได้อย่างเดียว) | ticket | 200 / 403 |
| GET | `/admin/support/tickets?status=` | — | คิวของทีมงาน `{"tickets":[{...,"user","awaiting_staff"}]}` | 200 |
| GET | `/notifications?page&pageSize&type&unread_only` | — | `{"notifications","total","page","pageSize","unread_count","muted_types"}` | 200 |
| PATCH | `/notifications/read-all` | `{"type?"}` | `{"updated"}` | 200 |
| GET/PUT | `/notifications/preferences` | `{"muted_types":[...]}` | `{"muted_types","available_types"}` | 200 |

#### 7.5 อื่น ๆ

- `PATCH /users/me/age-verification` ตอบ `{"age_verified","source"}` และตอบ 409 ถ้าอายุยืนยันจากบัญชี Google แล้ว (`GOOGLE_OAUTH_REQUEST_BIRTHDAY=true` → ขอ scope `user.birthday.read` ตอนล็อกอิน)
- `GET /health/ready` (นอก `/api/v1`) — 200 เมื่อ Postgres พร้อม / 503 เมื่อไม่พร้อม พร้อมสถานะ Neo4j — ใช้กับระบบ monitor uptime
- `GET /api/v1/openapi.json` — OpenAPI 3 ที่สร้างจาก router จริง, `GET /api/v1/docs` — Swagger UI (ไฟล์ snapshot: `docs/openapi.json`)

---

## หมายเหตุ

1. Endpoint กลุ่ม **DELETE ที่ย้ายลงถังขยะ** (chapters/characters/character-edges/locations/timeline-events) ไม่ใช่การลบถาวร — บันทึกลง `trash_bin` พร้อม `auto_delete_at = deleted_at + 30 วัน` ตาม Data Dictionary; การลบถาวรจริงทำผ่าน `DELETE /trash-bin/:trash_id` เท่านั้น
2. กลุ่ม 4 (System/Background) ไม่ผ่าน JWT ผู้ใช้ทั่วไป — ใช้ header `x-internal-token` (= `INTERNAL_SERVICE_TOKEN`) ระหว่าง Node.js Gateway ↔ Python NLP Worker ↔ Cron ภายนอก — งาน publish-scheduled / trash purge / recommendations sync รันอัตโนมัติใน process ของ api อยู่แล้ว (`apps/api/src/lib/scheduler.ts`, ปิดได้ด้วย `SCHEDULER_ENABLED=false`)
3. `sentiment_label`/`sentiment_score`/`sentiment_polarity` เป็น `null` ตอนสร้าง comment/review เสมอ (async NLP pipeline) แล้วถูก `PATCH` ผ่าน `/internal/nlp/sentiment-callback` ภายหลัง
4. Endpoint ที่ทำเครื่องหมาย **(Public)** ไม่ต้องแนบ `Authorization` header; ที่เหลือทั้งหมดต้องแนบ Bearer token
5. Path/field naming สอดคล้องกับ 18 models ใน `prisma/schema.prisma` และ 28 Use Case ใน `BuddyBook_UseCase_Diagram.md`
