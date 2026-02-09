<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useField, useForm } from 'vee-validate';
import * as yup from 'yup';
import { getPublicPasswordPolicy } from '@/data/studio/auth';
import type { PasswordPolicyDto } from '@/types/studio/user';
import { useToast } from '@/plugins/toast';
import { resolveAxiosError } from '@/utils/helpers';
import { passwordPolicyText } from '@/messages/passwordPolicy';

const toast = useToast();
const showPassword = ref(false);
const policy = ref<PasswordPolicyDto | null>(null);

const defaultPolicy: PasswordPolicyDto = {
    minLength: 8,
    maxLength: 20,
    requireUpper: false,
    requireLower: false,
    requireDigit: false,
    requireSpecial: false,
    allowedSpecials: '!@#$%^&*',
    allowWhitespace: false,
};

function buildPasswordRule(p: PasswordPolicyDto) {
    let rule = yup
        .string()
        .strict(true)
        .trim()
        .required('비밀번호를 입력하세요.')
        .min(p.minLength, passwordPolicyText.minLength(p.minLength))
        .max(p.maxLength, passwordPolicyText.maxLength(p.maxLength));

    if (p.requireUpper) {
        rule = rule.matches(/[A-Z]/, passwordPolicyText.requireUpper);
    }
    if (p.requireLower) {
        rule = rule.matches(/[a-z]/, passwordPolicyText.requireLower);
    }
    if (p.requireDigit) {
        rule = rule.matches(/[0-9]/, passwordPolicyText.requireDigit);
    }
    if (p.requireSpecial) {
        const specials = p.allowedSpecials || '';
        const escaped = specials.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
        if (escaped.length > 0) {
            rule = rule.matches(new RegExp(`[${escaped}]`), passwordPolicyText.requireSpecial(specials));
        }
    }
    if (!p.allowWhitespace) {
        rule = rule.matches(/^\S*$/, passwordPolicyText.disallowWhitespace);
    }
    return rule;
}

const schema = computed(() => {
    const p = policy.value ?? defaultPolicy;
    return yup.object({
        name: yup.string().required('이름을 입력하세요.'),
        email: yup.string().email('올바른 이메일 형식이 아닙니다.').required('이메일을 입력하세요.'),
        password: buildPasswordRule(p),
    });
});

const { handleSubmit } = useForm({
    validationSchema: schema,
    initialValues: { name: '', email: '', password: '' },
    validateOnMount: false,
    validateOnBlur: true,
    validateOnChange: false,
    validateOnInput: false,
} as any);

const { value: name, errorMessage: nameError } = useField<string>('name');
const { value: email, errorMessage: emailError } = useField<string>('email');
const { value: password, errorMessage: passwordError } = useField<string>('password');

const onSubmit = handleSubmit(async () => {
    toast.info('회원가입 API 연동이 필요합니다.');
});

onMounted(async () => {
    try {
        policy.value = await getPublicPasswordPolicy();
    } catch (e) {
        toast.error(resolveAxiosError(e));
        policy.value = defaultPolicy;
    }
});
</script>
<template>
    <v-form @submit.prevent="onSubmit">
        <v-row class="d-flex mb-3">
            <v-col cols="12">
                <v-label class="font-weight-bold mb-1">Name</v-label>
                <v-text-field v-model="name" variant="outlined" color="primary" :error-messages="nameError ? [nameError] : []"></v-text-field>
            </v-col>
            <v-col cols="12">
                <v-label class="font-weight-bold mb-1">Email Address</v-label>
                <v-text-field v-model="email" variant="outlined" type="email" color="primary" :error-messages="emailError ? [emailError] : []"></v-text-field>
            </v-col>
            <v-col cols="12">
                <v-label class="font-weight-bold mb-1">Password</v-label>
                <v-text-field
                    v-model="password"
                    variant="outlined"
                    :type="showPassword ? 'text' : 'password'"
                    color="primary"
                    :append-inner-icon="showPassword ? 'mdi-eye-off' : 'mdi-eye'"
                    @click:append-inner="showPassword = !showPassword"
                    :error-messages="passwordError ? [passwordError] : []"
                ></v-text-field>
            </v-col>
            <v-col cols="12">
                <v-btn type="submit" color="primary" size="large" block flat>Sign up</v-btn>
            </v-col>
        </v-row>
    </v-form>
</template>
