namespace ImageServer.Models;

public sealed record ImageListItemResponse(string FileName, string Url, string ContentType, DateTimeOffset CreatedUtc);
