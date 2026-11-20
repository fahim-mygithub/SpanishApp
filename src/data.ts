import planJson from '../data/plan.json'
import cardsJson from '../data/cards.json'

export type Link = [string, string]
export interface Task { k: string; t: string; d: string; l?: Link[]; w?: [string, string][] }
export interface Day { i: number; w: number; d: number; p: number; rv: boolean; tasks: Task[]; ck: string }
export interface Phase { id: number; name: string; en: string; weeks: [number, number]; color: string }
export interface Plan { phases: Phase[]; days: Day[]; weeks: Record<string, { g: string; ms: string }> }
export interface Card { id: string; es: string; en: string; day: number; w: number; t?: number }

export const PLAN = planJson as unknown as Plan
export const CORE = cardsJson as Card[]
export const TOTAL_DAYS = PLAN.days.length
export const dayAt = (i: number): Day => PLAN.days[Math.min(Math.max(i, 1), TOTAL_DAYS) - 1]
export const phaseOf = (d: Day): Phase => PLAN.phases.find((p) => p.id === d.p)!
