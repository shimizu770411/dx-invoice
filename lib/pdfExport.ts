export function openPdfExport(pdfEndpoint: string, includeOptionImages: boolean): void {
    const params = new URLSearchParams({ _t: Date.now().toString() })
    if (!includeOptionImages) {
        params.set('showOptions', 'false')
    }
    window.open(`${pdfEndpoint}?${params.toString()}`, '_blank')
}
