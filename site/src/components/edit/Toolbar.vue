<template>
  <div flex text-c w-72 h-full>
    <Tools />
    <Navbar />
  </div>
</template>

<script lang="tsx" setup>
import File from './toolbar/File.vue';
import Paper from './toolbar/Paper.vue';
import ThemeColor from './toolbar/ThemeColor.vue';
import FontFamily from './toolbar/FontFamily.vue';
import FontSize from './toolbar/FontSize.vue';
import Margins from './toolbar/Margins.vue';
import ParagraphSpace from './toolbar/ParagraphSpace.vue';
import LineHeight from './toolbar/LineHeight.vue';
import CorrectCase from './toolbar/CorrectCase.vue';
import Github from './toolbar/Github.vue';

const sections = [
  {
    name: "file",
    icon: "i-carbon:import-export",
    component: <div id="toolbar-file"><File /></div>
  },
  {
    name: "github",
    icon: "i-carbon:logo-github",
    component: <div id="toolbar-github"><Github /></div>
  },
  {
    name: "paper",
    icon: "i-majesticons:paper-fold-line",
    component: <div id="toolbar-paper"><Paper /></div>
  },
  {
    name: "theme-color",
    icon: "i-material-symbols:palette-outline",
    component: <div id="toolbar-theme-color"><ThemeColor /></div>
  },
  {
    name: "font-family",
    icon: "i-material-symbols:font-download-outline",
    component: <div id="toolbar-font-family"><FontFamily /></div>
  },
  {
    name: "font-size",
    icon: "i-ri:font-size-2",
    component: <div id="toolbar-font-size"><FontSize /></div>
  },
  {
    name: "margins",
    icon: "i-radix-icons:margin",
    component: <div id="toolbar-margins"><Margins /></div>
  },
  {
    name: "paragraph-space",
    icon: "i-icon-park-outline:paragraph-break-two",
    component: <div id="toolbar-paragraph-space"><ParagraphSpace /></div>
  },
  {
    name: "line-height",
    icon: "i-ic:round-format-line-spacing",
    component: <div id="toolbar-line-height"><LineHeight /></div>
  },
  {
    name: "correct-case",
    icon: "i-icon-park-outline:check-correct",
    component: <div id="toolbar-correct-case"><CorrectCase /></div>
  }
];

const scrollTo = (name: string) => {
  const toolbar = document.querySelector("#toolbar") as HTMLElement;
  const section = document.querySelector(`#toolbar-${name}`) as HTMLElement;

  toolbar.scrollTo({
    // offsetTop - header height - margin top
    top: section.offsetTop - 48 - 20,
    behavior: "smooth"
  });
};

const Tools = () => (
  <div class="pane-container" id="toolbar">
    {sections.map((item) => item.component)}
  </div>
);

const Navbar = () => (
  <div
    class="flex-center flex-col flex-none space-y-1 w-9 md:w-10"
    border="l c dashed lg:none"
  >
    {sections.map((item) => (
      <button class="round-btn" onClick={() => scrollTo(item.name)}>
        <span text="sm md:base" class={item.icon} />
      </button>
    ))}
  </div>
);
</script>

<style>
#toolbar .tool-item:not(:last-child) {
  @apply border-c border-b;
}
</style>
