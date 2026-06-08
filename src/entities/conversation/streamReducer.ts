import type {
  AppError,
  ConversationEvent,
  TokenUsage,
  TurnStats,
} from '../../shared/protocol/appEvent'

export type ConversationBlock =
  | { type: 'text'; content: string }
  | { type: 'thinking'; content: string }
  | {
      type: 'tool'
      toolCallId: string
      name: string
      label: string
      input?: Record<string, unknown>
      output?: string
      isError?: boolean
    }
  | { type: 'artifact'; artifactId: string; content: string; isStreaming: boolean }
  | { type: 'error'; error: AppError }

export interface ConversationTurnState {
  turnId: string
  status: 'streaming' | 'finished' | 'failed'
  blocks: ConversationBlock[]
  stats?: TurnStats
}

export interface ConversationStreamState {
  sessionId: string
  turns: ConversationTurnState[]
  usage: TokenUsage
}

export function createConversationStreamState(sessionId: string): ConversationStreamState {
  return {
    sessionId,
    turns: [],
    usage: { inputTokens: 0, outputTokens: 0 },
  }
}

function ensureTurn(state: ConversationStreamState, turnId: string): ConversationStreamState {
  if (state.turns.some((turn) => turn.turnId === turnId)) return state
  return {
    ...state,
    turns: [...state.turns, { turnId, status: 'streaming', blocks: [] }],
  }
}

function updateTurn(
  state: ConversationStreamState,
  turnId: string,
  updater: (turn: ConversationTurnState) => ConversationTurnState,
): ConversationStreamState {
  const withTurn = ensureTurn(state, turnId)
  return {
    ...withTurn,
    turns: withTurn.turns.map((turn) => (turn.turnId === turnId ? updater(turn) : turn)),
  }
}

function activeTurnId(state: ConversationStreamState): string {
  return state.turns[state.turns.length - 1]?.turnId ?? 'unknown'
}

function appendTextBlock(blocks: ConversationBlock[], content: string): ConversationBlock[] {
  const last = blocks[blocks.length - 1]
  if (last?.type === 'text') {
    return [...blocks.slice(0, -1), { ...last, content: last.content + content }]
  }
  return [...blocks, { type: 'text', content }]
}

function appendThinkingBlock(blocks: ConversationBlock[], content: string): ConversationBlock[] {
  const last = blocks[blocks.length - 1]
  if (last?.type === 'thinking') {
    return [...blocks.slice(0, -1), { ...last, content: last.content + content }]
  }
  return [...blocks, { type: 'thinking', content }]
}

function appendArtifactDelta(
  blocks: ConversationBlock[],
  artifactId: string,
  delta: string,
): ConversationBlock[] {
  const existingIndex = blocks.findIndex(
    (block) => block.type === 'artifact' && block.artifactId === artifactId,
  )
  if (existingIndex >= 0) {
    return blocks.map((block, index) =>
      index === existingIndex && block.type === 'artifact'
        ? { ...block, content: block.content + delta }
        : block,
    )
  }
  return [...blocks, { type: 'artifact', artifactId, content: delta, isStreaming: true }]
}

export function conversationStreamReducer(
  state: ConversationStreamState,
  event: ConversationEvent,
): ConversationStreamState {
  if (event.sessionId !== state.sessionId) return state

  switch (event.kind) {
    case 'turn_started':
      return ensureTurn(state, event.turnId)
    case 'text_delta':
      return updateTurn(state, event.turnId, (turn) => ({
        ...turn,
        blocks: appendTextBlock(turn.blocks, event.delta),
      }))
    case 'thinking_delta':
      return updateTurn(state, event.turnId, (turn) => ({
        ...turn,
        blocks: appendThinkingBlock(turn.blocks, event.delta),
      }))
    case 'tool_started':
      return updateTurn(state, event.turnId, (turn) => ({
        ...turn,
        blocks: [
          ...turn.blocks,
          {
            type: 'tool',
            toolCallId: event.toolCall.id,
            name: event.toolCall.name,
            label: event.toolCall.label,
            input: event.toolCall.input,
          },
        ],
      }))
    case 'tool_finished':
      return updateTurn(state, event.turnId, (turn) => ({
        ...turn,
        blocks: turn.blocks.map((block) =>
          block.type === 'tool' && block.toolCallId === event.toolCallId
            ? { ...block, output: event.output.content, isError: event.output.isError }
            : block,
        ),
      }))
    case 'artifact_delta':
      return updateTurn(state, event.turnId, (turn) => ({
        ...turn,
        blocks: appendArtifactDelta(turn.blocks, event.artifactId, event.delta),
      }))
    case 'artifact_finished':
      return updateTurn(state, event.turnId, (turn) => ({
        ...turn,
        blocks: turn.blocks.map((block) =>
          block.type === 'artifact' && block.artifactId === event.artifactId
            ? { ...block, isStreaming: false }
            : block,
        ),
      }))
    case 'failed':
      return updateTurn(state, activeTurnId(state), (turn) => ({
        ...turn,
        status: 'failed',
        blocks: [...turn.blocks, { type: 'error', error: event.error }],
      }))
    case 'turn_finished':
      return updateTurn(state, activeTurnId(state), (turn) => ({
        ...turn,
        status: 'finished',
        stats: event.stats,
      }))
    case 'usage':
      return { ...state, usage: event.usage }
  }
}
