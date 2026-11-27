// Permite variables CSS propias en `style` (p. ej. style={{ "--tc": color }}).
import "react";

declare module "react" {
  interface CSSProperties {
    [variable: `--${string}`]: string | number | undefined;
  }
}
