import apiClient from './api'
import Cookies from 'js-cookie'

export interface LoginCredentials {
    tel: string
    password: string
}

export interface User {
    id: string
    name: string
    tel: string
    email?: string
    role?: string
    isAdmin?: boolean
    requirePasswordChange?: boolean
}

export interface LoginResponse {
    access_token: string
    user: User
}

export async function login(credentials: LoginCredentials): Promise<LoginResponse> {
    const response = await apiClient.post<LoginResponse>('/auth/login', credentials)
    // サーバー側でHttpOnlyクッキーが設定されるが、クライアント側でも設定して
    // Authorizationヘッダに設定できるようにする（isAuthenticated()のチェックにも使用）
    if (response.data.access_token) {
        Cookies.set('access_token', response.data.access_token, {
            expires: 7,
            path: '/',
            sameSite: 'lax',
        })
    }
    return response.data
}

export async function getMe(): Promise<User> {
    const response = await apiClient.get<User>('/auth/me')
    return response.data
}

export async function logout() {
    try {
        // サーバー側のHttpOnlyクッキーを削除するためにAPIを呼び出す
        await apiClient.post('/auth/logout')
    } catch (error) {
        // エラーが発生してもクライアント側のクッキーは削除する
        console.error('Logout API error:', error)
    }
    
    // クライアント側のクッキーも削除
    Cookies.remove('access_token', { path: '/' })
    
    if (typeof window !== 'undefined') {
        window.location.href = '/login'
    }
}

export function isAuthenticated(): boolean {
    return !!Cookies.get('access_token')
}
