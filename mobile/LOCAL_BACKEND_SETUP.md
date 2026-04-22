# Local Backend Setup (Without Docker)

If Docker is having issues, you can run the backend services locally on your machine.

## Prerequisites

- .NET 8 SDK installed ([download here](https://dotnet.microsoft.com/download/dotnet/8.0))
- PostgreSQL 15+ installed ([download here](https://www.postgresql.org/download/))
- Redis installed ([download here](https://redis.io/download))

## Step 1: Start PostgreSQL

**macOS (with Homebrew):**
```bash
brew services start postgresql
```

**Or manually:**
```bash
postgres -D /usr/local/var/postgres
```

Verify it's running:
```bash
psql -U postgres -c "SELECT version();"
```

## Step 2: Start Redis

**macOS (with Homebrew):**
```bash
brew services start redis
```

**Or manually:**
```bash
redis-server
```

Verify it's running:
```bash
redis-cli ping
# Should return: PONG
```

## Step 3: Create Databases

```bash
psql -U postgres -c "CREATE DATABASE fitquest_auth;"
psql -U postgres -c "CREATE DATABASE fitquest_workouts;"
psql -U postgres -c "CREATE DATABASE fitquest_xp;"
```

## Step 4: Run Authentication Service

```bash
cd backend-dotnet/AuthenticationService
dotnet run
```

The service will start on `http://localhost:5001`

You should see:
```
info: Microsoft.Hosting.Lifetime[14]
      Now listening on: http://localhost:5001
```

## Step 5: Test the Mobile App

1. Make sure the mobile app is running in the iOS simulator
2. The app will automatically connect to `http://localhost:5001`
3. Create an account or login

## Troubleshooting

### PostgreSQL Connection Error
```
Host=localhost;Port=5432;Database=fitquest_auth;Username=postgres;Password=postgres
```

Make sure:
- PostgreSQL is running: `brew services list`
- Default password is `postgres`
- Port 5432 is not blocked

### Redis Connection Error
Make sure Redis is running:
```bash
redis-cli ping
```

### Port Already in Use
If port 5001 is already in use, modify `appsettings.json`:
```json
{
  "Kestrel": {
    "Endpoints": {
      "Http": {
        "Url": "http://localhost:5002"
      }
    }
  }
}
```

Then update the mobile app's AuthenticationService baseURL.

## Stopping Services

```bash
# Stop PostgreSQL
brew services stop postgresql

# Stop Redis
brew services stop redis
```

## Next Steps

Once authentication is working locally:
1. Test account creation and login
2. Verify tokens are stored securely
3. Test token refresh on expiration
