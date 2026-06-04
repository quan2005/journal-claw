import type { LayoutIssue } from '../../lib/journalLayout'

export function BlockError({ issue }: { issue: LayoutIssue }) {
  const title = `${issue.blockName ?? 'layout'} block failed`
  return (
    <aside className="journal-block journal-block-error" role="note">
      <div className="journal-block-error-title">{title}</div>
      <div className="journal-block-error-message">
        Line {issue.sourceRange.startLine}-{issue.sourceRange.endLine}: {issue.message}
      </div>
      <div className="journal-block-error-hint">{issue.hint}</div>
      {issue.source && (
        <pre className="journal-block-error-source">
          <code>{issue.source}</code>
        </pre>
      )}
    </aside>
  )
}
