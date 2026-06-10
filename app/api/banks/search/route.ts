import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'

const UPSTREAM = 'https://bank.teraren.com'

type Hit = { code: string; name: string; kana?: string }

function compact(b: any): Hit {
    return {
        code: b.code,
        name: b.normalize?.name || (b.name ? `${b.name}銀行` : '') || b.name || '',
        kana: b.normalize?.kana || b.kana || '',
    }
}

export async function GET(request: NextRequest) {
    try {
        const authResult = await requireAuth(request)
        if (authResult instanceof NextResponse) return authResult

        const { searchParams } = new URL(request.url)
        const q = searchParams.get('q')?.trim() || ''
        if (!q) {
            return NextResponse.json([])
        }

        const isNumeric = /^\d+$/.test(q)

        // 完全コード（4桁）の場合は直接取得
        if (isNumeric && q.length === 4) {
            const res = await fetch(`${UPSTREAM}/banks/${q}.json`, { next: { revalidate: 3600 } })
            if (res.ok) {
                const data = await res.json()
                return NextResponse.json([compact(data)])
            }
            return NextResponse.json([])
        }

        // 数字入力（4桁未満）の場合は全銀行から前方一致
        if (isNumeric) {
            const res = await fetch(`${UPSTREAM}/banks.json`, { next: { revalidate: 3600 } })
            if (!res.ok) {
                return NextResponse.json({ error: `upstream ${res.status}` }, { status: 502 })
            }
            const data = await res.json()
            const matched = (Array.isArray(data) ? data : [])
                .filter((b: any) => b.code && b.code.startsWith(q))
                .slice(0, 20)
                .map(compact)
            return NextResponse.json(matched)
        }

        // 名前検索
        const url = `${UPSTREAM}/banks/search.json?name=${encodeURIComponent(q)}&limit=20`
        const res = await fetch(url, { next: { revalidate: 3600 } })
        if (!res.ok) {
            return NextResponse.json({ error: `upstream ${res.status}` }, { status: 502 })
        }
        const data = await res.json()
        const result = (Array.isArray(data) ? data : []).slice(0, 20).map(compact)
        return NextResponse.json(result)
    } catch (e: any) {
        console.error('Bank search error:', e)
        return NextResponse.json({ error: 'Internal error', message: e.message }, { status: 500 })
    }
}
