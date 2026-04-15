export function initializeTinyMce({
    onEditorReady,
    onEditorContentChange,
    onImageUploadStatusChange,
    uploadImage
}) {
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
                onEditorReady(editor);
            });

            editor.on("change input undo redo setcontent", () => {
                onEditorContentChange(editor);
            });
        }
    });
}
