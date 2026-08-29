// PuppeteerでA4(297mm×210mm)・上下左右16pxパディングで出力しているため、
// 1ページに使える実際の高さ・幅(px)はここから算出する。
// PdfInvoiceLayout(プレビュー・PDF両方の見た目)とPDF生成APIルート(page.setViewport)の
// 両方がこの値を共有することで、プレビューと本番PDFのテキスト折返しを一致させている
// （幅がズレると、フッター等の内容依存の高さがプレビューと本番で食い違う）。
export const A4_HEIGHT_MM = 297
export const A4_WIDTH_MM = 210
export const PX_PER_MM = 96 / 25.4
export const PAGE_BODY_PADDING_PX = 16 * 2 // 上下・左右共通

export const PDF_VIEWPORT_WIDTH_PX = Math.round(A4_WIDTH_MM * PX_PER_MM)
export const PDF_VIEWPORT_HEIGHT_PX = Math.round(A4_HEIGHT_MM * PX_PER_MM)
export const PDF_CONTENT_WIDTH_PX = PDF_VIEWPORT_WIDTH_PX - PAGE_BODY_PADDING_PX
