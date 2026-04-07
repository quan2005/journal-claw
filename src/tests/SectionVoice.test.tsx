import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import SectionVoice from '../settings/components/SectionVoice'
import { renderWithProviders as render } from './setup'

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

const mockCheckWhisperkitCliInstalled = vi.fn()
const mockInstallWhisperkitCli = vi.fn()
const mockGetAppleSttVariant = vi.fn()
const mockGetSpeakerProfiles = vi.fn()
const mockUpdateSpeakerName = vi.fn()
const mockDeleteSpeakerProfile = vi.fn()
const mockMergeSpeakerProfiles = vi.fn()
const mockCheckSpeakerEmbedder = vi.fn()

vi.mock('../lib/tauri', () => ({
  getAsrConfig: (...args: unknown[]) => mockGetAsrConfig(...args),
  setAsrConfig: (...args: unknown[]) => mockSetAsrConfig(...args),
  getWhisperkitModelsDir: (...args: unknown[]) => mockGetWhisperkitModelsDir(...args),
  checkWhisperkitModelDownloaded: (...args: unknown[]) => mockCheckWhisperkitModelDownloaded(...args),
  downloadWhisperkitModel: (...args: unknown[]) => mockDownloadWhisperkitModel(...args),
  checkWhisperkitCliInstalled: (...args: unknown[]) => mockCheckWhisperkitCliInstalled(...args),
  installWhisperkitCli: (...args: unknown[]) => mockInstallWhisperkitCli(...args),
  getAppleSttVariant: (...args: unknown[]) => mockGetAppleSttVariant(...args),
  getSpeakerProfiles: (...args: unknown[]) => mockGetSpeakerProfiles(...args),
  updateSpeakerName: (...args: unknown[]) => mockUpdateSpeakerName(...args),
  deleteSpeakerProfile: (...args: unknown[]) => mockDeleteSpeakerProfile(...args),
  mergeSpeakerProfiles: (...args: unknown[]) => mockMergeSpeakerProfiles(...args),
  checkSpeakerEmbedder: (...args: unknown[]) => mockCheckSpeakerEmbedder(...args),
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

/** Wait for the component to finish loading (skeleton disappears, cards appear) */
async function waitForLoaded() {
  await screen.findByText('Small')
}

/** Click a model card by its label text */
function clickModelCard(label: string) {
  fireEvent.click(screen.getByText(label).closest('div[style]')!)
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
    mockCheckWhisperkitCliInstalled.mockResolvedValue(true)
    mockInstallWhisperkitCli.mockResolvedValue(undefined)
    mockDownloadWhisperkitModel.mockResolvedValue(undefined)
    mockGetAppleSttVariant.mockResolvedValue('default')
    mockGetSpeakerProfiles.mockResolvedValue([])
    mockUpdateSpeakerName.mockResolvedValue(undefined)
    mockDeleteSpeakerProfile.mockResolvedValue(undefined)
    mockMergeSpeakerProfiles.mockResolvedValue(undefined)
    mockCheckSpeakerEmbedder.mockResolvedValue({ available: true })
    mockInvoke.mockResolvedValue(undefined)
  })

  it('shows downloaded marker after the model name instead of a prefix checkmark', async () => {
    downloadedModels.add('small')

    render(<SectionVoice />)
    await waitForLoaded()

    // downloadedModels state is populated via refreshDownloadedModels (triggered by download events)
    // Simulate a download completion to trigger the refresh
    emitDownloadEvent({ model: 'small', status: 'done' })

    // The "已下载" text should appear for the Small model
    expect((await screen.findAllByText('已下载')).length).toBeGreaterThan(0)
  })

  it('keeps the download panel visible when switching to another model during download', async () => {
    render(<SectionVoice />)
    await waitForLoaded()

    // Models render in order: base(0), small(1), large-v3-turbo(2)
    const downloadButtons = screen.getAllByText('下载')
    fireEvent.click(downloadButtons[1]) // small

    expect(mockDownloadWhisperkitModel).toHaveBeenCalledWith('small')
    expect(screen.getByText('模型下载任务')).toBeTruthy()
    expect(screen.getAllByText('Small').length).toBeGreaterThan(0)

    emitDownloadEvent({
      model: 'small',
      status: 'downloading',
      message: '正在从 HuggingFace 拉取模型…',
    })

    expect(screen.getAllByText('正在从 HuggingFace 拉取模型…').length).toBeGreaterThan(0)

    // Switch to large-v3-turbo by clicking its card
    clickModelCard('Large v3 Turbo')

    expect(screen.getByText('有未保存修改')).toBeTruthy()
    expect(mockSetAsrConfig).not.toHaveBeenCalled()

    // Download panel should still be visible showing Small
    expect(screen.getByText('模型下载任务')).toBeTruthy()

    downloadedModels.add('small')
    emitDownloadEvent({
      model: 'small',
      status: 'done',
    })

    // Success message should appear
    const successTexts = await screen.findAllByText(/Small.*已下载/)
    expect(successTexts.length).toBeGreaterThan(0)
  })

  it('persists model changes only when save is clicked', async () => {
    render(<SectionVoice />)
    await waitForLoaded()

    const saveButton = screen.getByRole('button', { name: '保存' }) as HTMLButtonElement
    expect(saveButton.disabled).toBe(true)

    // Switch to large-v3-turbo by clicking its card
    clickModelCard('Large v3 Turbo')

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
    await waitForLoaded()

    // Click the download button for large-v3-turbo
    const downloadButtons = screen.getAllByText('下载')
    fireEvent.click(downloadButtons[downloadButtons.length - 1])

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
