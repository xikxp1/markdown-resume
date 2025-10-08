<template>
  <div class="edit-page flex flex-col">
    <Header>
      <template #middle>
        <RenameResume />
      </template>

      <template #tail>
        <SaveResume />
        <ToggleToolbar
          :is-toolbar-open="isToolbarOpen"
          @toggle-toolbar="isToolbarOpen = !isToolbarOpen"
        />
      </template>
    </Header>

    <div class="workspace size-full overflow-hidden" flex="~ 1" pb-2>
      <div v-bind="api.rootProps" px-3>
        <div class="editor-pane" v-bind="api.getPanelProps({ id: 'editor' })">
          <Editor />
        </div>

        <div v-bind="api.getResizeTriggerProps({ id: 'editor:preview' })" />

        <div class="preview-pane" v-bind="api.getPanelProps({ id: 'preview' })">
          <Preview />
        </div>
      </div>

      <div v-if="isToolbarOpen" class="tools-pane">
        <Toolbar />
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import * as splitter from "@zag-js/splitter";
import { normalizeProps, useMachine } from "@zag-js/vue";
import { debounce } from "ts-debounce";
import type { ResumeStorageItem } from "~/types";

// Horizontal splitpane
const [state, send] = useMachine(
  splitter.machine({
    id: "h",
    size: [{ id: "editor" }, { id: "preview" }]
  })
);

const api = computed(() => splitter.connect(state.value, send, normalizeProps));

// Autosave setup
const route = useRoute();
const config = useRuntimeConfig();
const { data } = useDataStore();
const { styles } = useStyleStore();
const ready = ref(false);

// Helper to build resume payload
const createResumePayload = (): ResumeStorageItem => ({
  name: data.curResumeName,
  markdown: data.mdContent,
  css: data.cssContent,
  styles: toRaw(styles),
  update: new Date().getTime().toString()
});

// Debounced autosave function
const performAutosave = () => {
  const id = data.curResumeId;
  if (!id) return;
  saveResume(id, createResumePayload());
};

const autosaveDebounceMs = Number(config.public.autosaveDebounceMs ?? 3000);
const debouncedAutosave = debounce(performAutosave, autosaveDebounceMs);

// Load resume and arm ready flag
const loadResume = async (id: string) => {
  ready.value = false;
  await switchResume(id);
  // Wait for reactive updates to settle before arming autosave
  nextTick(() => {
    ready.value = true;
  });
};

// Initial load
onMounted(() => loadResume(route.params.id as string));

// Watch for resume switching via route change
watch(
  () => route.params.id,
  (id) => {
    if (id) loadResume(id as string);
  }
);

// Watch for content and style changes to trigger autosave
watch(
  () => data.mdContent,
  () => {
    if (ready.value && data.curResumeId) debouncedAutosave();
  }
);

watch(
  () => data.cssContent,
  () => {
    if (ready.value && data.curResumeId) debouncedAutosave();
  }
);

watch(
  styles,
  () => {
    if (ready.value && data.curResumeId) debouncedAutosave();
  },
  { deep: true }
);

// Cancel pending autosave on unmount
onBeforeUnmount(() => {
  (debouncedAutosave as any).cancel?.();
});

// Toggle toolbar
const { width } = useWindowSize();
const isToolbarOpen = ref(width.value > 1024);
</script>

<style scoped>
[data-scope="splitter"][data-part="resize-trigger"] {
  @apply relative w-3 outline-none;
}

[data-scope="splitter"][data-part="resize-trigger"]::after {
  @apply content-[""] absolute bg-gray-400/40 w-1 h-10 rounded-full inset-0 m-auto;
}
</style>
