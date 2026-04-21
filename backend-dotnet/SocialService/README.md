# Social Service

The Social Service manages friend relationships, friend requests, and user search functionality for FitQuest.

## Features

- Friend request management (send, accept, decline)
- Friendship CRUD operations
- User search functionality
- Friend list retrieval with status
- Support for 1000+ friends per user
- Event publishing for FriendshipCreated events

## API Endpoints

### Friend Management

- `POST /friends/request` - Send friend request
- `POST /friends/request/{id}/accept` - Accept friend request
- `POST /friends/request/{id}/decline` - Decline friend request
- `DELETE /friends/{id}` - Remove friend
- `GET /friends` - List friends

### User Search

- `GET /users/search?query={query}` - Search for users

## Database Schema

### Friendships Table
```sql
CREATE TABLE friendships (
  id UUID PRIMARY KEY,
  user_id_1 UUID NOT NULL,
  user_id_2 UUID NOT NULL,
  status VARCHAR(50) NOT NULL,
  created_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP NOT NULL,
  UNIQUE(user_id_1, user_id_2)
);

CREATE INDEX idx_friendships_user_id_1 ON friendships(user_id_1);
CREATE INDEX idx_friendships_user_id_2 ON friendships(user_id_2);
CREATE INDEX idx_friendships_status ON friendships(status);
```

### Friend Requests Table
```sql
CREATE TABLE friend_requests (
  id UUID PRIMARY KEY,
  sender_id UUID NOT NULL,
  receiver_id UUID NOT NULL,
  created_at TIMESTAMP NOT NULL,
  UNIQUE(sender_id, receiver_id)
);

CREATE INDEX idx_friend_requests_sender_id ON friend_requests(sender_id);
CREATE INDEX idx_friend_requests_receiver_id ON friend_requests(receiver_id);
```

### User Profiles Table
```sql
CREATE TABLE user_profiles (
  id UUID PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  bio TEXT,
  level INTEGER NOT NULL,
  total_xp INTEGER NOT NULL
);

CREATE INDEX idx_user_profiles_email ON user_profiles(email);
CREATE INDEX idx_user_profiles_name ON user_profiles(name);
```

## Running Locally

### Prerequisites
- .NET 10 SDK
- PostgreSQL 14+
- Redis 7+

### Setup

1. Create database:
```bash
psql -h localhost -U postgres -c "CREATE DATABASE fitquest_social;"
```

2. Run migrations:
```bash
dotnet ef database update
```

3. Start service:
```bash
dotnet run
```

Service will be available at `http://localhost:5009`

## Docker

Build image:
```bash
docker build -f SocialService/Dockerfile -t fitquest-social-service .
```

Run container:
```bash
docker run -p 5009:80 \
  -e ConnectionStrings__DefaultConnection="Host=postgres;Database=fitquest_social;Username=postgres;Password=postgres" \
  -e ConnectionStrings__Redis="redis:6379" \
  fitquest-social-service
```

## Events

### Published Events
- `FriendshipCreated` - Published when friendship is accepted

### Subscribed Events
- None

## Performance Targets

- Friend list retrieval: < 100ms
- User search: < 200ms
- Friend request operations: < 50ms
- Support for 1000+ friends per user

## Security

- JWT authentication required for all endpoints except search
- Rate limiting on friend requests (10 per minute per user)
- Input validation on all requests
- SQL injection prevention via parameterized queries
