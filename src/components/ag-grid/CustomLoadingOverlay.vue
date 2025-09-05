<template>
<div class="custom-loading-overlay">
    <v-progress-circular color="primary" indeterminate size="64" />
</div>          
  </template>
  <style scoped>
  .custom-loading-overlay {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    width: 100%;
  }
  </style>
  <script>
  export default {
    name : 'CustomLoadingOverlay',
  }
  </script>