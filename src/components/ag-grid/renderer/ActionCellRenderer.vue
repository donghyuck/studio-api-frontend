<template>
  <div v-if="visible" class="action-cell" :style="cellStyle">
    <template v-for="a in resolvedActions" :key="a.key">
      <!-- 툴팁 텍스트가 있으면 v-tooltip 사용 -->
      <v-tooltip v-if="tooltipText(a)" :text="tooltipText(a)" location="top">
        <template #activator="{ props: tip }">
          <v-btn v-bind="tip" :variant="a.variant" :density="a.density" :size="a.size" :color="a.color || 'default'"
            :disabled="!!a.disabled"  
            :icon="a.iconOnly ? a.icon : undefined"
            :prepend-icon="!a.iconOnly ? a.prependIcon : undefined"
            :append-icon="!a.iconOnly ? a.appendIcon : undefined" @click.stop="onClick(a)" :text="a.label" spaced="end" />
        </template>
      </v-tooltip>
      <!-- 없으면 그냥 버튼 -->
      <v-btn v-else :variant="a.variant" :density="a.density" :size="a.size" :color="a.color || 'default'"
        :disabled="!!a.disabled" 
        :icon="a.iconOnly ? a.icon : undefined"
        :prepend-icon="!a.iconOnly ? a.prependIcon : undefined"
            :append-icon="!a.iconOnly ? a.appendIcon : undefined"
             @click.stop="onClick(a)" :text="a.label"  
        spaced="end"></v-btn>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { hasCaps } from '@/types/ag-gird/caps'

type ValueOrFn<T> = T | ((ctx: Ctx) => T)

type BtnVariant = 'text' | 'flat' | 'elevated' | 'tonal' | 'outlined' | 'plain'
type BtnDensity = 'default' | 'comfortable' | 'compact'
type BtnSize = 'x-small' | 'small' | 'default' | 'large' | 'x-large'

interface Ctx {
  params: any
  data: any
  api: any
  node: any
}

interface RawActionDef {
  label: ValueOrFn<string>
  icon?: ValueOrFn<string>
  color?: ValueOrFn<string>
  prependIcon?: ValueOrFn<string>
  appendIcon?: ValueOrFn<string>
  variant?: ValueOrFn<BtnVariant>
  density?: ValueOrFn<BtnDensity>
  size?: ValueOrFn<BtnSize> 
  event: ValueOrFn<string>      // 클릭 시 전송할 이벤트 키
  visible?: ValueOrFn<boolean>  // 기본 true
  disabled?: ValueOrFn<boolean> // 기본 false
  requiresCaps?: number         // (선택) 비트 플래그 권한
  reasonWhenDisabled?: ValueOrFn<string>
  /** 추가: 명시적 툴팁 */
  tooltip?: ValueOrFn<string>
  /** 추가: 비활성 상태일 때 보여줄 툴팁(우선순위 높음) */
  tooltipWhenDisabled?: ValueOrFn<string>
}

interface ResolvedAction {
  key: string
  label: string
  icon?: string
  prependIcon?: string
  appendIcon?: string
  variant?: BtnVariant
  density?: BtnDensity
  size: BtnSize
  color?: string
  event: string
  disabled: boolean
  reason?: string
  tooltip?: string
  iconOnly: boolean
}

const props = defineProps<{
  params: {
    data?: Record<string, any>;
    api?: any;
    node?: any;
    column?: any;
    colDef?: {
      cellRendererParams?: {
        actions?: RawActionDef[];
        /** 상위로 직접 콜백을 전달받아 호출할 수 있게 함 */
        onAction?: (payload: { action: string; row: any; colId?: string }) => void;
        btnDefaults?: {
          variant?: BtnVariant
          density?: BtnDensity 
          size?: BtnSize
        }
      };
    };
  };
}>()

const emit = defineEmits<{
  (e: 'action', payload: { event: string; row: any }): void
}>()


/** 값이 함수면 실행, 아니면 그대로 반환 */
function resolve<T>(v: ValueOrFn<T> | undefined, ctx: Ctx, fallback?: T): T {
  if (typeof v === 'function') return (v as any)(ctx)
  return (v ?? fallback) as T
}
const visible = computed(() => {
    if (props.params.data) {
        return true;
    }
    return false;
});

const hasTextButton = computed(() =>
  resolvedActions.value.some(a => !a.iconOnly)
)

const cellStyle = computed(() => ({
  display: 'inline-flex',
  gap: '6px',
  alignItems: 'center',
}))


const resolvedActions = computed<ResolvedAction[]>(() => {

  const actions: RawActionDef[] = props.params?.colDef?.cellRendererParams?.actions ?? []
  const defaults = props.params?.colDef?.cellRendererParams?.btnDefaults ?? {}
  const ctx: Ctx = {
    params: props.params,
    data: props.params?.data,
    api: props.params?.api,
    node: props.params?.node,
  }
  
  const caps = Number(props.params?.data?.caps ?? 0)

  return actions
    .map((raw, idx) => {
      const visible = resolve<boolean>(raw.visible, ctx, true)
      if (!visible) return null

      const event = resolve<string>(raw.event, ctx, `evt-${idx}`)
      const label = resolve<string>(raw.label, ctx, event)
      const icon = resolve<string | undefined>(raw.icon, ctx, undefined)
      const prependIcon = resolve<string | undefined>(raw.prependIcon, ctx, undefined)
      const appendIcon = resolve<string | undefined>(raw.appendIcon, ctx, undefined)
      const color = resolve<string | undefined>(raw.color, ctx, undefined)

      let disabled = resolve<boolean>(raw.disabled, ctx, false)
      let reason: string | undefined = resolve<string | undefined>(raw.reasonWhenDisabled, ctx, undefined)

      // 권한 체크
      if (raw.requiresCaps != null) {
        const ok = typeof hasCaps === 'function' ? hasCaps(caps, raw.requiresCaps) : true
        if (!ok) {
          disabled = true
          reason = reason || 'Not permitted'
        }
      }

      // 툴팁 계산 (우선순위 적용)
      const baseTooltip = resolve<string | undefined>(raw.tooltip, ctx, undefined)
      const disabledTooltip = resolve<string | undefined>(raw.tooltipWhenDisabled, ctx, undefined)
      const tooltip =
        disabled
          ? (disabledTooltip ?? reason ?? baseTooltip ?? label) // 비활성 시
          : (baseTooltip ?? undefined)                         // 활성 시

      const iconOnly = !!icon && !prependIcon && !appendIcon

      const variant = resolve<BtnVariant>(raw.variant, ctx,
        (defaults.variant as BtnVariant) ?? 'text'
      )
      const density = resolve<BtnDensity>(raw.density, ctx,
        (defaults.density as BtnDensity) ?? (iconOnly ? 'compact' : 'default')
      )
      const size = resolve<BtnSize>(raw.size, ctx,
        (defaults.size as BtnSize) ?? (iconOnly ? 'small' : 'small')
      )

      return {
        key: `${event}-${idx}`,
        label,
        iconOnly,
        icon,
        prependIcon,   // 텍스트 앞 아이콘
        appendIcon,    // 텍스트 뒤 아이콘
        variant,
        density,
        color,
        event,
        disabled,
        reason,
        tooltip,
         size,
      } as ResolvedAction
    })
    .filter((x): x is ResolvedAction => !!x)
})

function onClick(a: ResolvedAction) {
  if (a.disabled) return

  const row = props.params?.data
  const colId = props.params?.column?.getColId?.()

  // 0) 상위에서 콜백을 넘겨준 경우(권장)
  const onAction = props.params?.colDef?.cellRendererParams?.onAction
  if (typeof onAction === 'function') {
    onAction({ action: a.event, row, colId })
  }

  // 1) 컴포넌트 이벤트로도 알림 (선호시 유지)
  emit('action', { event: a.event, row })

  // 2) ag-Grid 이벤트 브로드캐스트 (옵션)
  props.params?.api?.dispatchEvent?.({
    type: 'actionCellRenderer:click',
    action: a.event,
    data: row,
    colId,
  })
}

function tooltipText(a: { reason?: string; label?: string, tooltip?: string }): string {
  // reason 우선, 없으면 tooltip
  return (a.reason || a.tooltip || '').trim()
}
</script>
<style scoped>
.tooltip-activator {
  display: inline-flex;
  /* Vuetify 권장: disabled 버튼 툴팁용 */
}
.action-cell {
  display: flex;
  gap: 6px;
  align-items: center;
}
.action-cell.has-text {
  padding-top: 5px;
}
</style>