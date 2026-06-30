'use client'

import { useParams } from 'next/navigation'
import { InvoiceFormEdit } from '../components/InvoiceForm'

export default function InvoiceEditPage() {
    const { id } = useParams()
    return <InvoiceFormEdit invoiceId={id as string} />
}
