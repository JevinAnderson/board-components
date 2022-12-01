// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import { ComponentWrapper } from "@cloudscape-design/test-utils-core/dom";
import dragHandleStyles from "../../../internal/drag-handle/styles.selectors.js";
import resizeHandleStyles from "../../../internal/resize-handle/styles.selectors.js";
import itemStyles from "../../../item/styles.selectors.js";

export default class DashboardItemWrapper extends ComponentWrapper {
  static rootSelector: string = itemStyles.root;

  findDragHandle(): ComponentWrapper {
    return this.findByClassName(dragHandleStyles.handle)!;
  }

  findResizeHandle(): ComponentWrapper {
    return this.findByClassName(resizeHandleStyles.handle)!;
  }
}
