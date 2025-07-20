import { Tooltip as ChakraTooltip, Portal } from "@chakra-ui/react";
import * as React from "react";

export interface ToggleTipProps
  extends Omit<ChakraTooltip.RootProps, "open" | "onOpenChange"> {
  showArrow?: boolean;
  portalled?: boolean;
  portalRef?: React.RefObject<HTMLElement>;
  content: React.ReactNode;
  contentProps?: ChakraTooltip.ContentProps;
  disabled?: boolean;
}

export const ToggleTip = React.forwardRef<HTMLDivElement, ToggleTipProps>(
  function ToggleTip(props, ref) {
    const {
      showArrow = true,
      children,
      disabled,
      portalled = true,
      content,
      contentProps,
      portalRef,
      ...rest
    } = props;

    const [isOpen, setIsOpen] = React.useState(false);

    if (disabled) return children;

    return (
      <ChakraTooltip.Root
        open={isOpen}
        onOpenChange={(details) => setIsOpen(details.open)}
        openDelay={0}
        closeDelay={0}
        closeOnClick={false}
        closeOnPointerDown={false}
        {...rest}
      >
        <ChakraTooltip.Trigger asChild onClick={() => setIsOpen(!isOpen)}>
          {children}
        </ChakraTooltip.Trigger>
        <Portal disabled={!portalled} container={portalRef}>
          <ChakraTooltip.Positioner>
            <ChakraTooltip.Content ref={ref} {...contentProps}>
              {showArrow && (
                <ChakraTooltip.Arrow>
                  <ChakraTooltip.ArrowTip />
                </ChakraTooltip.Arrow>
              )}
              {content}
            </ChakraTooltip.Content>
          </ChakraTooltip.Positioner>
        </Portal>
      </ChakraTooltip.Root>
    );
  }
);
