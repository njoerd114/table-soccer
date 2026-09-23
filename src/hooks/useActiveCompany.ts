import { useContext } from 'react'

import { ActiveCompanyContext } from '../context/ActiveCompanyContext'

export function useActiveCompany() {
  return useContext(ActiveCompanyContext)
}