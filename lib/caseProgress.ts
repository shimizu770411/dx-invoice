/**
 * 案件が今どこまで進んでいるか（見積・請求・入金・領収書）の判定。
 *
 * これまでこの判定は案件一覧のAPIと画面の中だけに書かれていたため、
 * 一覧の行からしか「次に何ができるか」が分からなかった。
 * 各画面の上部に置く切替バーも同じ判定で動かす必要があるので、ここに集約している。
 *
 * ボタンの見た目・使えるかどうかまでここで決めているのは、
 * 一覧とバーで「請求書が押せる条件」が食い違うのを防ぐため。
 */

/** 書類の有無だけで決まる状態。案件一覧の行データもそのまま渡せる形にしてある */
export interface CaseProgressLike {
    hasEstimate: boolean
    /** 見積が複数ある場合は本見積を優先した種別 */
    estimateType?: 'PRE_CONSULTATION' | 'FORMAL' | null
    preConsultEstimateId?: string | null
    hasInvoice: boolean
    isPaid: boolean
}

/** 1案件ぶんの進捗。切替バーはこれを受け取って各画面へのリンクを組み立てる */
export interface CaseProgress extends CaseProgressLike {
    customerId: string
    receptionNo: string
    deceasedName: string
    /** 本見積があれば本見積、無ければ最初の見積 */
    estimateId: string | null
    estimateStatus: string | null
    preConsultEstimateId: string | null
    invoiceId: string | null
}

export type CaseStepKey =
    | 'case'
    | 'preConsultEstimate'
    | 'estimate'
    | 'invoice'
    | 'payment'
    | 'receipt'
    | 'flowers'

/** ボタンの配色。案件一覧の行ボタンと同じ区分 */
export type CaseStepVariant = 'primary' | 'gold' | 'done' | 'alert' | 'accent'

/**
 * 並びの区切り。
 * edit（情報編集）と parallel（供花）は本線から外れるため、flow との間に区切り線を入れる。
 * flow の中は見積 → 請求 → 入金 → 領収書 の順で、間に矢印を入れる。
 */
export type CaseStepGroup = 'edit' | 'flow' | 'parallel'

export interface CaseStep {
    key: CaseStepKey
    group: CaseStepGroup
    label: string
    variant: CaseStepVariant
    disabled: boolean
    /** 使えない理由。ボタンの title に出す */
    lockedReason?: string
}

/**
 * 案件の進捗から、操作ボタンの並びを組み立てる。
 *
 * 事前相談見積のボタンは、本見積を作ったあとだけ別枠で出す。
 * 本見積を作る前は見積ボタン自体が事前相談見積を指しているため、2つ並べる意味がない。
 */
export function buildCaseSteps(progress: CaseProgressLike): CaseStep[] {
    const hasFormalEstimate = progress.estimateType === 'FORMAL'
    const steps: CaseStep[] = [
        { key: 'case', group: 'edit', label: '情報編集', variant: 'accent', disabled: false },
    ]

    if (hasFormalEstimate && progress.preConsultEstimateId) {
        steps.push({
            key: 'preConsultEstimate',
            group: 'flow',
            label: '事前相談見積',
            variant: 'done',
            disabled: false,
        })
    }

    steps.push({
        key: 'estimate',
        group: 'flow',
        label: !progress.hasEstimate ? '見積書作成' : hasFormalEstimate ? '本見積編集' : '事前相談見積',
        variant: !progress.hasEstimate ? 'primary' : hasFormalEstimate ? 'gold' : 'done',
        disabled: false,
    })

    steps.push({
        key: 'invoice',
        group: 'flow',
        label: progress.hasInvoice ? '請求書編集' : '請求書作成',
        variant: progress.hasInvoice ? 'done' : 'primary',
        disabled: !hasFormalEstimate,
        lockedReason: !hasFormalEstimate ? '本見積作成後に使用できます' : undefined,
    })

    steps.push({
        key: 'payment',
        group: 'flow',
        label: progress.isPaid ? '入金取消' : '入金登録',
        variant: progress.isPaid ? 'done' : 'alert',
        disabled: !progress.hasInvoice,
        lockedReason: !progress.hasInvoice ? '請求書作成後に使用できます' : undefined,
    })

    steps.push({
        key: 'receipt',
        group: 'flow',
        label: '領収書発行',
        variant: 'gold',
        disabled: !progress.isPaid,
        lockedReason: !progress.isPaid ? '入金登録後に使用できます' : undefined,
    })

    steps.push({ key: 'flowers', group: 'parallel', label: '供花登録', variant: 'accent', disabled: false })

    return steps
}

// ---------------------------------------------------------------------------
// サーバー側: DBの取得結果から進捗を組み立てる
// ---------------------------------------------------------------------------

/**
 * 進捗の判定に必要な取得条件。案件一覧と1件取得で同じ条件を使うために共有する。
 * 入金は請求書に対するもの（targetType=INVOICE）の最新1件だけを見る。供花の入金は対象外。
 */
export const CASE_PROGRESS_INCLUDE = {
    estimates: {
        select: { id: true, status: true, estimateType: true },
        orderBy: { id: 'asc' },
    },
    invoices: {
        select: {
            id: true,
            payments: {
                select: { status: true },
                where: { targetType: 'INVOICE' },
                orderBy: { createdAt: 'desc' },
                take: 1,
            },
        },
    },
} as const

interface CaseProgressSource {
    id: bigint | number | string
    receptionNo?: string | null
    deceasedName?: string | null
    estimates: { id: bigint | number | string; status?: string | null; estimateType?: string | null }[]
    invoices: { id: bigint | number | string; payments: { status?: string | null }[] }[]
}

/**
 * DBの取得結果（CASE_PROGRESS_INCLUDE 付き）を進捗に変換する。
 * 見積が複数ある案件では、本見積があればそちらを代表として返す。
 */
export function toCaseProgress(customer: CaseProgressSource): CaseProgress {
    const formalEstimate = customer.estimates.find((e) => e.estimateType === 'FORMAL')
    const representative = formalEstimate ?? customer.estimates[0]
    const preConsultEstimate = customer.estimates.find((e) => e.estimateType === 'PRE_CONSULTATION')
    const invoice = customer.invoices[0]
    const latestPayment = invoice?.payments[0]

    return {
        customerId: customer.id.toString(),
        receptionNo: customer.receptionNo ?? '',
        deceasedName: customer.deceasedName ?? '',
        hasEstimate: customer.estimates.length > 0,
        estimateId: representative ? representative.id.toString() : null,
        estimateStatus: representative?.status ?? null,
        estimateType: (representative?.estimateType as 'PRE_CONSULTATION' | 'FORMAL' | undefined) ?? null,
        preConsultEstimateId: preConsultEstimate ? preConsultEstimate.id.toString() : null,
        hasInvoice: customer.invoices.length > 0,
        invoiceId: invoice ? invoice.id.toString() : null,
        isPaid: latestPayment?.status === 'PAID',
    }
}
