<template>
  <Teleport to="body">
    <div v-if="open" class="fixed inset-0 z-50 flex items-center justify-center">
      <!-- Backdrop -->
      <div class="absolute inset-0 bg-black/50" @click="$emit('close')" />

      <!-- Dialog -->
      <div
        class="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl max-h-[80vh] w-full mx-4 flex flex-col">
        <!-- Header -->
        <div class="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 class="text-xl font-semibold"> {{ $t('history.title') }}</h2>
          <button @click="$emit('close')" class="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
            <span i-ic:baseline-close class="text-xl" />
          </button>
        </div>

        <!-- Content -->
        <div class="flex-1 overflow-auto p-4">
          <div v-if="versions.length === 0" class="text-center text-gray-500 py-8">
            {{ $t('history.no_history') }}
          </div>

          <div v-else class="space-y-2">
            <div v-for="version in versions" :key="version.versionId"
              class="border border-gray-300 dark:border-gray-600 rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
              <div class="flex items-start justify-between gap-4">
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-2 mb-1">
                    <h3 class="font-semibold text-base truncate">{{ version.name }}</h3>
                    <span class="px-2 py-0.5 text-xs rounded-full" :class="{
                      'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300': version.type === 'manual',
                      'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300': version.type === 'auto',
                      'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300': version.type === 'rollback'
                    }">
                      {{ version.type === 'manual' ? $t('history.type.manual') : version.type === 'auto' ? $t('history.type.auto') : $t('history.type.rollback')
                      }}
                    </span>
                    <span v-if="isEqualToCurrent(version)" class="px-2 py-0.5 text-xs rounded-full" :class="'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300'
                      ">
                      {{ $t('history.no_changes') }}
                    </span>
                  </div>
                  <p class="text-sm text-gray-600 dark:text-gray-400">
                    {{ formatDate(version.createdAt) }}
                  </p>
                </div>

                <div class="flex gap-2 flex-shrink-0">
                  <button class="btn-secondary text-sm px-3 py-1.5" @click="viewDiff(version)"
                    :disabled="isEqualToCurrent(version)">
                    {{ $t('history.actions.diff') }}
                  </button>
                  <button class="btn-primary text-sm px-3 py-1.5" @click="restoreVersion(version)"
                    :disabled="isEqualToCurrent(version)">
                    {{ $t('history.actions.restore') }}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </Teleport>

  <!-- Diff Viewer Dialog -->
  <DiffViewer v-if="showDiff && selectedVersion" :current-markdown="currentMarkdown" :current-css="currentCss"
    :version-markdown="selectedVersion.markdown" :version-css="selectedVersion.css" @close="showDiff = false" />

  <!-- Restore Confirmation Modal -->
  <Teleport to="body">
    <div v-if="showRestoreConfirm" class="fixed inset-0 z-60 flex items-center justify-center">
      <div class="absolute inset-0 bg-black/50" @click="showRestoreConfirm = false" />
      <div class="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
        <h3 class="text-lg font-semibold mb-4">{{ $t('history.restore.title') }}</h3>
        <p class="mb-6">{{ $t('history.restore.dialog') }}</p>
        <div class="flex justify-end gap-2">
          <button class="btn-secondary px-4 py-2" @click="showRestoreConfirm = false">{{ $t('history.restore.cancel') }}</button>
          <button class="btn-primary px-4 py-2" @click="confirmRestore">{{ $t('history.restore.confirm') }}</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script lang="ts" setup>
import type { ResumeVersionItem } from "~/types";
import { getResumeHistory, rollbackResume } from "~/utils/database";

const props = defineProps<{
  resumeId: string;
  open: boolean;
}>();

const emit = defineEmits<{
  close: [];
}>();

const { data } = useDataStore();

// Load versions
const versions = ref<ResumeVersionItem[]>([]);
const showDiff = ref(false);
const selectedVersion = ref<ResumeVersionItem | null>(null);
const showRestoreConfirm = ref(false);
const versionToRestore = ref<ResumeVersionItem | null>(null);

// Capture current content as snapshot (not reactive)
const currentMarkdown = ref('');
const currentCss = ref('');

const loadVersions = async () => {
  if (props.resumeId) {
    versions.value = await getResumeHistory(props.resumeId);
    // Capture current content as a snapshot when dialog opens
    currentMarkdown.value = data.mdContent;
    currentCss.value = data.cssContent;
  }
};

watch(() => props.open, (isOpen) => {
  if (isOpen) {
    loadVersions();
  }
});

onMounted(() => {
  if (props.open) {
    loadVersions();
  }
});

// Format date
const formatDate = (timestamp: string) => {
  const date = new Date(parseInt(timestamp));
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
};

// Actions
const viewDiff = (version: ResumeVersionItem) => {
  selectedVersion.value = version;
  showDiff.value = true;
};

const restoreVersion = (version: ResumeVersionItem) => {
  versionToRestore.value = version;
  showRestoreConfirm.value = true;
};

const confirmRestore = async () => {
  if (versionToRestore.value) {
    await rollbackResume(props.resumeId, versionToRestore.value.versionId);
    await loadVersions(); // Reload to show the new rollback version
    showRestoreConfirm.value = false;
    versionToRestore.value = null;
  }
};

const isEqualToCurrent = (version: ResumeVersionItem) => version.markdown === currentMarkdown.value && version.css === currentCss.value
</script>

<style scoped>
.btn-primary {
  @apply bg-blue-500 hover:bg-blue-600 text-white rounded transition-colors;
}

.btn-secondary {
  @apply bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded transition-colors;
}

button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
