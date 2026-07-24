import AdminGuard from '@/components/AdminGuard'

export default function StoresLayout({ children }: { children: React.ReactNode }) {
    return <AdminGuard>{children}</AdminGuard>
}
