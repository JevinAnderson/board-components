// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import clsx from "clsx";
import {
  CSSProperties,
  KeyboardEvent,
  ReactNode,
  PointerEvent as ReactPointerEvent,
  Ref,
  createContext,
  forwardRef,
  useContext,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import {
  DragAndDropData,
  InteractionType,
  Operation,
  useDragSubscription,
  useDraggable,
} from "../dnd-controller/controller";
import { useGridContext } from "../grid-context";
import { BoardItemDefinitionBase, Direction, ItemId } from "../interfaces";
import { Coordinates } from "../utils/coordinates";
import { getMinItemSize } from "../utils/layout";
import { getNormalizedElementRect } from "../utils/screen";
import { getNextDroppable } from "./get-next-droppable";
import styles from "./styles.css.js";

export interface ItemContainerRef {
  focusDragHandle(): void;
}

export interface ItemContext {
  dragHandle: {
    ref: React.RefObject<HTMLButtonElement>;
    onPointerDown(event: ReactPointerEvent): void;
    onKeyDown(event: KeyboardEvent): void;
  };
  resizeHandle: null | {
    onPointerDown(event: ReactPointerEvent): void;
    onKeyDown(event: KeyboardEvent): void;
  };
}

const Context = createContext<ItemContext | null>(null);

export function useItemContext() {
  const ctx = useContext(Context);
  if (!ctx) {
    throw new Error("Unable to find BoardItem context");
  }
  return ctx;
}

interface Transition {
  itemId: ItemId;
  operation: Operation;
  interactionType: InteractionType;
  sizeTransform: null | { width: number; height: number };
  positionTransform: null | { x: number; y: number };
}

/**
 * Defines item's parameters and its relation with the layout.
 *
 * `item` - the unique board item base object to be used in d&d context.
 * `acquired` - specifies if the item is essentially a copy temporarily acquired by a droppable but not submitted yet.
 * `itemSize` - the actual item's size in units.
 * `itemMaxSize` - the item's size in units it is allowed to grow to.
 * `transform` - items's position and size offset in units to temporarily change its placement.
 * `onNavigate` - a callback to fire when arrow keys are pressed on drag handle.
 */
export interface ItemContainerProps {
  item: BoardItemDefinitionBase<unknown>;
  acquired?: boolean;
  itemSize: { width: number; height: number };
  itemMaxSize: { width: number; height: number };
  onNavigate?(direction: Direction): void;
  onBorrow?(): void;
  children: ReactNode;
}

export const ItemContainer = forwardRef(ItemContainerComponent);

function ItemContainerComponent(
  { item, acquired, itemSize, itemMaxSize, onNavigate, onBorrow, children }: ItemContainerProps,
  ref: Ref<ItemContainerRef>
) {
  const pointerOffsetRef = useRef(new Coordinates({ x: 0, y: 0 }));
  const [isBorrowed, setIsBorrowed] = useState(false);
  const [transition, setTransition] = useState<null | Transition>(null);
  const clearState = () => {
    setIsBorrowed(false);
    setTransition(null);
  };
  const itemRef = useRef<HTMLDivElement>(null);
  const draggableApi = useDraggable({ item, getElement: () => itemRef.current! });
  const eventHandlersRef = useRef({
    onPointerMove: (event: PointerEvent) => draggableApi.updateTransition(Coordinates.fromEvent(event)),
    onPointerUp: () => draggableApi.submitTransition(),
  });
  const gridContext = useGridContext();

  function updateTransition({
    operation,
    interactionType,
    draggableItem,
    collisionRect,
    coordinates,
    dropTarget,
  }: DragAndDropData) {
    if (item.id === draggableItem.id) {
      const [width, height] = [collisionRect.right - collisionRect.left, collisionRect.bottom - collisionRect.top];
      const pointerOffset = pointerOffsetRef.current;

      if (operation === "resize" && dropTarget) {
        const { width: minWidth, height: minHeight } = dropTarget.scale(getMinItemSize(draggableItem));
        const { width: maxWidth } = dropTarget.scale(itemMaxSize);
        setTransition({
          operation,
          interactionType,
          itemId: draggableItem.id,
          sizeTransform: {
            width: Math.max(minWidth, Math.min(maxWidth, width - pointerOffset.x)),
            height: Math.max(minHeight, height - pointerOffset.y),
          },
          positionTransform: null,
        });
      } else if (operation === "insert" || operation === "reorder") {
        setTransition({
          operation,
          interactionType,
          itemId: draggableItem.id,
          sizeTransform: dropTarget ? dropTarget.scale(itemSize) : { width, height },
          positionTransform: { x: coordinates.x - pointerOffset.x, y: coordinates.y - pointerOffset.y },
        });
      }
    }
  }

  useDragSubscription("start", (detail) => updateTransition(detail));
  useDragSubscription("update", (detail) => updateTransition(detail));
  useDragSubscription("submit", () => clearState());
  useDragSubscription("discard", () => clearState());

  useEffect(() => {
    const { onPointerMove, onPointerUp } = eventHandlersRef.current;

    if (transition && transition.interactionType === "pointer" && transition.itemId === item.id) {
      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerup", onPointerUp);
    }

    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
  }, [item.id, transition]);

  function onKeyboardTransitionToggle(operation: "drag" | "resize") {
    // The acquired item is a copy and does not have the transition state.
    // However, pressing "Space" or "Enter" on the acquired item must submit the active transition.
    if (acquired) {
      return draggableApi.submitTransition();
    }

    // Create new transition if missing.
    if (!transition) {
      const rect = getNormalizedElementRect(itemRef.current!);
      const coordinates = new Coordinates({
        x: operation === "drag" ? rect.left : rect.right,
        y: operation === "drag" ? rect.top : rect.bottom,
      });

      if (operation === "drag" && !gridContext) {
        draggableApi.start("insert", "keyboard", coordinates);
      } else if (operation === "drag") {
        draggableApi.start("reorder", "keyboard", coordinates);
      } else {
        draggableApi.start("resize", "keyboard", coordinates);
      }
    }
    // Submit a transition if existing.
    else {
      draggableApi.submitTransition();
    }
  }

  function handleInsert(direction: Direction) {
    // Find the closest droppable (in the direction) to the item.
    const droppables = draggableApi.getDroppables();
    const nextDroppable = getNextDroppable(itemRef.current!, droppables, direction);

    if (!nextDroppable) {
      // TODO: add announcement
      // Context: the keyboard insertion only works when there is some droppable area in the specified direction.
      // That means that only some arrow keys might work which is confusing for a screen-reader user.
      // Alternatively, we can consider a multi-step insertion where the user would first explicitly select the desired board.
      return;
    }

    // Notify the respective droppable of the intention to insert the item in it.
    nextDroppable.context.acquire();

    setIsBorrowed(true);
    onBorrow?.();
  }

  function onHandleKeyDown(operation: "drag" | "resize", event: KeyboardEvent) {
    const canInsert = transition && operation === "drag" && !gridContext;
    const canNavigate = transition || operation === "drag";

    // The insert is handled by the item and the navigation is delegated to the containing layout.
    const move = (direction: Direction) => {
      if (canInsert) {
        handleInsert(direction);
      } else if (canNavigate) {
        onNavigate?.(direction);
      }
    };

    switch (event.key) {
      case "ArrowUp":
        return move("up");
      case "ArrowDown":
        return move("down");
      case "ArrowLeft":
        return move("left");
      case "ArrowRight":
        return move("right");
      case " ":
      case "Enter":
        return onKeyboardTransitionToggle(operation);
      case "Escape":
        return draggableApi.discardTransition();
    }
  }

  function onBlur() {
    // When drag- or resize handle loses focus the transition must be discarded with two exceptions:
    // 1. If the last interaction is not "keyboard" (the user clicked on another handle issuing a new transition);
    // 2. If the item is borrowed (in that case the focus moves to the acquired item which is expected).
    if (transition && transition.interactionType === "keyboard" && !isBorrowed) {
      draggableApi.discardTransition();
    }
  }

  function onDragHandlePointerDown(event: ReactPointerEvent) {
    // Calculate the offset between item's top-left corner and the pointer landing position.
    const rect = itemRef.current!.getBoundingClientRect();
    pointerOffsetRef.current = new Coordinates({ x: event.clientX - rect.left, y: event.clientY - rect.top });

    draggableApi.start(!gridContext ? "insert" : "reorder", "pointer", Coordinates.fromEvent(event));
  }

  function onDragHandleKeyDown(event: KeyboardEvent) {
    onHandleKeyDown("drag", event);
  }

  function onResizeHandlePointerDown(event: ReactPointerEvent) {
    // Calculate the offset between item's bottom-right corner and the pointer landing position.
    const rect = itemRef.current!.getBoundingClientRect();
    pointerOffsetRef.current = new Coordinates({ x: event.clientX - rect.right, y: event.clientY - rect.bottom });

    draggableApi.start("resize", "pointer", Coordinates.fromEvent(event));
  }

  function onResizeHandleKeyDown(event: KeyboardEvent) {
    onHandleKeyDown("resize", event);
  }

  const itemTransitionStyle: CSSProperties = {};
  const itemTransitionClassNames: string[] = [];

  // Adjust the dragged/resized item to the pointer's location.
  if (transition && transition.interactionType === "pointer") {
    itemTransitionClassNames.push(transition.operation === "resize" ? styles.resized : styles.dragged);
    itemTransitionStyle.left = transition.positionTransform?.x;
    itemTransitionStyle.top = transition.positionTransform?.y;
    itemTransitionStyle.width = transition.sizeTransform?.width;
    itemTransitionStyle.height = transition.sizeTransform?.height;
  }
  // Make the borrowed item dimmed.
  else if (isBorrowed) {
    itemTransitionClassNames.push(styles.borrowed);
  }

  const dragHandleRef = useRef<HTMLButtonElement>(null);
  useImperativeHandle(ref, () => ({
    focusDragHandle: () => dragHandleRef.current?.focus(),
  }));

  return (
    <div
      ref={itemRef}
      className={clsx(styles.root, ...itemTransitionClassNames)}
      style={itemTransitionStyle}
      data-item-id={item.id}
      onBlur={onBlur}
    >
      <Context.Provider
        value={{
          dragHandle: {
            ref: dragHandleRef,
            onPointerDown: onDragHandlePointerDown,
            onKeyDown: onDragHandleKeyDown,
          },
          resizeHandle: gridContext
            ? {
                onPointerDown: onResizeHandlePointerDown,
                onKeyDown: onResizeHandleKeyDown,
              }
            : null,
        }}
      >
        {children}
      </Context.Provider>
    </div>
  );
}
