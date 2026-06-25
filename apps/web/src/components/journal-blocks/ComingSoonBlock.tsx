import type { JournalBlock } from '../../lib/journalLayout'

export function ComingSoonBlock({ block }: { block: JournalBlock }) {
  return (
    <aside className="journal-block journal-block-coming-soon" role="note">
      <div className="journal-block-kicker">{block.name}</div>
      <div className="journal-block-coming-title">{block.name} layout block is registered</div>
      <div className="journal-block-coming-body">
        This module is recognized by the catalog and will render as a dedicated Journal block when
        its renderer is enabled.
      </div>
    </aside>
  )
}
