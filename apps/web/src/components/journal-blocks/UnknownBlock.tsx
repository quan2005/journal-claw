import type { JournalBlock } from '../../lib/journalLayout'

export function UnknownBlock({ block }: { block: JournalBlock }) {
  return (
    <aside className="journal-block journal-block-error" role="note">
      <div className="journal-block-error-title">Unknown layout block</div>
      <div className="journal-block-error-message">
        Line {block.sourceRange.startLine}-{block.sourceRange.endLine}: {block.name} is not in the
        Journal Layout Catalog.
      </div>
      <div className="journal-block-error-hint">Use a registered layout module name.</div>
      <pre className="journal-block-error-source">
        <code>{block.source}</code>
      </pre>
    </aside>
  )
}
