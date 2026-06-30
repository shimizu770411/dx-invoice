'use client'

import { useParams } from 'next/navigation'
import { EstimateFormEdit } from '../components/EstimateForm'

export default function EstimateEditPage() {
    const { id } = useParams()
    return <EstimateFormEdit estimateId={id as string} />
}
