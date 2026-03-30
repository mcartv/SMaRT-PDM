import * as React from "react";
import * as SelectPrimitive from "@radix-ui/react-select";
import { ChevronDown } from "lucide-react";
import { cn } from "../../lib/utils";

export const Select = SelectPrimitive.Root;
export const SelectGroup = SelectPrimitive.Group;
export const SelectValue = SelectPrimitive.Value;

export const SelectTrigger = ({ className, children, ...props }) => (
    <SelectPrimitive.Trigger
        className={cn("flex h-10 w-full items-center justify-between rounded-md border border-stone-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-stone-950 disabled:cursor-not-allowed disabled:opacity-50", className)}
        {...props}
    >
        {children}
        <ChevronDown className="h-4 w-4 opacity-50" />
    </SelectPrimitive.Trigger>
);

export const SelectContent = ({ className, children, position = "popper", ...props }) => (
    <SelectPrimitive.Portal>
        <SelectPrimitive.Content
            className={cn("relative z-50 min-w-32 overflow-hidden rounded-md border border-stone-200 bg-white text-stone-950 shadow-md data-[state=open]:animate-in data-[state=closed]:animate-out", className)}
            position={position}
            {...props}
        >
            <SelectPrimitive.Viewport className="p-1">{children}</SelectPrimitive.Viewport>
        </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
);

export const SelectItem = ({ className, children, ...props }) => (
    <SelectPrimitive.Item
        className={cn("relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none focus:bg-stone-100 data-disabled:pointer-events-none data-disabled:opacity-50", className)}
        {...props}
    >
        <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
    </SelectPrimitive.Item>
);