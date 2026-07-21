import React, { useState } from "react";
import { Heading, Icon, Inline, Pressable, Stack, xcss } from "@forge/react";

type Props = {
  title: string;
  defaultExpanded?: boolean;
  children: React.ReactNode;
};

// UI Kit has no Accordion/Expander and no way to animate anything (no DOM
// access, no XCSS transition property) — this toggles instantly by design.
const headerStyle = xcss({ width: "100%" });

const CollapsibleSection = ({
  title,
  defaultExpanded = true,
  children,
}: Props) => {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <Stack grow="fill" space="space.150">
      <Pressable
        onClick={() => setExpanded((current) => !current)}
        xcss={headerStyle}
        padding="space.050"
      >
        <Inline space="space.100" alignBlock="center">
          <Icon
            glyph={expanded ? "chevron-down" : "chevron-right"}
            label={expanded ? "Collapse section" : "Expand section"}
          />
          <Heading as="h2">{title}</Heading>
        </Inline>
      </Pressable>
      {expanded && children}
    </Stack>
  );
};

export default CollapsibleSection;
