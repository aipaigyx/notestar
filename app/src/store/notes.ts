// ========== Store - 笔记 / 课程域 ==========
// 职责：笔记 CRUD、回收站、课程 CRUD、课程内笔记查询。
// 依赖：只 import core 的 notes/courses/currentNote/hasElectron/frontendLogger（无环）。
import type { Note, Course } from '../types'
import { notes, courses, currentNote, hasElectron, frontendLogger } from './core'

// ========== 笔记操作 ==========
export async function createNote(title: string, courseId: string, tags: string[], content: string): Promise<Note> {
  const note: Partial<Note> = {
    title, courseId, tags, content,
    paragraphs: content.split('\n').filter(l => l.trim()).length,
  }
  if (hasElectron) {
    try {
      const saved = await window.noteAPI.saveNote(note)
      notes.value.unshift(saved)
      return saved
    } catch (err) {
      frontendLogger.error('Store', '笔记创建失败', err)
      throw err
    }
  } else {
    const newNote: Note = {
      ...(note as Note),
      id: 'n' + Date.now(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    notes.value.unshift(newNote)
    localStorage.setItem('notes', JSON.stringify(notes.value))
    return newNote
  }
}

export async function updateNote(note: Note): Promise<Note> {
  note.paragraphs = note.content.split('\n').filter(l => l.trim()).length
  if (hasElectron) {
    // 深拷贝为纯对象，避免 Vue Proxy 无法被 IPC structuredClone
    const plainNote = JSON.parse(JSON.stringify(note))
    const saved = await window.noteAPI.saveNote(plainNote)
    const idx = notes.value.findIndex(n => n.id === note.id)
    if (idx >= 0) notes.value[idx] = saved
    return saved
  } else {
    note.updatedAt = new Date().toISOString()
    const idx = notes.value.findIndex(n => n.id === note.id)
    if (idx >= 0) notes.value[idx] = note
    localStorage.setItem('notes', JSON.stringify(notes.value))
    return note
  }
}

export async function removeNote(id: string) {
  if (hasElectron) {
    await window.noteAPI.deleteNote(id)
  } else {
    notes.value = notes.value.filter(n => n.id !== id)
    localStorage.setItem('notes', JSON.stringify(notes.value))
  }
  // 无论 Electron 还是浏览器模式，都必须同步更新内存列表，否则删除后界面不刷新
  notes.value = notes.value.filter(n => n.id !== id)
  if (currentNote.value?.id === id) currentNote.value = null
}

// ========== 回收站 ==========
// 已删除笔记列表
export async function getDeletedNotes(): Promise<Note[]> {
  if (hasElectron) {
    return await window.noteAPI.getDeletedNotes()
  } else {
    return notes.value.filter(n => (n as any).deletedAt)
  }
}

// 恢复笔记
export async function restoreNote(id: string): Promise<boolean> {
  if (hasElectron) {
    await window.noteAPI.restoreNote(id)
  } else {
    const note = notes.value.find(n => n.id === id)
    if (note) { delete (note as any).deletedAt; localStorage.setItem('notes', JSON.stringify(notes.value)) }
  }
  // 同步内存：从回收站恢复（若在内存中则清除标记）
  const note = notes.value.find(n => n.id === id)
  if (note) delete (note as any).deletedAt
  return true
}

// 永久删除（不可恢复）
export async function purgeNote(id: string): Promise<boolean> {
  if (hasElectron) {
    await window.noteAPI.purgeNote(id)
  } else {
    notes.value = notes.value.filter(n => n.id !== id)
    localStorage.setItem('notes', JSON.stringify(notes.value))
  }
  notes.value = notes.value.filter(n => n.id !== id)
  if (currentNote.value?.id === id) currentNote.value = null
  return true
}

// ========== 课程操作 ==========
export async function createCourse(name: string, color: string): Promise<Course> {
  const course: Partial<Course> = { name, color }
  if (hasElectron) {
    try {
      const saved = await window.noteAPI.saveCourse(course)
      courses.value.push(saved)
      return saved
    } catch (err) {
      frontendLogger.error('Store', '课程创建失败', err)
      throw err
    }
  } else {
    const newCourse: Course = {
      ...(course as Course),
      id: 'c' + Date.now(),
      noteCount: 0,
      active: false,
    }
    courses.value.push(newCourse)
    localStorage.setItem('courses', JSON.stringify(courses.value))
    return newCourse
  }
}

export async function deleteCourse(id: string) {
  if (hasElectron) {
    await window.noteAPI.deleteCourse(id)
  } else {
    courses.value = courses.value.filter(c => c.id !== id)
    localStorage.setItem('courses', JSON.stringify(courses.value))
  }
  // 同步更新内存列表，避免界面不刷新
  courses.value = courses.value.filter(c => c.id !== id)
}

export function getCourseById(id: string): Course | undefined {
  return courses.value.find(c => c.id === id)
}

export function getNotesByCourse(courseId: string): Note[] {
  return notes.value.filter(n => n.courseId === courseId)
}