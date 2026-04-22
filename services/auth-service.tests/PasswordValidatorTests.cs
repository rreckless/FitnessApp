using AuthService.Services;
using Xunit;

namespace AuthService.Tests;

public class PasswordValidatorTests
{
    private readonly IPasswordValidator _validator = new PasswordValidator();

    [Fact]
    public void Validate_WithValidPassword_ReturnsValid()
    {
        // Arrange
        var password = "ValidPass123!";

        // Act
        var result = _validator.Validate(password);

        // Assert
        Assert.True(result.IsValid);
        Assert.Empty(result.Errors);
    }

    [Fact]
    public void Validate_WithTooShortPassword_ReturnsInvalid()
    {
        // Arrange
        var password = "Short1!";

        // Act
        var result = _validator.Validate(password);

        // Assert
        Assert.False(result.IsValid);
        Assert.Contains("at least 12 characters", result.Errors[0]);
    }

    [Fact]
    public void Validate_WithoutUppercase_ReturnsInvalid()
    {
        // Arrange
        var password = "validpass123!";

        // Act
        var result = _validator.Validate(password);

        // Assert
        Assert.False(result.IsValid);
        Assert.Contains("uppercase", result.Errors[0]);
    }

    [Fact]
    public void Validate_WithoutLowercase_ReturnsInvalid()
    {
        // Arrange
        var password = "VALIDPASS123!";

        // Act
        var result = _validator.Validate(password);

        // Assert
        Assert.False(result.IsValid);
        Assert.Contains("lowercase", result.Errors[0]);
    }

    [Fact]
    public void Validate_WithoutNumber_ReturnsInvalid()
    {
        // Arrange
        var password = "ValidPassABC!"; // 12 chars, but no number

        // Act
        var result = _validator.Validate(password);

        // Assert
        Assert.False(result.IsValid);
        Assert.Contains("number", result.Errors[0]);
    }

    [Fact]
    public void Validate_WithoutSpecialCharacter_ReturnsInvalid()
    {
        // Arrange
        var password = "ValidPass123";

        // Act
        var result = _validator.Validate(password);

        // Assert
        Assert.False(result.IsValid);
        Assert.Contains("special character", result.Errors[0]);
    }

    [Fact]
    public void Validate_WithEmptyPassword_ReturnsInvalid()
    {
        // Arrange
        var password = "";

        // Act
        var result = _validator.Validate(password);

        // Assert
        Assert.False(result.IsValid);
        Assert.Contains("required", result.Errors[0]);
    }

    [Theory]
    [InlineData("ValidPass123!")]
    [InlineData("MyPassword@456")]
    [InlineData("SecurePass#789")]
    public void Validate_WithValidPasswords_ReturnsValid(string password)
    {
        // Act
        var result = _validator.Validate(password);

        // Assert
        Assert.True(result.IsValid);
        Assert.Empty(result.Errors);
    }

    [Theory]
    [InlineData("short1!")]
    [InlineData("NoNumber!")]
    [InlineData("noupppercase123!")]
    [InlineData("NOLOWERCASE123!")]
    [InlineData("NoSpecial123")]
    public void Validate_WithInvalidPasswords_ReturnsInvalid(string password)
    {
        // Act
        var result = _validator.Validate(password);

        // Assert
        Assert.False(result.IsValid);
        Assert.NotEmpty(result.Errors);
    }

    // ============================================================================
    // Property-Based Tests for Password Strength Validation
    // **Validates: Requirements 1.5.1, 1.5.2, 1.5.3**
    // ============================================================================

    /// <summary>
    /// Property 2: Password Strength Validation
    /// Validates that passwords with 12+ characters, uppercase, lowercase, number, 
    /// and special character are valid.
    /// **Validates: Requirements 1.5.1, 1.5.2, 1.5.3**
    /// </summary>
    [Fact]
    public void Property_ValidPasswordsWithAllRequirements_AreValid()
    {
        // Test multiple valid passwords with all required components
        var validPasswords = new[]
        {
            "ValidPass123!",
            "MyPassword@456",
            "SecurePass#789",
            "TestPass$1234",
            "Demo%Pass5678",
            "Sample^Pass9012",
            "Example&Pass3456",
            "Strong*Pass7890",
            "Secure!Pass1111",
            "Complex@Pass2222"
        };

        foreach (var password in validPasswords)
        {
            var result = _validator.Validate(password);
            Assert.True(result.IsValid, $"Password '{password}' should be valid but got errors: {string.Join(", ", result.Errors)}");
            Assert.Empty(result.Errors);
        }
    }

    /// <summary>
    /// Property: Passwords with less than 12 characters are invalid
    /// **Validates: Requirement 1.5.1**
    /// </summary>
    [Fact]
    public void Property_PasswordsWithLessThan12Characters_AreInvalid()
    {
        // Test passwords with various lengths less than 12
        var invalidPasswords = new[]
        {
            "",
            "a",
            "ab",
            "abc",
            "abcd",
            "abcde",
            "abcdef",
            "abcdefg",
            "abcdefgh",
            "abcdefghi",
            "abcdefghij",
            "abcdefghijk"  // 11 chars
        };

        foreach (var password in invalidPasswords)
        {
            var result = _validator.Validate(password);
            Assert.False(result.IsValid, $"Password with length {password.Length} should be invalid");
            
            // Should contain length error (unless empty, which has different error)
            if (password.Length > 0)
            {
                Assert.Contains(result.Errors, e => e.Contains("12 characters"));
            }
        }
    }

    /// <summary>
    /// Property: Passwords without uppercase letters are invalid
    /// **Validates: Requirement 1.5.2**
    /// </summary>
    [Fact]
    public void Property_PasswordsWithoutUppercase_AreInvalid()
    {
        // Generate passwords with lowercase, numbers, and special chars but NO uppercase
        var passwordsWithoutUppercase = new[]
        {
            "validpass123!",
            "lowercase1234@",
            "nouppercase5#",
            "test1234567!",
            "demo@pass1234"
        };

        foreach (var password in passwordsWithoutUppercase)
        {
            if (password.Length < 12 || password.Any(c => c >= 'A' && c <= 'Z'))
                continue;

            var result = _validator.Validate(password);
            Assert.False(result.IsValid, $"Password without uppercase should be invalid");
            Assert.Contains(result.Errors, e => e.Contains("uppercase"));
        }
    }

    /// <summary>
    /// Property: Passwords without lowercase letters are invalid
    /// **Validates: Requirement 1.5.2**
    /// </summary>
    [Fact]
    public void Property_PasswordsWithoutLowercase_AreInvalid()
    {
        // Generate passwords with uppercase, numbers, and special chars but NO lowercase
        var passwordsWithoutLowercase = new[]
        {
            "VALIDPASS123!",
            "UPPERCASE1234@",
            "NOLOWERCASE5#",
            "TEST1234567!",
            "DEMO@PASS1234"
        };

        foreach (var password in passwordsWithoutLowercase)
        {
            if (password.Length < 12 || password.Any(c => c >= 'a' && c <= 'z'))
                continue;

            var result = _validator.Validate(password);
            Assert.False(result.IsValid, $"Password without lowercase should be invalid");
            Assert.Contains(result.Errors, e => e.Contains("lowercase"));
        }
    }

    /// <summary>
    /// Property: Passwords without numbers are invalid
    /// **Validates: Requirement 1.5.2**
    /// </summary>
    [Fact]
    public void Property_PasswordsWithoutNumbers_AreInvalid()
    {
        // Generate passwords with uppercase, lowercase, and special chars but NO numbers
        var passwordsWithoutNumbers = new[]
        {
            "ValidPassABC!",
            "UppercasePass@",
            "NoNumberPass#",
            "TestPassWord!",
            "DemoPassword@"
        };

        foreach (var password in passwordsWithoutNumbers)
        {
            if (password.Length < 12 || password.Any(c => c >= '0' && c <= '9'))
                continue;

            var result = _validator.Validate(password);
            Assert.False(result.IsValid, $"Password without number should be invalid");
            Assert.Contains(result.Errors, e => e.Contains("number"));
        }
    }

    /// <summary>
    /// Property: Passwords without special characters are invalid
    /// **Validates: Requirement 1.5.2**
    /// </summary>
    [Fact]
    public void Property_PasswordsWithoutSpecialCharacters_AreInvalid()
    {
        // Generate passwords with uppercase, lowercase, and numbers but NO special chars
        var passwordsWithoutSpecial = new[]
        {
            "ValidPass123",
            "UppercasePass1234",
            "NoSpecialPass5678",
            "TestPassword1234",
            "DemoPassword5678"
        };

        foreach (var password in passwordsWithoutSpecial)
        {
            if (password.Length < 12 || password.Any(c => "!@#$%^&*".Contains(c)))
                continue;

            var result = _validator.Validate(password);
            Assert.False(result.IsValid, $"Password without special character should be invalid");
            Assert.Contains(result.Errors, e => e.Contains("special character"));
        }
    }

    /// <summary>
    /// Property: Error messages list all missing requirements
    /// **Validates: Requirement 1.5.3**
    /// </summary>
    [Fact]
    public void Property_ErrorMessagesListAllMissingRequirements()
    {
        // Test case 1: Missing all requirements except length
        var password1 = "abc";
        var result1 = _validator.Validate(password1);
        Assert.False(result1.IsValid);
        Assert.Contains(result1.Errors, e => e.Contains("12 characters"));
        Assert.Contains(result1.Errors, e => e.Contains("uppercase"));
        Assert.Contains(result1.Errors, e => e.Contains("number"));
        Assert.Contains(result1.Errors, e => e.Contains("special character"));

        // Test case 2: Missing uppercase and special character
        var password2 = "validpass123";
        var result2 = _validator.Validate(password2);
        Assert.False(result2.IsValid);
        Assert.Contains(result2.Errors, e => e.Contains("uppercase"));
        Assert.Contains(result2.Errors, e => e.Contains("special character"));
        Assert.DoesNotContain(result2.Errors, e => e.Contains("12 characters"));
        Assert.DoesNotContain(result2.Errors, e => e.Contains("lowercase"));
        Assert.DoesNotContain(result2.Errors, e => e.Contains("number"));

        // Test case 3: Missing only number
        var password3 = "ValidPass!@#";
        var result3 = _validator.Validate(password3);
        Assert.False(result3.IsValid);
        Assert.Single(result3.Errors);
        Assert.Contains(result3.Errors, e => e.Contains("number"));

        // Test case 4: Valid password has no errors
        var password4 = "ValidPass123!";
        var result4 = _validator.Validate(password4);
        Assert.True(result4.IsValid);
        Assert.Empty(result4.Errors);
    }

    /// <summary>
    /// Property: Minimum length requirement is exactly 12 characters
    /// **Validates: Requirement 1.5.1**
    /// </summary>
    [Fact]
    public void Property_MinimumLengthBoundary_Is12Characters()
    {
        // Test password with exactly 11 characters (should be invalid)
        var password11Actual = "ValidPass1!";  // 11 chars
        var result11 = _validator.Validate(password11Actual);
        Assert.False(result11.IsValid);
        Assert.Contains(result11.Errors, e => e.Contains("12 characters"));

        // Test password with exactly 12 characters (should be valid if other requirements met)
        var password12Actual = "ValidPass12!";  // 12 chars
        var result12 = _validator.Validate(password12Actual);
        Assert.True(result12.IsValid);
        Assert.Empty(result12.Errors);

        // Test password with 13 characters (should be valid if other requirements met)
        var password13Actual = "ValidPass123!";  // 13 chars
        var result13 = _validator.Validate(password13Actual);
        Assert.True(result13.IsValid);
        Assert.Empty(result13.Errors);
    }

    /// <summary>
    /// Property: Special character validation accepts only allowed special characters
    /// **Validates: Requirement 1.5.2**
    /// </summary>
    [Fact]
    public void Property_SpecialCharacterValidation_AcceptsOnlyAllowedCharacters()
    {
        var allowedSpecialChars = new[] { '!', '@', '#', '$', '%', '^', '&', '*' };

        // Test with each allowed special character
        foreach (var specialChar in allowedSpecialChars)
        {
            var password = $"ValidPass123{specialChar}";
            var result = _validator.Validate(password);
            Assert.True(result.IsValid, $"Password with special character '{specialChar}' should be valid");
        }

        // Test with disallowed special characters
        var disallowedChars = new[] { '~', '`', '-', '_', '=', '+', '[', ']', '{', '}', '|', ';', ':', '"', '\'', '<', '>', ',', '.', '?', '/' };
        foreach (var specialChar in disallowedChars)
        {
            var password = $"ValidPass123{specialChar}";
            var result = _validator.Validate(password);
            Assert.False(result.IsValid, $"Password with special character '{specialChar}' should be invalid");
            Assert.Contains(result.Errors, e => e.Contains("special character"));
        }
    }

    /// <summary>
    /// Property: Validation is deterministic - same password always produces same result
    /// **Validates: Requirements 1.5.1, 1.5.2, 1.5.3**
    /// </summary>
    [Fact]
    public void Property_Validation_IsDeterministic()
    {
        var testPasswords = new[]
        {
            "ValidPass123!",
            "short1!",
            "NoNumber!",
            "noupppercase123!",
            "NOLOWERCASE123!",
            "NoSpecial123",
            ""
        };

        foreach (var password in testPasswords)
        {
            var result1 = _validator.Validate(password);
            var result2 = _validator.Validate(password);
            var result3 = _validator.Validate(password);

            // All three validations should produce identical results
            Assert.Equal(result1.IsValid, result2.IsValid);
            Assert.Equal(result2.IsValid, result3.IsValid);
            Assert.Equal(result1.Errors.Count, result2.Errors.Count);
            Assert.Equal(result2.Errors.Count, result3.Errors.Count);
            
            for (int i = 0; i < result1.Errors.Count; i++)
            {
                Assert.Equal(result1.Errors[i], result2.Errors[i]);
                Assert.Equal(result2.Errors[i], result3.Errors[i]);
            }
        }
    }

    /// <summary>
    /// Property: All password requirements are independent
    /// **Validates: Requirements 1.5.1, 1.5.2**
    /// </summary>
    [Fact]
    public void Property_PasswordRequirements_AreIndependent()
    {
        // Each requirement should be independently validated
        
        // Missing only length
        var tooShort = "Pass1!aB";  // 8 chars, has all other requirements
        var resultShort = _validator.Validate(tooShort);
        Assert.False(resultShort.IsValid);
        Assert.Single(resultShort.Errors.Where(e => e.Contains("12 characters")));

        // Missing only uppercase
        var noUpper = "validpass123!";  // 13 chars, has length, lowercase, number, special
        var resultNoUpper = _validator.Validate(noUpper);
        Assert.False(resultNoUpper.IsValid);
        Assert.Single(resultNoUpper.Errors.Where(e => e.Contains("uppercase")));

        // Missing only lowercase
        var noLower = "VALIDPASS123!";  // 13 chars, has length, uppercase, number, special
        var resultNoLower = _validator.Validate(noLower);
        Assert.False(resultNoLower.IsValid);
        Assert.Single(resultNoLower.Errors.Where(e => e.Contains("lowercase")));

        // Missing only number
        var noNumber = "ValidPassABC!";  // 13 chars, has length, uppercase, lowercase, special
        var resultNoNumber = _validator.Validate(noNumber);
        Assert.False(resultNoNumber.IsValid);
        Assert.Single(resultNoNumber.Errors.Where(e => e.Contains("number")));

        // Missing only special character
        var noSpecial = "ValidPass123";  // 12 chars, has length, uppercase, lowercase, number
        var resultNoSpecial = _validator.Validate(noSpecial);
        Assert.False(resultNoSpecial.IsValid);
        Assert.Single(resultNoSpecial.Errors.Where(e => e.Contains("special character")));
    }

    /// <summary>
    /// Property: Multiple violations are all reported
    /// **Validates: Requirement 1.5.3**
    /// </summary>
    [Fact]
    public void Property_MultipleViolations_AreAllReported()
    {
        // Test with multiple violations
        var password = "abc";  // Too short, no uppercase, no number, no special
        var result = _validator.Validate(password);
        
        Assert.False(result.IsValid);
        Assert.True(result.Errors.Count >= 4, $"Expected at least 4 errors, got {result.Errors.Count}");
        
        // Verify all violations are reported
        var errorText = string.Join(" ", result.Errors);
        Assert.Contains("12 characters", errorText);
        Assert.Contains("uppercase", errorText);
        Assert.Contains("number", errorText);
        Assert.Contains("special character", errorText);
    }
}
