/* eslint-disable */

import type { AttributifyAttributes } from "@unocss/preset-attributify";
import type * as Monaco from "monaco-editor";

declare global {
  interface Window {
    // extend the window
    monaco: typeof Monaco | undefined;
    MonacoEnvironment: Monaco.Environment | undefined;
  }
}

declare module "*.vue" {
  import { type DefineComponent } from "vue";
  const component: DefineComponent<{}, {}, any>;
  export default component;
}

declare module "@vue/runtime-dom" {
  interface HTMLAttributes extends AttributifyAttributes {}
}
