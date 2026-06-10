import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const STORES = [
    '総合総裁玉泉院',
    '那覇玉泉院',
    '名護玉泉院',
    '一日橋玉泉院',
    '糸満玉泉院',
    '具志川玉泉院',
    'やすらぎ会館玉泉院',
    '西原玉泉院',
    '小緑・豊見城玉泉院',
]

async function main() {
    for (let i = 0; i < STORES.length; i++) {
        const name = STORES[i]
        const existing = await prisma.store.findFirst({ where: { name } })
        if (existing) {
            await prisma.store.update({
                where: { id: existing.id },
                data: { sortNo: i + 1, isActive: true },
            })
            console.log(`update: ${name}`)
        } else {
            await prisma.store.create({
                data: { name, sortNo: i + 1, isActive: true },
            })
            console.log(`create: ${name}`)
        }
    }
    console.log('店舗マスタ登録完了')
}

main()
    .catch((e) => {
        console.error(e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
