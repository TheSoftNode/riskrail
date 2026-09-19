import Image from "next/image";
import { cn } from "cn";

// Intrinsic size of the trimmed artwork, used only for the aspect ratio.
const MARK_W = 1273;
const MARK_H = 944;

/**
 * Brand lockup: the RiskRail mark plus "Risk" in text ink and "Rail" in cyan.
 *
 * The supplied artwork draws the outer R in near-white, which disappears on a
 * light surface — so there are two files and CSS picks one. Both are rendered
 * and toggled by the `dark` class rather than read from the theme in JS, which
 * keeps the header free of a hydration flash.
 */
export function Logo({
  className,
  showWordmark = true,
  markClassName,
}: {
  className?: string;
  showWordmark?: boolean;
  markClassName?: string;
}) {
  const mark = cn("w-auto object-contain", markClassName ?? "h-7");

  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <Image
        src="/riskrail-mark-light.png"
        alt=""
        width={MARK_W}
        height={MARK_H}
        priority
        className={cn(mark, "block dark:hidden")}
      />
      <Image
        src="/riskrail-mark-dark.png"
        alt=""
        width={MARK_W}
        height={MARK_H}
        priority
        className={cn(mark, "hidden dark:block")}
      />
      {showWordmark ? (
        <span className="text-[1.0625rem] font-semibold tracking-tight">
          <span className="text-foreground">Risk</span>
          <span className="text-brand-text">Rail</span>
        </span>
      ) : (
        <span className="sr-only">RiskRail</span>
      )}
    </span>
  );
}
