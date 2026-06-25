import { describe, it, expect } from 'vitest'
import { ArtifactIndexService } from './index.js'
import { isArtifact } from '@journal/contracts'

describe('ArtifactIndexService', () => {
  it('records and retrieves an artifact by id', () => {
    const svc = new ArtifactIndexService()
    const a = svc.recordArtifact({ runId: 'r1', type: 'summary', title: 'Daily', content: '# Hi' })
    expect(isArtifact(a)).toBe(true)
    expect(svc.getArtifact(a.id)?.title).toBe('Daily')
  })

  it('lists artifacts by run', () => {
    const svc = new ArtifactIndexService()
    svc.recordArtifact({ runId: 'r1', type: 'note', title: 'a', content: 'x' })
    svc.recordArtifact({ runId: 'r1', type: 'note', title: 'b', content: 'y' })
    svc.recordArtifact({ runId: 'r2', type: 'note', title: 'c', content: 'z' })
    expect(svc.listByRun('r1')).toHaveLength(2)
    expect(svc.listByRun('r2')).toHaveLength(1)
  })

  it('lists artifacts by type', () => {
    const svc = new ArtifactIndexService()
    svc.recordArtifact({ runId: 'r1', type: 'summary', title: 's', content: 's' })
    svc.recordArtifact({ runId: 'r1', type: 'outline', title: 'o', content: 'o' })
    expect(svc.listByType('summary')).toHaveLength(1)
    expect(svc.listAll()).toHaveLength(2)
  })

  it('captureFromRun indexes <artifact> tags from assistant text', () => {
    const svc = new ArtifactIndexService()
    const text = 'Before\n<artifact type="report" title="Q2 Review">## Findings\nblah</artifact>\nAfter'
    const recorded = svc.captureFromRun('r1', text)
    expect(recorded).toHaveLength(1)
    expect(recorded[0].type).toBe('report')
    expect(recorded[0].title).toBe('Q2 Review')
    expect(recorded[0].content).toContain('Findings')
    expect(svc.listByRun('r1')).toHaveLength(1)
  })

  it('captureFromRun handles multiple artifacts and missing close tag', () => {
    const svc = new ArtifactIndexService()
    const text =
      '<artifact type="todo" title="Tasks">- a</artifact>\n<artifact title="No close">content'
    const recorded = svc.captureFromRun('r1', text)
    expect(recorded).toHaveLength(2)
    expect(recorded[0].type).toBe('todo')
    expect(recorded[1].title).toBe('No close')
    expect(recorded[1].content).toBe('content')
  })

  it('captureFromRun returns nothing when no tags present', () => {
    const svc = new ArtifactIndexService()
    expect(svc.captureFromRun('r1', 'just plain text')).toHaveLength(0)
  })
})
