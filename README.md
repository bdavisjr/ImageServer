# ImageServer

Small ASP.NET Core image server with a TinyMCE-based HTML/JavaScript demo harness.

## What this project does

- Accepts image uploads through `POST /api/images`
- Stores uploaded files on local disk or in Cloudflare Images
- Serves stored files only through `GET /api/images/{fileName}`
- Hosts a TinyMCE test page from `/` for manual testing

## Storage providers

The active provider comes from `ImageStorage:Provider` in `appsettings.json`.

Supported values:

- `Local`
- `CloudflareImages`

### Local storage location

The configured storage path is in `appsettings.json`.

By default:

- `ImageStorage:StoragePath` = `App_Data/Images`
- That path is resolved relative to the application content root
- In this repo, that means images are stored under:
  `App_Data/Images`

The path is resolved in `Program.cs` and `Services/LocalImageStorageService.cs`.

### Cloudflare Images configuration

To use Cloudflare Images, set:

- `ImageStorage:Provider` = `CloudflareImages`
- `CloudflareImages:AccountId`
- `CloudflareImages:AccountHash`
- `CloudflareImages:ApiToken`
- `CloudflareImages:VariantName`

The keys are present in `appsettings.json` as empty placeholders so developers can see what must be configured.

For local development, prefer ASP.NET user secrets or a local environment-specific configuration source for real values.

For production, do not store real credentials in `appsettings.json`. Use environment variables, a secret manager, or your hosting platform's secure configuration system.

The implementation is in `Services/CloudflareImageStorageService.cs`.

### Cloudflare Images setup

Use this flow to set up Cloudflare Images for this app:

1. In Cloudflare, enable the Images product for your account.
2. Find your Cloudflare Account ID.
3. Open the Images dashboard and note the Images account hash used in delivery URLs.
4. Create an API token with Images write access for uploads.
5. Create a delivery variant. This app defaults to `public`.
6. Configure the app to use `CloudflareImages` as the provider.

Cloudflare’s getting started guide says you need an Account ID and API token before making your first Images API request, and uploaded images are served with URLs in the format `https://imagedelivery.net/<ACCOUNT_HASH>/<IMAGE_ID>/<VARIANT_NAME>`. [Getting started](https://developers.cloudflare.com/images/get-started/) [Serve uploaded images](https://developers.cloudflare.com/images/manage-images/serve-images/serve-uploaded-images/)

#### 1. Get the required Cloudflare values

You need:

- `CloudflareImages:AccountId`
- `CloudflareImages:AccountHash`
- `CloudflareImages:ApiToken`
- `CloudflareImages:VariantName`

Cloudflare documents the delivery URL format and notes that the account hash is available from the Images dashboard’s developer resources area. [Serve uploaded images](https://developers.cloudflare.com/images/manage-images/serve-images/serve-uploaded-images/)

#### 2. Create an API token

Create either a user token or an account-owned token in Cloudflare. For long-lived service integrations, Cloudflare recommends account-owned tokens. [Create API token](https://developers.cloudflare.com/fundamentals/api/get-started/create-token/) [Account API tokens](https://developers.cloudflare.com/fundamentals/api/get-started/account-owned-tokens/)

For this app, grant the minimum Images permission needed for upload access:

- `Images Write`

Cloudflare’s Images API reference lists `Images Write` as an accepted permission for image upload and variant creation endpoints. [Images API](https://developers.cloudflare.com/api/resources/images/subresources/v1/subresources/variants/methods/create/)

#### 3. Create a variant

This app defaults to `public`, so creating a `public` variant is the easiest path if it does not already exist.

Cloudflare documents variant creation in the Images dashboard:

1. Go to Hosted Images
2. Open the Delivery tab
3. Select Create variant
4. Name the variant
5. Save the variant options

Cloudflare also notes that uploaded images are commonly served with a `public` variant. [Create variants](https://developers.cloudflare.com/images/manage-images/create-variants/) [Serve uploaded images](https://developers.cloudflare.com/images/manage-images/serve-images/serve-uploaded-images/)

#### 4. Configure local development

Keep the placeholders in `appsettings.json`, but put real values in user secrets.

Example:

```bash
dotnet user-secrets init
dotnet user-secrets set "ImageStorage:Provider" "CloudflareImages"
dotnet user-secrets set "CloudflareImages:AccountId" "your-account-id"
dotnet user-secrets set "CloudflareImages:AccountHash" "your-images-account-hash"
dotnet user-secrets set "CloudflareImages:ApiToken" "your-api-token"
dotnet user-secrets set "CloudflareImages:VariantName" "public"
```

#### 5. Configure production

Set these as environment variables or platform-managed secrets:

- `ImageStorage__Provider=CloudflareImages`
- `CloudflareImages__AccountId=...`
- `CloudflareImages__AccountHash=...`
- `CloudflareImages__ApiToken=...`
- `CloudflareImages__VariantName=public`

#### 6. Verify

After configuration:

1. Start the app
2. Open the TinyMCE harness at `/`
3. Upload an image
4. Confirm the upload returns a URL from this app like `/api/images/{fileName}`
5. Confirm `GET /api/images/{fileName}` streams the image successfully

## App flow

1. The TinyMCE harness loads from `/`
2. TinyMCE uploads an image to `POST /api/images` using a multipart form field named `file`
3. The server validates type and size, then stores the file in the configured provider
4. The upload response returns a URL like `http://host/api/images/{fileName}`
5. TinyMCE inserts that URL into the editor content
6. Browser requests for the image go through `ImageServerController.GetAsync`

## Important files

- `Program.cs`: service registration and middleware
- `Controllers/ImageServerController.cs`: upload and image retrieval endpoints
- `Services/LocalImageStorageService.cs`: local disk storage and validation
- `Services/CloudflareImageStorageService.cs`: Cloudflare Images storage and retrieval
- `Options/ImageStorageOptions.cs`: storage settings
- `Options/CloudflareImagesOptions.cs`: Cloudflare Images settings
- `Models/ImageUploadResponse.cs`: upload response payload
- `Models/ImageListItemResponse.cs`: uploaded-images gallery payload
- `wwwroot/index.html`: TinyMCE harness markup
- `wwwroot/app.js`: front-end entry point that wires the harness together
- `wwwroot/js/harness.js`: harness-specific UI behavior, draft save flow, and gallery updates
- `wwwroot/js/tinymce-config.js`: TinyMCE configuration and setup callbacks
- `wwwroot/js/image-upload.js`: browser-side upload, image import, and gallery API calls
- `wwwroot/styles.css`: harness styling
- `wwwroot/editor-content.css`: styles that load inside the TinyMCE editor iframe

## Front-end developer notes

The harness JavaScript is intentionally split into a few small modules instead of one large file:

- `wwwroot/app.js` only gathers DOM elements and composes the page
- `wwwroot/js/tinymce-config.js` owns TinyMCE plugins, toolbar options, picker behavior, and editor lifecycle hooks
- `wwwroot/js/image-upload.js` owns upload requests, uploaded-image listing, and content normalization during save
- `wwwroot/js/harness.js` owns buttons, status updates, draft restore/save, sample insertion, and the uploaded-images gallery

This makes it easier to change TinyMCE behavior without touching the harness layout code, and easier to change image API behavior without digging through editor setup.

The reusable image integration is intentionally generic. It handles temporary editor image sources like `data:` and `blob:` by default. Harness-specific rules, such as treating local demo assets under `/img/...` as save-time imports, are added by the harness when it creates the image integration.

### Draft and image lifecycle

The harness keeps all editor-inserted images temporary until save:

- Toolbar-selected images are inserted into the editor as temporary image sources
- Pasted `data:image/...` images are allowed to exist temporarily inside the editor while the user is drafting
- Drag/drop images are converted to temporary data URLs inside the editor
- The harness also treats its local sample images from `/img/...` as temporary sources until save
- `Save draft` is the persistence boundary for all temporary image sources
- During save, the harness scans editor HTML, uploads any temporary images to the image server, rewrites those `src` values to `/api/images/...`, and then stores the normalized HTML in `localStorage`

This avoids creating stored images for abandoned drafts while still making image insertion feel immediate in the editor.

The TinyMCE integration also supports a configurable persistence mode:

- `imagePersistenceMode: "on-save"` keeps inserted images temporary until `prepareEditorForSave(editor)` runs
- `imagePersistenceMode: "immediate"` uploads toolbar-selected and drag/dropped images right away

If the option is omitted, the default is `"on-save"`.

### Uploaded images gallery

The side-panel gallery is populated from `GET /api/images`.

- Local storage mode returns the most recent stored images from `App_Data/Images`
- The harness uses that response to render clickable thumbnails in the right-side panel
- Cloudflare image listing is not implemented yet, so the gallery is currently local-storage focused

### Editor content styling

The visible page styling and the editor content styling are separate on purpose:

- `wwwroot/styles.css` styles the harness page around TinyMCE
- `wwwroot/editor-content.css` styles content inside the TinyMCE iframe

If a content block looks right on the page shell but not inside the editor, the editor stylesheet is the first place to check.

### Minimum integration

If another page just wants TinyMCE image handling and save-time image normalization, it usually only needs:

- `wwwroot/js/image-upload.js`
- `wwwroot/js/tinymce-config.js`
- a small page-specific script for that page's own save flow

The harness module is only needed for demo-specific behaviors like sample content, copy test image, local draft persistence, and the uploaded-images gallery.

Example page script:

```js
import { createImageServerEditor } from "/js/image-upload.js";
import { initializeTinyMceEditor } from "/js/tinymce-config.js";

const imageServerEditor = createImageServerEditor({
    onUploadComplete: (location) => {
        console.log("Image uploaded:", location);
    },
    shouldImportImageSource: (src) => {
        return src.startsWith("/img/") || src.startsWith(`${window.location.origin}/img/`);
    }
});

initializeTinyMceEditor({
    imageServerEditor,
    imagePersistenceMode: "on-save",
    onEditorReady: () => {},
    onEditorContentChange: () => {},
    onImageUploadStatusChange: () => {}
});

async function savePage() {
    const editor = tinymce.get("editor");
    const htmlToSave = await imageServerEditor.prepareEditorForSave(editor);

    await fetch("/api/articles/save", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            html: htmlToSave
        })
    });
}
```

If a page already has its own save pipeline and another function reads the editor later, it can ignore the return value and just normalize the editor in place first:

```js
async function beforePageSave() {
    const editor = tinymce.get("editor");
    await imageServerEditor.prepareEditorForSave(editor);
}

async function existingSavePage() {
    await beforePageSave();

    const editor = tinymce.get("editor");
    const htmlToSave = editor.getContent();

    await saveRecordToDatabase(htmlToSave);
}
```

The main reusable save hook is:

- `imageServerEditor.prepareEditorForSave(editor)`

That method:

- reads the current TinyMCE HTML
- uploads temporary image sources such as `data:` images and drag/drop images
- rewrites those image `src` values to stored `/api/images/...` URLs
- updates the TinyMCE editor content with the normalized HTML
- returns the normalized HTML so the page can save it immediately if that is convenient

That means a page can either:

- use the returned HTML directly in its save function
- or ignore the return value and let the rest of its existing save pipeline read `editor.getContent()` afterward

If a page has its own local asset paths that should be imported during save, it can pass a `shouldImportImageSource(src)` callback to `createImageServerEditor(...)`.

If a page does not want the editor instance updated in-place, it can call `imageServerEditor.normalizeEditorContent(html)` directly instead and manage the returned HTML itself.

## API

### `POST /api/images`

Uploads an image using multipart form data.

Expected form field:

- `file`

Allowed content types:

- `image/jpeg`
- `image/png`
- `image/gif`
- `image/webp`

Successful response shape:

```json
{
  "location": "http://localhost:5254/api/images/example-file.jpg",
  "fileName": "example-file.jpg",
  "contentType": "image/jpeg",
  "size": 12345
}
```

### `GET /api/images/{fileName}`

Returns the stored image stream if the file exists and matches an allowed extension.

This is the only supported read path for stored images.

When Cloudflare Images is enabled, the controller still remains the only public read path for this app. The backend fetches the image from Cloudflare and streams it back to the client.

### `GET /api/images`

Returns a lightweight list of stored images for the harness gallery.

Successful response shape:

```json
[
  {
    "fileName": "example-file.jpg",
    "url": "http://localhost:5254/api/images/example-file.jpg",
    "contentType": "image/jpeg",
    "createdUtc": "2026-04-15T14:30:00+00:00"
  }
]
```

## Running locally

Build:

```bash
dotnet build ImageServer.csproj
```

Run:

```bash
dotnet run --project ImageServer.csproj
```

Then open:

- `http://localhost:5254/`

The launch profile is defined in [Properties/launchSettings.json]

## Notes for developers

- The demo uses a self-hosted TinyMCE copy from `wwwroot/lib/tinymce` and loads it from `wwwroot/index.html`
- The app deliberately does not expose the image folder as a static file directory
- Image retrieval should stay behind the controller so auth, logging, transformations, or access checks can be added later in one place
- Cloudflare Images upload uses the official account upload endpoint and retrieves bytes from an Images delivery URL built from `AccountHash`, image ID, and variant name
- The front-end entry script is an ES module, so `wwwroot/index.html` loads `wwwroot/app.js` with `type="module"`
