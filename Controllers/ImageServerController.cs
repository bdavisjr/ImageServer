using ImageServer.Models;
using ImageServer.Services;
using Microsoft.AspNetCore.Mvc;

namespace ImageServer.Controllers;

[ApiController]
[Route("api/images")]
public sealed class ImageServerController : ControllerBase
{
    private readonly IImageStorageService _imageStorageService;

    public ImageServerController(IImageStorageService imageStorageService)
    {
        _imageStorageService = imageStorageService;
    }

    [HttpPost]
    [RequestSizeLimit(10 * 1024 * 1024)]
    public async Task<ActionResult<ImageUploadResponse>> UploadAsync(IFormFile? file, CancellationToken cancellationToken)
    {
        if (file is null)
        {
            return BadRequest(new { error = "The request must include a file field named 'file'." });
        }

        try
        {
            var storedImage = await _imageStorageService.SaveAsync(file, cancellationToken);
            var imageUrl = $"{Request.Scheme}://{Request.Host}/api/images/{storedImage.FileName}";

            return Ok(new ImageUploadResponse(imageUrl, storedImage.FileName, storedImage.ContentType, storedImage.Size));
        }
        catch (InvalidOperationException exception)
        {
            return BadRequest(new { error = exception.Message });
        }
    }

    [HttpGet("{fileName}")]
    public async Task<IActionResult> GetAsync(string fileName, CancellationToken cancellationToken)
    {
        var image = await _imageStorageService.GetAsync(fileName, cancellationToken);

        if (image is null)
        {
            return NotFound();
        }

        return File(image.Content, image.ContentType, enableRangeProcessing: true);
    }
}
