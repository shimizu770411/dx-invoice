import apiClient from './api'

export interface CompanyProfile {
    id: string
    companyNo?: string
    companyName: string
    companyAddress: string
    companyTel: string
    companyFax?: string
    repTitle?: string
    repName?: string
    bank1Name?: string
    bank1Branch?: string
    bank1Type?: string
    bank1Account?: string
    bank1Holder?: string
    bank2Name?: string
    bank2Branch?: string
    bank2Type?: string
    bank2Account?: string
    bank2Holder?: string
    bank3Name?: string
    bank3Branch?: string
    bank3Type?: string
    bank3Account?: string
    bank3Holder?: string
    bank4Name?: string
    bank4Branch?: string
    bank4Type?: string
    bank4Account?: string
    bank4Holder?: string
    dateFormat?: string
}

export interface UpdateCompanyProfileData {
    companyNo?: string
    companyName: string
    companyAddress: string
    companyTel: string
    companyFax?: string
    repTitle?: string
    repName?: string
    bank1Name?: string
    bank1Branch?: string
    bank1Type?: string
    bank1Account?: string
    bank1Holder?: string
    bank2Name?: string
    bank2Branch?: string
    bank2Type?: string
    bank2Account?: string
    bank2Holder?: string
    bank3Name?: string
    bank3Branch?: string
    bank3Type?: string
    bank3Account?: string
    bank3Holder?: string
    bank4Name?: string
    bank4Branch?: string
    bank4Type?: string
    bank4Account?: string
    bank4Holder?: string
    dateFormat?: string
}

export async function getCompanyProfile(): Promise<CompanyProfile> {
    const response = await apiClient.get<CompanyProfile>('/company-profile')
    return response.data
}

export async function updateCompanyProfile(data: UpdateCompanyProfileData): Promise<CompanyProfile> {
    const response = await apiClient.put<CompanyProfile>('/company-profile', data)
    return response.data
}
