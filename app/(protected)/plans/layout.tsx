import AdminGuard from '@/components/AdminGuard'

export default function PlansLayout({ children }: { children: React.ReactNode }) {
    return <AdminGuard>{children}</AdminGuard>
}
