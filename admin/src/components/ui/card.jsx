import React from "react";
import { cn } from "./utils";

function Card({ className, ...props }) {
  return (
    <div
      data-slot="card"
      className={cn(
        "bg-card text-card-foreground flex flex-col gap-6 rounded-xl border",
        className
      )}
      {...props}
    />
  );
}

function CardHeader({ className, ...props }) {
  return (
    <div className={cn("px-6 pt-6", className)} {...props} />
  );
}

function CardTitle({ className, ...props }) {
  return <h4 className={cn("leading-none", className)} {...props} />;
}

function CardDescription({ className, ...props }) {
  return <p className={cn("text-muted-foreground", className)} {...props} />;
}

function CardContent({ className, ...props }) {
  return <div className={cn("px-6", className)} {...props} />;
}

function CardFooter({ className, ...props }) {
  return <div className={cn("px-6 pb-6", className)} {...props} />;
}

export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardDescription,
  CardContent,
};