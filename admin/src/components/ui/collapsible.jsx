"use client";

import React from "react";
import * as CollapsiblePrimitive from "@radix-ui/react-collapsible";

function Collapsible(props) {
  return <CollapsiblePrimitive.Root {...props} />;
}

function CollapsibleTrigger(props) {
  return <CollapsiblePrimitive.CollapsibleTrigger {...props} />;
}

function CollapsibleContent(props) {
  return <CollapsiblePrimitive.CollapsibleContent {...props} />;
}

export { Collapsible, CollapsibleTrigger, CollapsibleContent };