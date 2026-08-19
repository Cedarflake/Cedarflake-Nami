import type { ReactNode } from "react"

import { Card } from "@/components/ui/surfaces/card"

interface CenteredPanelProps {
  children: ReactNode
  headerAction?: ReactNode
}

export function CenteredPanel({ children, headerAction }: CenteredPanelProps) {
  return (
    <div className="w-full max-w-md">
      <Card
        elevation="flat"
        padding="lg"
        className="animate-[panel-in_420ms_cubic-bezier(0.16,1,0.3,1)] motion-reduce:animate-none"
      >
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.4em] text-muted">
            <span aria-hidden="true" className="h-1 w-8 rounded-full bg-accent" />
            Nami
          </div>

          {headerAction}
        </div>

        {children}
      </Card>
    </div>
  )
}
