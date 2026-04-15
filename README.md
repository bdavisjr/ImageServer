# ImageServer

Small ASP.NET Core image server with a TinyMCE-based HTML/JavaScript demo harness.

## What this project does

- Accepts image uploads through `POST /api/images`
- Stores uploaded files on local disk
- Serves stored files only through `GET /api/images/{fileName}`
- Hosts a TinyMCE test page from `/` for manual testing

## Storage location

The configured storage path is in [appsettings.json](/Volumes/SourceCode/Code/Projects/ImageServer/appsettings.json:1).

By default:

- `ImageStorage:StoragePath` = `App_Data/Images`
- That path is resolved relative to the application content root
- In this repo, that means images are stored under:
  `/Volumes/SourceCode/Code/Projects/ImageServer/App_Data/Images`

The path is resolved in [Program.cs](/Volumes/SourceCode/Code/Projects/ImageServer/Program.cs:25) and [LocalImageStorageService.cs](/Volumes/SourceCode/Code/Projects/ImageServer/Services/LocalImageStorageService.cs:19).

## App flow

1. The TinyMCE harness loads from `/`
2. TinyMCE uploads an image to `POST /api/images` using a multipart form field named `file`
3. The server validates type and size, then saves the file under `App_Data/Images`
4. The upload response returns a URL like `http://host/api/images/{fileName}`
5. TinyMCE inserts that URL into the editor content
6. Browser requests for the image go through `ImageServerController.GetAsync`

## Important files

- [Program.cs](/Volumes/SourceCode/Code/Projects/ImageServer/Program.cs:1): service registration and middleware
- [Controllers/ImageServerController.cs](/Volumes/SourceCode/Code/Projects/ImageServer/Controllers/ImageServerController.cs:1): upload and image retrieval endpoints
- [Services/LocalImageStorageService.cs](/Volumes/SourceCode/Code/Projects/ImageServer/Services/LocalImageStorageService.cs:1): local disk storage and validation
- [Options/ImageStorageOptions.cs](/Volumes/SourceCode/Code/Projects/ImageServer/Options/ImageStorageOptions.cs:1): storage settings
- [Models/ImageUploadResponse.cs](/Volumes/SourceCode/Code/Projects/ImageServer/Models/ImageUploadResponse.cs:1): upload response payload
- [wwwroot/index.html](/Volumes/SourceCode/Code/Projects/ImageServer/wwwroot/index.html:1): TinyMCE harness markup
- [wwwroot/app.js](/Volumes/SourceCode/Code/Projects/ImageServer/wwwroot/app.js:1): TinyMCE initialization and upload handler
- [wwwroot/styles.css](/Volumes/SourceCode/Code/Projects/ImageServer/wwwroot/styles.css:1): harness styling

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

The launch profile is defined in [Properties/launchSettings.json](/Volumes/SourceCode/Code/Projects/ImageServer/Properties/launchSettings.json:1).

## Notes for developers

- The demo uses TinyMCE from the Tiny Cloud CDN in [wwwroot/index.html](/Volumes/SourceCode/Code/Projects/ImageServer/wwwroot/index.html:8)
- The app deliberately does not expose the image folder as a static file directory
- Image retrieval should stay behind the controller so auth, logging, transformations, or access checks can be added later in one place
- The project excludes macOS `._*` sidecar files in [ImageServer.csproj](/Volumes/SourceCode/Code/Projects/ImageServer/ImageServer.csproj:15) because they were interfering with builds on this volume
