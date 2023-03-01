// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { MIN_COL_SPAN, MIN_ROW_SPAN } from "../constants";
import { BoardItemDefinition, BoardItemLayoutSetting, GridLayout, GridLayoutItem, ItemId } from "../interfaces";

type Item<D = unknown> = BoardItemDefinition<D>;

/**
 * The function produces grid layout from board items and given number of columns.
 * The positional data is taken from the items when available or the default placement is used otherwise.
 */
export function interpretItems(items: readonly Item[], columns: number): GridLayout {
  const layoutItems: GridLayoutItem[] = [];
  const columnHeights = Array(columns).fill(0);

  function getColumnSpan(item: Item): number {
    const minColumnSpan = getItemMinColumnSpan(item, columns);
    const columnSpan = item.columnSpan?.[columns] ?? getItemDefaultColumnSpan(item, columns);
    return Math.max(minColumnSpan, columnSpan);
  }

  function getRowSpan(item: Item): number {
    const minRowSpan = getItemMinRowSpan(item);
    const rowSpan = item.rowSpan?.[columns] ?? getItemDefaultRowSpan(item);
    return Math.max(minRowSpan, rowSpan);
  }

  function getColumnOffset(item: Item, currentOffset: number): number {
    const columnSpan = getColumnSpan(item);
    const rowSpan = getRowSpan(item);
    return item.columnOffset?.[columns] ?? findOptimalColumnOffset(currentOffset, columnSpan, rowSpan);
  }

  function findOptimalColumnOffset(currentColumnOffset: number, columnSpan: number, rowSpan: number): number {
    for (let colOffset = currentColumnOffset; colOffset + columnSpan <= columns; colOffset++) {
      if (getRowOffset(colOffset, columnSpan) + rowSpan <= getRowOffset(0, columns)) {
        return colOffset;
      }
    }
    for (let colOffset = 0; colOffset + columnSpan <= columns; colOffset++) {
      if (getRowOffset(colOffset, columnSpan) + rowSpan <= getRowOffset(0, columns)) {
        return colOffset;
      }
    }
    return currentColumnOffset + columnSpan <= columns ? currentColumnOffset : 0;
  }

  function getRowOffset(columnOffset: number, columnSpan: number) {
    let rowOffset = 0;
    for (let col = columnOffset; col < columnOffset + columnSpan; col++) {
      rowOffset = Math.max(rowOffset, columnHeights[col]);
    }
    return rowOffset;
  }

  for (let index = 0, columnOffset = 0, rowOffset = 0; index < items.length; index++, rowOffset = 0) {
    const columnSpan = getColumnSpan(items[index]);
    const rowSpan = getRowSpan(items[index]);
    columnOffset = getColumnOffset(items[index], columnOffset);
    rowOffset = getRowOffset(columnOffset, columnSpan);

    layoutItems.push({ id: items[index].id, width: columnSpan, height: rowSpan, x: columnOffset, y: rowOffset });

    for (let col = columnOffset; col < columnOffset + columnSpan; col++) {
      columnHeights[col] = rowOffset + rowSpan;
    }

    columnOffset += columnSpan;
  }

  layoutItems.sort(itemComparator);

  return { items: layoutItems, columns, rows: getRowOffset(0, columns) };
}

/**
 * The function produces new items from the current state and updated grid layout.
 * The positional data for the given number of columns is preserved as is while the other layouts are partially invalidated.
 */
export function transformItems<D>(
  sourceItems: readonly BoardItemDefinition<D>[],
  gridLayout: GridLayout
): readonly BoardItemDefinition<D>[] {
  const itemById = new Map(sourceItems.map((item) => [item.id, item]));
  const getItem = (itemId: ItemId) => {
    const item = itemById.get(itemId);
    if (!item) {
      throw new Error("Invariant violation: no matching source item found.");
    }
    return item;
  };

  const sortedLayout = gridLayout.items.slice().sort(itemComparator);

  const items: BoardItemDefinition<D>[] = [];

  let changeFromIndex = sortedLayout.findIndex(({ id }, index) => sourceItems[index].id !== id);
  changeFromIndex = changeFromIndex !== -1 ? changeFromIndex : sortedLayout.length - 1;

  function writeItemSetting(
    item: Item,
    name: "columnOffset" | "columnSpan" | "rowSpan",
    layout: number,
    value: number
  ) {
    if (!item[name]) {
      item[name] = {};
    }
    item[name]![layout] = value;
  }

  for (let index = 0; index < sortedLayout.length; index++) {
    const { id, x, width, height } = sortedLayout[index];

    const item = { ...getItem(id) };

    if (index >= changeFromIndex) {
      item.columnOffset = undefined;
    }

    writeItemSetting(item, "columnOffset", gridLayout.columns, x);
    writeItemSetting(item, "columnSpan", gridLayout.columns, width);
    writeItemSetting(item, "rowSpan", gridLayout.rows, height);

    items.push(item);
  }

  return items;
}

export function createPlaceholdersLayout(rows: number, columns: number): GridLayout {
  const layoutItems: GridLayoutItem[] = [];

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < columns; col++) {
      layoutItems.push({ id: `awsui-placeholder-${row}-${col}`, x: col, y: row, width: 1, height: 1 });
    }
  }

  return { items: layoutItems, columns, rows };
}

export function getItemMinColumnSpan(item: Item, columns: number) {
  return Math.max(MIN_COL_SPAN, getColumnSpanForColumns(item.definition?.minColumnSpan, columns));
}

export function getItemDefaultColumnSpan(item: Item, columns: number) {
  return Math.min(
    columns,
    Math.max(getItemMinColumnSpan(item, columns), getColumnSpanForColumns(item.definition?.defaultColumnSpan, columns))
  );
}

function getColumnSpanForColumns(columnSpan: BoardItemLayoutSetting | undefined, columns: number): number {
  if (!columnSpan) {
    return MIN_COL_SPAN;
  }
  for (let i = columns; i >= 0; i--) {
    if (columnSpan[i] !== undefined) {
      return columnSpan[i];
    }
  }
  return MIN_COL_SPAN;
}

export function getItemMinRowSpan(item: Item) {
  return Math.max(MIN_ROW_SPAN, item.definition?.minRowSpan ?? 0);
}

export function getItemDefaultRowSpan(item: Item) {
  return Math.max(getItemMinRowSpan(item), item.definition?.defaultRowSpan ?? 0);
}

function itemComparator(a: GridLayoutItem, b: GridLayoutItem) {
  if (a.y !== b.y) {
    return a.y > b.y ? 1 : -1;
  }
  return a.x > b.x ? 1 : -1;
}
