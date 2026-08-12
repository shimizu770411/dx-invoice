import React, { useState } from 'react'

interface TextareaUIProps {
    value?: string
    onChange: (value: string) => void
    onBlur?: () => void
    label?: string
    placeholder?: string
    rows?: number
    error?: string
    required?: boolean
    disabled?: boolean
    noResize?: boolean
    maxRows?: number
    maxLength?: number
    maxLineLength?: number
}

// 改行(\n)区切りの各行が maxLineLength 文字を超えたら、その行だけ切り捨てる（自動改行はしない）。
// maxRows 行を超える分の行も切り詰める
function clampLines(text: string, maxLineLength?: number, maxRows?: number): string {
    let lines = text.split('\n')
    if (maxLineLength) {
        lines = lines.map((line) => (line.length > maxLineLength ? line.slice(0, maxLineLength) : line))
    }
    if (maxRows !== undefined && lines.length > maxRows) {
        lines = lines.slice(0, maxRows)
    }
    return lines.join('\n')
}

export function TextareaUI({
    value = '',
    onChange,
    onBlur,
    label,
    placeholder,
    rows = 4,
    error,
    required,
    disabled,
    noResize,
    maxRows,
    maxLength,
    maxLineLength,
}: TextareaUIProps) {
    const [isComposing, setIsComposing] = useState(false)

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (maxRows !== undefined && e.key === 'Enter') {
            const currentLines = (e.currentTarget.value.match(/\n/g) ?? []).length + 1
            if (currentLines >= maxRows) {
                e.preventDefault()
            }
        }
    }

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const raw = e.target.value
        // IME変換中に文字列を書き換えると変換が壊れるため、確定後(onCompositionEnd)に整形する
        onChange(isComposing ? raw : clampLines(raw, maxLineLength, maxRows))
    }

    const handleCompositionEnd = (e: React.CompositionEvent<HTMLTextAreaElement>) => {
        setIsComposing(false)
        onChange(clampLines(e.currentTarget.value, maxLineLength, maxRows))
    }

    return (
        <div>
            {label && (
                <label className="brand-label">
                    {label}
                    {required && <span className="brand-label-required">*</span>}
                </label>
            )}
            <textarea
                value={value}
                onChange={handleChange}
                onCompositionStart={() => setIsComposing(true)}
                onCompositionEnd={handleCompositionEnd}
                onBlur={onBlur}
                onKeyDown={handleKeyDown}
                placeholder={placeholder}
                rows={rows}
                style={{
                    width: '100%',
                    // box-sizing: border-box 環境ではpaddingがrows基準の高さ計算に食い込み、
                    // 指定行数ぶんのテキストが収まらずスクロールバーが出てしまうため、
                    // line-height を固定した上で height を明示計算する
                    height: `calc(${rows} * 1.5em + 1rem + 2px)`,
                    lineHeight: 1.5,
                    padding: '0.5rem',
                    border: error ? '2px solid #dc3545' : '1px solid #ddd',
                    borderRadius: '4px',
                    fontSize: '1.25rem',
                    fontFamily: 'inherit',
                    backgroundColor: disabled ? '#f5f5f5' : 'white',
                    cursor: disabled ? 'not-allowed' : 'text',
                    resize: noResize ? 'none' : undefined,
                    // maxRows指定時は行数がロジックで maxRows を超えないため、
                    // スクロールバーによる表示幅の圧迫（→1行の折り返し位置のズレ）を防ぐため非表示にする
                    overflowY: maxRows !== undefined ? 'hidden' : undefined,
                }}
                maxLength={maxLength}
                disabled={disabled}
            />
            {maxLength !== undefined && (
                <div style={{ textAlign: 'right', fontSize: '0.75rem', marginTop: '0.25rem', color: value.length >= maxLength ? '#dc3545' : '#888' }}>
                    {value.length} / {maxLength}
                </div>
            )}
            {error && <div style={{ color: '#dc3545', fontSize: '0.875rem', marginTop: '0.25rem' }}>{error}</div>}
        </div>
    )
}
