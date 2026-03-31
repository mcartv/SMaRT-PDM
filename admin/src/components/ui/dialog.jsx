"use client";

import React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { XIcon } from "lucide-react";
import { cn } from "./utils";

function Dialog(props) {
  return <DialogPrimitive.Root {...props} />;
}

function DialogTrigger(props) {
  return <DialogPrimitive.Trigger {...props} />;
}

function DialogContent({ className, children, ...props }) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 bg-black/50" />
      <DialogPrimitive.Content
        className={cn(
          "fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white p-6 rounded-lg shadow",
          className
        )}
        {...props}
      >
        {children}
        <DialogPrimitive.Close className="absolute top-4 right-4">
          <XIcon />
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

function DialogHeader({ className, ...props }) {
  return <div className={cn("flex flex-col gap-2", className)} {...props} />;
}

function DialogFooter({ className, ...props }) {
  return <div className={cn("flex justify-end gap-2", className)} {...props} />;
}

function DialogTitle(props) {
  return <DialogPrimitive.Title className="text-lg font-semibold" {...props} />;
}

function DialogDescription(props) {
  return <DialogPrimitive.Description className="text-sm text-muted-foreground" {...props} />;
}

export {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
};