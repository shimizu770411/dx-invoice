import AdminGuard from '@/components/AdminGuard'

export default function DeletedCasesLayout({ children }: { children: React.ReactNode }) {
    return <AdminGuard>{children}</AdminGuard>
}
