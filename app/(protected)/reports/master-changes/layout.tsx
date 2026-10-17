import AdminGuard from '@/components/AdminGuard'

export default function MasterChangesLayout({ children }: { children: React.ReactNode }) {
    return <AdminGuard>{children}</AdminGuard>
}
