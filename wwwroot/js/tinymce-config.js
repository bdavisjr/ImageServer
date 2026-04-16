function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.addEventListener("load", () => resolve(reader.result));
        reader.addEventListener("error", () => reject(new Error("The dropped image could not be read.")));
        reader.readAsDataURL(file);
    });
}

export function initializeTinyMceEditor({
    imageServerEditor,
    imagePersistenceMode = "on-save",
    onEditorReady,
    onEditorContentChange,
    onImageUploadStatusChange,
    onImageUploaded = () => {}
}) {
    async function insertImage(editor, file) {
        if (imagePersistenceMode === "immediate") {
            onImageUploadStatusChange("Uploading image...", "working");
            const location = await imageServerEditor.uploadImage({
                blob: () => file,
                filename: () => file.name
            }, () => {});
            onImageUploadStatusChange("Upload complete", "success");
            await onImageUploaded(location);
            return {
                source: location,
                title: file.name
            };
        }

        const dataUrl = await readFileAsDataUrl(file);
        onImageUploadStatusChange("Image inserted", "idle");
        await onImageUploaded(dataUrl);
        return {
            source: dataUrl,
            title: file.name
        };
    }

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
            if (imagePersistenceMode !== "immediate") {
                return await readFileAsDataUrl(blobInfo.blob());
            }

            onImageUploadStatusChange("Uploading image...", "working");

            try {
                const location = await imageServerEditor.uploadImage(blobInfo, progress);
                onImageUploadStatusChange("Upload complete", "success");
                await onImageUploaded(location);
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

            // The page can choose whether picker-selected images stay temporary or upload right away.
            const input = document.createElement("input");
            input.type = "file";
            input.accept = "image/png,image/jpeg,image/gif,image/webp";
            input.addEventListener("change", async () => {
                const file = input.files?.[0];
                if (!file) {
                    return;
                }

                try {
                    const image = await insertImage(tinymce.get("editor"), file);
                    callback(image.source, { title: image.title });
                } catch {
                    onImageUploadStatusChange("Image insert failed", "error");
                    window.alert("The selected image could not be added to the editor.");
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

                // Drag/drop follows the same persistence mode as the picker-selected image flow.
                event.preventDefault();
                event.stopPropagation();

                void (async () => {
                    editor.focus();

                    for (const file of imageFiles) {
                        const altText = file.name.replace(/"/g, "&quot;");
                        const image = await insertImage(editor, file);
                        editor.insertContent(`<p><img src="${image.source}" alt="${altText}"></p>`);
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
