# ---------- BUILD ----------
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

# copy csproj first (better docker layer caching)
COPY SkGroupBankPro.Api/SkGroupBankpro.Api.csproj SkGroupBankPro.Api/
RUN dotnet restore SkGroupBankPro.Api/SkGroupBankpro.Api.csproj

# copy everything else
COPY . .
RUN dotnet publish SkGroupBankPro.Api/SkGroupBankpro.Api.csproj -c Release -o /app/publish /p:UseAppHost=false

# ---------- RUNTIME ----------
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS runtime
WORKDIR /app

# Use a stable internal port (Render will map external PORT -> container port)
ENV ASPNETCORE_URLS=http://0.0.0.0:8080
EXPOSE 8080

COPY --from=build /app/publish .

ENTRYPOINT ["dotnet", "SkGroupBankpro.Api.dll"]
