// 全局弹窗/通知工具 — 替代 Electron 中不可用的 confirm()/alert()
import { ref, type App } from 'vue'

interface ConfirmOptions {
  title?: string
  message: string
  confirmText?: string
  cancelText?: string
  danger?: boolean
}

const dialogRef = ref<{
  showConfirm: (opts: ConfirmOptions) => Promise<boolean>
  showAlert: (title: string, message: string) => void
  showToast: (message: string, type?: 'info' | 'success' | 'error' | 'warn', duration?: number) => void
} | null>(null)

export function setDialogRef(ref: any) {
  dialogRef.value = ref
}

export function showConfirm(options: ConfirmOptions | string): Promise<boolean> {
  if (typeof options === 'string') {
    options = { message: options }
  }
  if (dialogRef.value) {
    return dialogRef.value.showConfirm(options)
  }
  // Fallback: 原生 confirm（浏览器环境）
  return Promise.resolve(window.confirm(options.message))
}

export function showAlert(title: string, message?: string) {
  if (message === undefined) {
    message = title
    title = '提示'
  }
  if (dialogRef.value) {
    dialogRef.value.showAlert(title, message)
  } else {
    window.alert(message)
  }
}

export function showToast(message: string, type: 'info' | 'success' | 'error' | 'warn' = 'info', duration = 2500) {
  if (dialogRef.value) {
    dialogRef.value.showToast(message, type, duration)
  }
}
