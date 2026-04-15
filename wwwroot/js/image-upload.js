function getImageExtension(contentType) {
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
        return await uploadImage(
            {
                blob: () => blob,
                filename: () => filename
            },
            () => {}
        );
    }

    function isStoredImageUrl(src) {
        return src.startsWith("/api/images/") || src.startsWith(`${window.location.origin}/api/images/`);
    }

    function shouldImportImageSource(src) {
        if (!src) {
            return false;
        }

        if (src.startsWith("data:image/")) {
            return true;
        }

        return src.startsWith("/img/") || src.startsWith(`${window.location.origin}/img/`);
    }

    async function importImageSource(src, index) {
        const response = await fetch(src);
        if (!response.ok) {
            throw new Error("The image source could not be loaded for import.");
        }

        const blob = await response.blob();
        const contentType = blob.type || "image/jpeg";
        return await uploadBlob(blob, `editor-import-${index}${getImageExtension(contentType)}`);
    }

    async function normalizeEditorContent(html) {
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
        const response = await fetch("/api/images");
        if (!response.ok) {
            throw new Error("Uploaded images could not be loaded.");
        }

        return await response.json();
    }

    return {
        listImages,
        normalizeEditorContent,
        uploadImage
    };
}
