// Layout
export { Split, Columns, Column, MacPreview, Placeholder } from './layout'

// Display
export { ProsCons, Pros, Cons, Stat, StatGroup } from './display'
export { Table } from './display'
export { TagList } from './display'
export { Progress } from './display'
export { Avatar, AvatarGroup } from './display'

// Callout & Quote
export { RelatedEntry, RelatedIdentity } from './callout'

// Cards & Lists
export { Options, Option } from './cards'
export { Kanban } from './cards'
export { Counter } from './cards'
export { RatingBar } from './cards'
export { Stack } from './cards'

// Media
export { AudioCard, VideoCard, ImageViewer, FileCard } from './media'

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
export { PhonePreview, useDeviceDensity } from './device-mockups'

// Grid & Flow
export { Grid, Col, Flow } from './grid'

// Semantic journal components
export {
  ActionTable,
  DecisionRecord,
  DecisionList,
  RiskMatrix,
  StatusBadge,
  ComparisonMatrix,
  OptionMatrix,
  RACI,
  MilestoneTimeline,
  IncidentTimeline,
  InsightCard,
  EvidenceCard,
} from './semantic'

// Sources and transcripts
export { SourceCard, ReferenceList, Transcript, TimestampLink, CopyButton } from './source'

// Canonical directive-parity layout components
export * from './layout/index'

// ── Component map ─────────────────────────────────────────

import { Split, Columns, Column, MacPreview, Placeholder } from './layout'
import {
  ProsCons,
  Pros,
  Cons,
  Stat,
  StatGroup,
  Table,
  TagList,
  Progress,
  Avatar,
  AvatarGroup,
} from './display'
import { RelatedEntry, RelatedIdentity } from './callout'
import { Options, Option, Kanban, Counter, RatingBar, Stack } from './cards'
import { AudioCard, VideoCard, ImageViewer, FileCard } from './media'
import { BarChart, LineChart, PieChart, RadarChart } from './charts'
import { Mermaid } from './mermaid'
import { InlineMath, BlockMath } from './math'
import { Section, Subtitle, Label, Divider } from './typography'
import { HtmlPreview } from './html-preview'
import { PhonePreview } from './device-mockups'
import { Grid, Col, Flow } from './grid'
import {
  ActionTable,
  DecisionRecord,
  DecisionList,
  RiskMatrix,
  StatusBadge,
  ComparisonMatrix,
  OptionMatrix,
  RACI,
  MilestoneTimeline,
  IncidentTimeline,
  InsightCard,
  EvidenceCard,
} from './semantic'
import { SourceCard, ReferenceList, Transcript, TimestampLink, CopyButton } from './source'
import * as LayoutComponents from './layout/index'

export const mdxComponents = {
  Split,
  Columns,
  Column,
  MacPreview,
  Placeholder,
  ProsCons,
  Pros,
  Cons,
  Stat,
  StatGroup,
  Table,
  TagList,
  Progress,
  Avatar,
  AvatarGroup,
  RelatedEntry,
  RelatedIdentity,
  Options,
  Option,
  Kanban,
  Counter,
  RatingBar,
  Stack,
  AudioCard,
  VideoCard,
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
  PhonePreview,
  Grid,
  Col,
  Flow,
  ActionTable,
  DecisionRecord,
  DecisionList,
  RiskMatrix,
  StatusBadge,
  ComparisonMatrix,
  OptionMatrix,
  RACI,
  MilestoneTimeline,
  IncidentTimeline,
  InsightCard,
  EvidenceCard,
  SourceCard,
  ReferenceList,
  Transcript,
  TimestampLink,
  CopyButton,
  ...LayoutComponents,
}
