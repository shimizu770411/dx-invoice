import apiClient from './api';

// ACCOUNTING（経理）は請求書の確認欄を持たないロール（確認できるのは担当者・事務員・決裁者のみ）
export type UserRole = 'STAFF' | 'CLERK' | 'APPROVER' | 'ACCOUNTING'

export const USER_ROLE_LABELS: Record<UserRole, string> = {
  STAFF: '担当者',
  CLERK: '事務員',
  APPROVER: '決裁者',
  ACCOUNTING: '経理',
}

export interface User {
  id: string;
  name: string;
  tel: string;
  email?: string;
  birthDate?: string;
  role: UserRole;
  isAdmin: boolean;
  requirePasswordChange: boolean;
  isActive: boolean;
  /** 印影画像のURL。請求書PDFの押印欄に出す */
  sealImageUrl?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateUserData {
  name: string;
  tel: string;
  password: string;
  email?: string;
  birthDate?: string;
  role?: UserRole;
  isAdmin?: boolean;
  requirePasswordChange?: boolean;
  sealImageUrl?: string | null;
}

export interface UpdateUserData {
  name?: string;
  tel?: string;
  password?: string;
  email?: string;
  birthDate?: string;
  role?: UserRole;
  isAdmin?: boolean;
  requirePasswordChange?: boolean;
  isActive?: boolean;
  sealImageUrl?: string | null;
}

export async function getUsers(name?: string): Promise<User[]> {
  const params = name ? { name } : {};
  const response = await apiClient.get<User[]>('/users', { params });
  return response.data;
}

export async function getUser(id: string): Promise<User> {
  const response = await apiClient.get<User>(`/users/${id}`);
  return response.data;
}

export async function createUser(data: CreateUserData): Promise<User> {
  const response = await apiClient.post<User>('/users', data);
  return response.data;
}

export async function updateUser(id: string, data: UpdateUserData): Promise<User> {
  const response = await apiClient.put<User>(`/users/${id}`, data);
  return response.data;
}

// 印影画像のアップロード（管理者のみ）。返ってきたURLをユーザーの sealImageUrl として保存する
export async function uploadUserSealImage(file: File): Promise<string> {
  const form = new FormData();
  form.append('file', file);
  const response = await apiClient.post<{ url: string }>('/upload/user-seal', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data.url;
}
