import axios from 'axios'
import Cookies from 'js-cookie'

// Vercel環境では相対パスを使用、ローカルでは環境変数またはデフォルト値
const getApiUrl = () => {
    if (typeof window === 'undefined') {
        // サーバーサイド
        return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'
    }
    // クライアントサイド
    const apiUrl = process.env.NEXT_PUBLIC_API_URL
    if (apiUrl && apiUrl !== 'undefined') {
        return apiUrl
    }
    // 環境変数が設定されていない場合は相対パスを使用（Vercel環境）
    return '/api'
}

const API_URL = getApiUrl()

const apiClient = axios.create({
    baseURL: API_URL,
    headers: {
        'Content-Type': 'application/json',
    },
    // Include credentials so HttpOnly cookie set by server is sent with requests
    withCredentials: true,
    timeout: 60000, // 60秒のタイムアウト（dev サーバーの初回コンパイル考慮）
})

// リクエストインターセプター: トークンを自動付与
// HttpOnlyクッキーを使用する場合、クライアント側からは読み取れないため、
// サーバー側（ミドルウェア）でクッキーから読み取る
// ただし、クライアント側で設定されたクッキーがある場合はそれを使用
apiClient.interceptors.request.use((config) => {
    const token = Cookies.get('access_token')
    if (token) {
        config.headers.Authorization = `Bearer ${token}`
    }
    // HttpOnlyクッキーは自動的に送信される（withCredentials: trueにより）
    return config
})

// レスポンスインターセプター: エラーハンドリング
apiClient.interceptors.response.use(
    (response) => {
        console.log('API Response:', response.status, response.config.url)
        return response
    },
    (error) => {
        console.error('API Error:', error.message, error.response?.status, error.config?.url)

        // タイムアウトエラーやネットワークエラーの場合
        if (!error.response) {
            console.error('Network error or timeout:', error.message)
            // ログイン画面へのリダイレクトは行わない（ログイン画面自体がリダイレクトされる可能性がある）
            return Promise.reject(error)
        }

        if (error.response?.status === 401) {
            // 認証エラーの場合、ログイン画面へリダイレクト
            // ただし、ログイン画面からのリクエストの場合はリダイレクトしない
            // AuthGuardが処理する場合は、自動リダイレクトをスキップする
            const isAuthGuardRequest = error.config?.url?.includes('/auth/me')
            if (typeof window !== 'undefined' && !window.location.pathname.includes('/login') && !isAuthGuardRequest) {
                Cookies.remove('access_token', { path: '/' })
                window.location.href = '/login'
            }
        }
        return Promise.reject(error)
    }
)

export default apiClient
