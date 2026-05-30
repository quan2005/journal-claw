export function AutomationWorkbench({
  onOpenConversation: _onOpenConversation,
}: {
  onOpenConversation: (sessionId: string) => void
}) {
  return (
    <div style={{ padding: 28, color: 'var(--item-text)' }}>
      <div style={{ fontSize: 13, color: 'var(--month-label)', marginBottom: 8 }}>
        Automation Workbench
      </div>
      <h2 style={{ fontSize: 22, margin: 0 }}>自动化工作台</h2>
    </div>
  )
}
