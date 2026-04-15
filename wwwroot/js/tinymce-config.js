function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.addEventListener("load", () => resolve(reader.result));
        reader.addEventListener("error", () => reject(new Error("The dropped image could not be read.")));
        reader.readAsDataURL(file);
    });
}

export function initializeTinyMce({
    onEditorReady,
    onEditorContentChange,
    onImageUploadStatusChange,
    uploadImage
}) {
    // Keep editor configuration isolated so the harness can focus on page behavior.
    tinymce.init({
        selector: "#editor",
        license_key: "gpl",
        min_height: 420,
        menubar: "file edit view insert format tools table help",
        content_css: "/editor-content.css",
        plugins: "image code table lists link autoresize paste",
        toolbar: "undo redo | blocks | bold italic underline | alignleft aligncenter alignright | bullist numlist | link image table | pastetext code",
        branding: false,
        image_title: true,
        automatic_uploads: false,
        paste_data_images: true,
        smart_paste: true,
        autoresize_bottom_margin: 24,
        autoresize_overflow_padding: 16,
        file_picker_types: "image",
        images_upload_handler: async (blobInfo, progress) => {
            // Toolbar-driven image inserts are intentional, so they upload immediately.
            onImageUploadStatusChange("Uploading image...", "working");

            try {
                const location = await uploadImage(blobInfo, progress);
                onImageUploadStatusChange("Upload complete", "success");
                return location;
            } catch (error) {
                onImageUploadStatusChange("Upload failed", "error");
                throw new Error(typeof error === "string" ? error : "Image upload failed.");
            }
        },
        file_picker_callback: (callback, _value, meta) => {
            if (meta.filetype !== "image") {
                return;
            }

            // Use the same upload path whether the user picks a file or uses TinyMCE's upload handler.
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

                onImageUploadStatusChange("Uploading image...", "working");

                try {
                    const location = await uploadImage(blobInfo, () => {});
                    onImageUploadStatusChange("Upload complete", "success");
                    callback(location, { title: file.name });
                } catch (error) {
                    onImageUploadStatusChange("Upload failed", "error");
                    window.alert(typeof error === "string" ? error : "Image upload failed.");
                }
            });

            input.click();
        },
        setup: (editor) => {
            editor.on("init", () => {
                // Let the harness restore draft state and sync its side panel once the editor exists.
                onEditorReady(editor);
            });

            editor.on("drop", (event) => {
                const imageFiles = Array.from(event.dataTransfer?.files ?? [])
                    .filter((file) => file.type.startsWith("image/"));

                if (!imageFiles.length) {
                    return;
                }

                // Treat drag/drop like paste: show the image now, but defer server upload until save.
                event.preventDefault();
                event.stopPropagation();

                void (async () => {
                    editor.focus();

                    for (const file of imageFiles) {
                        const dataUrl = await readFileAsDataUrl(file);
                        const altText = file.name.replace(/"/g, "&quot;");
                        editor.insertContent(`<p><img src="${dataUrl}" alt="${altText}"></p>`);
                    }

                    onEditorContentChange(editor);
                })().catch(() => {
                    onImageUploadStatusChange("Drop failed", "error");
                    window.alert("The dropped image could not be added to the editor.");
                });
            });

            // Keep the side-panel HTML output in sync with normal edits and programmatic content updates.
            editor.on("change input undo redo setcontent", () => {
                onEditorContentChange(editor);
            });
        }
    });
}
