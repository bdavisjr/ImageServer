using ImageServer.Options;
using Microsoft.Extensions.Options;

namespace ImageServer.Services;

public sealed class LocalImageStorageService : IImageStorageService
{
    private static readonly Dictionary<string, string> ExtensionsByContentType = new(StringComparer.OrdinalIgnoreCase)
    {
        ["image/jpeg"] = ".jpg",
        ["image/png"] = ".png",
        ["image/gif"] = ".gif",
        ["image/webp"] = ".webp"
    };

    private readonly ImageStorageOptions _options;
    private readonly string _rootPath;

    public LocalImageStorageService(IOptions<ImageStorageOptions> options, IWebHostEnvironment environment)
    {
        _options = options.Value;
        _rootPath = Path.GetFullPath(Path.Combine(environment.ContentRootPath, _options.StoragePath));
        Directory.CreateDirectory(_rootPath);
    }

    public async Task<StoredImageResult> SaveAsync(IFormFile file, CancellationToken cancellationToken)
    {
        Validate(file);

        var extension = ExtensionsByContentType[file.ContentType];
        var fileName = $"{Guid.CreateVersion7():N}{extension}";
        var fullPath = Path.Combine(_rootPath, fileName);

        await using var destination = File.Create(fullPath);
        await file.CopyToAsync(destination, cancellationToken);

        return new StoredImageResult(fileName, file.ContentType, file.Length);
    }

    public Task<StoredImageFile?> GetAsync(string fileName, CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();

        if (string.IsNullOrWhiteSpace(fileName))
        {
            return Task.FromResult<StoredImageFile?>(null);
        }

        var safeFileName = Path.GetFileName(fileName);
        var fullPath = Path.Combine(_rootPath, safeFileName);

        if (!File.Exists(fullPath))
        {
            return Task.FromResult<StoredImageFile?>(null);
        }

        var extension = Path.GetExtension(safeFileName);
        var contentType = ExtensionsByContentType.FirstOrDefault(x => x.Value.Equals(extension, StringComparison.OrdinalIgnoreCase)).Key;

        if (contentType is null)
        {
            return Task.FromResult<StoredImageFile?>(null);
        }

        Stream stream = File.OpenRead(fullPath);
        return Task.FromResult<StoredImageFile?>(new StoredImageFile(safeFileName, contentType, stream));
    }

    private void Validate(IFormFile file)
    {
        if (file.Length <= 0)
        {
            throw new InvalidOperationException("The uploaded file is empty.");
        }

        if (file.Length > _options.MaxUploadBytes)
        {
            throw new InvalidOperationException($"The uploaded file exceeds the {_options.MaxUploadBytes} byte limit.");
        }

        if (!_options.AllowedContentTypes.Contains(file.ContentType, StringComparer.OrdinalIgnoreCase))
        {
            throw new InvalidOperationException($"Content type '{file.ContentType}' is not allowed.");
        }
    }
}
