// src/plugins/filepond.ts
import vueFilePond from 'vue-filepond'
import 'filepond/dist/filepond.min.css'
import FilePondPluginImagePreview from 'filepond-plugin-image-preview'
import 'filepond-plugin-image-preview/dist/filepond-plugin-image-preview.css'
import FilePondPluginImageExifOrientation from 'filepond-plugin-image-exif-orientation'
import FilePondPluginImageResize from 'filepond-plugin-image-resize'
import FilePondPluginImageTransform from 'filepond-plugin-image-transform'
import FilePondPluginFileRename from 'filepond-plugin-file-rename'
export const FilePond = vueFilePond(
  FilePondPluginImagePreview,
  FilePondPluginImageExifOrientation,
  FilePondPluginImageResize,
  FilePondPluginImageTransform,
  FilePondPluginFileRename
)