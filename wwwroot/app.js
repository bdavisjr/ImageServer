import { initializeHarness } from "/js/harness.js";
import { initializeTinyMce } from "/js/tinymce-config.js";
import { createImageUploadService } from "/js/image-upload.js";

const elements = {
    statusPill: document.getElementById("status-pill"),
    lastUploadUrl: document.getElementById("last-upload-url"),
    htmlOutput: document.getElementById("html-output"),
    insertSampleButton: document.getElementById("insert-sample"),
    copyTestImageButton: document.getElementById("copy-test-image"),
    saveEditorButton: document.getElementById("save-editor"),
    clearEditorButton: document.getElementById("clear-editor"),
    headerImage: document.getElementById("header-image"),
    headerImagePlaceholder: document.getElementById("header-image-placeholder"),
    uploadedImages: document.getElementById("uploaded-images")
};

const imageUploadService = createImageUploadService({
    onUploadComplete: (location) => {
        elements.lastUploadUrl.value = location;
    }
});

const harness = initializeHarness({
    elements,
    imageUploadService,
    initializeTinyMce
});

harness.start();
