// Layout
export { Split, Columns, Column, Mockup, Placeholder } from './layout'

// Display
export { ProsCons, Stat, StatGroup } from './display'
export { Table } from './display'
export { Timeline } from './display'
export { TagList } from './display'
export { Progress } from './display'
export { Avatar, AvatarGroup } from './display'

// Callout & Quote
export { Callout, Quote, RelatedEntry, RelatedIdentity } from './callout'

// Cards & Lists
export { Cards, Card } from './cards'
export { Options, Option } from './cards'
export { Kanban } from './cards'
export { Checklist } from './cards'
export { Counter } from './cards'
export { RatingBar } from './cards'

// Media
export { AudioCard, VideoCard, ImageViewer, FileCard } from './media'

// Charts (lazy)
export { BarChart, LineChart, PieChart, RadarChart } from './charts'

// Mermaid (lazy)
export { Mermaid } from './mermaid'

// Typography
export { Section, Subtitle, Label, Divider } from './typography'

// ── Component map for MDX evaluate ──────────────────────

import { Split, Columns, Column, Mockup, Placeholder } from './layout'
import { ProsCons, Stat, StatGroup, Table, Timeline, TagList, Progress, Avatar, AvatarGroup } from './display'
import { Callout, Quote, RelatedEntry, RelatedIdentity } from './callout'
import { Cards, Card, Options, Option, Kanban, Checklist, Counter, RatingBar } from './cards'
import { AudioCard, VideoCard, ImageViewer, FileCard } from './media'
import { BarChart, LineChart, PieChart, RadarChart } from './charts'
import { Mermaid } from './mermaid'
import { Section, Subtitle, Label, Divider } from './typography'

/** Map of component names → React components available in MDX content */
export const mdxComponents = {
  Split, Columns, Column, Mockup, Placeholder,
  ProsCons, Stat, StatGroup, Table, Timeline, TagList, Progress, Avatar, AvatarGroup,
  Callout, Quote, RelatedEntry, RelatedIdentity,
  Cards, Card, Options, Option, Kanban, Checklist, Counter, RatingBar,
  AudioCard, VideoCard, ImageViewer, FileCard,
  BarChart, LineChart, PieChart, RadarChart,
  Mermaid,
  Section, Subtitle, Label, Divider,
}
