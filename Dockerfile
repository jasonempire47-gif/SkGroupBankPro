FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src
COPY . .
RUN dotnet restore "Sk Group BankPro\SkGroupBankpro.Api\SkGroupBankpro.Api.csproj"
RUN dotnet publish "Sk Group BankPro\SkGroupBankpro.Api\SkGroupBankpro.Api.csproj" -c Release -o /app/publish

FROM mcr.microsoft.com/dotnet/aspnet:8.0
WORKDIR /app
ENV ASPNETCORE_URLS=http://0.0.0.0:${PORT}
COPY --from=build /app/publish .
CMD ["dotnet", "SkGroupBankpro.Api.dll"]
