import AdminGuard from '@/components/AdminGuard'

export default function CompanyLayout({ children }: { children: React.ReactNode }) {
    return <AdminGuard>{children}</AdminGuard>
}
