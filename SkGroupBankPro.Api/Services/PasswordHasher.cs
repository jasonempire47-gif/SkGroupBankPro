using Microsoft.AspNetCore.Identity;

namespace SkGroupBankpro.Api.Services
{
    public class PasswordHasher
    {
        private readonly PasswordHasher<string> _hasher = new();

        public string Hash(string password)
        {
            if (string.IsNullOrWhiteSpace(password))
                throw new ArgumentException("Password is required.", nameof(password));

            return _hasher.HashPassword("user", password);
        }

        public bool Verify(string hashedPassword, string providedPassword)
        {
            if (string.IsNullOrWhiteSpace(hashedPassword)) return false;
            if (string.IsNullOrWhiteSpace(providedPassword)) return false;

            var result = _hasher.VerifyHashedPassword("user", hashedPassword, providedPassword);
            return result == PasswordVerificationResult.Success
                || result == PasswordVerificationResult.SuccessRehashNeeded;
        }
    }
}
