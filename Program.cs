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
        builder.Services.AddSingleton<IImageStorageService, LocalImageStorageService>();

        var app = builder.Build();

        if (app.Environment.IsDevelopment())
        {
            app.MapOpenApi();
        }

        var imageStorageOptions = app.Services.GetRequiredService<IOptions<ImageStorageOptions>>().Value;
        var imageRootPath = Path.GetFullPath(Path.Combine(app.Environment.ContentRootPath, imageStorageOptions.StoragePath));
        Directory.CreateDirectory(imageRootPath);

        app.UseDefaultFiles();
        app.UseStaticFiles();
        app.UseHttpsRedirection();
        app.UseAuthorization();

        app.MapControllers();

        app.Run();
    }
}
