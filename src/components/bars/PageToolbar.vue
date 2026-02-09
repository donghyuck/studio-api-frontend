<template>
  <v-toolbar :density="props.density" :class="toolbarClass">
    <template v-slot:prepend>
      <v-btn v-if="previous" size="small" icon="mdi-chevron-left" :title="previousTitle" @click="handlePrevious" /> 
    </template> 
    <v-toolbar-title class="ml-1" v-if="title != null" :text="title">
      <v-chip size="x-small" variant="plain" v-if="label != null || $slots.label">
        <slot name="label">{{ label }}</slot>
      </v-chip>
    </v-toolbar-title> 
    <template v-for="a in resolvedPrependItems" :key="a.key"></template>
    <v-spacer></v-spacer>
    <template v-for="a in resolvedItems" :key="a.key">
      <v-tooltip v-if="tooltipText(a)" :text="tooltipText(a)" location="top">
        <template #activator="{ props: tip }">
          <v-btn v-bind="tip" :variant="a.variant" :density="a.density" :size="a.size" :color="a.color || 'default'"
            :disabled="!!a.disabled" :icon="a.iconOnly ? a.icon : undefined"
            :prepend-icon="!a.iconOnly ? a.prependIcon : undefined" class="mr-1"
            :append-icon="!a.iconOnly ? a.appendIcon : undefined" @click.stop="onClick(a)" :text="a.text"
            :spaced="a.iconOnly ? undefined : 'end'"  />
        </template>
      </v-tooltip>
      <v-btn v-else :variant="a.variant" :density="a.density" :size="a.size" :color="a.color || 'default'" 
        :disabled="!!a.disabled" :icon="a.iconOnly ? a.icon : undefined" class="d-flex-none"
        :prepend-icon="!a.iconOnly ? a.prependIcon : undefined" :append-icon="!a.iconOnly ? a.appendIcon : undefined"
        @click.stop="onClick(a)" :text="!a.iconOnly ? a.text : undefined" :spaced="a.iconOnly ? undefined : 'end'">
      </v-btn>
    </template>
    <v-btn icon variant="text" size="small" @click="emits('close')" v-if="closeable">
      <v-icon>mdi-close</v-icon>
    </v-btn>
  </v-toolbar>
  <v-divider v-if="divider" class="page-toolbar-divider" />
</template>
<script setup lang="ts">
import { hasHistory } from '@/utils/helpers';
import { computed } from 'vue';
import { useRouter, type RouteLocationRaw } from 'vue-router';

type BtnVariant = 'text' | 'flat' | 'elevated' | 'tonal' | 'outlined' | 'plain'
type BtnDensity = 'default' | 'comfortable' | 'compact'
type BtnSize = 'x-small' | 'small' | 'default' | 'large' | 'x-large'
type ValueOrFn<T> = T | (() => T)

interface Item {
  variant?: BtnVariant
  density?: BtnDensity
  size?: BtnSize
  icon: string
  prependIcon?: string
  appendIcon?: string
  disabled?: boolean
  visible?: boolean
  event?: ValueOrFn<string>
  text?: string
  color?: string
  payload?: any     // 필요 시 클릭 시 함께 전달할 데이터
  tooltip?: string
  tooltipWhenDisabled?: ValueOrFn<string>
}

interface ResolvedItem {
  key: string
  variant?: BtnVariant
  density?: BtnDensity
  size?: BtnSize
  icon: string
  prependIcon?: string
  appendIcon?: string
  disabled?: boolean
  visible?: boolean
  event?: string
  text?: string
  color?: string
  payload?: any     // 필요 시 클릭 시 이벤트와 함께 전달할 데이터
  tooltip?: string
  iconOnly: boolean
}

// define props with default values.
interface Props {
  title?: string;
  subtitle?: string;
  label?: string;
  class?: string;
  density?: BtnDensity;
  divider?: boolean;
  divider_margin?: false;
  closeable?: boolean;
  previous?: boolean;
  previousTitle?: string;
  previousIcon?: string;
  /** router.push 로 이동할 목적지 (우선순위 1) */
  previousTo?: RouteLocationRaw | (() => RouteLocationRaw);
  /** router.go(n) 값 (우선순위 2). 예: -1(뒤로), -2(두 단계 뒤로) */
  previousGo?: number;
  prependItems?: Item[];
  items?: Item[];
}


const props = withDefaults(defineProps<Props>(), {
  title: undefined,
  subtitle: undefined,
  label: undefined,
  density: 'compact',
  class: '',
  divider: true,
  closeable: false,
  previous: false,
  prependItems: () => [],
  items: () => [],
})

const toolbarClass = computed(() => ['page-toolbar', props.class].filter(Boolean))

const isVisible = (visible?: boolean) => visible !== false

/** PREVIOUS HANDLE */
const router = useRouter();
const previousTitle = computed(() => props.previousTitle ?? "이전");
function resolvePreviousTo(): RouteLocationRaw | undefined {
  if (!props.previousTo) return undefined;
  return typeof props.previousTo === "function" ? props.previousTo() : props.previousTo;
}
async function handlePrevious() {
  // 부모가 가로채고 싶으면 'previous' 리스닝해서 prevent 가능
  emits("previous");
  const to = resolvePreviousTo();
  if (to) {
    await router.push(to);
    return;
  }
  if (typeof props.previousGo === "number" && Number.isFinite(props.previousGo)) {
    router.go(props.previousGo);
    return;
  }
  // 기본 동작: 한 단계 뒤로 
  if (hasHistory()) {
    router.back();
  } else {
    // 히스토리가 없을 때 fallback (홈 등)
    await router.push("/");
  }
}

const emits = defineEmits([
  "previous",
  "close",
  "create",
  "createNewVersion",
  "custom",
  "delete",
  "deleteCurrent",
  "download-excel-all",
  "edit",
  "email-sync",
  "fullscreen",
  "lock",
  "nextTopic",
  "openAcl",
  "openCategories",
  "openPermissions",
  "openRoleHelp",
  "pin",
  "prevTopic",
  "preview",
  "refresh",
  "reload",
  "remove-membership",
  "selectAll",
  "upload",
]);

function resolve<T>(v: ValueOrFn<T> | undefined, fallback?: T): T {
  if (typeof v === 'function') return (v as any)()
  return (v ?? fallback) as T
}
const resolvedPrependItems = computed<ResolvedItem[]>(() => {
  const items: Item[] = props.prependItems ?? []
  return items
    .map((raw, idx) => {
      const visible = resolve<boolean>(raw.visible, true)
      if (!visible) return null
      const event = resolve<string>(raw.event, `evt-${idx}`)
      const text = resolve<string>(raw.text, event)
      const icon = resolve<string | undefined>(raw.icon, undefined)
      const prependIcon = resolve<string | undefined>(raw.prependIcon, undefined)
      const appendIcon = resolve<string | undefined>(raw.appendIcon, undefined)
      const color = resolve<string | undefined>(raw.color, undefined)

      let disabled = resolve<boolean>(raw.disabled, false)
      const baseTooltip = resolve<string | undefined>(raw.tooltip, undefined)
      const disabledTooltip = resolve<string | undefined>(raw.tooltipWhenDisabled, undefined)
      const tooltip =
        disabled
          ? (disabledTooltip ?? baseTooltip ?? text)
          : (baseTooltip ?? undefined)

      const iconOnly = !!icon && !prependIcon && !appendIcon

      const variant = resolve<BtnVariant>(raw.variant, 'text')
      const density = resolve<BtnDensity>(raw.density, (iconOnly ? 'default' : 'comfortable'))
      const size = resolve<BtnSize>(raw.size, (iconOnly ? 'small' : 'default'))
      const payload = resolve<any>(raw.payload, null);

      return {
        key: `${event}-${idx}`,
        variant,
        density,
        size,
        icon,
        prependIcon,
        appendIcon,
        disabled,
        visible,
        event,
        text,
        color,
        payload,
        tooltip,
        iconOnly
      } as ResolvedItem
    })
    .filter((x): x is ResolvedItem => !!x)
})

const resolvedItems = computed<ResolvedItem[]>(() => {
  const items: Item[] = props.items ?? []
  return items
    .map((raw, idx) => {
      const visible = resolve<boolean>(raw.visible, true)
      if (!visible) return null
      const event = resolve<string>(raw.event, `evt-${idx}`)
      const text = resolve<string>(raw.text, event)
      const icon = resolve<string | undefined>(raw.icon, undefined)
      const prependIcon = resolve<string | undefined>(raw.prependIcon, undefined)
      const appendIcon = resolve<string | undefined>(raw.appendIcon, undefined)
      const color = resolve<string | undefined>(raw.color, undefined)

      let disabled = resolve<boolean>(raw.disabled, false)
      const baseTooltip = resolve<string | undefined>(raw.tooltip, undefined)
      const disabledTooltip = resolve<string | undefined>(raw.tooltipWhenDisabled, undefined)
      const tooltip =
        disabled
          ? (disabledTooltip ?? baseTooltip ?? text)
          : (baseTooltip ?? undefined)

      const iconOnly = !!icon && !prependIcon && !appendIcon

      const variant = resolve<BtnVariant>(raw.variant, 'text')
      const density = resolve<BtnDensity>(raw.density, (iconOnly ? 'default' : 'comfortable'))
      const size = resolve<BtnSize>(raw.size, (iconOnly ? 'small' : 'default'))
      const payload = resolve<any>(raw.payload, null);

      return {
        key: `${event}-${idx}`,
        variant,
        density,
        size,
        icon,
        prependIcon,
        appendIcon,
        disabled,
        visible,
        event,
        text,
        color,
        payload,
        tooltip,
        iconOnly
      } as ResolvedItem
    })
    .filter((x): x is ResolvedItem => !!x)
})

// define emits
function onClick(item: ResolvedItem) {
  if (item.disabled) return
  const name = item.event ?? 'custom'
  const payload = item.payload ?? item
  emits(name, payload)
}


function tooltipText(a: { text?: string, tooltip?: string }): string {
  // reason 우선, 없으면 tooltip
  return (a.tooltip || '').trim()
}

</script>

<style scoped>
.page-toolbar {
  background: transparent;
  color: rgb(var(--v-theme-on-surface));
}

.page-toolbar-divider {
  border-color: rgba(var(--v-border-color), var(--v-border-opacity));
}
</style>
