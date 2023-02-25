// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import ButtonDropdown from "@cloudscape-design/components/button-dropdown";
import Header from "@cloudscape-design/components/header";
import { useState } from "react";
import { Board, BoardItem, ItemsPalette } from "../../lib/components";
import { BoardData } from "../../lib/components/internal/interfaces";
import { ItemsPaletteProps } from "../../src/items-palette/interfaces";
import PageLayout from "../app/page-layout";
import { boardI18nStrings, boardItemI18nStrings, itemsPaletteI18nStrings } from "../shared/i18n";
import { ItemData } from "../shared/interfaces";
import classnames from "./engine.module.css";
import { ItemWidgets } from "./items";

export function EnginePageTemplate({
  initialBoardData,
  initialPaletteItems,
  widgets,
  layout = "grid",
}: {
  initialBoardData: BoardData<ItemData>;
  initialPaletteItems: readonly ItemsPaletteProps.Item<ItemData>[];
  widgets: ItemWidgets;
  layout?: "grid" | "absolute";
}) {
  const [data, setData] = useState(initialBoardData);
  const [paletteItems, setPaletteItems] = useState(initialPaletteItems);

  return (
    <PageLayout header={<Header variant="h1">Configurable board demo</Header>}>
      <div className={classnames[`layout-${layout}`]}>
        <Board
          {...data}
          i18nStrings={boardI18nStrings}
          renderItem={(item, actions) => (
            <BoardItem
              header={<Header>{item.data.title}</Header>}
              footer={item.data.footer}
              settings={
                <ButtonDropdown
                  items={[{ id: "remove", text: "Remove widget" }]}
                  ariaLabel="Widget settings"
                  variant="icon"
                  onItemClick={() => actions.removeItem()}
                />
              }
              i18nStrings={boardItemI18nStrings}
            >
              {item.data.content}
            </BoardItem>
          )}
          onItemsChange={({ detail: { items, layout, addedItem, removedItem } }) => {
            setData({ items, layout });
            if (addedItem) {
              setPaletteItems((paletteItems) => paletteItems.filter((item) => item.id !== addedItem.id));
            }
            if (removedItem) {
              setPaletteItems((prev) =>
                [...prev, removedItem].sort((a, b) => a.data.title.localeCompare(b.data.title))
              );
            }
          }}
          empty="No items"
        />
        <div className={classnames.palette}>
          <Header>Add widgets</Header>
          <ItemsPalette
            items={paletteItems}
            renderItem={(item) => {
              const widgetConfig = widgets[item.id]!.data;
              return (
                <BoardItem header={<Header>{widgetConfig.title}</Header>} i18nStrings={boardItemI18nStrings}>
                  {widgetConfig.description}
                </BoardItem>
              );
            }}
            i18nStrings={itemsPaletteI18nStrings}
          />
        </div>
      </div>
    </PageLayout>
  );
}
