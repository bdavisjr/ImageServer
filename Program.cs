using ImageServer.Options;
using ImageServer.Services;
using Microsoft.Extensions.Options;

namespace ImageServer;

public class Program
{
    public static void Main(string[] args)
    {
        var builder = WebApplication.CreateBuilder(args);

        builder.Services.AddControllers();
        builder.Services.AddOpenApi();
        builder.Services.Configure<ImageStorageOptions>(builder.Configuration.GetSection(ImageStorageOptions.SectionName));
        builder.Services.Configure<CloudflareImagesOptions>(builder.Configuration.GetSection(CloudflareImagesOptions.SectionName));
        builder.Services.AddHttpClient<CloudflareImageStorageService>();
        builder.Services.AddSingleton<IImageStorageService>(serviceProvider =>
        {
            var imageStorageOptions = serviceProvider.GetRequiredService<IOptions<ImageStorageOptions>>().Value;

            return imageStorageOptions.Provider.Equals("CloudflareImages", StringComparison.OrdinalIgnoreCase)
                ? serviceProvider.GetRequiredService<CloudflareImageStorageService>()
                : serviceProvider.GetRequiredService<LocalImageStorageService>();
        });
        builder.Services.AddSingleton<LocalImageStorageService>();

        var app = builder.Build();

        if (app.Environment.IsDevelopment())
        {
            app.MapOpenApi();
        }

        var imageStorageOptions = app.Services.GetRequiredService<IOptions<ImageStorageOptions>>().Value;
        if (imageStorageOptions.Provider.Equals("Local", StringComparison.OrdinalIgnoreCase))
        {
            var imageRootPath = Path.GetFullPath(Path.Combine(app.Environment.ContentRootPath, imageStorageOptions.StoragePath));
            Directory.CreateDirectory(imageRootPath);
        }

        app.UseDefaultFiles();
        app.UseStaticFiles();
        app.UseHttpsRedirection();
        app.UseAuthorization();

        app.MapControllers();

        app.Run();
    }
}
