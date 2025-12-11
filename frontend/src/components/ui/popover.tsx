import * as React from "react"
import * as PopoverPrimitive from "@radix-ui/react-popover"

import { cn } from "@/lib/utils"

function Popover({
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.Root>) {
  return <PopoverPrimitive.Root data-slot="popover" {...props} />
}

function PopoverTrigger({ children, className, id, onClick, tabIndex, style, title }: React.ComponentProps<typeof PopoverPrimitive.Trigger>) {
  // Forward only a conservative set of props to avoid leaking unknown props
  const safeProps: Partial<React.ComponentProps<typeof PopoverPrimitive.Trigger>> = { children, className, id, onClick, tabIndex, style, title };
  return <PopoverPrimitive.Trigger data-slot="popover-trigger" {...safeProps} />
}

function PopoverContent({
  className,
  align = "center",
  sideOffset = 4,
  children,
  style,
  forceMount,
}: React.ComponentProps<typeof PopoverPrimitive.Content>) {
  const safeProps: Partial<React.ComponentProps<typeof PopoverPrimitive.Content>> = { align, sideOffset, style, forceMount };
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        data-slot="popover-content"
        className={cn(
          "bg-white text-slate-900 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 z-50 w-72 origin-(--radix-popover-content-transform-origin) rounded-lg border border-slate-200 p-4 shadow-lg outline-hidden",
          className
        )}
        {...safeProps}
      >
        {children}
      </PopoverPrimitive.Content>
    </PopoverPrimitive.Portal>
  )
}

function PopoverAnchor({
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.Anchor>) {
  return <PopoverPrimitive.Anchor data-slot="popover-anchor" {...props} />
}

export { Popover, PopoverTrigger, PopoverContent, PopoverAnchor }
