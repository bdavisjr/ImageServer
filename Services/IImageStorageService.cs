namespace ImageServer.Services;

public interface IImageStorageService
{
    Task<StoredImageResult> SaveAsync(IFormFile file, CancellationToken cancellationToken);

    Task<StoredImageFile?> GetAsync(string fileName, CancellationToken cancellationToken);
}

public sealed record StoredImageResult(string FileName, string ContentType, long Size);

public sealed record StoredImageFile(string FileName, string ContentType, Stream Content);
