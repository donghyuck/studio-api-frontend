<template>
  <v-breadcrumbs class="pa-0" :items="['커뮤니티', forumSlug, topic?.title || `토픽 #${topicId}`]" density="compact" />
  <PageToolbar :title="topic?.title || '게시글'" :label="topic?.title ? `'${topic.title}'의 댓글을 확인합니다.` : '토픽의 게시글을 확인합니다.'"
    @refresh="refresh" @create="openReplyDialog" @edit="openEditDialog" @delete="deleteTopic" @pin="togglePinTopic"
    @lock="toggleLockTopic" :closeable="false" :previous="true" :divider="true" :items="toolbarItems" />
  <v-skeleton-loader :loading="loading" class="mx-auto mt-2" max-width="100%" type="avatar, article, actions">
    <v-card v-if="firstPost" class="mt-2 discourse-outline" variant="outlined">
      <v-card-item class="py-2">
        <template v-slot:prepend>
          <UserAvatar :username="firstPost.createdBy" :show-name="false" :show-email="false" :show-image="true" />
        </template>
        <template v-slot:title>
          <v-card-title class="text-subtitle-2">{{ firstPost.createdBy }}</v-card-title>
          <v-card-subtitle>
            post at {{ dayjs(firstPost.createdAt).format("YYYY-MM-DD HH:mm:ss") }}
          </v-card-subtitle>
        </template>
      </v-card-item>
      <v-divider class="border-opacity-100" />
      <v-card-text class="post-content" v-html="renderContent(firstPost.content)"></v-card-text>
      <v-divider class="border-opacity-100" />
      <v-card-text class="pt-0 pb-0"
        v-if="canReadAttachments && !firstPostAttachmentsLoading && firstPostAttachments.length">
        <v-list dense>
          <v-list-item v-for="attachment in firstPostAttachments" :key="attachment.attachmentId">
            <template #prepend>
              <v-avatar size="28" color="grey-lighten-3">
                <v-img
                  v-if="!hasThumbnailError(attachment.attachmentId)"
                  :src="thumbnailUrl(firstPost?.id ?? 0, attachment.attachmentId)"
                  cover
                  @error="markThumbnailError(attachment.attachmentId)"
                />
                <v-icon v-else size="16" color="grey-darken-2">mdi-file</v-icon>
              </v-avatar>
            </template>
            <v-list-item-content>
              <v-list-item-title>
                {{ attachment.name ?? `첨부 #${attachment.attachmentId}` }}
              </v-list-item-title>
              <v-list-item-subtitle class="text-caption text-grey-darken-1">
                {{ attachment.contentType ?? 'Unknown' }} · {{ formatFileSize(attachment.size ?? 0) }}
              </v-list-item-subtitle>
            </v-list-item-content>
            <template #append>
              <v-btn icon variant="text" @click="openAttachment(attachment.downloadUrl)"
                :disabled="firstPostAttachmentsLoading">
                <v-icon>mdi-download</v-icon>
              </v-btn>
              <v-btn icon variant="text" color="error" v-if="canManageAttachments"
                @click="deleteAttachmentForPost(firstPost?.id ?? 0, attachment.attachmentId)"
                :disabled="firstPostAttachmentsLoading">
                <v-icon>mdi-delete</v-icon>
              </v-btn>
            </template>
          </v-list-item>
        </v-list>
      </v-card-text>
      <v-card-actions v-if="editable(firstPost.createdById ?? null, true) || canDeleteTopic">
        <v-spacer />
        <v-btn variant="text" prepend-icon="mdi-text-box-edit-outline" rounded="xl" color="primary" width="100"
          :loading="saving" v-if="editable(firstPost.createdById ?? null, true)" @click="openEditDialog">
          수정
        </v-btn>
        <v-btn variant="text" prepend-icon="mdi-forum-remove" rounded="xl" color="red" width="100" :loading="saving"
          v-if="canDeleteTopic" @click="deleteTopic">
          삭제
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-skeleton-loader>
  <v-row class="mt-2" v-if="canModerate">
    <v-col cols="auto">
      <v-switch v-model="includeHiddenPosts" label="숨김 댓글 포함" density="compact" hide-details color="primary" inset />
    </v-col>
  </v-row>
  <v-card class="px-5" variant="text">
    <v-timeline side="end" density="comfortable" line-color="grey-lighten-3">
      <template v-if="dataStore.loading && replies.length === 0">
        <v-timeline-item v-for="index in 3" :key="`skeleton-${index}`" dot-color="grey-lighten-5" fill-dot
          class="reply-item">
          <v-card class="reply-card" variant="outlined">
            <v-card-text>
              <v-skeleton-loader type="article" />
            </v-card-text>
          </v-card>
        </v-timeline-item>
      </template>
      <template v-else>
        <v-timeline-item v-for="(post, idx) in replies" :key="post.id" dot-color="grey-lighten-5" fill-dot
          class="reply-item">
          <template #icon>
            <UserAvatar :username="post.createdBy" :show-name="false" :show-email="false" :show-image="true" />
          </template>
          <template #opposite>
            <div class="text-caption text-grey-darken-1">{{ dayjs(post.createdAt).format("YYYY-MM-DD HH:mm:ss") }}</div>
          </template>
          <div class="reply-header">
            <div class="text-caption text-grey-darken-1">{{ post.createdBy }}</div>
            <v-spacer />
          </div>
          <v-card class="reply-card" variant="outlined">
            <v-card-text>
              <div class="post-content" v-html="renderContent(post.content)"></div>
              <div v-if="canReadAttachments && !attachmentsLoadingForPost(post.id) && attachmentsForPost(post.id).length"
                class="mt-3">
                <v-list dense>
                  <v-list-item v-for="attachment in attachmentsForPost(post.id)"
                    :key="`reply-${post.id}-${attachment.attachmentId}`">
                    <template #prepend>
                      <v-avatar size="28" color="grey-lighten-3">
                        <v-img
                          v-if="!hasThumbnailError(attachment.attachmentId)"
                          :src="thumbnailUrl(post.id, attachment.attachmentId)"
                          cover
                          @error="markThumbnailError(attachment.attachmentId)"
                        />
                        <v-icon v-else size="16" color="grey-darken-2">mdi-file</v-icon>
                      </v-avatar>
                    </template>
                    <v-list-item-content>
                      <v-list-item-title>
                        {{ attachment.name ?? `첨부 #${attachment.attachmentId}` }}
                      </v-list-item-title>
                      <v-list-item-subtitle class="text-caption text-grey-darken-1">
                        {{ attachment.contentType ?? 'Unknown' }} · {{ formatFileSize(attachment.size ?? 0) }}
                      </v-list-item-subtitle>
                    </v-list-item-content>
                    <template #append>
                      <v-btn icon variant="text" @click="openAttachment(attachment.downloadUrl)"
                        :disabled="attachmentsLoadingForPost(post.id)">
                        <v-icon>mdi-download</v-icon>
                      </v-btn>
                      <v-btn icon variant="text" color="error" v-if="canManageAttachmentsForPost(post)"
                        @click="deleteAttachmentForPost(post.id, attachment.attachmentId)"
                        :disabled="attachmentsLoadingForPost(post.id)">
                        <v-icon>mdi-delete</v-icon>
                      </v-btn>
                    </template>
                  </v-list-item>
                </v-list>
              </div>
            </v-card-text>
            <v-card-actions class="reply-card__actions"
              v-if="editable(post.createdById ?? null, true) || deletable(post.createdById ?? null, true) || canHidePost">
              <v-spacer />
              <v-btn v-if="editable(post.createdById ?? null, true)" size="small" variant="text" color="grey"
                prepend-icon="mdi-pencil" @click="openEditReplyDialog(post)">
                수정
              </v-btn>
              <v-btn v-if="deletable(post.createdById ?? null, true)" size="small" variant="text" color="error"
                prepend-icon="mdi-delete" @click="deleteReply(post)">
                삭제
              </v-btn>
              <v-btn v-if="canHidePost" size="small" variant="text" color="warning" prepend-icon="mdi-eye-off"
                @click="openHideDialog(post)">
                숨김
              </v-btn>
            </v-card-actions>
          </v-card>
        </v-timeline-item>
      </template>
    </v-timeline>
    <v-divider />
    <v-fab v-if="canReplyTopic" class="ms-4 mr-5" color="blue" icon="mdi-timeline-text-outline" absolute location="right bottom" size="60"
      @click="openReplyDialog"></v-fab>
    <v-card-actions class="justify-space-between">
      <v-btn variant="text" :disabled="!hasPrev" @click="goPrev">
        이전
      </v-btn>
      <div class="text-caption text-grey-darken-1">
        {{ pageLabel }}
      </div>
      <v-btn variant="text" :disabled="!hasNext" @click="goNext">
        다음
      </v-btn>
    </v-card-actions>
  </v-card>

  <v-dialog v-model="dialogs.reply" max-width="720">
    <v-card>
      <v-card-title class="text-subtitle-1 pb-0">
        <v-icon size="18" class="mr-2" color="primary">mdi-reply</v-icon>
        <span class="text-primary ml-2">{{ topic?.title || '' }}</span>
      </v-card-title>
      <v-card-text class="pa-2">
        <div class="tiptap-shell">
          <div class="tiptap-toolbar">
            <v-btn size="small" variant="tonal" :color="editor?.isActive('bold') ? 'primary' : 'grey'"
              icon="mdi-format-bold" @click="editor?.chain().focus().toggleBold().run()" title="굵게" />
            <v-btn size="small" variant="tonal" :color="editor?.isActive('italic') ? 'primary' : 'grey'"
              icon="mdi-format-italic" @click="editor?.chain().focus().toggleItalic().run()" title="기울임" />
            <v-btn size="small" variant="tonal" :color="editor?.isActive('strike') ? 'primary' : 'grey'"
              icon="mdi-format-strikethrough" @click="editor?.chain().focus().toggleStrike().run()" title="취소선" />
            <v-divider vertical class="mx-2" />
            <v-btn size="small" variant="tonal" :color="editor?.isActive('bulletList') ? 'primary' : 'grey'"
              icon="mdi-format-list-bulleted" @click="editor?.chain().focus().toggleBulletList().run()" title="불릿 목록" />
            <v-btn size="small" variant="tonal" :color="editor?.isActive('orderedList') ? 'primary' : 'grey'"
              icon="mdi-format-list-numbered" @click="editor?.chain().focus().toggleOrderedList().run()"
              title="번호 목록" />
            <v-divider vertical class="mx-2" />
            <v-btn size="small" variant="tonal" :color="editor?.isActive('blockquote') ? 'primary' : 'grey'"
              icon="mdi-format-quote-close" @click="editor?.chain().focus().toggleBlockquote().run()" title="인용" />
            <v-btn size="small" variant="tonal" :color="editor?.isActive('codeBlock') ? 'primary' : 'grey'"
              icon="mdi-code-tags" @click="editor?.chain().focus().toggleCodeBlock().run()" title="코드 블록" />
            <v-divider vertical class="mx-2" />
            <v-btn size="small" variant="tonal" color="grey" icon="mdi-image-plus" @click="insertImageUrl"
              title="이미지 추가" />
            <v-btn size="small" variant="tonal" color="grey" icon="mdi-video" @click="insertVideoUrl"
              title="동영상 추가 (YouTube)" />
            <v-btn size="small" variant="tonal" color="grey" icon="mdi-file-video" @click="insertMp4Url"
              title="MP4 추가" />
            <v-divider vertical class="mx-2" />
            <v-btn size="small" variant="tonal" :color="isImageActive ? 'primary' : 'grey'"
              icon="mdi-image-size-select-small" @click="promptMediaSize('image', editor ?? null)" :disabled="!isImageActive"
              title="이미지 크기 조정" />
            <v-btn size="small" variant="tonal" :color="isVideoActive ? 'primary' : 'grey'" icon="mdi-video-box"
              @click="promptMediaSize('video', editor ?? null)" :disabled="!isVideoActive" title="동영상 크기 조정" />
            <v-divider vertical class="mx-2" />
            <v-btn size="small" variant="tonal" :color="isLinkActive ? 'primary' : 'grey'" icon="mdi-link-off"
              @click="removeLink(editor ?? null)" title="링크 제거" />
            <v-btn size="small" variant="tonal" color="grey" icon="mdi-format-clear" @click="clearFormatting(editor ?? null)"
              title="서식 지우기" />
          </div>
          <div v-if="isLinkActive" class="link-edit-row">
            <v-text-field v-model="replyLinkUrl" dense hide-details label="링크 주소" class="me-2" />
            <v-text-field v-model="replyLinkTarget" dense hide-details label="target 속성 (옵션)" class="me-2" />
            <v-btn size="small" variant="tonal" color="primary"
              @click="applyLink(editor ?? null, replyLinkUrl, replyLinkTarget)">
              링크 적용
            </v-btn>
          </div>
          <v-alert dense variant="tonal" color="info" class="media-helper" v-if="replySelectedMedia">
            <div>
              <div class="text-caption text-grey-darken-1 mb-1">
                선택된 {{ replySelectedMedia.type === 'image' ? '이미지' : '동영상' }}
              </div>
              <div class="text-caption">
                너비: {{ replySelectedMedia.attrs.width ?? '자동' }} · 높이: {{ replySelectedMedia.attrs.height ?? '자동' }}
              </div>
            </div>
            <v-btn size="small" variant="tonal" color="primary"
              @click="promptMediaSize(normalizeMediaType(replySelectedMedia.type), editor ?? null)">
              크기 조정
            </v-btn>
          </v-alert>
          <EditorContent :editor="editor" />
        </div>
        <v-row class="mt-3" v-if="canUploadAttachments">
          <v-col cols="12">
            <v-file-input v-model="replyAttachmentFiles" multiple density="compact" hide-details label="첨부파일 (선택)"
              prepend-icon="mdi-paperclip" :disabled="replyAttachmentUploading" truncate-length="24"
              @update:model-value="handleReplyAttachmentChange" />
          </v-col>
          <v-col cols="12" v-if="replyAttachmentError">
            <v-alert density="compact" variant="tonal" type="error" class="mb-0">
              {{ replyAttachmentError }}
            </v-alert>
          </v-col>
        </v-row>
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn variant="tonal" color="grey" @click="closeReplyDialog" :disabled="saving" rounded="xl">
          취소
        </v-btn>
        <v-btn variant="tonal" color="primary" @click="submitReply" :loading="saving" :disabled="!canReply"
          rounded="xl">
          등록
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
  <v-dialog v-model="dialogs.edit" max-width="900">
    <v-card>
      <v-card-title class="text-subtitle-1">게시글 수정</v-card-title>
      <v-card-text>
        <v-text-field v-model="editTitle" label="제목" density="compact" variant="outlined" :disabled="saving"
          hide-details />
        <v-text-field v-model="editTags" label="태그 (쉼표로 구분)" density="compact" variant="outlined" class="mt-3"
          :disabled="saving" />

        <div class="tiptap-shell">
          <div class="tiptap-toolbar">
            <v-btn size="small" variant="tonal" :color="editEditor?.isActive('bold') ? 'primary' : 'grey'"
              icon="mdi-format-bold" @click="editEditor?.chain().focus().toggleBold().run()" title="굵게" />
            <v-btn size="small" variant="tonal" :color="editEditor?.isActive('italic') ? 'primary' : 'grey'"
              icon="mdi-format-italic" @click="editEditor?.chain().focus().toggleItalic().run()" title="기울임" />
            <v-btn size="small" variant="tonal" :color="editEditor?.isActive('strike') ? 'primary' : 'grey'"
              icon="mdi-format-strikethrough" @click="editEditor?.chain().focus().toggleStrike().run()" title="취소선" />
            <v-divider vertical class="mx-2" />
            <v-btn size="small" variant="tonal" :color="editEditor?.isActive('bulletList') ? 'primary' : 'grey'"
              icon="mdi-format-list-bulleted" @click="editEditor?.chain().focus().toggleBulletList().run()"
              title="불릿 목록" />
            <v-btn size="small" variant="tonal" :color="editEditor?.isActive('orderedList') ? 'primary' : 'grey'"
              icon="mdi-format-list-numbered" @click="editEditor?.chain().focus().toggleOrderedList().run()"
              title="번호 목록" />
            <v-divider vertical class="mx-2" />
            <v-btn size="small" variant="tonal" :color="editEditor?.isActive('blockquote') ? 'primary' : 'grey'"
              icon="mdi-format-quote-close" @click="editEditor?.chain().focus().toggleBlockquote().run()" title="인용" />
            <v-btn size="small" variant="tonal" :color="editEditor?.isActive('codeBlock') ? 'primary' : 'grey'"
              icon="mdi-code-tags" @click="editEditor?.chain().focus().toggleCodeBlock().run()" title="코드 블록" />
            <v-divider vertical class="mx-2" />
            <v-btn size="small" variant="tonal" color="grey" icon="mdi-image-plus" @click="insertEditImageUrl"
              title="이미지 추가" />
            <v-btn size="small" variant="tonal" color="grey" icon="mdi-video" @click="insertEditVideoUrl"
              title="동영상 추가 (YouTube)" />
            <v-btn size="small" variant="tonal" color="grey" icon="mdi-file-video" @click="insertEditMp4Url"
              title="MP4 추가" />
            <v-divider vertical class="mx-2" />
            <v-btn size="small" variant="tonal" :color="isEditImageActive ? 'primary' : 'grey'"
              icon="mdi-image-size-select-small" @click="promptMediaSize('image', editEditor ?? null)"
              :disabled="!isEditImageActive" title="이미지 크기 조정" />
            <v-btn size="small" variant="tonal" :color="isEditVideoActive ? 'primary' : 'grey'" icon="mdi-video-box"
              @click="promptMediaSize('video', editEditor ?? null)" :disabled="!isEditVideoActive" title="동영상 크기 조정" />
            <v-divider vertical class="mx-2" />
            <v-btn size="small" variant="tonal" :color="isEditLinkActive ? 'primary' : 'grey'" icon="mdi-link-off"
              @click="removeLink(editEditor ?? null)" title="링크 제거" />
            <v-btn size="small" variant="tonal" color="grey" icon="mdi-format-clear"
              @click="clearFormatting(editEditor ?? null)" title="서식 지우기" />
          </div>
          <div v-if="isEditLinkActive" class="link-edit-row">
            <v-text-field v-model="editLinkUrl" dense hide-details label="링크 주소" class="me-2" />
            <v-text-field v-model="editLinkTarget" dense hide-details label="target 속성 (옵션)" class="me-2" />
            <v-btn size="small" variant="tonal" color="primary"
              @click="applyLink(editEditor ?? null, editLinkUrl, editLinkTarget)">
              링크 적용
            </v-btn>
          </div>
          <v-alert dense variant="tonal" color="info" class="media-helper" v-if="editSelectedMedia">
            <div>
              <div class="text-caption text-grey-darken-1 mb-1">
                선택된 {{ editSelectedMedia.type === 'image' ? '이미지' : '동영상' }}
              </div>
              <div class="text-caption">
                너비: {{ editSelectedMedia.attrs.width ?? '자동' }} · 높이: {{ editSelectedMedia.attrs.height ?? '자동' }}
              </div>
            </div>
            <v-btn size="small" variant="tonal" color="primary"
              @click="promptMediaSize(normalizeMediaType(editSelectedMedia.type), editEditor ?? null)">
              크기 조정
            </v-btn>
          </v-alert>
          <EditorContent :editor="editEditor" />
        </div>
        <v-divider class="my-4" />
        <div class="d-flex align-center mb-2">
          <div class="text-caption text-grey-darken-1 fw-medium">첨부파일</div>
          <v-progress-circular v-if="editAttachmentUploading" size="16" width="2" color="primary" indeterminate
            class="ms-2" />
        </div>
        <v-list dense v-if="firstPostAttachments.length">
          <v-list-item v-for="attachment in firstPostAttachments" :key="`edit-${attachment.attachmentId}`">
            <template #prepend>
              <v-avatar size="28" color="grey-lighten-3">
                <v-img
                  v-if="!hasThumbnailError(attachment.attachmentId)"
                  :src="thumbnailUrl(firstPost?.id ?? 0, attachment.attachmentId)"
                  cover
                  @error="markThumbnailError(attachment.attachmentId)"
                />
                <v-icon v-else size="16" color="grey-darken-2">mdi-file</v-icon>
              </v-avatar>
            </template>
            <v-list-item-content>
              <v-list-item-title>
                {{ attachment.name ?? `첨부 #${attachment.attachmentId}` }}
              </v-list-item-title>
              <v-list-item-subtitle class="text-caption text-grey-darken-1">
                {{ attachment.contentType ?? 'Unknown' }} · {{ formatFileSize(attachment.size ?? 0) }}
              </v-list-item-subtitle>
            </v-list-item-content>
            <template #append>
              <v-btn icon variant="text" @click="openAttachment(attachment.downloadUrl)"
                :disabled="editAttachmentUploading">
                <v-icon>mdi-download</v-icon>
              </v-btn>
              <v-btn icon variant="text" color="error" v-if="canManageAttachments"
                @click="deleteAttachmentForPost(firstPost?.id ?? 0, attachment.attachmentId)"
                :disabled="editAttachmentUploading">
                <v-icon>mdi-delete</v-icon>
              </v-btn>
            </template>
          </v-list-item>
        </v-list>
        <div v-else-if="canReadAttachments" class="text-caption text-grey-darken-1 mb-2">첨부파일이 없습니다.</div>
        <v-row v-if="canUploadAttachments">
          <v-col cols="12">
            <v-file-input v-model="editAttachmentFiles" multiple density="compact" hide-details label="추가 첨부파일"
              prepend-icon="mdi-paperclip" :disabled="editAttachmentUploading" truncate-length="24"
              @update:model-value="handleEditAttachmentChange" />
          </v-col>
          <v-col cols="12" v-if="editAttachmentError">
            <v-alert density="compact" variant="tonal" type="error" class="mb-0">
              {{ editAttachmentError }}
            </v-alert>
          </v-col>
        </v-row>
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn variant="tonal" color="grey" @click="closeEditDialog" :disabled="saving" rounded="xl">
          취소
        </v-btn>
        <v-btn variant="outlined" color="primary" @click="submitEditTopic" :loading="saving" :disabled="!canEditTopic"
          rounded="xl">
          저장
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
  <v-dialog v-model="dialogs.editReply" max-width="720">
    <v-card>
      <v-card-title class="text-subtitle-1">댓글 수정</v-card-title>
      <v-card-text>
        <div class="tiptap-shell">
          <div class="tiptap-toolbar">
            <v-btn size="small" variant="tonal" :color="editReplyEditor?.isActive('bold') ? 'primary' : 'grey'"
              icon="mdi-format-bold" @click="editReplyEditor?.chain().focus().toggleBold().run()" title="굵게" />
            <v-btn size="small" variant="tonal" :color="editReplyEditor?.isActive('italic') ? 'primary' : 'grey'"
              icon="mdi-format-italic" @click="editReplyEditor?.chain().focus().toggleItalic().run()" title="기울임" />
            <v-btn size="small" variant="tonal" :color="editReplyEditor?.isActive('strike') ? 'primary' : 'grey'"
              icon="mdi-format-strikethrough" @click="editReplyEditor?.chain().focus().toggleStrike().run()"
              title="취소선" />
            <v-divider vertical class="mx-2" />
            <v-btn size="small" variant="tonal" :color="editReplyEditor?.isActive('bulletList') ? 'primary' : 'grey'"
              icon="mdi-format-list-bulleted" @click="editReplyEditor?.chain().focus().toggleBulletList().run()"
              title="불릿 목록" />
            <v-btn size="small" variant="tonal" :color="editReplyEditor?.isActive('orderedList') ? 'primary' : 'grey'"
              icon="mdi-format-list-numbered" @click="editReplyEditor?.chain().focus().toggleOrderedList().run()"
              title="번호 목록" />
            <v-divider vertical class="mx-2" />
            <v-btn size="small" variant="tonal" :color="editReplyEditor?.isActive('blockquote') ? 'primary' : 'grey'"
              icon="mdi-format-quote-close" @click="editReplyEditor?.chain().focus().toggleBlockquote().run()"
              title="인용" />
            <v-btn size="small" variant="tonal" :color="editReplyEditor?.isActive('codeBlock') ? 'primary' : 'grey'"
              icon="mdi-code-tags" @click="editReplyEditor?.chain().focus().toggleCodeBlock().run()" title="코드 블록" />
            <v-divider vertical class="mx-2" />
            <v-btn size="small" variant="tonal" color="grey" icon="mdi-image-plus" @click="insertEditReplyImageUrl"
              title="이미지 추가" />
            <v-btn size="small" variant="tonal" color="grey" icon="mdi-video" @click="insertEditReplyVideoUrl"
              title="동영상 추가 (YouTube)" />
            <v-btn size="small" variant="tonal" color="grey" icon="mdi-file-video" @click="insertEditReplyMp4Url"
              title="MP4 추가" />
            <v-divider vertical class="mx-2" />
            <v-btn size="small" variant="tonal" :color="isReplyImageActive ? 'primary' : 'grey'"
              icon="mdi-image-size-select-small" @click="promptMediaSize('image', editReplyEditor ?? null)"
              :disabled="!isReplyImageActive" title="이미지 크기 조정" />
            <v-btn size="small" variant="tonal" :color="isReplyVideoActive ? 'primary' : 'grey'" icon="mdi-video-box"
              @click="promptMediaSize('video', editReplyEditor ?? null)" :disabled="!isReplyVideoActive" title="동영상 크기 조정" />
            <v-divider vertical class="mx-2" />
            <v-btn size="small" variant="tonal" :color="isReplyLinkActive ? 'primary' : 'grey'" icon="mdi-link-off"
              @click="removeLink(editReplyEditor ?? null)" title="링크 제거" />
            <v-btn size="small" variant="tonal" color="grey" icon="mdi-format-clear"
              @click="clearFormatting(editReplyEditor ?? null)" title="서식 지우기" />
          </div>
          <div v-if="isReplyLinkActive" class="link-edit-row">
            <v-text-field v-model="editReplyLinkUrl" dense hide-details label="링크 주소" class="me-2" />
            <v-text-field v-model="editReplyLinkTarget" dense hide-details label="target 속성 (옵션)" class="me-2" />
            <v-btn size="small" variant="tonal" color="primary"
              @click="applyLink(editReplyEditor ?? null, editReplyLinkUrl, editReplyLinkTarget)">
              링크 적용
            </v-btn>
          </div>
          <v-alert dense variant="tonal" color="info" class="media-helper" v-if="editReplySelectedMedia">
            <div>
              <div class="text-caption text-grey-darken-1 mb-1">
                선택된 {{ editReplySelectedMedia.type === 'image' ? '이미지' : '동영상' }}
              </div>
              <div class="text-caption">
                너비: {{ editReplySelectedMedia.attrs.width ?? '자동' }} · 높이: {{ editReplySelectedMedia.attrs.height ??
                '자동'
                }}
              </div>
            </div>
            <v-btn size="small" variant="tonal" color="primary"
              @click="promptMediaSize(normalizeMediaType(editReplySelectedMedia.type), editReplyEditor ?? null)">
              크기 조정
            </v-btn>
          </v-alert>
          <EditorContent :editor="editReplyEditor" />
        </div>
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn variant="tonal" color="grey" @click="closeEditReplyDialog" :disabled="saving">
          취소
        </v-btn>
        <v-btn variant="outlined" color="primary" @click="submitEditReply" :loading="saving" :disabled="!canEditReply">
          저장
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
  <v-dialog v-model="hideDialog" max-width="480">
    <v-card>
      <PageToolbar title="댓글 숨김 처리" @close="closeHideDialog" :closeable="true" :divider="true" />
      <v-card-text>
        <v-textarea v-model="hideReason" label="숨김 사유 (선택)" rows="3" density="compact" counter
          hint="필요 시 자세히 작성하면 검토에 도움이 됩니다." />
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn variant="tonal" color="grey" rounded="xl" width="100" @click="closeHideDialog" :disabled="hiding">
          취소
        </v-btn>
        <v-btn variant="outlined" color="warning" rounded="xl" width="100" :loading="hiding" :disabled="hiding"
          @click="submitHidePost">
          {{ hideTarget?.hidden ? '숨김 해제' : '숨김' }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import PageToolbar from '@/components/bars/PageToolbar.vue';
import UserAvatar from '@/components/users/UserAvatar.vue';
import { forumsAdminApi } from '@/data/studio/mgmt/forums';
import { forumsPublicApi } from '@/data/studio/public/forums';
import { usePublicForumPostsStore } from '@/stores/studio/public/forum.posts.store';
import { usePublicForumAuthzStore } from '@/stores/studio/public/forum.authz.store';
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useToast } from '@/plugins/toast';
import { EditorContent, useEditor } from '@tiptap/vue-3';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Image from '@tiptap/extension-image';
import Youtube from '@tiptap/extension-youtube';
import Link from '@tiptap/extension-link';
import { Node } from '@tiptap/core';
import type { TopicResponse, PostResponse, PostAttachmentResponse } from '@/types/studio/forums';
import type { Editor } from '@tiptap/vue-3';
import dayjs from "dayjs";
import { useConfirm } from '@/plugins/confirm';
import { useAuthStore } from '@/stores/studio/mgmt/auth.store';
import { resolveAxiosError } from '@/utils/helpers';
import { isOwner } from '@/utils/ownership';
import type { PermissionAction } from '@/types/studio/forums';
import { API_BASE_URL } from "@/config/backend";

const route = useRoute();
const router = useRouter();
const toast = useToast();
const confirm = useConfirm();
const auth = useAuthStore();
const dataStore = usePublicForumPostsStore();
const authzStore = usePublicForumAuthzStore();

const forumSlug = computed(() => String(route.params.forumSlug || ""));
const topicId = computed(() => Number(route.params.topicId || 0));
const topic = ref<TopicResponse | null>(null);
const topicEtag = ref<string | null>(null);

const VideoNode = Node.create({
  name: 'video',
  group: 'block',
  atom: true,
  draggable: true,
  addAttributes() {
    return {
      src: { default: null },
      controls: { default: true },
      width: { default: null },
      height: { default: null },
    };
  },
  parseHTML() {
    return [{ tag: 'video' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['video', { ...HTMLAttributes, controls: HTMLAttributes.controls ?? true }];
  },
});

const dialogs = ref({ reply: false, edit: false, editReply: false });
const editor = useEditor({
  extensions: [
    StarterKit,
    Placeholder.configure({
      placeholder: '댓글 내용을 입력하세요.',
    }),
    Link.configure({
      openOnClick: false,
      autolink: false,
      linkOnPaste: false,
    }),
    Image.configure({
      inline: false,
      addAttributes() {
        return {
          width: {
            default: null,
          },
          height: {
            default: null,
          },
        };
      },
    } as any),
    Link.configure({
      openOnClick: false,
      autolink: false,
      linkOnPaste: false,
    }),
    Youtube.configure({
      controls: true,
      modestBranding: true,
    }),
    Youtube.configure({
      controls: true,
      modestBranding: true,
    }),
    VideoNode,
  ],
  content: '',
});
const editEditor = useEditor({
  extensions: [
    StarterKit,
    Placeholder.configure({
      placeholder: '본문을 입력하세요.',
    }),
    Image.configure({
      inline: false,
      addAttributes() {
        return {
          width: {
            default: null,
          },
          height: {
            default: null,
          },
        };
      },
    } as any),
    Link.configure({
      openOnClick: false,
      autolink: false,
      linkOnPaste: false,
    }),
    Youtube.configure({
      controls: true,
      modestBranding: true,
    }),
    VideoNode,
  ],
  content: '',
});
const editReplyEditor = useEditor({
  extensions: [
    StarterKit,
    Placeholder.configure({
      placeholder: '댓글을 입력하세요.',
    }),
    Image.configure({
      inline: false,
      addAttributes() {
        return {
          width: {
            default: null,
          },
          height: {
            default: null,
          },
        };
      },
    } as any),
    Link.configure({
      openOnClick: false,
      autolink: false,
      linkOnPaste: false,
    }),
    Youtube.configure({
      controls: true,
      modestBranding: true,
    }),
    VideoNode,
  ],
  content: '',
});
const saving = ref(false);
const editTitle = ref('');
const editTags = ref('');
const postAttachments = ref<Record<number, PostAttachmentResponse[]>>({});
const postAttachmentsLoading = ref<Record<number, boolean>>({});
const thumbnailErrors = ref<Record<number, boolean>>({});
const replyAttachmentFiles = ref<File[]>([]);
const replyAttachmentError = ref<string | null>(null);
const replyAttachmentUploading = ref(false);
const editAttachmentFiles = ref<File[]>([]);
const editAttachmentError = ref<string | null>(null);
const editAttachmentUploading = ref(false);
const hideDialog = ref(false);
const hideReason = ref('');
const hideTarget = ref<PostResponse | null>(null);
const hiding = ref(false);
const includeHiddenPosts = ref(false);
const pinning = ref(false);
const locking = ref(false);

const hasPermission = (action: PermissionAction) => {
  const slug = forumSlug.value;
  if (!slug) return false;
  return authzStore.hasPermission(slug, action);
};

const canModerate = computed(() => !!auth.user?.userId && hasPermission("MODERATE"));
const canPinTopic = computed(() => hasPermission("PIN_TOPIC"));
const canLockTopic = computed(() => hasPermission("LOCK_TOPIC"));
const canHidePost = computed(() => hasPermission("HIDE_POST") || hasPermission("MODERATE"));
const canReplyTopic = computed(() => hasPermission("REPLY_POST"));
const canReadAttachments = computed(() => hasPermission("READ_ATTACHMENT"));
const canUploadAttachments = computed(() => hasPermission("UPLOAD_ATTACHMENT"));

const thumbnailUrl = (postId?: number, attachmentId?: number) => {
  const slug = forumSlug.value;
  const topic = topicId.value;
  if (!slug || !Number.isFinite(topic) || topic <= 0) return "";
  if (!postId || !attachmentId) return "";
  return `${API_BASE_URL}/api/forums/${slug}/topics/${topic}/posts/${postId}/attachments/${attachmentId}/thumbnail?size=48`;
};

const hasThumbnailError = (attachmentId?: number) => {
  if (!attachmentId) return true;
  return !!thumbnailErrors.value[attachmentId];
};

const markThumbnailError = (attachmentId?: number) => {
  if (!attachmentId) return;
  thumbnailErrors.value = { ...thumbnailErrors.value, [attachmentId]: true };
};


const hasEditorContent = computed(() => {
  const text = editor.value?.getText()?.trim() ?? '';
  if (text.length > 0) return true;
  const html = editor.value?.getHTML() ?? '';
  return /<(img|iframe|video)\b/i.test(html);
});

const canReply = computed(() => {
  return hasEditorContent.value && !saving.value;
});

const hasEditContent = computed(() => {
  const text = editEditor.value?.getText()?.trim() ?? '';
  if (text.length > 0) return true;
  const html = editEditor.value?.getHTML() ?? '';
  return /<(img|iframe|video)\b/i.test(html);
});
const canEditTopic = computed(() => {
  const identifier = firstPost.value?.createdById ?? null;
  if (!editable(identifier, true)) return false;
  if (!topicEtag.value) return false;
  return editTitle.value.trim().length > 0 && hasEditContent.value && !saving.value;
});
const canEditReply = computed(() => {
  if (!editReplyTarget.value) return false;
  const text = editReplyEditor.value?.getText()?.trim() ?? '';
  if (text.length > 0) return !saving.value;
  const html = editReplyEditor.value?.getHTML() ?? '';
  return /<(img|iframe|video)\b/i.test(html) && !saving.value;
});
const isImageActive = computed(() => editor.value?.isActive("image") ?? false);
const isVideoActive = computed(() => editor.value?.isActive("video") ?? false);
const isEditImageActive = computed(() => editEditor.value?.isActive("image") ?? false);
const isEditVideoActive = computed(() => editEditor.value?.isActive("video") ?? false);
const isReplyImageActive = computed(() => editReplyEditor.value?.isActive("image") ?? false);
const isReplyVideoActive = computed(() => editReplyEditor.value?.isActive("video") ?? false);
const isLinkActive = computed(() => editor.value?.isActive("link") ?? false);
const isEditLinkActive = computed(() => editEditor.value?.isActive("link") ?? false);
const isReplyLinkActive = computed(() => editReplyEditor.value?.isActive("link") ?? false);

const replyLinkUrl = ref('');
const replyLinkTarget = ref('');
const editLinkUrl = ref('');
const editLinkTarget = ref('');
const editReplyLinkUrl = ref('');
const editReplyLinkTarget = ref('');
const replyLinkAttrs = computed(() => (editor.value ? editor.value.getAttributes('link') : {}));
const editLinkAttrs = computed(() => (editEditor.value ? editEditor.value.getAttributes('link') : {}));
const replyEditLinkAttrs = computed(() => (editReplyEditor.value ? editReplyEditor.value.getAttributes('link') : {}));

const applyLink = (editorInstance: Editor | null, url: string, target: string) => {
  if (!editorInstance || !url.trim()) return;
  editorInstance
    .chain()
    .focus()
    .extendMarkRange('link')
    .setLink({ href: url.trim(), target: target?.trim().length ? target.trim() : undefined })
    .run();
};

const replySelectedMedia = computed(() => {
  if (isImageActive.value) {
    return { type: 'image', attrs: editor.value?.getAttributes('image') ?? {} };
  }
  if (isVideoActive.value) {
    return { type: 'video', attrs: editor.value?.getAttributes('video') ?? {} };
  }
  return null;
});

const editSelectedMedia = computed(() => {
  if (isEditImageActive.value) {
    return { type: 'image', attrs: editEditor.value?.getAttributes('image') ?? {} };
  }
  if (isEditVideoActive.value) {
    return { type: 'video', attrs: editEditor.value?.getAttributes('video') ?? {} };
  }
  return null;
});

const editReplySelectedMedia = computed(() => {
  if (isReplyImageActive.value) {
    return { type: 'image', attrs: editReplyEditor.value?.getAttributes('image') ?? {} };
  }
  if (isReplyVideoActive.value) {
    return { type: 'video', attrs: editReplyEditor.value?.getAttributes('video') ?? {} };
  }
  return null;
});

const normalizeMediaType = (value: string) => (value === "video" ? "video" : "image");

const insertImageUrl = () => {
  const url = window.prompt('이미지 URL을 입력하세요.');
  if (!url) return;
  editor.value?.chain().focus().setImage({ src: url.trim() }).run();
};

const insertVideoUrl = () => {
  const url = window.prompt('동영상 URL을 입력하세요. (YouTube 지원)');
  if (!url) return;
  editor.value?.chain().focus().setYoutubeVideo({ src: url.trim() }).run();
};

const insertMp4Url = () => {
  const url = window.prompt('MP4 URL을 입력하세요.');
  if (!url) return;
  const safeUrl = url.trim();
  editor.value?.chain().focus().insertContent({ type: 'video', attrs: { src: safeUrl, controls: true } }).run();
};

const promptMediaSize = (media: 'image' | 'video', editorInstance: Editor | null) => {
  if (!editorInstance) return;
  const width = window.prompt('넓이값(예: 400px, 80%)을 입력하세요. 비워두면 기본으로 유지됩니다.', '');
  if (width === null) return;
  const height = window.prompt('높이값(예: 200px)을 입력하세요. 비워두면 기본 유지.', '');
  if (height === null) return;
  const attrs: Record<string, string> = {};
  if (width.trim()) attrs.width = width.trim();
  if (height.trim()) attrs.height = height.trim();
  if (Object.keys(attrs).length === 0) return;
  editorInstance.chain().focus().updateAttributes(media, attrs).run();
};

const removeLink = (editorInstance: Editor | null) => {
  if (!editorInstance) return;
  editorInstance.chain().focus().unsetLink().run();
};

const clearFormatting = (editorInstance: Editor | null) => {
  if (!editorInstance) return;
  editorInstance.chain().focus().unsetAllMarks().clearNodes().setParagraph().run();
};

watch(isLinkActive, (active) => {
  if (active) {
    replyLinkUrl.value = replyLinkAttrs.value.href ?? '';
    replyLinkTarget.value = replyLinkAttrs.value.target ?? '';
  } else {
    replyLinkUrl.value = '';
    replyLinkTarget.value = '';
  }
});

watch(isEditLinkActive, (active) => {
  if (active) {
    editLinkUrl.value = editLinkAttrs.value.href ?? '';
    editLinkTarget.value = editLinkAttrs.value.target ?? '';
  } else {
    editLinkUrl.value = '';
    editLinkTarget.value = '';
  }
});

watch(isReplyLinkActive, (active) => {
  if (active) {
    editReplyLinkUrl.value = replyEditLinkAttrs.value.href ?? '';
    editReplyLinkTarget.value = replyEditLinkAttrs.value.target ?? '';
  } else {
    editReplyLinkUrl.value = '';
    editReplyLinkTarget.value = '';
  }
});

const insertEditImageUrl = () => {
  const url = window.prompt('이미지 URL을 입력하세요.');
  if (!url) return;
  editEditor.value?.chain().focus().setImage({ src: url.trim() }).run();
};

const insertEditVideoUrl = () => {
  const url = window.prompt('동영상 URL을 입력하세요. (YouTube 지원)');
  if (!url) return;
  editEditor.value?.chain().focus().setYoutubeVideo({ src: url.trim() }).run();
};

const setPostAttachmentsLoading = (postId: number, value: boolean) => {
  postAttachmentsLoading.value = {
    ...postAttachmentsLoading.value,
    [postId]: value,
  };
};

const loadAttachmentsForPost = async (postId: number) => {
  if (!postId) return;
  if (!canReadAttachments.value) return;
  const slug = forumSlug.value;
  const id = topicId.value;
  if (!slug || !Number.isFinite(id) || id <= 0) return;
  setPostAttachmentsLoading(postId, true);
  try {
    const list = await forumsPublicApi.listPostAttachments(slug, id, postId);
    postAttachments.value = {
      ...postAttachments.value,
      [postId]: list ?? [],
    };
  } catch (error) {
    postAttachments.value = {
      ...postAttachments.value,
      [postId]: [],
    };
    console.error('attachments load failed', error);
  } finally {
    setPostAttachmentsLoading(postId, false);
  }
};

const uploadPostAttachments = async (postId: number, files: File[]) => {
  if (!postId || files.length === 0) return;
  if (!canUploadAttachments.value) return;
  const slug = forumSlug.value;
  const id = topicId.value;
  if (!slug || !Number.isFinite(id) || id <= 0) return;
  for (const file of files) {
    await forumsPublicApi.uploadPostAttachment(slug, id, postId, file);
  }
  await loadAttachmentsForPost(postId);
};

const deleteAttachmentForPost = async (postId: number, attachmentId: number) => {
  if (!postId || !attachmentId) return;
  if (!canUploadAttachments.value) return;
  const ok = await confirm({
    title: '확인',
    message: '첨부파일을 삭제하시겠습니까?',
    okText: '삭제',
    cancelText: '취소',
    color: 'error',
  });
  if (!ok) return;
  const slug = forumSlug.value;
  const id = topicId.value;
  if (!slug || !Number.isFinite(id) || id <= 0) return;
  try {
    await forumsPublicApi.deletePostAttachment(slug, id, postId, attachmentId);
    toast.success('첨부파일이 삭제되었습니다.');
    await loadAttachmentsForPost(postId);
  } catch {
    toast.error('첨부파일 삭제에 실패했습니다.');
  }
};

const handleReplyAttachmentChange = (files: File | File[] | null) => {
  const next = Array.isArray(files) ? files.slice(0, files.length) : files ? [files] : [];
  replyAttachmentFiles.value = next.filter((file): file is File => file instanceof File);
  replyAttachmentError.value = null;
};

const handleEditAttachmentChange = (files: File | File[] | null) => {
  const next = Array.isArray(files) ? files.slice(0, files.length) : files ? [files] : [];
  editAttachmentFiles.value = next.filter((file): file is File => file instanceof File);
  editAttachmentError.value = null;
};

const insertEditMp4Url = () => {
  const url = window.prompt('MP4 URL을 입력하세요.');
  if (!url) return;
  const safeUrl = url.trim();
  editEditor.value?.chain().focus().insertContent({ type: 'video', attrs: { src: safeUrl, controls: true } }).run();
};
const insertEditReplyImageUrl = () => {
  const url = window.prompt('이미지 URL을 입력하세요.');
  if (!url) return;
  editReplyEditor.value?.chain().focus().setImage({ src: url.trim() }).run();
};

const insertEditReplyVideoUrl = () => {
  const url = window.prompt('동영상 URL을 입력하세요. (YouTube 지원)');
  if (!url) return;
  editReplyEditor.value?.chain().focus().setYoutubeVideo({ src: url.trim() }).run();
};

const insertEditReplyMp4Url = () => {
  const url = window.prompt('MP4 URL을 입력하세요.');
  if (!url) return;
  const safeUrl = url.trim();
  editReplyEditor.value?.chain().focus().insertContent({ type: 'video', attrs: { src: safeUrl, controls: true } }).run();
};

const openReplyDialog = () => {
  dialogs.value.reply = true;
};

const closeReplyDialog = (force = false) => {
  if (saving.value && !force) return;
  dialogs.value.reply = false;
  editor.value?.commands.setContent('');
  replyAttachmentFiles.value = [];
  replyAttachmentError.value = null;
  replyAttachmentUploading.value = false;
};

const openEditDialog = () => {
  editTitle.value = topic.value?.title ?? '';
  editTags.value = (topic.value?.tags ?? []).join(', ');
  editEditor.value?.commands.setContent(renderContent(firstPost.value?.content ?? ''));
  dialogs.value.edit = true;
};

const closeEditDialog = () => {
  if (saving.value) return;
  dialogs.value.edit = false;
  editEditor.value?.commands.setContent('');
  editAttachmentFiles.value = [];
  editAttachmentError.value = null;
  editAttachmentUploading.value = false;
};
const editReplyTarget = ref<any | null>(null);

const openEditReplyDialog = (post: any) => {
  editReplyTarget.value = post;
  editReplyEditor.value?.commands.setContent(renderContent(post?.content ?? ''));
  dialogs.value.editReply = true;
};

const closeEditReplyDialog = () => {
  if (saving.value) return;
  dialogs.value.editReply = false;
  editReplyTarget.value = null;
  editReplyEditor.value?.commands.setContent('');
};

const submitReply = async () => {
  if (!canReply.value) return;
  const slug = forumSlug.value;
  const id = topicId.value;
  if (!slug || !Number.isFinite(id) || id <= 0) return;
  saving.value = true;
  try {
    const contentHtml = editor.value?.getHTML()?.trim() ?? '';
    const result = await forumsAdminApi.createPost(slug, id, { content: contentHtml });
    const postId = Number((result as any)?.postId ?? 0);
    if (postId && replyAttachmentFiles.value.length > 0) {
      replyAttachmentUploading.value = true;
      try {
        await uploadPostAttachments(postId, replyAttachmentFiles.value);
        replyAttachmentFiles.value = [];
        replyAttachmentError.value = null;
      } catch (error: any) {
        replyAttachmentError.value = resolveAxiosError(error);
        toast.error('첨부파일 업로드에 실패했습니다.');
      } finally {
        replyAttachmentUploading.value = false;
      }
    }
    toast.success('댓글이 등록되었습니다.');
    closeReplyDialog(true);
    refresh();
  } catch (e: any) {
    toast.error('댓글 등록에 실패했습니다.');
  } finally {
    saving.value = false;
  }
};

const submitEditTopic = async () => {
  if (!canEditTopic.value) return;
  const slug = forumSlug.value;
  const id = topicId.value;
  const etag = topicEtag.value;
  if (!slug || !Number.isFinite(id) || id <= 0 || !etag) return;
  saving.value = true;
  try {
    const tags = editTags.value
      .split(',')
      .map((tag) => tag.trim())
      .filter((tag) => tag.length > 0);
    const updated = await forumsPublicApi.updateTopic(
      slug,
      id,
      { title: editTitle.value.trim(), tags },
      etag
    );
    topicEtag.value = updated.etag ?? topicEtag.value;
    if (firstPost.value?.id) {
      const version = Number(firstPost.value?.version ?? 0);
      const ifMatch = `W/"${version}"`;
      const contentHtml = editEditor.value?.getHTML()?.trim() ?? '';
      await forumsPublicApi.updatePost(slug, id, Number(firstPost.value.id), { content: contentHtml }, ifMatch);
    }
    const postId = Number(firstPost.value?.id ?? 0);
    if (postId && editAttachmentFiles.value.length > 0) {
      editAttachmentUploading.value = true;
      try {
        await uploadPostAttachments(postId, editAttachmentFiles.value);
        editAttachmentFiles.value = [];
        editAttachmentError.value = null;
      } catch (error: any) {
        editAttachmentError.value = resolveAxiosError(error);
        toast.error('첨부파일 업로드에 실패했습니다.');
      } finally {
        editAttachmentUploading.value = false;
      }
    }
    toast.success('게시글이 수정되었습니다.');
    dialogs.value.edit = false;
    await loadTopic();
  } catch {
    toast.error('게시글 수정에 실패했습니다.');
  } finally {
    saving.value = false;
  }
};

const submitEditReply = async () => {
  if (!canEditReply.value || !editReplyTarget.value) return;
  const slug = forumSlug.value;
  const id = topicId.value;
  if (!slug || !Number.isFinite(id) || id <= 0) return;
  saving.value = true;
  try {
    const contentHtml = editReplyEditor.value?.getHTML()?.trim() ?? '';
    const version = Number(editReplyTarget.value?.version ?? 0);
    const ifMatch = `W/\"${version}\"`;
    await forumsPublicApi.updatePost(
      slug,
      id,
      Number(editReplyTarget.value.id),
      { content: contentHtml },
      ifMatch
    );
    toast.success('댓글이 수정되었습니다.');
    closeEditReplyDialog();
    refresh();
  } catch {
    toast.error('댓글 수정에 실패했습니다.');
  } finally {
    saving.value = false;
  }
};

const posts = computed(() => dataStore.dataItems ?? []);
const firstPost = computed(() => posts.value[0] ?? null);
const canManageAttachments = computed(() => {
  if (!canUploadAttachments.value) return false;
  const identifier = firstPost.value?.createdById ?? null;
  return isOwner(identifier, {
    byId: true,
    userId: auth.user?.userId ?? null,
    username: auth.user?.username ?? null,
  });
});
const topicPinned = computed(() => topic.value?.pinned ?? false);
const topicLocked = computed(() => topic.value?.locked ?? false);
const replies = computed(() => posts.value.slice(1));
const page = computed(() => dataStore.page ?? 0);
const pageSize = computed(() => dataStore.pageSize ?? 20);
const totalCount = computed(() => Number(dataStore.total ?? posts.value.length));
const hasPrev = computed(() => page.value > 0);
const hasNext = computed(() => posts.value.length >= pageSize.value);
const firstPostAttachments = computed(() => {
  const postId = firstPost.value?.id;
  return postId ? postAttachments.value[postId] ?? [] : [];
});
const firstPostAttachmentsLoading = computed(() => {
  const postId = firstPost.value?.id;
  return postId ? postAttachmentsLoading.value[postId] ?? false : false;
});
const canManageAttachmentsForPost = (post: PostResponse) => {
  if (!canUploadAttachments.value) return false;
  const identifier = post?.createdById ?? null;
  return isOwner(identifier, {
    byId: true,
    userId: auth.user?.userId ?? null,
    username: auth.user?.username ?? null,
  });
};
const attachmentsForPost = (postId?: number) => {
  if (!postId) return [];
  return postAttachments.value[postId] ?? [];
};
const attachmentsLoadingForPost = (postId?: number) => {
  if (!postId) return false;
  return postAttachmentsLoading.value[postId] ?? false;
};

const deletable = (identifier?: number | string | null, byId = true) =>
  isOwner(identifier, {
    byId,
    userId: auth.user?.userId ?? null,
    username: auth.user?.username ?? null,
  });
const editable = (identifier?: number | string | null, byId = true) =>
  isOwner(identifier, {
    byId,
    userId: auth.user?.userId ?? null,
    username: auth.user?.username ?? null,
  });

const canDeleteTopic = computed(() => {
  const identifier = firstPost.value?.createdById ?? null;
  if (!deletable(identifier, true)) return false;
  if (totalCount.value > 1) return false;
  if (!topicEtag.value) return false;
  return true;
});

const toolbarItems = computed(() => {
  const items: { icon: string; event: string; tooltip: string; color?: string; disabled?: boolean }[] = [];
  if (canDeleteTopic.value) {
    items.push({
      icon: 'mdi-forum-remove',
      event: 'delete',
      tooltip: '게시글 삭제',
      color: 'error',
    });
  }
  const identifier = firstPost.value?.createdById ?? null;
  if (editable(identifier, true) && topicEtag.value) {
    items.push({
      icon: 'mdi-text-box-edit-outline',
      event: 'edit',
      tooltip: '게시글 수정',
      color: 'primary',
    });
  }
  if (canReplyTopic.value) {
    items.push({ icon: 'mdi-timeline-text-outline', event: 'create', color: 'blue', tooltip: '댓글 작성' });
  }
  if (canPinTopic.value) {
    items.push({
      icon: topicPinned.value ? 'mdi-pin-off' : 'mdi-pin',
      event: 'pin',
      tooltip: topicPinned.value ? '핀 해제' : '상단 고정',
      disabled: pinning.value,
      color: pinning.value ? 'primary' : undefined,
    });
  }
  if (canLockTopic.value) {
    items.push({
      icon: topicLocked.value ? 'mdi-lock-open' : 'mdi-lock',
      event: 'lock',
      tooltip: topicLocked.value ? '잠금 해제' : '토픽 잠금',
      disabled: locking.value,
      color: locking.value ? 'error' : undefined,
    });
  }
  items.push({ icon: 'mdi-refresh', event: 'refresh', tooltip: '새로고침' });
  return items;
});
const pageLabel = computed(() => `페이지 ${page.value + 1}`);

const refresh = () => {
  dataStore.fetch();
};

const goPrev = async () => {
  if (!hasPrev.value) return;
  dataStore.setPage(page.value - 1);
  await dataStore.fetch();
};

const goNext = async () => {
  if (!hasNext.value) return;
  dataStore.setPage(page.value + 1);
  await dataStore.fetch();
};

const deleteTopic = async () => {
  if (!canDeleteTopic.value) return;
  const ok = await confirm({
    title: '확인',
    message: '이 게시글을 삭제하시겠습니까?',
    okText: '삭제',
    cancelText: '취소',
    color: 'error',
  });
  if (!ok) return;
  const slug = forumSlug.value;
  const id = topicId.value;
  const etag = topicEtag.value;
  if (!slug || !id || !etag) return;
  try {
    await forumsAdminApi.deleteTopic(slug, id, etag);
    toast.success('게시글이 삭제되었습니다.');
    await router.push({ name: 'CommunityForumTopics', params: { forumSlug: slug } });
  } catch {
    toast.error('게시글 삭제에 실패했습니다.');
  }
};

const deleteReply = async (post: any) => {
  const slug = forumSlug.value;
  const id = topicId.value;
  if (!slug || !id) return;
  const ok = await confirm({
    title: '확인',
    message: '이 댓글을 삭제하시겠습니까?',
    okText: '삭제',
    cancelText: '취소',
    color: 'error',
  });
  if (!ok) return;
  try {
    const version = Number(post?.version ?? 0);
    const ifMatch = `W/"${version}"`;
    await forumsAdminApi.deletePost(slug, id, Number(post.id), ifMatch);
    toast.success('댓글이 삭제되었습니다.');
    refresh();
  } catch {
    toast.error('댓글 삭제에 실패했습니다.');
  }
};

const renderContent = (value?: string | null) => {
  if (!value) return '';
  if (!/&lt;|&gt;|&amp;/.test(value)) return value;
  const textarea = document.createElement('textarea');
  textarea.innerHTML = value;
  return textarea.value;
};

const loading = ref(false);

const loadTopic = async () => {
  const slug = forumSlug.value;
  const id = topicId.value;
  if (!slug || !Number.isFinite(id) || id <= 0) return;
  try {
    loading.value = true;
    const res = await forumsPublicApi.getTopic(slug, id);
    topic.value = res?.data ?? res ?? null;
    topicEtag.value = res?.etag ?? null;
  } catch {
    topic.value = null;
    topicEtag.value = null;
  } finally {
    loading.value = false;
  }
};

const formatFileSize = (size: number) => {
  if (!Number.isFinite(size)) return '';
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
};

const openAttachment = (url?: string) => {
  if (!url) return;
  window.open(url, '_blank');
};

const togglePinTopic = async () => {
  const slug = forumSlug.value;
  const id = topicId.value;
  const etag = topicEtag.value;
  if (!slug || !Number.isFinite(id) || id <= 0 || !etag) return;
  const target = !topicPinned.value;
  const ok = await confirm({
    title: '확인',
    message: target ? '토픽을 상단으로 고정하시겠습니까?' : '토픽 고정을 해제하시겠습니까?',
    okText: target ? '고정' : '해제',
    cancelText: '취소',
    color: target ? 'primary' : 'error',
  });
  if (!ok) return;
  pinning.value = true;
  try {
    await forumsAdminApi.pinTopic(slug, id, { pinned: target }, etag);
    toast.success(target ? '토픽이 고정되었습니다.' : '토픽 고정이 해제되었습니다.');
    await loadTopic();
  } catch {
    toast.error('토픽 고정 상태를 변경하지 못했습니다.');
  } finally {
    pinning.value = false;
  }
};

const toggleLockTopic = async () => {
  const slug = forumSlug.value;
  const id = topicId.value;
  const etag = topicEtag.value;
  if (!slug || !Number.isFinite(id) || id <= 0 || !etag) return;
  const target = !topicLocked.value;
  const ok = await confirm({
    title: '확인',
    message: target ? '토픽을 잠그시겠습니까?' : '토픽 잠금을 해제하시겠습니까?',
    okText: target ? '잠금' : '해제',
    cancelText: '취소',
    color: target ? 'error' : 'primary',
  });
  if (!ok) return;
  locking.value = true;
  try {
    await forumsAdminApi.lockTopic(slug, id, { locked: target }, etag);
    toast.success(target ? '토픽이 잠금되었습니다.' : '토픽 잠금이 해제되었습니다.');
    await loadTopic();
  } catch {
    toast.error('토픽 잠금 상태를 변경하지 못했습니다.');
  } finally {
    locking.value = false;
  }
};

const openHideDialog = (post: PostResponse) => {
  hideTarget.value = post;
  hideReason.value = '';
  hideDialog.value = true;
};

const closeHideDialog = () => {
  hideDialog.value = false;
  hideTarget.value = null;
  hideReason.value = '';
};

const submitHidePost = async () => {
  if (!hideTarget.value) return;
  const slug = forumSlug.value;
  const id = topicId.value;
  const postId = Number(hideTarget.value.id);
  const version = Number(hideTarget.value.version ?? 0);
  const ifMatch = `W/"${version}"`;
  const hidden = !(hideTarget.value.hidden ?? false);
  hiding.value = true;
  try {
    await forumsAdminApi.hidePost(
      slug,
      id,
      postId,
      {
        hidden,
        reason: hideReason.value?.trim() || undefined,
      },
      ifMatch
    );
    toast.success(hidden ? '댓글이 숨겨졌습니다.' : '댓글 숨김이 해제되었습니다.');
    closeHideDialog();
    refresh();
  } catch {
    toast.error('댓글 숨김 처리에 실패했습니다.');
  } finally {
    hiding.value = false;
  }
};

const applyPostFilter = () => {
  const params: Record<string, any> = {};
  if (includeHiddenPosts.value) {
    params.includeHidden = true;
  }
  dataStore.setFilter(params);
};
applyPostFilter();

watch(
  () => [forumSlug.value, topicId.value],
  ([slug, id]) => {
    const slugValue = String(slug ?? "");
    const idValue = Number(id);
    if (!slugValue || !Number.isFinite(idValue) || idValue <= 0) return;
    dataStore.setForumSlug(slugValue);
    dataStore.setTopicId(idValue);
    refresh();
  }
);

watch(forumSlug, (slug) => {
  if (!slug) return;
  authzStore.loadForumAuthz(slug).catch(() => { });
});

watch(
  canReadAttachments,
  (allowed) => {
    if (!allowed) return;
    const ids = (posts.value ?? [])
      .map((post) => Number(post.id))
      .filter((id) => Number.isFinite(id) && id > 0);
    ids.forEach((postId) => {
      if (!postAttachments.value[postId] && !postAttachmentsLoading.value[postId]) {
        loadAttachmentsForPost(postId);
      }
    });
  },
);

watch(
  posts,
  (items) => {
    const ids = (items ?? []).map((post) => Number(post.id)).filter((id) => Number.isFinite(id) && id > 0);
    if (canReadAttachments.value) {
      ids.forEach((postId) => {
        if (!postAttachments.value[postId] && !postAttachmentsLoading.value[postId]) {
          loadAttachmentsForPost(postId);
        }
      });
    }
  },
  { immediate: true }
);

watch(
  () => firstPost.value?.id,
  (postId) => {
    if (postId && canReadAttachments.value) {
      loadAttachmentsForPost(postId);
    }
  }
);

watch(includeHiddenPosts, () => {
  applyPostFilter();
  dataStore.setPage(0);
  refresh();
});

onMounted(async () => {
  const slug = forumSlug.value;
  const id = topicId.value;
  if (!slug || !Number.isFinite(id) || id <= 0) return;
  dataStore.setForumSlug(slug);
  dataStore.setTopicId(id);
  await loadTopic();
  await authzStore.loadForumAuthz(slug).catch(() => { });
  refresh();
});
</script>

<style scoped>
.tiptap-shell {
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  padding: 10px 12px;
  background: #fff;
  min-height: 160px;
}

.tiptap-toolbar {
  display: flex;
  align-items: center;
  gap: 6px;
  padding-bottom: 8px;
  border-bottom: 1px solid #e0e0e0;
  margin-bottom: 8px;
}

.tiptap-shell :deep(.ProseMirror) {
  outline: none;
  min-height: 140px;
}

.tiptap-shell :deep(.ProseMirror p.is-editor-empty:first-child::before) {
  content: attr(data-placeholder);
  float: left;
  color: #9e9e9e;
  pointer-events: none;
  height: 0;
}

.tiptap-shell :deep(img) {
  max-width: 100%;
  height: auto;
  display: block;
}

.tiptap-shell :deep(iframe) {
  max-width: 100%;
  width: 100%;
  aspect-ratio: 16 / 9;
  height: auto;
  display: block;
}

.tiptap-shell :deep(video) {
  max-width: 100%;
  width: 100%;
  height: auto;
  display: block;
}

.tiptap-shell :deep(.ProseMirror .is-selected img),
.tiptap-shell :deep(.ProseMirror .is-selected video) {
  outline: 2px dashed var(--v-theme-primary);
  outline-offset: 4px;
}

.link-edit-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: flex-end;
  margin-bottom: 4px;
}

.media-helper {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  border-radius: 6px;
  padding: 6px 10px;
}

.tiptap-shell :deep(.ProseMirror .is-selected img),
.tiptap-shell :deep(.ProseMirror .is-selected video),
.tiptap-shell :deep(.ProseMirror figure.is-selected img),
.tiptap-shell :deep(.ProseMirror figure.is-selected video) {
  box-shadow: 0 0 0 2px rgba(13, 71, 161, 0.25);
  border-radius: 4px;
  transition: box-shadow 0.15s ease, outline 0.15s ease;
}

.post-content :deep(img) {
  max-width: 100%;
  height: auto;
  display: block;
}

.post-content :deep(iframe) {
  max-width: 100%;
  width: 100%;
  aspect-ratio: 16 / 9;
  height: auto;
  display: block;
}

.post-content :deep(video) {
  max-width: 100%;
  width: 100%;
  height: auto;
  display: block;
}

.post-content {
  white-space: pre-line;
  line-height: 1.85;
  letter-spacing: 0.01em;
}

.post-content :deep(p),
.post-content :deep(li) {
  margin: 0 0 0.85em;
}

.post-content :deep(p:last-child),
.post-content :deep(li:last-child) {
  margin-bottom: 0;
}

.reply-card {
  border-color: #e0e0e0;
  min-width: 100%;
}

.reply-item :deep(.v-timeline-item__body) {
  width: 100%;
  max-width: 500px;
}

.reply-card__content {
  padding-bottom: 6px;
}

.reply-card__actions {
  padding-top: 0;
  padding-bottom: 0;
}

.discourse-outline {
  border: 1px solid #e0e0e0;
  border-radius: 8px;
}
</style>
