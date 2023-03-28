// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
declare module "*.css.js" {
  const styles: Record<string, string>;
  export default styles;
}
declare module "*.selectors.js" {
  // this is how Node.js and Vitest receive ESM transpiled to CJS
  const styles: {
    default: Record<string, string>;
  };
  export default styles;
}
