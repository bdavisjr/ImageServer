using ImageServer.Models;
using ImageServer.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;

namespace ImageServer.Controllers;

[ApiController]
[Route("api/images")]
public sealed class ImageServerController : ControllerBase
{
    private readonly IImageStorageService _imageStorageService;
    private readonly ILogger<ImageServerController> _logger;

    public ImageServerController(IImageStorageService imageStorageService, ILogger<ImageServerController> logger)
    {
        _imageStorageService = imageStorageService;
        _logger = logger;
    }

    [HttpPost]
    public async Task<ActionResult<ImageUploadResponse>> UploadAsync(IFormFile? file, CancellationToken cancellationToken)
    {
        if (file is null)
        {
            return BadRequest(new { error = "The request must include a file field named 'file'." });
        }

        try
        {
            var storedImage = await _imageStorageService.SaveAsync(file, cancellationToken);
            // Always return the controller route so storage stays behind the API boundary.
            var imageUrl = $"{Request.Scheme}://{Request.Host}/api/images/{storedImage.FileName}";

            return Ok(new ImageUploadResponse(imageUrl, storedImage.FileName, storedImage.ContentType, storedImage.Size));
        }
        catch (InvalidOperationException exception)
        {
            // Validation failures are expected user errors, so they stay in the 400 range.
            _logger.LogWarning(exception, "Image upload rejected.");
            return BadRequest(new { error = "The uploaded image was rejected." });
        }
        catch (Exception exception)
        {
            // Unexpected provider/storage failures are logged, but the client gets a generic error.
            _logger.LogError(exception, "Unexpected image upload failure.");
            return StatusCode(StatusCodes.Status500InternalServerError, new { error = "The image upload could not be completed." });
        }
    }

    [HttpGet]
    [Route("{fileName}")]
    public async Task<IActionResult> GetAsync(string fileName, CancellationToken cancellationToken)
    {
        // Images are served through the controller rather than exposing the storage folder directly.
        var image = await _imageStorageService.GetAsync(fileName, cancellationToken);

        if (image is null)
        {
            return NotFound();
        }

        return File(image.Content, image.ContentType, enableRangeProcessing: true);
    }

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<ImageListItemResponse>>> ListAsync(CancellationToken cancellationToken)
    {
        // The harness uses this lightweight listing endpoint to populate its uploaded-images gallery.
        var images = await _imageStorageService.ListAsync(Request, cancellationToken);
        // Return just enough metadata for preview links without exposing storage-specific details.
        var response = images
            .Select(image => new ImageListItemResponse(image.FileName, image.Url, image.ContentType, image.CreatedUtc))
            .ToList();

        return Ok(response);
    }
}
