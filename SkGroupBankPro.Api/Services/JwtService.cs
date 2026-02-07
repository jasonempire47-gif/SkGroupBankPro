using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.IdentityModel.Tokens;
using SkGroupBankpro.Api.Models;

namespace SkGroupBankpro.Api.Services
{
    public class JwtService
    {
        private readonly IConfiguration _config;

        public JwtService(IConfiguration config)
        {
            _config = config;
        }

        public string Generate(User user)
        {
            string key = _config["Jwt:Key"] ?? throw new InvalidOperationException("Missing Jwt:Key");
            string issuer = _config["Jwt:Issuer"] ?? throw new InvalidOperationException("Missing Jwt:Issuer");

            var claims = new List<Claim>
            {
                // sub must match how you read CurrentUserId() in controllers
                new Claim(JwtRegisteredClaimNames.Sub, user.Id.ToString()),
                new Claim(ClaimTypes.Name, user.Username),
                new Claim(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString())
            };

            // This is REQUIRED for [Authorize(Roles="Admin,Finance")]
            if (!string.IsNullOrWhiteSpace(user.Role))
                claims.Add(new Claim(ClaimTypes.Role, user.Role));

            var signingKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(key));
            var creds = new SigningCredentials(signingKey, SecurityAlgorithms.HmacSha256);

            var token = new JwtSecurityToken(
                issuer: issuer,
                audience: null,
                claims: claims,
                notBefore: DateTime.UtcNow.AddSeconds(-5),
                expires: DateTime.UtcNow.AddHours(12),
                signingCredentials: creds
            );

            return new JwtSecurityTokenHandler().WriteToken(token);
        }
    }
}
