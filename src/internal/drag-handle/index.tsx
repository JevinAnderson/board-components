// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import { Icon } from "@cloudscape-design/components";
import { ForwardedRef, KeyboardEvent, PointerEvent, forwardRef } from "react";

import Handle from "../handle";
import styles from "./styles.css.js";

export interface DragHandleProps {
  ariaLabelledBy: string;
  ariaDescribedBy: string;
  onPointerDown: (event: PointerEvent) => void;
  onKeyDown: (event: KeyboardEvent) => void;
}

function DragHandle(
  { ariaLabelledBy, ariaDescribedBy, onPointerDown, onKeyDown }: DragHandleProps,
  ref: ForwardedRef<HTMLButtonElement>
) {
  return (
    <Handle
      ref={ref}
      className={styles.handle}
      aria-labelledby={ariaLabelledBy}
      aria-describedby={ariaDescribedBy}
      onPointerDown={onPointerDown}
      onKeyDown={onKeyDown}
    >
      <Icon name="drag-indicator" />
    </Handle>
  );
}

export default forwardRef(DragHandle);
