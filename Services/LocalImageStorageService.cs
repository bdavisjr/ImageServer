using ImageServer.Options;
using Microsoft.Extensions.Options;

namespace ImageServer.Services;

public sealed class LocalImageStorageService : IImageStorageService
{
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
        await ImageValidation.ValidateAsync(file, _options.MaxUploadBytes, _options.AllowedContentTypes, cancellationToken);

        var extension = ImageValidation.GetExtensionForContentType(file.ContentType);
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
        var contentType = ImageValidation.GetContentTypeForExtension(extension);

        if (contentType is null)
        {
            return Task.FromResult<StoredImageFile?>(null);
        }

        Stream stream = File.OpenRead(fullPath);
        return Task.FromResult<StoredImageFile?>(new StoredImageFile(safeFileName, contentType, stream));
    }

    public Task<IReadOnlyList<StoredImageListItem>> ListAsync(HttpRequest request, CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();

        var items = Directory.EnumerateFiles(_rootPath)
            .Select(path =>
            {
                var fileName = Path.GetFileName(path);
                var extension = Path.GetExtension(fileName);
                var contentType = ImageValidation.GetContentTypeForExtension(extension);

                if (contentType is null)
                {
                    return null;
                }

                var fileInfo = new FileInfo(path);
                var url = $"{request.Scheme}://{request.Host}/api/images/{fileName}";
                return new StoredImageListItem(fileName, url, contentType, new DateTimeOffset(fileInfo.CreationTimeUtc, TimeSpan.Zero));
            })
            .Where(item => item is not null)
            .OrderByDescending(item => item!.CreatedUtc)
            .Take(24)
            .Cast<StoredImageListItem>()
            .ToList();

        return Task.FromResult<IReadOnlyList<StoredImageListItem>>(items);
    }
}
