<template>
  <button class="round-btn" @click="openHistory">
    <span i-ic:baseline-history md:text-lg />
  </button>
</template>

<script lang="ts" setup>
const emit = defineEmits<{
  openHistory: []
}>();

const openHistory = () => {
  emit('openHistory');
};
</script>
