'use client'

import { useState } from 'react'
import { handleOperationError } from '@/lib/errorHandler'

interface SealImageInputProps {
    /** 画像のURL。未登録は空文字 */
    value: string
    onChange: (url: string) => void
    /** 画像をアップロードしてURLを返す（会社の角印・ユーザーの印影で送り先が違う） */
    upload: (file: File) => Promise<string>
    /** プレビュー画像の代替テキストと、失敗時の文言に使う名前（例: 角印、印影） */
    label: string
}

/**
 * 角印・印影のような透過画像の登録欄（プレビュー・アップロード・クリア）。
 * 自社情報の角印とユーザーの印影で同じ見た目・操作にするため共通化している。
 */
export function SealImageInput({ value, onChange, upload, label }: SealImageInputProps) {
    const [uploading, setUploading] = useState(false)

    return (
        <div className="flex items-center gap-4">
            <div
                className="relative flex items-center justify-center overflow-hidden"
                style={{ width: 96, height: 96, border: '1px solid var(--brand-border)', backgroundColor: '#ffffff' }}
            >
                {value ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={value} alt={label} style={{ width: '100%', height: '100%', objectFit: 'contain', padding: 4 }} />
                ) : (
                    <span className="material-symbols-outlined" style={{ fontSize: 32, color: 'var(--brand-gold-soft)', opacity: 0.5 }}>
                        image
                    </span>
                )}
                {uploading && (
                    <div
                        className="absolute inset-0 flex items-center justify-center"
                        style={{ backgroundColor: 'rgba(255,255,255,0.85)', fontSize: 11 }}
                    >
                        アップロード中…
                    </div>
                )}
            </div>
            <div className="flex flex-col gap-2">
                <label
                    className="font-mincho cursor-pointer"
                    style={{
                        padding: '6px 12px',
                        border: '1px solid var(--brand-gold)',
                        color: 'var(--brand-gold-soft)',
                        backgroundColor: '#ffffff',
                        fontSize: 12,
                        letterSpacing: '0.15em',
                        textAlign: 'center',
                    }}
                >
                    画像をアップロード
                    <input
                        type="file"
                        accept="image/png,image/webp"
                        className="hidden"
                        onChange={async (e) => {
                            const file = e.target.files?.[0]
                            e.target.value = ''
                            if (!file) return
                            try {
                                setUploading(true)
                                onChange(await upload(file))
                            } catch (error) {
                                handleOperationError(error, `${label}画像のアップロードに失敗しました`)
                            } finally {
                                setUploading(false)
                            }
                        }}
                    />
                </label>
                {value && (
                    <button
                        type="button"
                        onClick={() => onChange('')}
                        style={{
                            padding: '4px 8px',
                            fontSize: 11,
                            color: 'var(--brand-text-muted)',
                            border: '1px dashed var(--brand-border)',
                            backgroundColor: 'transparent',
                        }}
                    >
                        画像をクリア
                    </button>
                )}
            </div>
        </div>
    )
}
