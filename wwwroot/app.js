import { initializeHarness } from "/js/harness.js";
import { initializeTinyMceEditor } from "/js/tinymce-config.js";
import { createImageServerEditor } from "/js/image-upload.js";

// Keep the entry point tiny so the page wiring stays easy to scan.
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

const imageServerEditor = createImageServerEditor({
    onUploadComplete: (location) => {
        elements.lastUploadUrl.value = location;
    }
});

// Compose the harness from focused modules rather than one large script.
const harness = initializeHarness({
    elements,
    imageServerEditor,
    initializeTinyMceEditor
});

harness.start();
