'use client'

// template.tsx перемонтируется на каждую навигацию — даёт анимацию входа страницы
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="page-enter">{children}</div>
}
