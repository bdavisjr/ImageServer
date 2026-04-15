namespace ImageServer.Models;

public sealed record ImageUploadResponse(string Location, string FileName, string ContentType, long Size);
