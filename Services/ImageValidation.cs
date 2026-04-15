namespace ImageServer.Services;

internal static class ImageValidation
{
    private static readonly Dictionary<string, string> ExtensionsByContentType = new(StringComparer.OrdinalIgnoreCase)
    {
        ["image/jpeg"] = ".jpg",
        ["image/png"] = ".png",
        ["image/gif"] = ".gif",
        ["image/webp"] = ".webp"
    };

    public static string GetExtensionForContentType(string contentType)
    {
        if (!ExtensionsByContentType.TryGetValue(contentType, out var extension))
        {
            throw new InvalidOperationException($"Content type '{contentType}' is not allowed.");
        }

        return extension;
    }

    public static string? GetContentTypeForExtension(string extension)
    {
        return ExtensionsByContentType.FirstOrDefault(x => x.Value.Equals(extension, StringComparison.OrdinalIgnoreCase)).Key;
    }

    public static async Task ValidateAsync(IFormFile file, long maxUploadBytes, string[] allowedContentTypes, CancellationToken cancellationToken)
    {
        if (file.Length <= 0)
        {
            throw new InvalidOperationException("The uploaded file is empty.");
        }

        if (file.Length > maxUploadBytes)
        {
            throw new InvalidOperationException($"The uploaded file exceeds the {maxUploadBytes} byte limit.");
        }

        if (!allowedContentTypes.Contains(file.ContentType, StringComparer.OrdinalIgnoreCase))
        {
            throw new InvalidOperationException($"Content type '{file.ContentType}' is not allowed.");
        }

        await using var stream = file.OpenReadStream();
        var header = new byte[16];
        var bytesRead = await stream.ReadAsync(header.AsMemory(0, header.Length), cancellationToken);

        if (!MatchesSignature(file.ContentType, header.AsSpan(0, bytesRead)))
        {
            throw new InvalidOperationException("The uploaded file content does not match its declared image type.");
        }
    }

    private static bool MatchesSignature(string contentType, ReadOnlySpan<byte> header)
    {
        return contentType switch
        {
            "image/jpeg" => header.Length >= 3 &&
                            header[0] == 0xFF &&
                            header[1] == 0xD8 &&
                            header[2] == 0xFF,
            "image/png" => header.Length >= 8 &&
                           header[0] == 0x89 &&
                           header[1] == 0x50 &&
                           header[2] == 0x4E &&
                           header[3] == 0x47 &&
                           header[4] == 0x0D &&
                           header[5] == 0x0A &&
                           header[6] == 0x1A &&
                           header[7] == 0x0A,
            "image/gif" => header.Length >= 6 &&
                           header[0] == 0x47 &&
                           header[1] == 0x49 &&
                           header[2] == 0x46 &&
                           header[3] == 0x38 &&
                           (header[4] == 0x37 || header[4] == 0x39) &&
                           header[5] == 0x61,
            "image/webp" => header.Length >= 12 &&
                            header[0] == 0x52 &&
                            header[1] == 0x49 &&
                            header[2] == 0x46 &&
                            header[3] == 0x46 &&
                            header[8] == 0x57 &&
                            header[9] == 0x45 &&
                            header[10] == 0x42 &&
                            header[11] == 0x50,
            _ => false
        };
    }
}
