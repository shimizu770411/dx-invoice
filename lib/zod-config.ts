import { z } from 'zod'

// Zod のデフォルトエラーメッセージを日本語化する。
// アプリ起動時に 1 度だけ読み込まれるよう、protected layout から import する。
z.setErrorMap((issue, ctx) => {
    switch (issue.code) {
        case z.ZodIssueCode.invalid_type:
            if (issue.received === 'undefined' || issue.received === 'null') {
                return { message: '入力してください' }
            }
            if (issue.expected === 'number') {
                return { message: '数値を入力してください' }
            }
            if (issue.expected === 'string') {
                return { message: '文字列を入力してください' }
            }
            if (issue.expected === 'date') {
                return { message: '日付を入力してください' }
            }
            break
        case z.ZodIssueCode.too_small:
            if (issue.type === 'number') {
                return { message: `${issue.minimum} 以上で入力してください` }
            }
            if (issue.type === 'string') {
                return { message: `${issue.minimum} 文字以上で入力してください` }
            }
            if (issue.type === 'array') {
                return { message: `${issue.minimum} 件以上指定してください` }
            }
            break
        case z.ZodIssueCode.too_big:
            if (issue.type === 'number') {
                return { message: `${issue.maximum} 以下で入力してください` }
            }
            if (issue.type === 'string') {
                return { message: `${issue.maximum} 文字以内で入力してください` }
            }
            if (issue.type === 'array') {
                return { message: `${issue.maximum} 件以内で指定してください` }
            }
            break
        case z.ZodIssueCode.invalid_string:
            if (issue.validation === 'email') return { message: 'メールアドレスの形式が不正です' }
            if (issue.validation === 'url') return { message: 'URL の形式が不正です' }
            if (issue.validation === 'regex') return { message: '入力形式が不正です' }
            return { message: '文字列の形式が不正です' }
        case z.ZodIssueCode.invalid_enum_value:
            return { message: '選択肢から選んでください' }
        case z.ZodIssueCode.invalid_date:
            return { message: '日付の形式が不正です' }
        case z.ZodIssueCode.custom:
            return { message: issue.message ?? '入力内容が不正です' }
    }
    return { message: ctx.defaultError }
})
