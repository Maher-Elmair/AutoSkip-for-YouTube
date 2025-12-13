import * as React from "react";
import * as SwitchPrimitive from "@radix-ui/react-switch";

import { cn } from "@/lib/utils";

function Switch({
  className,
  dir,
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root> & {
  dir?: "rtl" | "ltr";
}) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        "peer data-[state=checked]:bg-primary data-[state=unchecked]:bg-button focus-visible:border-ring focus-visible:ring-ring/50 inline-flex h-[1.15rem] w-8 shrink-0 items-center rounded-full border border-transparent shadow-xs transition-all outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50",
        dir === "rtl" && "rtl:direction-rtl",
        className
      )}
      dir={dir}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className={cn(
          "bg-background dark:data-[state=unchecked]:bg-foreground dark:data-[state=checked]:bg-primary-foreground pointer-events-none block size-4 rounded-full ring-0 transition-transform",
          // LTR style
          !dir || dir === "ltr"
            ? "data-[state=checked]:translate-x-[calc(100%-3px)] data-[state=unchecked]:translate-x-[calc(100%-14px)]"
            : // RTL style - reversed
              "data-[state=checked]:translate-x-[calc(100%-30px)] data-[state=unchecked]:translate-x-[calc(100%-18px)]"
        )}
      />
    </SwitchPrimitive.Root>
  );
}

export { Switch };
