import type { CategoryType } from '@/lib/types'

const DEFAULT_CATEGORIES: Array<{ name: string; emoji: string; color: string; type: CategoryType }> = [
  { name: 'Salário', emoji: '💼', color: '#00e676', type: 'income' },
  { name: 'Freelance', emoji: '💻', color: '#00e5ff', type: 'income' },
  { name: 'Investimento', emoji: '📈', color: '#00e676', type: 'income' },
  { name: 'Alimentação', emoji: '🍔', color: '#ff9100', type: 'expense' },
  { name: 'Transporte', emoji: '🚗', color: '#00e5ff', type: 'expense' },
  { name: 'Lazer', emoji: '🎬', color: '#b388ff', type: 'expense' },
  { name: 'Saúde', emoji: '💊', color: '#ff3d57', type: 'expense' },
  { name: 'Moradia', emoji: '🏠', color: '#ff9100', type: 'expense' },
  { name: 'Aluguel', emoji: '🏠', color: '#ff9100', type: 'expense' },
  { name: 'Financiamento', emoji: '🏦', color: '#ff9100', type: 'expense' },
  { name: 'Cartão', emoji: '💳', color: '#b388ff', type: 'expense' },
  { name: 'Assinatura', emoji: '🔁', color: '#00e5ff', type: 'expense' },
  { name: 'Outros', emoji: '📦', color: '#555555', type: 'both' },
]

export function createDefaultCategories(userId: string) {
  return DEFAULT_CATEGORIES.map((category) => ({
    id: crypto.randomUUID(),
    user_id: userId,
    ...category,
  }))
}
