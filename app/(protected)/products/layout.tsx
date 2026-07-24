import AdminGuard from '@/components/AdminGuard'

export default function ProductsLayout({ children }: { children: React.ReactNode }) {
    return <AdminGuard>{children}</AdminGuard>
}
