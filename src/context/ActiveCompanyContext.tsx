import { createContext, useState } from 'react'
import type { ReactNode } from 'react'

import type { Company } from '../domain/types'

type ActiveCompanyContextValue = {
  company: Company | null
  setCompany: (company: Company | null) => void
}

const ActiveCompanyContext = createContext<ActiveCompanyContextValue>({
  company: null,
  setCompany: () => {}
})

export function ActiveCompanyProvider({ children }: { children: ReactNode }) {
  const [company, setCompany] = useState<Company | null>(null)

  return (
    <ActiveCompanyContext.Provider value={{ company, setCompany }}>
      {children}
    </ActiveCompanyContext.Provider>
  )
}

export { ActiveCompanyContext }