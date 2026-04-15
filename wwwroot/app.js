const statusPill = document.getElementById("status-pill");
const lastUploadUrl = document.getElementById("last-upload-url");
const htmlOutput = document.getElementById("html-output");
const insertSampleButton = document.getElementById("insert-sample");
const clearEditorButton = document.getElementById("clear-editor");

function setStatus(message, tone = "idle") {
    statusPill.textContent = message;
    statusPill.dataset.tone = tone;
}

function syncHtmlOutput(editor) {
    htmlOutput.value = editor.getContent();
}

async function uploadImage(blobInfo, progress) {
    const formData = new FormData();
    formData.append("file", blobInfo.blob(), blobInfo.filename());

    const xhr = new XMLHttpRequest();

    return await new Promise((resolve, reject) => {
        xhr.open("POST", "/api/images");

        xhr.upload.addEventListener("progress", (event) => {
            if (!event.lengthComputable) {
                return;
            }

            progress((event.loaded / event.total) * 100);
        });

        xhr.addEventListener("load", () => {
            if (xhr.status < 200 || xhr.status >= 300) {
                const message = xhr.responseText || "Image upload failed.";
                reject(message);
                return;
            }

            try {
                const result = JSON.parse(xhr.responseText);
                if (!result.location) {
                    reject("Upload succeeded but no location was returned.");
                    return;
                }

                lastUploadUrl.value = result.location;
                resolve(result.location);
            } catch {
                reject("Upload succeeded but the JSON response could not be read.");
            }
        });

        xhr.addEventListener("error", () => reject("Network error while uploading image."));
        xhr.send(formData);
    });
}

tinymce.init({
    selector: "#editor",
    height: 540,
    menubar: "file edit view insert format tools table help",
    plugins: "image code table lists link autoresize paste",
    toolbar: "undo redo | blocks | bold italic underline | alignleft aligncenter alignright | bullist numlist | link image table | code",
    branding: false,
    image_title: true,
    automatic_uploads: true,
    paste_data_images: true,
    file_picker_types: "image",
    images_upload_handler: async (blobInfo, progress) => {
        setStatus("Uploading image...", "working");

        try {
            const location = await uploadImage(blobInfo, progress);
            setStatus("Upload complete", "success");
            return location;
        } catch (error) {
            setStatus("Upload failed", "error");
            throw new Error(typeof error === "string" ? error : "Image upload failed.");
        }
    },
    file_picker_callback: (callback, _value, meta) => {
        if (meta.filetype !== "image") {
            return;
        }

        const input = document.createElement("input");
        input.type = "file";
        input.accept = "image/png,image/jpeg,image/gif,image/webp";
        input.addEventListener("change", async () => {
            const file = input.files?.[0];
            if (!file) {
                return;
            }

            const blobInfo = {
                blob: () => file,
                filename: () => file.name
            };

            setStatus("Uploading image...", "working");

            try {
                const location = await uploadImage(blobInfo, () => {});
                setStatus("Upload complete", "success");
                callback(location, { title: file.name });
            } catch (error) {
                setStatus("Upload failed", "error");
                window.alert(typeof error === "string" ? error : "Image upload failed.");
            }
        });

        input.click();
    },
    setup: (editor) => {
        editor.on("init", () => {
            setStatus("Editor ready", "success");
            syncHtmlOutput(editor);
        });

        editor.on("change input undo redo setcontent", () => {
            syncHtmlOutput(editor);
        });
    }
});

insertSampleButton.addEventListener("click", () => {
    const editor = tinymce.get("editor");
    if (!editor) {
        return;
    }

    editor.setContent(`
        <h2>Image server smoke test</h2>
        <p>This content was added by the demo harness. Use the image button to upload a local file into the image server.</p>
        <p><strong>Quick checks:</strong></p>
        <ul>
            <li>Upload from the TinyMCE image dialog.</li>
            <li>Paste a screenshot directly into the editor.</li>
            <li>Confirm the returned image URL is reachable.</li>
        </ul>
    `);
    setStatus("Sample content inserted", "idle");
});

clearEditorButton.addEventListener("click", () => {
    const editor = tinymce.get("editor");
    if (!editor) {
        return;
    }

    editor.setContent("");
    setStatus("Editor cleared", "idle");
});
