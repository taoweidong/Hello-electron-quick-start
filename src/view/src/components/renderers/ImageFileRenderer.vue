<template>
  <div class="image-file-renderer">
    <div class="image-preview">
      <el-image
        :src="imageSrc"
        fit="contain"
        style="max-width: 100%; max-height: 400px;"
        @load="onImageLoad"
      />
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent, ref, onMounted } from 'vue'

export default defineComponent({
  name: 'ImageFileRenderer',
  props: {
    file: {
      type: Object,
      required: true
    }
  },
  emits: ['imageLoaded'],
  setup(props, { emit }) {
    const imageSrc = ref<string>('')

    const setImageSrc = () => {
      imageSrc.value = `file://${props.file.path}`
    }

    const onImageLoad = () => {
      emit('imageLoaded', imageSrc.value)
    }

    onMounted(() => {
      setImageSrc()
    })

    return {
      imageSrc,
      onImageLoad
    }
  }
})
</script>

<style scoped>
.image-preview {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 200px;
  background-color: var(--el-fill-color-light);
  border-radius: 4px;
}
</style>