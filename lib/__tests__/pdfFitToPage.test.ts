import { describe, it, expect } from 'vitest'
import { A4_FIT_HEIGHT_PX, calcFitScale } from '../pdfFitToPage'

describe('calcFitScale', () => {
    it('1ページに収まる高さなら縮小しない', () => {
        expect(calcFitScale(1000, 1090)).toBe(1)
        expect(calcFitScale(1090, 1090)).toBe(1)
    })

    it('収まらない高さなら、ちょうど収まる率に縮める', () => {
        const scale = calcFitScale(1203, 1090)
        expect(scale).toBeCloseTo(1090 / 1203)
        expect(1203 * scale).toBeCloseTo(1090)
    })

    it('高さが取れない（0）ときは縮小しない', () => {
        expect(calcFitScale(0, 1090)).toBe(1)
    })

    it('既定の高さはA4から上下のパディングを除いた値', () => {
        // A4 297mm = 約1122.5px、上下16pxずつと余裕2pxを除く
        expect(A4_FIT_HEIGHT_PX).toBeCloseTo(1088.5, 0)
        expect(calcFitScale(A4_FIT_HEIGHT_PX + 100)).toBeLessThan(1)
    })
})
