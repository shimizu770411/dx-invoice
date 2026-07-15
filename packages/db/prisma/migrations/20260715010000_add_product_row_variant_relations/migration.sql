-- AddForeignKey
ALTER TABLE "estimate_items" ADD CONSTRAINT "estimate_items_product_row_id_fkey" FOREIGN KEY ("product_row_id") REFERENCES "product_rows"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estimate_items" ADD CONSTRAINT "estimate_items_product_row_variant_id_fkey" FOREIGN KEY ("product_row_variant_id") REFERENCES "product_row_variants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_items" ADD CONSTRAINT "invoice_items_product_row_id_fkey" FOREIGN KEY ("product_row_id") REFERENCES "product_rows"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_items" ADD CONSTRAINT "invoice_items_product_row_variant_id_fkey" FOREIGN KEY ("product_row_variant_id") REFERENCES "product_row_variants"("id") ON DELETE SET NULL ON UPDATE CASCADE;
