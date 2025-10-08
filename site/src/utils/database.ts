import * as localForage from "localforage";
import { downloadFile, uploadFile, copy, isClient } from "@renovamen/utils";
import { DEFAULT_STYLES, DEFAULT_NAME, DEFAULT_MD_CONTENT, DEFAULT_CSS_CONTENT } from ".";
import type { ResumeStorage, ResumeStorageItem, ResumeStyles, ResumeHistoryStorage, ResumeVersionItem, SaveType } from "~/types";

const MARKDOWN_RESUME_KEY = "MARKDOWN_RESUME_data";
const MARKDOWN_RESUME_HISTORY_KEY = "MARKDOWN_RESUME_history";

export const getStorage = async () =>
  isClient ? localForage.getItem<ResumeStorage>(MARKDOWN_RESUME_KEY) : null;

export const getHistory = async () =>
  isClient ? localForage.getItem<ResumeHistoryStorage>(MARKDOWN_RESUME_HISTORY_KEY) : null;

export const setHistory = async (history: ResumeHistoryStorage) => {
  if (isClient) await localForage.setItem(MARKDOWN_RESUME_HISTORY_KEY, history);
};

export const getResumeHistory = async (id: string) => {
  const history = (await getHistory()) || {};
  return history[id] || [];
};

export const getResumeList = async () => {
  const storage = (await getStorage()) || {};
  return Object.keys(storage)
    .map((i) => ({
      id: i,
      ...storage[i]
    }))
    .sort((a, b) => (b.update || b.id).localeCompare(a.update || a.id));
};

/**
 * Compute a content hash for deduplication
 */
export const computeContentHash = async (content: {
  markdown: string;
  css: string;
  styles: ResumeStyles;
}): Promise<string> => {
  const str = JSON.stringify({
    markdown: content.markdown,
    css: content.css,
    styles: content.styles
  });

  if (isClient && window.crypto && window.crypto.subtle) {
    try {
      const encoder = new TextEncoder();
      const data = encoder.encode(str);
      const hashBuffer = await window.crypto.subtle.digest("SHA-256", data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
    } catch {
      // Fallback to simple hash if crypto.subtle fails
    }
  }

  // Simple fallback hash for non-browser or if crypto fails
  let simpleHash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    simpleHash = (simpleHash << 5) - simpleHash + char;
    simpleHash = simpleHash & simpleHash;
  }
  return simpleHash.toString(16);
};

/**
 * Add a version to history with deduplication and pruning
 */
export const addVersion = async (
  id: string,
  payload: Omit<ResumeVersionItem, "hash" | "versionId" | "createdAt">,
  config: { public: { versionHistoryMax?: number; versionHistoryDedupe?: boolean } }
) => {
  const maxVersions = Number(config.public.versionHistoryMax ?? 200);
  const dedupe = config.public.versionHistoryDedupe !== false;

  const history = (await getHistory()) || {};
  const versions = history[id] || [];

  // Compute hash
  const hash = await computeContentHash({
    markdown: payload.markdown,
    css: payload.css,
    styles: payload.styles
  });

  // Check for deduplication
  if (dedupe && versions.length > 0 && versions[0].hash === hash) {
    return; // Skip adding duplicate
  }

  // Create version
  const now = new Date().getTime().toString();
  const version: ResumeVersionItem = {
    versionId: (typeof crypto !== "undefined" && crypto.randomUUID) ? crypto.randomUUID() : now,
    createdAt: now,
    hash,
    ...payload
  };

  // Add to beginning (newest first)
  versions.unshift(version);

  // Prune to max
  if (versions.length > maxVersions) {
    versions.splice(maxVersions);
  }

  history[id] = versions;
  await setHistory(history);
};

export const setResumeStyles = (styles: ResumeStyles) => {
  const { setStyle } = useStyleStore();

  for (const key of Object.keys(styles) as Array<keyof ResumeStyles>)
    setStyle(key, styles[key]);
};

export const setResumeMd = (content: string) => {
  const { setData, toggleMdFlag } = useDataStore();

  setData("mdContent", content);
  toggleMdFlag(true);
};

export const setResumeCss = (content: string) => {
  const { setData, toggleCssFlag } = useDataStore();

  setData("cssContent", content);
  toggleCssFlag(true);
};

/**
 * Overwrite data for a given resume to local storage
 *
 * @param id resume id
 * @param resume resume data
 */
export const setResume = (id: string, resume: ResumeStorageItem) => {
  const { setData } = useDataStore();

  setData("curResumeId", id);
  setData("curResumeName", resume.name);
  setResumeMd(resume.markdown);
  setResumeCss(resume.css);
  setResumeStyles(resume.styles);
};

/**
 * Save changes to a certain resume
 *
 * @param id resume id
 * @param resume resume data
 * @param saveType type of save (manual, auto, rollback)
 */
export const saveResume = async (
  id: string,
  resume: ResumeStorageItem,
  saveType: SaveType = "manual"
) => {
  const storage = (await getStorage()) || {};
  storage[id] = resume;

  await localForage.setItem(MARKDOWN_RESUME_KEY, storage);

  // Add to version history
  const config = useRuntimeConfig();
  await addVersion(id, {
    type: saveType,
    name: resume.name,
    markdown: resume.markdown,
    css: resume.css,
    styles: resume.styles
  }, config);

  const toast = useToast();
  toast.save();
};

/**
 * New a resume using default styles and content
 */
export const newResume = async () => {
  const id = new Date().getTime().toString(); // generate a new id
  const resume = {
    name: DEFAULT_NAME,
    markdown: DEFAULT_MD_CONTENT,
    css: DEFAULT_CSS_CONTENT,
    styles: DEFAULT_STYLES,
    update: id
  } as ResumeStorageItem;

  await saveResume(id, resume);

  const toast = useToast();
  toast.new();

  return id;
};

/**
 * Download data for all resumes to a .json file
 */
export const saveResumesToLocal = async () => {
  const storage = (await getStorage()) || {};
  downloadFile("MARKDOWN_RESUME_data.json", JSON.stringify(storage));
};

/**
 * Import resumes from a local .json file
 *
 * @param callback A callback function to be excuted after importing finished
 */
export const importResumesFromLocal = async (callback?: () => void) => {
  const toast = useToast();

  const check = (data: ResumeStorage) => {
    for (const resume of Object.values(data)) {
      if (typeof resume.name !== "string") return false;
      if (typeof resume.markdown !== "string") return false;
      if (typeof resume.css !== "string") return false;
      if (typeof resume.styles !== "object") return false;
      if (!["string", "undefined"].includes(typeof resume.update)) return false;

      const styles = resume.styles;

      if (typeof styles.fontSize !== "number") return false;
      if (typeof styles.lineHeight !== "number") return false;
      if (typeof styles.marginH !== "number") return false;
      if (typeof styles.marginV !== "number") return false;
      if (typeof styles.paper !== "string") return false;
      if (typeof styles.paragraphSpace !== "number") return false;
      if (typeof styles.themeColor !== "string") return false;

      if (typeof styles.fontCJK !== "object" || typeof styles.fontCJK.name !== "string")
        return false;
      if (typeof styles.fontEN !== "object" || typeof styles.fontEN.name !== "string")
        return false;
    }

    return true;
  };

  const storage = (await getStorage()) || {};

  const merge = async (content: string) => {
    const data = JSON.parse(content) as ResumeStorage;

    if (!check(data)) {
      toast.import(false);
      return;
    }

    const newStorage = {
      ...storage,
      ...data
    };

    await localForage.setItem(MARKDOWN_RESUME_KEY, newStorage);
    toast.import(true);

    callback && callback();
  };

  uploadFile(merge, ".json");
};

export const deleteResume = async (id: string) => {
  const toast = useToast();
  const storage = await getStorage();

  if (storage && storage[id]) {
    const name = storage[id].name;
    delete storage[id];

    await localForage.setItem(MARKDOWN_RESUME_KEY, storage);

    // Also delete history
    const history = (await getHistory()) || {};
    if (history[id]) {
      delete history[id];
      await setHistory(history);
    }

    toast.delete(name);
  }
};

export const switchResume = async (id: string) => {
  const toast = useToast();
  const storage = await getStorage();

  if (storage && storage[id]) {
    setResume(id, storage[id]);
    toast.switch(storage[id].name);
    return true;
  }

  return false;
};

export const duplicateResume = async (id: string) => {
  const toast = useToast();
  const storage = await getStorage();

  if (storage && storage[id]) {
    // Generate an id and name for duplicated resume
    const resume = copy(storage[id]);
    const newId = new Date().getTime().toString();
    const oldName = resume.name;

    resume.name = oldName + " Copy";
    resume.update = newId;
    storage[newId] = resume;

    await localForage.setItem(MARKDOWN_RESUME_KEY, storage);
    toast.duplicate(oldName);
  }
};

export const renameResume = async (id: string, name: string) => {
  const storage = (await getStorage()) || {};
  storage[id].name = name;

  await localForage.setItem(MARKDOWN_RESUME_KEY, storage);

  const toast = useToast();
  toast.save();
};

/**
 * Rollback to a specific version
 *
 * @param id resume id
 * @param versionId version id to rollback to
 */
export const rollbackResume = async (id: string, versionId: string) => {
  const versions = await getResumeHistory(id);
  const version = versions.find((v) => v.versionId === versionId);

  if (!version) {
    const toast = useToast();
    toast.error();
    return;
  }

  const { withAutosaveSuppressed } = useDataStore();

  await withAutosaveSuppressed(async () => {
    // Apply the version snapshot
    const resume: ResumeStorageItem = {
      name: version.name,
      markdown: version.markdown,
      css: version.css,
      styles: version.styles,
      update: new Date().getTime().toString()
    };

    // Set to current state (without triggering autosave)
    setResume(id, resume);

    // Save with rollback type (this will add a new version)
    await saveResume(id, resume, "rollback");
  });

  const toast = useToast();
  toast.restore();
};
