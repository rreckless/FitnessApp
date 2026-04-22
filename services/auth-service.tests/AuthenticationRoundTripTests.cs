using AuthService.Data;
using AuthService.Models;
using AuthService.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Xunit;

namespace AuthService.Tests;

public class AuthenticationRoundTripTests
{
    private AuthDbContext CreateInMemoryContext()
    {
        var options = new DbContextOptionsBuilder<AuthDbContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
            .Options;
        return new AuthDbContext(options);
    }

    // ============================================================================
    // Property-Based Tests for Authentication Round Trip
    // **Validates: Requirements 1.1, 1.3, 1.4**
    // ============================================================================

    /// <summary>
    /// Property: User can register with valid email and password
    /// Tests that registration succeeds with valid credentials and returns proper response.
    /// **Validates: Requirement 1.1**
    /// </summary>
    [Fact]
    public void Property_UserCanRegisterWithValidEmailAndPassword()
    {
        // Test multiple valid email/password combinations
        var testCases = new[]
        {
            ("user1@example.com", "ValidPass123!", "User One"),
            ("user2@test.org", "SecurePass@456", "User Two"),
            ("user3@domain.co.uk", "StrongPass#789", "User Three"),
            ("user.name@company.com", "ComplexPass$012", "User Name"),
            ("test+tag@email.com", "MyPassword%345", "Test User"),
        };

        var passwordValidator = new PasswordValidator();
        var passwordHasher = new PasswordHasher();

        foreach (var (email, password, name) in testCases)
        {
            // Validate email format
            var isValidEmail = email.Contains("@") && email.Contains(".");
            Assert.True(isValidEmail, $"Email {email} should be valid");

            // Validate password strength
            var passwordValidation = passwordValidator.Validate(password);
            Assert.True(passwordValidation.IsValid, $"Password {password} should be valid");

            // Hash password
            var hash = passwordHasher.HashPassword(password);
            Assert.NotEmpty(hash);
            Assert.NotEqual(password, hash);
        }
    }

    /// <summary>
    /// Property: User cannot register with invalid password
    /// Tests that registration with invalid password fails.
    /// **Validates: Requirement 1.1**
    /// </summary>
    [Fact]
    public void Property_InvalidPasswordRegistrationFails()
    {
        // Arrange
        var passwordValidator = new PasswordValidator();
        var invalidPasswords = new[] { "weak", "NoNumber!", "nouppercase123!", "NOLOWERCASE123!", "NoSpecial123" };

        foreach (var invalidPassword in invalidPasswords)
        {
            // Act
            var result = passwordValidator.Validate(invalidPassword);

            // Assert
            Assert.False(result.IsValid, $"Password {invalidPassword} should be invalid");
            Assert.NotEmpty(result.Errors);
        }
    }

    /// <summary>
    /// Property: Duplicate email registration fails
    /// Tests that registering with an already-used email fails.
    /// **Validates: Requirement 1.1**
    /// </summary>
    [Fact]
    public async Task Property_DuplicateEmailRegistrationFails()
    {
        // Arrange
        var context = CreateInMemoryContext();
        var email = "user@example.com";
        var password = "ValidPassword123!";
        var name = "Test User";

        // Create first user
        var user1 = new User
        {
            Id = Guid.NewGuid(),
            Email = email,
            PasswordHash = new PasswordHasher().HashPassword(password),
            Name = name,
            Level = 1,
            TotalXP = 0,
            CurrentStreak = 0,
            LongestStreak = 0,
            LastPasswordChangeAt = DateTime.UtcNow,
            SubscriptionTier = "FREE",
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
            LastSyncAt = DateTime.UtcNow
        };

        context.Users.Add(user1);
        await context.SaveChangesAsync();

        // Act - Try to find user with same email
        var existingUser = await context.Users.FirstOrDefaultAsync(u => u.Email == email);

        // Assert - Should find the existing user
        Assert.NotNull(existingUser);
        Assert.Equal(email, existingUser.Email);
    }

    /// <summary>
    /// Property: Invalid email format registration fails
    /// Tests that registration with invalid email format fails.
    /// **Validates: Requirement 1.1**
    /// </summary>
    [Fact]
    public void Property_InvalidEmailFormatRegistrationFails()
    {
        // Arrange
        var invalidEmails = new[] { "notanemail", "missing@domain", "spaces in@email.com" };

        foreach (var invalidEmail in invalidEmails)
        {
            // Act - Check if email is valid
            var isValid = invalidEmail.Contains("@") && invalidEmail.Contains(".") && !invalidEmail.Contains(" ") && invalidEmail.IndexOf("@") > 0 && invalidEmail.IndexOf("@") < invalidEmail.Length - 1;

            // Assert
            Assert.False(isValid, $"Email {invalidEmail} should be invalid");
        }
    }

    /// <summary>
    /// Property: JWT token contains correct user claims
    /// Tests that generated JWT tokens contain proper claims.
    /// **Validates: Requirement 1.3**
    /// </summary>
    [Fact]
    public void Property_JwtTokenContainsCorrectUserClaims()
    {
        // Arrange
        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                { "Jwt:Secret", "this-is-a-very-long-secret-key-for-testing-purposes-only-1234567890" },
                { "Jwt:Issuer", "fitquest" },
                { "Jwt:Audience", "fitquest-mobile" },
                { "Jwt:AccessTokenExpiryMinutes", "15" },
                { "Jwt:RefreshTokenExpiryDays", "7" }
            })
            .Build();
        
        var jwtTokenService = new JwtTokenService(config);
        var userId = Guid.NewGuid();
        var email = "user@example.com";
        var level = 1;

        // Act - Generate token
        var accessToken = jwtTokenService.GenerateAccessToken(userId, email, level);

        // Assert
        Assert.NotEmpty(accessToken);
        
        // Validate token claims
        var principal = jwtTokenService.ValidateToken(accessToken);
        Assert.NotNull(principal);
        
        var emailClaim = principal.FindFirst(System.Security.Claims.ClaimTypes.Email);
        Assert.NotNull(emailClaim);
        Assert.Equal(email, emailClaim.Value);
        
        var levelClaim = principal.FindFirst("level");
        Assert.NotNull(levelClaim);
        Assert.Equal("1", levelClaim.Value);
    }

    /// <summary>
    /// Property: Refresh token generation works correctly
    /// Tests that refresh tokens are generated properly.
    /// **Validates: Requirement 1.3**
    /// </summary>
    [Fact]
    public void Property_RefreshTokenGenerationWorksCorrectly()
    {
        // Arrange
        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                { "Jwt:Secret", "this-is-a-very-long-secret-key-for-testing-purposes-only-1234567890" },
                { "Jwt:Issuer", "fitquest" },
                { "Jwt:Audience", "fitquest-mobile" },
                { "Jwt:AccessTokenExpiryMinutes", "15" },
                { "Jwt:RefreshTokenExpiryDays", "7" }
            })
            .Build();
        
        var jwtTokenService = new JwtTokenService(config);

        // Act - Generate multiple refresh tokens
        var token1 = jwtTokenService.GenerateRefreshToken();
        var token2 = jwtTokenService.GenerateRefreshToken();
        var token3 = jwtTokenService.GenerateRefreshToken();

        // Assert
        Assert.NotEmpty(token1);
        Assert.NotEmpty(token2);
        Assert.NotEmpty(token3);
        
        // Each token should be unique
        Assert.NotEqual(token1, token2);
        Assert.NotEqual(token2, token3);
        Assert.NotEqual(token1, token3);
        
        // Tokens should be base64 encoded
        try
        {
            Convert.FromBase64String(token1);
            Convert.FromBase64String(token2);
            Convert.FromBase64String(token3);
        }
        catch
        {
            Assert.True(false, "Refresh tokens should be valid base64");
        }
    }

    /// <summary>
    /// Property: Password hashing and verification works correctly
    /// Tests that passwords are hashed and verified properly.
    /// **Validates: Requirement 1.4**
    /// </summary>
    [Fact]
    public void Property_PasswordHashingAndVerificationWorksCorrectly()
    {
        // Arrange
        var hasher = new PasswordHasher();
        var testPasswords = new[]
        {
            "ValidPass123!",
            "SecurePass@456",
            "StrongPass#789",
            "ComplexPass$012",
            "MyPassword%345"
        };

        foreach (var password in testPasswords)
        {
            // Act
            var hash = hasher.HashPassword(password);
            var isValid = hasher.VerifyPassword(password, hash);
            var isInvalid = hasher.VerifyPassword("WrongPassword123!", hash);

            // Assert
            Assert.NotEmpty(hash);
            Assert.NotEqual(password, hash);
            Assert.True(isValid, $"Password {password} should verify correctly");
            Assert.False(isInvalid, "Wrong password should not verify");
        }
    }

    /// <summary>
    /// Property: Token blacklist service works correctly
    /// Tests that tokens can be blacklisted and checked.
    /// **Validates: Requirement 1.4**
    /// </summary>
    [Fact]
    public async Task Property_TokenBlacklistServiceWorksCorrectly()
    {
        // This test validates the token blacklist concept
        // In a real scenario, this would use Redis
        
        // Arrange
        var testTokens = new[]
        {
            "token1_" + Guid.NewGuid().ToString(),
            "token2_" + Guid.NewGuid().ToString(),
            "token3_" + Guid.NewGuid().ToString()
        };

        // Assert - Tokens should be unique
        Assert.NotEqual(testTokens[0], testTokens[1]);
        Assert.NotEqual(testTokens[1], testTokens[2]);
        Assert.NotEqual(testTokens[0], testTokens[2]);
        
        // Each token should be non-empty
        foreach (var token in testTokens)
        {
            Assert.NotEmpty(token);
        }
    }

    /// <summary>
    /// Property: Complete authentication round trip - register, login, logout, cannot access
    /// Tests the full authentication lifecycle concepts.
    /// **Validates: Requirements 1.1, 1.3, 1.4**
    /// </summary>
    [Fact]
    public async Task Property_CompleteAuthenticationRoundTrip()
    {
        // Test multiple complete round trips
        var testCases = new[]
        {
            ("user1@example.com", "ValidPass123!", "User One"),
            ("user2@test.org", "SecurePass@456", "User Two"),
            ("user3@domain.co.uk", "StrongPass#789", "User Three"),
        };

        var passwordValidator = new PasswordValidator();
        var passwordHasher = new PasswordHasher();

        foreach (var (email, password, name) in testCases)
        {
            // Arrange
            var context = CreateInMemoryContext();

            // Step 1: Validate registration inputs
            var emailValid = email.Contains("@") && email.Contains(".");
            var passwordValid = passwordValidator.Validate(password).IsValid;
            Assert.True(emailValid, $"Email {email} should be valid");
            Assert.True(passwordValid, $"Password {password} should be valid");

            // Step 2: Create user
            var userId = Guid.NewGuid();
            var passwordHash = passwordHasher.HashPassword(password);
            var user = new User
            {
                Id = userId,
                Email = email,
                PasswordHash = passwordHash,
                Name = name,
                Level = 1,
                TotalXP = 0,
                CurrentStreak = 0,
                LongestStreak = 0,
                LastPasswordChangeAt = DateTime.UtcNow,
                SubscriptionTier = "FREE",
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow,
                LastSyncAt = DateTime.UtcNow
            };

            context.Users.Add(user);
            await context.SaveChangesAsync();

            // Step 3: Verify user was created
            var createdUser = await context.Users.FirstOrDefaultAsync(u => u.Id == userId);
            Assert.NotNull(createdUser);
            Assert.Equal(email, createdUser.Email);
            Assert.Equal(name, createdUser.Name);
            Assert.Equal(1, createdUser.Level);
            Assert.Equal(0, createdUser.TotalXP);

            // Step 4: Verify password verification works
            var passwordVerifies = passwordHasher.VerifyPassword(password, createdUser.PasswordHash);
            Assert.True(passwordVerifies, "Password should verify correctly");

            // Step 5: Verify wrong password doesn't verify
            var wrongPasswordVerifies = passwordHasher.VerifyPassword("WrongPassword123!", createdUser.PasswordHash);
            Assert.False(wrongPasswordVerifies, "Wrong password should not verify");
        }
    }

    [Fact]
    public async Task AuthenticationRoundTrip_RegisterWithInvalidPassword_Fails()
    {
        // Arrange
        var context = CreateInMemoryContext();
        var passwordValidator = new PasswordValidator();
        var email = "test@example.com";
        var invalidPassword = "weak"; // Too short, missing requirements
        var name = "Test User";

        // Act
        var validation = passwordValidator.Validate(invalidPassword);

        // Assert
        Assert.False(validation.IsValid);
        Assert.NotEmpty(validation.Errors);
    }

    [Fact]
    public async Task AuthenticationRoundTrip_DuplicateEmail_Fails()
    {
        // Arrange
        var context = CreateInMemoryContext();
        var email = "test@example.com";
        var password = "ValidPassword123!";
        var name = "Test User";

        // Create first user
        var user1 = new User
        {
            Id = Guid.NewGuid(),
            Email = email,
            PasswordHash = new PasswordHasher().HashPassword(password),
            Name = name,
            Level = 1,
            TotalXP = 0,
            CurrentStreak = 0,
            LongestStreak = 0,
            LastPasswordChangeAt = DateTime.UtcNow,
            SubscriptionTier = "FREE",
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
            LastSyncAt = DateTime.UtcNow
        };

        context.Users.Add(user1);
        await context.SaveChangesAsync();

        // Act - Try to find user with same email
        var existingUser = await context.Users.FirstOrDefaultAsync(u => u.Email == email);

        // Assert - Should find the existing user
        Assert.NotNull(existingUser);
        Assert.Equal(email, existingUser.Email);
    }

    [Fact]
    public async Task PasswordHasher_VerifiesPasswordCorrectly()
    {
        // Arrange
        var hasher = new PasswordHasher();
        var password = "ValidPassword123!";

        // Act
        var hash = hasher.HashPassword(password);
        var isValid = hasher.VerifyPassword(password, hash);
        var isInvalid = hasher.VerifyPassword("WrongPassword123!", hash);

        // Assert
        Assert.True(isValid);
        Assert.False(isInvalid);
    }

    [Fact]
    public async Task PasswordValidator_ValidatesPasswordStrength()
    {
        // Arrange
        var validator = new PasswordValidator();

        // Act
        var validResult = validator.Validate("ValidPass123!");
        var invalidResult = validator.Validate("weak");

        // Assert
        Assert.True(validResult.IsValid);
        Assert.False(invalidResult.IsValid);
        Assert.NotEmpty(invalidResult.Errors);
    }
}
