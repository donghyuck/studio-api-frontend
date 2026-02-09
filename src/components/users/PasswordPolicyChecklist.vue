<template>
    <v-card variant="outlined" class="password-policy-checklist">
        <v-card-text class="py-3 text-body-2">
            <div class="text-caption mb-2">{{ passwordPolicyText.title }}</div>
            <div class="d-flex align-center mb-1" v-for="item in checks" :key="item.label">
                <v-icon :icon="item.ok ? 'mdi-check-circle' : 'mdi-circle-outline'" :color="item.ok ? 'success' : 'grey'"
                    size="16" class="me-2" />
                <span class="text-body-2">{{ item.label }}</span>
            </div>
        </v-card-text>
    </v-card>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { PasswordPolicyDto } from '@/types/studio/user'
import { passwordPolicyText } from '@/messages/passwordPolicy'

const props = defineProps<{
    policy: PasswordPolicyDto
    password: string
}>()

const checks = computed(() => {
    const p = props.policy
    const v = props.password || ''
    const items: Array<{ label: string; ok: boolean }> = [
        { label: passwordPolicyText.lengthRange(p.minLength, p.maxLength), ok: v.length >= p.minLength && v.length <= p.maxLength },
        { label: passwordPolicyText.noWhitespace, ok: p.allowWhitespace ? true : !/\s/.test(v) },
    ]
    if (p.requireUpper) items.push({ label: passwordPolicyText.upper, ok: /[A-Z]/.test(v) })
    if (p.requireLower) items.push({ label: passwordPolicyText.lower, ok: /[a-z]/.test(v) })
    if (p.requireDigit) items.push({ label: passwordPolicyText.digit, ok: /[0-9]/.test(v) })
    if (p.requireSpecial) {
        const specials = p.allowedSpecials || ''
        const escaped = specials.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')
        items.push({
            label: passwordPolicyText.special(specials),
            ok: escaped.length > 0 ? new RegExp(`[${escaped}]`).test(v) : false,
        })
    }
    return items
})
</script>


<style scoped>
.password-policy-checklist {
    border-color: rgba(var(--v-theme-on-surface), 0.18);
    background: rgba(var(--v-theme-on-surface), 0.02);
}
</style>
