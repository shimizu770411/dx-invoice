import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * 商品画像の URL を正規化する。
 * - フルパス（/ や http で始まる）→ そのまま
 * - ファイル名のみ → /images/products/{name} を前置（旧ロジック互換）
 * 日本語などの非ASCII文字はセグメントごとにURLエンコード。
 */
export function resolveProductImageUrl(imageUrl: string | null | undefined): string | null {
  if (!imageUrl) return null
  const raw = imageUrl.startsWith('/') || imageUrl.startsWith('http') ? imageUrl : `/images/products/${imageUrl}`
  return encodePathPreserveSlashes(raw)
}

function encodePathPreserveSlashes(url: string): string {
  try {
    // http(s) でない場合はパスのみエンコード
    if (url.startsWith('/')) {
      return url.split('/').map((seg) => encodeURIComponent(seg)).join('/')
    }
    // フル URL の場合
    const u = new URL(url)
    u.pathname = u.pathname.split('/').map((seg) => encodeURIComponent(seg)).join('/')
    return u.toString()
  } catch {
    return url
  }
}
