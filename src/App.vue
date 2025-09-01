<script setup>
import { RouterView } from 'vue-router'
</script>

<template>
  <RouterView />
</template>

<style>
body {
  background-size: cover;
  background-repeat: no-repeat;
  background-position: center center;
  background-attachment: fixed;
  margin: 0;
  padding: 0;
  min-height: 100vh;
}

html {
  margin: 0;
  padding: 0;
  min-height: 100vh;
}

::selection {
  /* intentionally left blank to have no effect */
  background: transparent;
  color: inherit;
}
</style>
