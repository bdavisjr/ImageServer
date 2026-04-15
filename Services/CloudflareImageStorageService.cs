using System.Net.Http.Headers;
using System.Text.Json;
using ImageServer.Options;
using Microsoft.Extensions.Options;

namespace ImageServer.Services;

public sealed class CloudflareImageStorageService : IImageStorageService
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    private readonly HttpClient _httpClient;
    private readonly ImageStorageOptions _imageStorageOptions;
    private readonly CloudflareImagesOptions _cloudflareOptions;

    public CloudflareImageStorageService(
        HttpClient httpClient,
        IOptions<ImageStorageOptions> imageStorageOptions,
        IOptions<CloudflareImagesOptions> cloudflareOptions)
    {
        _httpClient = httpClient;
        _imageStorageOptions = imageStorageOptions.Value;
        _cloudflareOptions = cloudflareOptions.Value;

        if (string.IsNullOrWhiteSpace(_cloudflareOptions.AccountId))
        {
            throw new InvalidOperationException("CloudflareImages:AccountId is required when using the CloudflareImages provider.");
        }

        if (string.IsNullOrWhiteSpace(_cloudflareOptions.AccountHash))
        {
            throw new InvalidOperationException("CloudflareImages:AccountHash is required when using the CloudflareImages provider.");
        }

        if (string.IsNullOrWhiteSpace(_cloudflareOptions.ApiToken))
        {
            throw new InvalidOperationException("CloudflareImages:ApiToken is required when using the CloudflareImages provider.");
        }

        if (string.IsNullOrWhiteSpace(_cloudflareOptions.VariantName))
        {
            throw new InvalidOperationException("CloudflareImages:VariantName is required when using the CloudflareImages provider.");
        }
    }

    public async Task<StoredImageResult> SaveAsync(IFormFile file, CancellationToken cancellationToken)
    {
        await ImageValidation.ValidateAsync(file, _imageStorageOptions.MaxUploadBytes, _imageStorageOptions.AllowedContentTypes, cancellationToken);

        using var formData = new MultipartFormDataContent();
        await using var stream = file.OpenReadStream();
        using var fileContent = new StreamContent(stream);
        fileContent.Headers.ContentType = MediaTypeHeaderValue.Parse(file.ContentType);
        var extension = ImageValidation.GetExtensionForContentType(file.ContentType);
        var safeFileName = $"{Guid.CreateVersion7():N}{extension}";
        formData.Add(fileContent, "file", safeFileName);

        using var request = new HttpRequestMessage(
            HttpMethod.Post,
            $"https://api.cloudflare.com/client/v4/accounts/{_cloudflareOptions.AccountId}/images/v1");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", _cloudflareOptions.ApiToken);
        request.Content = formData;

        using var response = await _httpClient.SendAsync(request, cancellationToken);
        var responseBody = await response.Content.ReadAsStringAsync(cancellationToken);

        if (!response.IsSuccessStatusCode)
        {
            throw new InvalidOperationException($"Cloudflare Images upload failed: {responseBody}");
        }

        var payload = JsonSerializer.Deserialize<CloudflareEnvelope<CloudflareImageUploadResult>>(responseBody, JsonOptions);
        var imageId = payload?.Result?.Id;

        if (string.IsNullOrWhiteSpace(imageId))
        {
            throw new InvalidOperationException("Cloudflare Images upload succeeded but no image ID was returned.");
        }

        return new StoredImageResult(imageId, file.ContentType, file.Length);
    }

    public async Task<StoredImageFile?> GetAsync(string fileName, CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();

        if (string.IsNullOrWhiteSpace(fileName))
        {
            return null;
        }

        var imageId = Path.GetFileName(fileName);
        var deliveryUrl = $"https://imagedelivery.net/{_cloudflareOptions.AccountHash}/{imageId}/{_cloudflareOptions.VariantName}";

        using var response = await _httpClient.GetAsync(deliveryUrl, HttpCompletionOption.ResponseHeadersRead, cancellationToken);

        if (response.StatusCode == System.Net.HttpStatusCode.NotFound)
        {
            return null;
        }

        if (!response.IsSuccessStatusCode)
        {
            var responseBody = await response.Content.ReadAsStringAsync(cancellationToken);
            throw new InvalidOperationException($"Cloudflare Images fetch failed: {responseBody}");
        }

        var contentType = response.Content.Headers.ContentType?.MediaType;
        if (string.IsNullOrWhiteSpace(contentType))
        {
            contentType = "application/octet-stream";
        }

        var content = await response.Content.ReadAsStreamAsync(cancellationToken);
        return new StoredImageFile(imageId, contentType, content);
    }

    public Task<IReadOnlyList<StoredImageListItem>> ListAsync(HttpRequest request, CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();
        return Task.FromResult<IReadOnlyList<StoredImageListItem>>([]);
    }

    private sealed class CloudflareEnvelope<T>
    {
        public T? Result { get; init; }
    }

    private sealed class CloudflareImageUploadResult
    {
        public string? Id { get; init; }
    }
}
