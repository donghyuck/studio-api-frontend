import { passwordPolicyTextEn } from './passwordPolicy.en'
import { passwordPolicyTextKo } from './passwordPolicy.ko'

export type PasswordPolicyText = typeof passwordPolicyTextKo

function resolveLanguage(): string {
    if (typeof document !== 'undefined' && typeof document.documentElement?.lang === 'string') {
        return document.documentElement.lang.toLowerCase()
    }
    if (typeof navigator !== 'undefined' && typeof navigator.language === 'string') {
        return navigator.language.toLowerCase()
    }
    return 'ko'
}

const lang = resolveLanguage()

export const passwordPolicyText: PasswordPolicyText = lang.startsWith('en')
    ? (passwordPolicyTextEn as PasswordPolicyText)
    : passwordPolicyTextKo
