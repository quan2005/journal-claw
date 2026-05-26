interface ChartData { label: string; value: number }

export function BarChart({ data: _data, title, color: _color }: { data: ChartData[]; title?: string; color?: string }) {
  return <div data-chart="bar">{title}</div>
}

export function LineChart({ data: _data, title, color: _color }: { data: ChartData[]; title?: string; color?: string }) {
  return <div data-chart="line">{title}</div>
}

export function PieChart({ data: _data, title }: { data: ChartData[]; title?: string }) {
  return <div data-chart="pie">{title}</div>
}

export function RadarChart({ data: _data, title, color: _color }: { data: ChartData[]; title?: string; color?: string }) {
  return <div data-chart="radar">{title}</div>
}
