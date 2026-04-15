function getImageExtension(contentType) {
    // Keep imported filenames aligned with their detected image type before upload.
    switch (contentType) {
        case "image/png":
            return ".png";
        case "image/gif":
            return ".gif";
        case "image/webp":
            return ".webp";
        default:
            return ".jpg";
    }
}

export function createImageUploadService({ onUploadComplete }) {
    async function uploadImage(blobInfo, progress) {
        // TinyMCE hands us a blob-like wrapper; the API expects a normal multipart file field.
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
                    reject(xhr.responseText || "Image upload failed.");
                    return;
                }

                try {
                    const result = JSON.parse(xhr.responseText);
                    if (!result.location) {
                        reject("Upload succeeded but no location was returned.");
                        return;
                    }

                    onUploadComplete(result.location);
                    resolve(result.location);
                } catch {
                    reject("Upload succeeded but the JSON response could not be read.");
                }
            });

            xhr.addEventListener("error", () => reject("Network error while uploading image."));
            xhr.send(formData);
        });
    }

    async function uploadBlob(blob, filename) {
        // Reuse the same API path for imported editor images and direct picker uploads.
        return await uploadImage(
            {
                blob: () => blob,
                filename: () => filename
            },
            () => {}
        );
    }

    function isStoredImageUrl(src) {
        // Once an image already points at this API, it does not need to be imported again on save.
        return src.startsWith("/api/images/") || src.startsWith(`${window.location.origin}/api/images/`);
    }

    function shouldImportImageSource(src) {
        if (!src) {
            return false;
        }

        if (src.startsWith("data:image/")) {
            return true;
        }

        if (src.startsWith("blob:")) {
            return true;
        }

        // Sample assets live under /img until the editor content is normalized and saved.
        return src.startsWith("/img/") || src.startsWith(`${window.location.origin}/img/`);
    }

    async function importImageSource(src, index) {
        // Re-import local sample images and pasted data URLs into the image server on save.
        const response = await fetch(src);
        if (!response.ok) {
            throw new Error("The image source could not be loaded for import.");
        }

        const blob = await response.blob();
        const contentType = blob.type || "image/jpeg";
        return await uploadBlob(blob, `editor-import-${index}${getImageExtension(contentType)}`);
    }

    async function normalizeEditorContent(html) {
        // Save is the persistence boundary: convert temporary image sources into stored URLs here.
        const parser = new DOMParser();
        const documentFragment = parser.parseFromString(html, "text/html");
        const images = Array.from(documentFragment.querySelectorAll("img"));

        for (const [index, image] of images.entries()) {
            const src = image.getAttribute("src")?.trim();
            if (!src || isStoredImageUrl(src) || !shouldImportImageSource(src)) {
                continue;
            }

            const storedImageUrl = await importImageSource(src, index);
            image.setAttribute("src", storedImageUrl);
        }

        return documentFragment.body.innerHTML;
    }

    async function listImages() {
        // The harness gallery reads from the same API route that serves stored images.
        const response = await fetch("/api/images");
        if (!response.ok) {
            throw new Error("Uploaded images could not be loaded.");
        }

        // The API returns a light list model that is already shaped for the gallery.
        return await response.json();
    }

    return {
        listImages,
        normalizeEditorContent,
        uploadImage
    };
}
