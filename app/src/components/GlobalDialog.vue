<template>
  <Teleport to="body">
    <!-- 确认弹窗 -->
    <Transition name="dialog-fade">
      <div v-if="confirmState.show" class="dialog-overlay" @click.self="cancelConfirm">
        <div class="dialog-box">
          <h3 class="dialog-title">{{ confirmState.title }}</h3>
          <p class="dialog-message">{{ confirmState.message }}</p>
          <div class="dialog-actions">
            <button class="dialog-btn cancel" @click="cancelConfirm">{{ confirmState.cancelText }}</button>
            <button class="dialog-btn confirm" :class="{ danger: confirmState.danger }" @click="confirmConfirm">{{ confirmState.confirmText }}</button>
          </div>
        </div>
      </div>
    </Transition>

    <!-- 提示弹窗 -->
    <Transition name="dialog-fade">
      <div v-if="alertState.show" class="dialog-overlay" @click.self="closeAlert">
        <div class="dialog-box">
          <h3 class="dialog-title">{{ alertState.title }}</h3>
          <p class="dialog-message">{{ alertState.message }}</p>
          <div class="dialog-actions">
            <button class="dialog-btn confirm" @click="closeAlert">知道了</button>
          </div>
        </div>
      </div>
    </Transition>

    <!-- Toast 通知 -->
    <Transition name="toast-slide">
      <div v-if="toastState.show" class="toast-container" :class="toastState.type">
        <span class="toast-icon">{{ toastIcon }}</span>
        <span class="toast-message">{{ toastState.message }}</span>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref } from 'vue'

// ========== 确认弹窗 ==========
const confirmState = ref({
  show: false,
  title: '确认操作',
  message: '',
  confirmText: '确认',
  cancelText: '取消',
  danger: false,
  resolve: null as ((value: boolean) => void) | null,
})

const showConfirm = (options: {
  title?: string
  message: string
  confirmText?: string
  cancelText?: string
  danger?: boolean
}): Promise<boolean> => {
  return new Promise((resolve) => {
    confirmState.value = {
      show: true,
      title: options.title || '确认操作',
      message: options.message,
      confirmText: options.confirmText || '确认',
      cancelText: options.cancelText || '取消',
      danger: options.danger || false,
      resolve,
    }
  })
}

const confirmConfirm = () => {
  confirmState.value.show = false
  confirmState.value.resolve?.(true)
}

const cancelConfirm = () => {
  confirmState.value.show = false
  confirmState.value.resolve?.(false)
}

// ========== 提示弹窗 ==========
const alertState = ref({ show: false, title: '提示', message: '' })

const showAlert = (title: string, message: string) => {
  alertState.value = { show: true, title, message }
}

const closeAlert = () => {
  alertState.value.show = false
}

// ========== Toast ==========
const toastState = ref({ show: false, message: '', type: 'info' as 'info' | 'success' | 'error' | 'warn' })
let toastTimer: ReturnType<typeof setTimeout> | null = null

const toastIcons = { info: 'ℹ', success: '✓', error: '✕', warn: '⚠' }
const toastIcon = ref('ℹ')

const showToast = (message: string, type: 'info' | 'success' | 'error' | 'warn' = 'info', duration = 2500) => {
  if (toastTimer) clearTimeout(toastTimer)
  toastIcon.value = toastIcons[type]
  toastState.value = { show: true, message, type }
  toastTimer = setTimeout(() => {
    toastState.value.show = false
  }, duration)
}

// 导出供全局使用
defineExpose({ showConfirm, showAlert, showToast })
</script>

<style scoped>
.dialog-overlay {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(33, 26, 77, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
}

.dialog-box {
  background: linear-gradient(160deg, #FFFFFF 0%, #FDF7FC 100%);
  border-radius: var(--radius-xl);
  padding: 28px 32px;
  min-width: 340px;
  max-width: 460px;
  box-shadow: 0 16px 48px rgba(183, 148, 246, 0.25);
  border: 1px solid rgba(255, 192, 213, 0.45);
  position: relative;
  overflow: hidden;
}
.dialog-box::before {
  content: '';
  position: absolute;
  top: 0; left: 0; right: 0;
  height: 3px;
  background: var(--gradient-pink-purple);
}

.dialog-title {
  font-size: 16px;
  font-weight: 700;
  color: #3A2D54;
  margin-bottom: 12px;
}

.dialog-message {
  font-size: 14px;
  color: #6B6B96;
  line-height: 1.6;
  margin-bottom: 24px;
}

.dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

.dialog-btn {
  height: 38px;
  padding: 0 20px;
  border-radius: var(--radius-pill);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  border: 1.5px solid rgba(255, 192, 213, 0.6);
  transition: all 0.15s;
}

.dialog-btn.cancel {
  background: white;
  color: #6B6B96;
}
.dialog-btn.cancel:hover {
  background: #FAF6FD;
  border-color: var(--color-pink);
  color: var(--color-pink);
}

.dialog-btn.confirm {
  background: linear-gradient(135deg, #FF6B9D 0%, #B794F6 100%);
  color: white;
  border: none;
}
.dialog-btn.confirm:hover {
  transform: translateY(-1px);
  box-shadow: 0 6px 16px rgba(255, 107, 157, 0.35);
}

.dialog-btn.confirm.danger {
  background: linear-gradient(135deg, #e74c3c 0%, #c0392b 100%);
}
.dialog-btn.confirm.danger:hover {
  box-shadow: 0 6px 16px rgba(231, 76, 60, 0.35);
}

/* Toast */
.toast-container {
  position: fixed;
  top: 24px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 24px;
  border-radius: 12px;
  font-size: 13px;
  font-weight: 600;
  z-index: 10001;
  box-shadow: 0 8px 24px rgba(33, 26, 77, 0.15);
}

.toast-container.info {
  background: rgba(66, 146, 245, 0.95);
  color: white;
}
.toast-container.success {
  background: rgba(38, 208, 168, 0.95);
  color: white;
}
.toast-container.error {
  background: rgba(231, 76, 60, 0.95);
  color: white;
}
.toast-container.warn {
  background: rgba(243, 156, 18, 0.95);
  color: white;
}

.toast-icon {
  font-size: 16px;
}

/* Transitions */
.dialog-fade-enter-active, .dialog-fade-leave-active {
  transition: opacity 0.2s ease;
}
.dialog-fade-enter-from, .dialog-fade-leave-to {
  opacity: 0;
}

.toast-slide-enter-active, .toast-slide-leave-active {
  transition: all 0.3s ease;
}
.toast-slide-enter-from {
  opacity: 0;
  transform: translateX(-50%) translateY(-20px);
}
.toast-slide-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(-20px);
}
</style>
