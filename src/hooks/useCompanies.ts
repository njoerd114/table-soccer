import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import type { Company, CompanyMember } from '../domain/types'
import { queryKeys } from '../lib/queryKeys'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'

export type CreateCompanyInput = {
  readonly name: string
}

export type JoinCompanyInput = {
  readonly companyId: string
}

class MissingAuthenticatedUserError extends Error {
  constructor(action: 'create company' | 'join company') {
    super(`Cannot ${action} without an authenticated Supabase user`)
    this.name = 'MissingAuthenticatedUserError'
  }
}

/**
 * Reads companies visible to the current user through tenant RLS membership.
 */
export function useCompanies() {
  const { user } = useAuth()

  return useQuery({
    queryKey: queryKeys.companies,
    queryFn: fetchCompanies,
    enabled: user !== null
  })
}

export async function fetchCompanies(): Promise<Company[]> {
  const { data, error } = await supabase
    .from('companies')
    .select('*')
    .order('name')

  if (error) {
    throw error
  }

  return data ?? []
}

/**
 * Creates a company and records the creator as its owner membership.
 */
export function useCreateCompany() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: createCompany,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.companies }),
        queryClient.invalidateQueries({ queryKey: queryKeys.companyMembers })
      ])
    }
  })
}

async function createCompany(input: CreateCompanyInput): Promise<Company> {
  const {
    data: { user },
    error: authError
  } = await supabase.auth.getUser()

  if (authError) {
    throw authError
  }

  if (!user) {
    throw new MissingAuthenticatedUserError('create company')
  }

  const { data: company, error: companyError } = await supabase
    .from('companies')
    .insert({ name: input.name, created_by: user.id })
    .select()
    .single()

  if (companyError) {
    throw companyError
  }

  const { error: memberError } = await supabase.from('company_members').insert({
    company_id: company.id,
    user_id: user.id,
    role: 'owner'
  })

  if (memberError) {
    throw memberError
  }

  return company
}

/**
 * Reads company membership rows for a single tenant.
 */
export function useCompanyMembers(companyId: string) {
  const { user } = useAuth()

  return useQuery({
    queryKey: [...queryKeys.companyMembers, companyId],
    queryFn: () => fetchCompanyMembers(companyId),
    enabled: user !== null
  })
}

export async function fetchCompanyMembers(
  companyId: string
): Promise<CompanyMember[]> {
  const { data, error } = await supabase
    .from('company_members')
    .select('*')
    .eq('company_id', companyId)

  if (error) {
    throw error
  }

  return data ?? []
}

/**
 * Adds the current user as a member of an existing company.
 */
export function useJoinCompany() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: joinCompany,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.companies }),
        queryClient.invalidateQueries({ queryKey: queryKeys.companyMembers })
      ])
    }
  })
}

async function joinCompany(input: JoinCompanyInput): Promise<void> {
  const {
    data: { user },
    error: authError
  } = await supabase.auth.getUser()

  if (authError) {
    throw authError
  }

  if (!user) {
    throw new MissingAuthenticatedUserError('join company')
  }

  const { error } = await supabase.from('company_members').insert({
    company_id: input.companyId,
    user_id: user.id,
    role: 'member'
  })

  if (error) {
    throw error
  }
}
