import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { NavRail } from '../components/NavRail'
import type { Category } from '../contexts/UIContext'

describe('NavRail', () => {
  const defaultProps = {
    activeCategory: 'journal' as Category,
    onCategoryChange: vi.fn(),
    onSettingsClick: vi.fn(),
  }

  it('renders all category buttons', () => {
    render(<NavRail {...defaultProps} />)
    expect(screen.getByRole('button', { name: /日志/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /想法/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /记忆/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /专题/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /自动化/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /技能/i })).toBeTruthy()
  })

  it('marks active category with aria-current', () => {
    render(<NavRail {...defaultProps} activeCategory="ideas" />)
    expect(screen.getByRole('button', { name: /想法/i }).getAttribute('aria-current')).toBe('page')
    expect(screen.getByRole('button', { name: /日志/i }).getAttribute('aria-current')).toBeNull()
  })

  it('calls onCategoryChange when clicking a button', () => {
    const onChange = vi.fn()
    render(<NavRail {...defaultProps} onCategoryChange={onChange} />)
    fireEvent.click(screen.getByRole('button', { name: /自动化/i }))
    expect(onChange).toHaveBeenCalledWith('automation')
  })

  it('calls onSettingsClick for settings button', () => {
    const onSettings = vi.fn()
    render(<NavRail {...defaultProps} onSettingsClick={onSettings} />)
    fireEvent.click(screen.getByRole('button', { name: /设置/i }))
    expect(onSettings).toHaveBeenCalled()
  })

  it('has navigation role and label', () => {
    render(<NavRail {...defaultProps} />)
    expect(screen.getByRole('navigation', { name: /分类导航/i })).toBeTruthy()
  })
})
