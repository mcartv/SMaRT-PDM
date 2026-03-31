"use client";

import React from "react";
import * as ContextMenuPrimitive from "@radix-ui/react-context-menu";
import { CheckIcon, ChevronRightIcon, CircleIcon } from "lucide-react";
import { cn } from "./utils";

function ContextMenu(props) {
  return <ContextMenuPrimitive.Root {...props} />;
}

function ContextMenuTrigger(props) {
  return <ContextMenuPrimitive.Trigger {...props} />;
}

function ContextMenuContent({ className, ...props }) {
  return (
    <ContextMenuPrimitive.Portal>
      <ContextMenuPrimitive.Content
        className={cn("min-w-32 rounded-md border p-1", className)}
        {...props}
      />
    </ContextMenuPrimitive.Portal>
  );
}

function ContextMenuItem({ className, inset, ...props }) {
  return (
    <ContextMenuPrimitive.Item
      className={cn(
        "flex items-center gap-2 px-2 py-1.5 text-sm",
        inset && "pl-8",
        className
      )}
      {...props}
    />
  );
}

function ContextMenuCheckboxItem({ children, ...props }) {
  return (
    <ContextMenuPrimitive.CheckboxItem
      className="flex items-center pl-8 pr-2 py-1.5 text-sm"
      {...props}
    >
      <span className="absolute left-2">
        <ContextMenuPrimitive.ItemIndicator>
          <CheckIcon className="size-4" />
        </ContextMenuPrimitive.ItemIndicator>
      </span>
      {children}
    </ContextMenuPrimitive.CheckboxItem>
  );
}

function ContextMenuRadioItem({ children, ...props }) {
  return (
    <ContextMenuPrimitive.RadioItem
      className="flex items-center pl-8 pr-2 py-1.5 text-sm"
      {...props}
    >
      <span className="absolute left-2">
        <ContextMenuPrimitive.ItemIndicator>
          <CircleIcon className="size-2 fill-current" />
        </ContextMenuPrimitive.ItemIndicator>
      </span>
      {children}
    </ContextMenuPrimitive.RadioItem>
  );
}

function ContextMenuSeparator(props) {
  return <ContextMenuPrimitive.Separator className="h-px bg-border my-1" {...props} />;
}

export {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuCheckboxItem,
  ContextMenuRadioItem,
  ContextMenuSeparator,
};