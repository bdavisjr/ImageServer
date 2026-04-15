const savedDraftStorageKey = "image-server-harness-editor-html";
const defaultHeaderImageUrl = "/img/Blog_DecisionRoad.jpg";
const defaultSampleImageUrl = "/img/Blog_FlyingGirl.jpg";
const emptyUploadValue = "No uploads yet";

function getEditor() {
    // TinyMCE owns the textarea after init, so interactions go through its editor instance.
    return tinymce.get("editor");
}

function copyImageToClipboardFactory() {
    return async function copyImageToClipboard(src) {
        if (!navigator.clipboard || !window.ClipboardItem) {
            throw new Error("This browser does not support image clipboard writes.");
        }

        const response = await fetch(src);
        if (!response.ok) {
            throw new Error("The image could not be loaded for clipboard copy.");
        }

        const blob = await response.blob();
        const contentType = blob.type || "image/jpeg";

        await navigator.clipboard.write([
            new ClipboardItem({
                [contentType]: blob
            })
        ]);
    };
}

export function initializeHarness({ elements, imageUploadService, initializeTinyMce }) {
    const copyImageToClipboard = copyImageToClipboardFactory();

    function setStatus(message, tone = "idle") {
        elements.statusPill.textContent = message;
        elements.statusPill.dataset.tone = tone;
    }

    function syncHtmlOutput(editor) {
        // Show the current editor markup in the side panel for quick inspection during testing.
        elements.htmlOutput.value = editor.getContent();
    }

    function getHeaderImageUrl() {
        // Keep the header test image stable so copy/paste testing stays predictable.
        return defaultHeaderImageUrl;
    }

    function getLastUploadedUrl() {
        return elements.lastUploadUrl.value;
    }

    function hasUploadedImage() {
        const uploadedImageUrl = getLastUploadedUrl();
        return uploadedImageUrl && uploadedImageUrl !== emptyUploadValue;
    }

    function getSampleImageSrc() {
        return hasUploadedImage() ? getLastUploadedUrl() : defaultSampleImageUrl;
    }

    function syncHeaderImage() {
        // The placeholder is only useful before the test image is available.
        elements.headerImage.src = getHeaderImageUrl();
        elements.headerImage.hidden = false;
        elements.headerImagePlaceholder.hidden = true;
    }

    function renderEmptyGallery(message) {
        elements.uploadedImages.innerHTML = `<div class="gallery-empty">${message}</div>`;
    }

    function renderGallery(images) {
        if (!images.length) {
            renderEmptyGallery("No uploaded images yet.");
            return;
        }

        elements.uploadedImages.innerHTML = images.map((image) => `
            <a class="gallery-item" href="${image.url}" target="_blank" rel="noreferrer">
                <img src="${image.url}" alt="${image.fileName}">
                <span>${image.fileName}</span>
            </a>
        `).join("");
    }

    async function loadUploadedImages() {
        try {
            const images = await imageUploadService.listImages();
            renderGallery(images);
        } catch {
            renderEmptyGallery("Uploaded images could not be loaded.");
        }
    }

    function restoreDraft(editor) {
        // Drafts are stored client-side so the harness can survive refreshes without a database.
        const savedDraft = window.localStorage.getItem(savedDraftStorageKey);
        if (!savedDraft) {
            return false;
        }

        editor.setContent(savedDraft);
        setStatus("Draft restored", "success");
        return true;
    }

    async function saveDraft() {
        const editor = getEditor();
        if (!editor) {
            return;
        }

        setStatus("Saving draft...", "working");

        // Replace pasted/base64 and local sample images with stored server URLs before saving.
        const normalizedContent = await imageUploadService.normalizeEditorContent(editor.getContent());
        editor.setContent(normalizedContent);
        window.localStorage.setItem(savedDraftStorageKey, normalizedContent);
        syncHtmlOutput(editor);
        setStatus("Draft saved", "success");
        await loadUploadedImages();
    }

    function insertSampleContent() {
        const editor = getEditor();
        if (!editor) {
            return;
        }

        // Append a realistic content block instead of replacing whatever the editor already has.
        editor.insertContent(`
            <article class="sample-card">
                <img src="${getSampleImageSrc()}" alt="Sample card image" class="sample-card-image">
                <div class="sample-card-body">
                    <p class="sample-card-eyebrow">Sample image card</p>
                    <h2 class="sample-card-title">TinyMCE image card smoke test</h2>
                    <p class="sample-card-text">
                        This sample is useful for testing a realistic content block with an image, headline, supporting copy, and a call to action.
                    </p>
                    <p class="sample-card-text">
                        The header preview uses the decision-road image for copy/paste testing. This sample card uses the flying image by default, and switches to the latest upload after you add one.
                    </p>
                    <a href="#" class="sample-card-button">Review uploaded image</a>
                </div>
            </article><p></p>
        `);
        setStatus("Sample content inserted", "idle");
    }

    async function copyTestImage() {
        // Prefer the latest uploaded image when available so copy/paste can exercise stored assets too.
        const sourceImageUrl = hasUploadedImage() ? getLastUploadedUrl() : defaultHeaderImageUrl;

        try {
            await copyImageToClipboard(sourceImageUrl);
            setStatus("Image copied", "success");
        } catch (error) {
            setStatus("Copy failed", "error");
            window.alert(typeof error === "string" ? error : "The image could not be copied to the clipboard.");
        }
    }

    function clearEditor() {
        const editor = getEditor();
        if (!editor) {
            return;
        }

        editor.setContent("");
        window.localStorage.removeItem(savedDraftStorageKey);
        elements.lastUploadUrl.value = emptyUploadValue;
        syncHeaderImage();
        renderEmptyGallery("No uploaded images yet.");
        setStatus("Editor cleared", "idle");
    }

    function wireEvents() {
        // Keep button wiring here so the module entry point only has to call start().
        elements.insertSampleButton.addEventListener("click", insertSampleContent);
        elements.copyTestImageButton.addEventListener("click", () => {
            void copyTestImage();
        });
        elements.saveEditorButton.addEventListener("click", () => {
            void saveDraft().catch((error) => {
                setStatus("Save failed", "error");
                window.alert(typeof error === "string" ? error : "The draft could not be saved.");
            });
        });
        elements.clearEditorButton.addEventListener("click", clearEditor);
    }

    function start() {
        wireEvents();
        syncHeaderImage();
        void loadUploadedImages();

        initializeTinyMce({
            onEditorReady: (editor) => {
                const restored = restoreDraft(editor);
                if (!restored) {
                    setStatus("Editor ready", "success");
                    syncHtmlOutput(editor);
                }
            },
            onEditorContentChange: syncHtmlOutput,
            onImageUploadStatusChange: setStatus,
            uploadImage: async (blobInfo, progress) => {
                // Refresh the gallery after explicit uploads so the harness reflects stored state right away.
                const location = await imageUploadService.uploadImage(blobInfo, progress);
                syncHeaderImage();
                await loadUploadedImages();
                return location;
            }
        });
    }

    return {
        start
    };
}
