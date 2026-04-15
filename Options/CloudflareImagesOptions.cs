namespace ImageServer.Options;

public sealed class CloudflareImagesOptions
{
    public const string SectionName = "CloudflareImages";

    public string AccountId { get; set; } = string.Empty;

    public string AccountHash { get; set; } = string.Empty;

    public string ApiToken { get; set; } = string.Empty;

    public string VariantName { get; set; } = "public";
}
