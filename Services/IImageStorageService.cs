namespace ImageServer.Services;

public interface IImageStorageService
{
    Task<StoredImageResult> SaveAsync(IFormFile file, CancellationToken cancellationToken);

    Task<StoredImageFile?> GetAsync(string fileName, CancellationToken cancellationToken);

    Task<IReadOnlyList<StoredImageListItem>> ListAsync(HttpRequest request, CancellationToken cancellationToken);
}

public sealed record StoredImageResult(string FileName, string ContentType, long Size);

public sealed record StoredImageFile(string FileName, string ContentType, Stream Content);

public sealed record StoredImageListItem(string FileName, string Url, string ContentType, DateTimeOffset CreatedUtc);
