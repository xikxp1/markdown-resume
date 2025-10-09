<template>
    <ToolItem :text="$t('toolbar.github.text')" icon="i-carbon:logo-github">
        <Dialog id="github-settings" :title="$t('toolbar.github.settings_title')" icon="i-carbon:logo-github"
            box-class="w-full md:w-96">
            <template #button>
                <li class="dropdown-li space-x-1.5 rounded" role="button">
                    <span i-carbon:settings text-base />
                    <span>{{ $t("toolbar.github.settings") }}</span>
                </li>
            </template>

            <template #content>
                <div class="space-y-4 p-4">
                    <div>
                        <label for="github-token" class="block text-sm font-medium mb-2">
                            {{ $t("toolbar.github.token") }}
                        </label>
                        <input id="github-token" v-model="token" type="password"
                            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand"
                            :placeholder="$t('toolbar.github.token_placeholder')" />
                        <p class="mt-1 text-xs text-gray-500">
                            {{ $t("toolbar.github.token_help") }}
                        </p>
                    </div>

                    <div>
                        <label for="github-repo" class="block text-sm font-medium mb-2">
                            {{ $t("toolbar.github.repository") }}
                        </label>
                        <input id="github-repo" v-model="repo" type="text"
                            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand"
                            :placeholder="$t('toolbar.github.repo_placeholder')" />
                        <p class="mt-1 text-xs text-gray-500">
                            {{ $t("toolbar.github.repo_help") }}
                        </p>
                    </div>

                    <div class="flex space-x-2 pt-2">
                        <button
                            class="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500"
                            @click="resetSettings">
                            {{ $t("toolbar.github.reset") }}
                        </button>
                        <button
                            class="px-4 py-2 text-sm font-medium text-white bg-brand rounded-md hover:bg-brand/90 focus:outline-none focus:ring-2 focus:ring-brand"
                            @click="saveSettings">
                            {{ $t("toolbar.github.save") }}
                        </button>
                    </div>
                </div>
            </template>
        </Dialog>
    </ToolItem>
</template>

<script lang="ts" setup>
import { getGithubToken, setGithubToken, getRepo, setRepo } from "~/utils/github";
import { useToast } from "~/composables/toast";

const toast = useToast();

const token = ref("");
const repo = ref("");

// Load settings when component mounts
onMounted(async () => {
    const savedToken = await getGithubToken();
    const savedRepo = await getRepo();

    if (savedToken) token.value = savedToken;
    if (savedRepo.owner && savedRepo.repo) {
        repo.value = `${savedRepo.owner}/${savedRepo.repo}`;
    }
});

const saveSettings = async () => {
    await setGithubToken(token.value);
    await setRepo(repo.value);
    toast.save();
};

const resetSettings = async () => {
    token.value = "";
    repo.value = "";
    await setGithubToken("");
    await setRepo("");
    toast.save();
};

</script>
