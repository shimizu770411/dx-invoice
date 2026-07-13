import apiClient from './api';

export type UserRole = 'STAFF' | 'CLERK' | 'APPROVER'

export const USER_ROLE_LABELS: Record<UserRole, string> = {
  STAFF: '担当者',
  CLERK: '事務員',
  APPROVER: '決裁者',
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
