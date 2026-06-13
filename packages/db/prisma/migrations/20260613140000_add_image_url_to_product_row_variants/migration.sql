-- ProductRowVariant に画像URL列を追加（ProductVariant.imageUrl と同様）
ALTER TABLE "product_row_variants" ADD COLUMN "image_url" VARCHAR(500);
