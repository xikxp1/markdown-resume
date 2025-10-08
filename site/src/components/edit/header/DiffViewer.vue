<template>
  <Teleport to="body">
    <div v-if="true" class="fixed inset-0 z-50 flex items-center justify-center">
      <!-- Backdrop -->
      <div class="absolute inset-0 bg-black/50" @click="$emit('close')" />
      
      <!-- Dialog -->
      <div class="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-6xl max-h-[90vh] w-full mx-4 flex flex-col">
        <!-- Header -->
        <div class="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 class="text-xl font-semibold">Version Comparison</h2>
          <button @click="$emit('close')" class="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
            <span i-ic:baseline-close class="text-xl" />
          </button>
        </div>

        <!-- Tabs -->
        <div class="flex border-b border-gray-200 dark:border-gray-700 px-4">
          <button
            v-for="tab in tabList"
            :key="tab.value"
            @click="currentTab = tab.value"
            class="relative px-4 py-2 text-sm"
            :class="currentTab === tab.value ? 'text-blue-600 dark:text-blue-400' : 'text-gray-600 dark:text-gray-400'"
          >
            {{ tab.label }}
            <span
              v-if="currentTab === tab.value"
              class="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500"
            />
          </button>
        </div>

        <!-- Diff Editor Container -->
        <div class="relative flex-1 overflow-hidden h-[70vh] min-h-[300px]">
          <!-- Side labels -->
          <div class="absolute top-0 left-0 right-0 z-10 px-4 py-2 text-xs text-gray-600 dark:text-gray-300 flex justify-between bg-white/70 dark:bg-gray-800/70 backdrop-blur">
            <span class="ml-14">Version</span>
            <span class="mr-8">Current</span>
          </div>
          <!-- Editor -->
          <div ref="diffEditorRef" class="absolute left-0 right-0 bottom-0 top-8"></div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script lang="ts" setup>
import type * as Monaco from "monaco-editor";
import { isClient } from "@renovamen/utils";
import { setupMonaco } from "~/monaco";

const props = defineProps<{
  currentMarkdown: string;
  currentCss: string;
  versionMarkdown: string;
  versionCss: string;
  originalLabelMarkdown?: string;
  modifiedLabelMarkdown?: string;
  originalLabelCss?: string;
  modifiedLabelCss?: string;
}>();

const emit = defineEmits<{
  close: [];
}>();

const diffEditorRef = ref<HTMLDivElement>();
const currentTab = ref<"markdown" | "css">("markdown");

const tabList = [
  { value: "markdown" as const, label: "Markdown" },
  { value: "css" as const, label: "CSS" }
];

// Whether there are diffs for each tab
const hasMarkdownDiff = computed(() => props.currentMarkdown !== props.versionMarkdown);
const hasCssDiff = computed(() => props.currentCss !== props.versionCss);


// Monaco diff editor
let diffEditor: Monaco.editor.IStandaloneDiffEditor | undefined;
let markdownOriginal: Monaco.editor.ITextModel | undefined;
let markdownModified: Monaco.editor.ITextModel | undefined;
let cssOriginal: Monaco.editor.ITextModel | undefined;
let cssModified: Monaco.editor.ITextModel | undefined;

const setupDiffEditor = async () => {
  if (!isClient || !diffEditorRef.value || diffEditor) return;

  const { monaco } = await setupMonaco();

  diffEditor = monaco.editor.createDiffEditor(diffEditorRef.value, {
    wordWrap: "on",
    fontSize: 13,
    fontFamily: `Menlo, Monaco, "Courier New", monospace`,
    lineHeight: 1.5,
    automaticLayout: true,
    renderSideBySide: true,
    readOnly: true,
  });
  // Ensure layout after creation in case container height is measured late
  diffEditor?.layout();

  // Create all models
  markdownOriginal = monaco.editor.createModel(props.versionMarkdown, "markdown");
  markdownModified = monaco.editor.createModel(props.currentMarkdown, "markdown");
  cssOriginal = monaco.editor.createModel(props.versionCss, "css");
  cssModified = monaco.editor.createModel(props.currentCss, "css");

  // Set initial model
  if (diffEditor && markdownOriginal && markdownModified) {
    diffEditor.setModel({
      original: markdownOriginal,
      modified: markdownModified
    });
    // Layout to render content immediately
    diffEditor?.layout();
  }

  // Apply theme
  const colorMode = useColorMode();
  // Use built-in theme to avoid undefined custom theme
  monaco.editor.setTheme(colorMode.preference === "dark" ? "vs-dark" : "vs");

  watch(
    () => colorMode.preference,
    (val) => {
      monaco.editor.setTheme(val === "dark" ? "vs-dark" : "vs");
    }
  );
};

// Watch tab changes
watch(currentTab, (tab) => {
  if (!diffEditor) return;

  if (tab === "markdown" && markdownOriginal && markdownModified) {
    diffEditor.setModel({
      original: markdownOriginal,
      modified: markdownModified
    });
    diffEditor?.layout();
  } else if (tab === "css" && cssOriginal && cssModified) {
    diffEditor.setModel({
      original: cssOriginal,
      modified: cssModified
    });
    diffEditor?.layout();
  }
});

onMounted(() => {
  setupDiffEditor();
});

onBeforeUnmount(() => {
  // Important: Dispose the editor BEFORE disposing the models
  // to avoid "TextModel got disposed before DiffEditorWidget model got reset" error
  if (diffEditor) {
    diffEditor.setModel(null); // Clear the model first
    diffEditor.dispose();
  }
  
  // Now safely dispose the models
  markdownOriginal?.dispose();
  markdownModified?.dispose();
  cssOriginal?.dispose();
  cssModified?.dispose();
});
</script>
