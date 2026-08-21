-- AlterTable
ALTER TABLE "company_profiles" ADD COLUMN     "pdf_show_option_images" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "pdf_prompt_on_export" BOOLEAN NOT NULL DEFAULT true;
