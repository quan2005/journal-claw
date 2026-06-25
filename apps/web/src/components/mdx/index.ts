// Layout
export { Columns, Column } from './layout'

// Display
export { ProsCons, Stat, StatGroup } from './display'
export { Table } from './display'
export { TagList } from './display'

// Callout & Quote
export { RelatedEntry, RelatedIdentity } from './callout'

// Cards & Lists
export { Kanban } from './cards'
export { Counter } from './cards'
export { RatingBar } from './cards'
export { Stack } from './cards'

// Media
export { ImageViewer, FileCard } from './media'

// Charts (lazy)
export { BarChart, LineChart, PieChart, RadarChart } from './charts'

// Mermaid (lazy)
export { Mermaid } from './mermaid'

// Math
export { InlineMath, BlockMath } from './math'

// Typography
export { Section, Subtitle, Label, Divider } from './typography'

// Preview
export { HtmlPreview } from './html-preview'

// Error handling & fault-tolerant rendering
export { ErrorCard } from './ErrorCard'
export { DegradationBadge } from './DegradationBadge'
export { BlockErrorBoundary } from './BlockErrorBoundary'
export { BlockRenderer } from './BlockRenderer'

// Grid & Flow
export { Grid, Flow } from './grid'

// Semantic journal components
export {
  DecisionRecord,
  StatusBadge,
  ComparisonMatrix,
  RACI,
  MilestoneTimeline,
  InsightCard,
} from './semantic'

// Sources and transcripts
export { SourceCard, ReferenceList, CopyButton } from './source'

// Canonical directive-parity layout components
export * from './layout/index'

// ── Component map ─────────────────────────────────────────

import { Columns, Column } from './layout'
import { ProsCons, Stat, StatGroup, Table, TagList } from './display'
import { RelatedEntry, RelatedIdentity } from './callout'
import { Kanban, Counter, RatingBar, Stack } from './cards'
import { ImageViewer, FileCard } from './media'
import { BarChart, LineChart, PieChart, RadarChart } from './charts'
import { Mermaid } from './mermaid'
import { InlineMath, BlockMath } from './math'
import { Section, Subtitle, Label, Divider } from './typography'
import { HtmlPreview } from './html-preview'
import { Grid, Flow } from './grid'
import {
  DecisionRecord,
  StatusBadge,
  ComparisonMatrix,
  RACI,
  MilestoneTimeline,
  InsightCard,
} from './semantic'
import { SourceCard, ReferenceList, CopyButton } from './source'
import * as LayoutComponents from './layout/index'

export const mdxComponents = {
  Columns,
  Column,
  ProsCons,
  Stat,
  StatGroup,
  Table,
  TagList,
  RelatedEntry,
  RelatedIdentity,
  Kanban,
  Counter,
  RatingBar,
  Stack,
  ImageViewer,
  FileCard,
  BarChart,
  LineChart,
  PieChart,
  RadarChart,
  Mermaid,
  InlineMath,
  BlockMath,
  Section,
  Subtitle,
  Label,
  Divider,
  HtmlPreview,
  Grid,
  Flow,
  DecisionRecord,
  StatusBadge,
  ComparisonMatrix,
  RACI,
  MilestoneTimeline,
  InsightCard,
  SourceCard,
  ReferenceList,
  CopyButton,
  ...LayoutComponents,
}
