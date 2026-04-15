namespace ImageServer.Options;

public sealed class ImageStorageOptions
{
    public const string SectionName = "ImageStorage";

    public string Provider { get; set; } = "Local";

    public string StoragePath { get; set; } = "App_Data/Images";

    public long MaxUploadBytes { get; set; } = 5 * 1024 * 1024;

    public string[] AllowedContentTypes { get; set; } =
    [
        "image/jpeg",
        "image/png",
        "image/gif",
        "image/webp"
    ];
}
