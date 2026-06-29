import { NextResponse } from 'next/server'

// 確定解除は廃止。本見積（FORMAL）に確定した後は事前相談見積に戻すことはできない。
export async function POST() {
    return NextResponse.json({ error: 'この操作は廃止されました' }, { status: 410 })
}
