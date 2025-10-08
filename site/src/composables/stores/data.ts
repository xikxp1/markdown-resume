import { acceptHMRUpdate, defineStore } from "pinia";
import type { SystemData } from "~/types";

export const useDataStore = defineStore("data", () => {
  const data = reactive<SystemData>({
    mdContent: "",
    cssContent: "",
    mdFlag: false,
    cssFlag: false,
    curResumeId: null,
    curResumeName: DEFAULT_NAME,
    autosaveSuppressed: 0
  });

  const setData = <T extends keyof SystemData>(key: T, value: SystemData[T]) => {
    data[key] = value;
    if (key === "cssContent") setBackboneCss(value as string, "preview");
  };

  const toggleMdFlag = (to: boolean) => {
    data.mdFlag = to;
  };

  const toggleCssFlag = (to: boolean) => {
    data.cssFlag = to;
  };

  const suppressAutosave = () => {
    data.autosaveSuppressed++;
  };

  const releaseAutosave = () => {
    if (data.autosaveSuppressed > 0) data.autosaveSuppressed--;
  };

  const withAutosaveSuppressed = async <T>(fn: () => T | Promise<T>): Promise<T> => {
    suppressAutosave();
    try {
      return await fn();
    } finally {
      releaseAutosave();
    }
  };

  return {
    data,
    setData,
    toggleMdFlag,
    toggleCssFlag,
    suppressAutosave,
    releaseAutosave,
    withAutosaveSuppressed
  };
});

if (import.meta.hot)
  import.meta.hot.accept(acceptHMRUpdate(useDataStore, import.meta.hot));
