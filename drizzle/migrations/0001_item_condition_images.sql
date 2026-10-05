-- Align item_condition with OpenAPI/FE; remap excellent → like_new
ALTER TYPE "public"."item_condition" RENAME TO "item_condition_old";
CREATE TYPE "public"."item_condition" AS ENUM('new', 'like_new', 'good', 'fair', 'attention_required');
ALTER TABLE "items" ALTER COLUMN "condition" DROP DEFAULT;
ALTER TABLE "items" ALTER COLUMN "condition" TYPE "public"."item_condition" USING (
  CASE "condition"::text
    WHEN 'excellent' THEN 'like_new'
    WHEN 'like_new' THEN 'like_new'
    WHEN 'good' THEN 'good'
    WHEN 'fair' THEN 'fair'
    WHEN 'new' THEN 'new'
    WHEN 'attention_required' THEN 'attention_required'
    ELSE 'good'
  END
)::"public"."item_condition";
DROP TYPE "public"."item_condition_old";

-- Normalize images JSON: displayOrder → alt (empty if missing)
UPDATE "items"
SET "images" = COALESCE(
  (
    SELECT jsonb_agg(
      jsonb_build_object(
        'url', COALESCE(elem->>'url', ''),
        'alt', COALESCE(elem->>'alt', '')
      )
      ORDER BY ordinality
    )
    FROM jsonb_array_elements(COALESCE("images", '[]'::jsonb)) WITH ORDINALITY AS t(elem, ordinality)
  ),
  '[]'::jsonb
);

-- Normalize defect_images: string[] → {url,alt}[]
UPDATE "items"
SET "defect_images" = COALESCE(
  (
    SELECT jsonb_agg(
      CASE
        WHEN jsonb_typeof(elem) = 'string' THEN jsonb_build_object('url', elem #>> '{}', 'alt', '')
        ELSE jsonb_build_object(
          'url', COALESCE(elem->>'url', ''),
          'alt', COALESCE(elem->>'alt', '')
        )
      END
    )
    FROM jsonb_array_elements(COALESCE("defect_images", '[]'::jsonb)) AS elem
  ),
  '[]'::jsonb
);
