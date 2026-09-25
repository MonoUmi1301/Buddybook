# Gift donation assets

Path constants live in `apps/web/src/lib/donate-assets.ts` (web) and `apps/api/prisma/gift-catalog.ts` (seed).
Never hard-code these paths anywhere else.

All images: PNG, 512x512, transparent background, sticker outline baked in.
Check that every file exists with `npm run check:gift-assets --workspace=apps/api`.

## gifts/ (file name = GiftItem.slug)

The catalog has 10 gifts. `matcha-latte` was removed because it has no image (see `RETIRED_GIFT_SLUGS` in `apps/api/prisma/gift-catalog.ts`).

| file | gift | coins | tier | status |
|---|---|---|---|---|
| coffee.png | กาแฟ | 10 | S | present |
| cupcake.png | คัพเค้ก | 30 | S | present |
| chocolate.png | ช็อกโกแลตกำลังใจ | 40 | S | present |
| back-patch.png | แผ่นแปะแก้ปวดหลัง | 50 | M | present |
| neck-pillow.png | หมอนรองคอ | 80 | M | present |
| bluelight-glasses.png | แว่นกรองแสง | 100 | M | present |
| desk-plant.png | ต้นไม้ตั้งโต๊ะ | 150 | L | present |
| keyboard.png | คีย์บอร์ดน่ารัก | 300 | L | present |
| massage-chair.png | เก้าอี้นวด | 500 | L | present |
| hug-bear.png | ตุ๊กตาหมีกอดใจ | 1000 | XL | present |

Prices are editable later in admin. The seed does not overwrite prices that were already changed.

## mascot/

| file | use |
|---|---|
| mascot-bear.png | Round brown bear with blush cheeks and round glasses. Used as the fallback for a missing gift image. |

## Letter cards

The 4 card templates (stamp, matcha, navy, bear) are drawn entirely in code (CSS in `src/app/gifts.css` and SVG in
`src/components/gifts/`). They use no image files. The bear on the "bear" card is an SVG version of the mascot.

## Adding a gift

1. Put `gifts/<slug>.png` here.
2. Add the row to `apps/api/prisma/gift-catalog.ts` (or create it in admin).
3. Update the table above.

Palette: line #5A3A28, cream #FBF6EC, bear brown #B8743F, matcha #9DB57A, navy #23305C, blush #F2A7A0.
