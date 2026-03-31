import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import SectionVoice from '../settings/components/SectionVoice'

type WhisperModel = 'base' | 'small' | 'large-v3-turbo'
type DownloadPayload = {
  model: WhisperModel
  status: 'downloading' | 'done' | 'error'
  message?: string
}

const mockGetAsrConfig = vi.fn()
const mockSetAsrConfig = vi.fn()
const mockGetWhisperkitModelsDir = vi.fn()
const mockCheckWhisperkitModelDownloaded = vi.fn()
const mockDownloadWhisperkitModel = vi.fn()
const mockInvoke = vi.fn()

let downloadedModels = new Set<WhisperModel>(['base'])
let downloadListener: ((event: { payload: DownloadPayload }) => void) | null = null

vi.mock('../lib/tauri', () => ({
  getAsrConfig: (...args: unknown[]) => mockGetAsrConfig(...args),
  setAsrConfig: (...args: unknown[]) => mockSetAsrConfig(...args),
  getWhisperkitModelsDir: (...args: unknown[]) => mockGetWhisperkitModelsDir(...args),
  checkWhisperkitModelDownloaded: (...args: unknown[]) => mockCheckWhisperkitModelDownloaded(...args),
  downloadWhisperkitModel: (...args: unknown[]) => mockDownloadWhisperkitModel(...args),
}))

vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: unknown[]) => mockInvoke(...args),
}))

vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn((eventName: string, cb: (event: { payload: DownloadPayload }) => void) => {
    if (eventName === 'whisperkit-download-progress') {
      downloadListener = cb
    }
    return Promise.resolve(() => {
      if (downloadListener === cb) {
        downloadListener = null
      }
    })
  }),
}))

function emitDownloadEvent(payload: DownloadPayload) {
  act(() => {
    downloadListener?.({ payload })
  })
}

describe('SectionVoice', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    downloadListener = null
    downloadedModels = new Set<WhisperModel>(['base'])

    mockGetAsrConfig.mockResolvedValue({
      asr_engine: 'whisperkit',
      dashscope_api_key: '',
      whisperkit_model: 'small',
    })
    mockSetAsrConfig.mockResolvedValue(undefined)
    mockGetWhisperkitModelsDir.mockResolvedValue('/tmp/whisperkit-models')
    mockCheckWhisperkitModelDownloaded.mockImplementation(async (model: WhisperModel) => downloadedModels.has(model))
    mockDownloadWhisperkitModel.mockResolvedValue(undefined)
    mockInvoke.mockResolvedValue(undefined)
  })

  it('shows downloaded marker after the model name instead of a prefix checkmark', async () => {
    downloadedModels.add('small')

    render(<SectionVoice />)

    await screen.findByRole('combobox')

    expect(screen.getByRole('option', { name: 'Small (~244MB，已下载)' })).toBeTruthy()
    expect(screen.queryByRole('option', { name: /^✓/ })).toBeNull()
  })

  it('keeps the download panel visible when switching to another model during download', async () => {
    render(<SectionVoice />)

    await screen.findByRole('combobox')

    fireEvent.click(screen.getByRole('button', { name: '下载模型' }))

    expect(mockDownloadWhisperkitModel).toHaveBeenCalledWith('small')
    expect(screen.getByText('模型下载任务')).toBeTruthy()
    expect(screen.getByText('Small 模型')).toBeTruthy()

    emitDownloadEvent({
      model: 'small',
      status: 'downloading',
      message: '正在从 HuggingFace 拉取模型…',
    })

    expect(screen.getAllByText('正在从 HuggingFace 拉取模型…').length).toBeGreaterThan(0)

    fireEvent.change(screen.getByRole('combobox'), {
      target: { value: 'large-v3-turbo' },
    })

    expect(screen.getByText('有未保存修改')).toBeTruthy()
    expect(mockSetAsrConfig).not.toHaveBeenCalled()

    expect(screen.getByText('Small 模型')).toBeTruthy()
    expect(screen.getByRole('button', { name: '稍候下载' })).toHaveProperty('disabled', true)

    downloadedModels.add('small')
    emitDownloadEvent({
      model: 'small',
      status: 'done',
    })

    expect((await screen.findAllByText('Small 模型已下载，可离线使用')).length).toBeGreaterThan(0)
  })

  it('persists model changes only when save is clicked', async () => {
    render(<SectionVoice />)

    await screen.findByRole('combobox')

    const saveButton = screen.getByRole('button', { name: '保存' }) as HTMLButtonElement
    expect(saveButton.disabled).toBe(true)

    fireEvent.change(screen.getByRole('combobox'), {
      target: { value: 'large-v3-turbo' },
    })

    expect(screen.getByText('有未保存修改')).toBeTruthy()
    expect(saveButton.disabled).toBe(false)
    expect(mockSetAsrConfig).not.toHaveBeenCalled()

    fireEvent.click(saveButton)

    await waitFor(() => {
      expect(mockSetAsrConfig).toHaveBeenCalledWith({
        asr_engine: 'whisperkit',
        dashscope_api_key: '',
        whisperkit_model: 'large-v3-turbo',
      })
    })

    expect(await screen.findByText('已保存')).toBeTruthy()
  })

  it('shows retry action after a download failure', async () => {
    mockGetAsrConfig.mockResolvedValue({
      asr_engine: 'whisperkit',
      dashscope_api_key: '',
      whisperkit_model: 'large-v3-turbo',
    })

    render(<SectionVoice />)

    await screen.findByRole('combobox')

    fireEvent.click(screen.getByRole('button', { name: '下载模型' }))

    emitDownloadEvent({
      model: 'large-v3-turbo',
      status: 'error',
      message: '下载失败，请检查网络连接后重试。',
    })

    expect((await screen.findAllByText('下载失败，请检查网络连接后重试。')).length).toBeGreaterThan(0)

    fireEvent.click(screen.getByRole('button', { name: '重新下载' }))

    expect(mockDownloadWhisperkitModel).toHaveBeenCalledTimes(2)
    expect(mockDownloadWhisperkitModel).toHaveBeenLastCalledWith('large-v3-turbo')
  })
})
