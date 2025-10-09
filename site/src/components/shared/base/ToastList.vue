<template>
  <div>
    <div v-bind="api.getGroupProps()">
      <Toast
        v-for="(toast, index) in api.getToasts()"
        :key="toast.id"
        :toast="toast"
        :index="index"
        :parent="service"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import * as toast from "@zag-js/toast";
import { normalizeProps, useMachine } from "@zag-js/vue";

const nuxtApp = useNuxtApp();

// Create the toast store
const toaster = toast.createStore({
  placement: "bottom-end",
  overlap: true,
  duration: 2500,
  removeDelay: 750
});

const service = useMachine(toast.group.machine, {
  id: "toast",
  store: toaster
});

const api = computed(() => toast.group.connect(service, normalizeProps));

// Provide the toaster store to be used by the composable
nuxtApp.provide("toast", toaster);
</script>
