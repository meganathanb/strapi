# Audit Log Plugin - Testing Guide

> **📊 For detailed test execution results, see [TEST_RESULTS.md](./TEST_RESULTS.md)**

## Table of Contents
- [Quick Start Testing](#quick-start-testing)
- [Test Results Summary](#test-results-summary)
- [Manual Testing Guide](#manual-testing-guide)
- [Feature Verification Checklist](#feature-verification-checklist)
- [Common Test Commands](#common-test-commands)

---

## Quick Start Testing

### Prerequisites
- Strapi running on `http://localhost:1337`
- Admin user created
- Audit log plugin enabled

> **📝 Note:** The `examples/empty/src/api/article` directory contains a test content type created during testing. This is intentional and serves as a reference for testing the audit log functionality.

### Test Environment
- **Database:** SQLite 3 (better-sqlite3 v11.3.0)
  - File location: `examples/empty/.tmp/data.db`
  - The plugin is database-agnostic and works with PostgreSQL, MySQL, and SQLite in production

### 3-Step Quick Test

#### Step 1: Get Your Bearer Token
```bash
curl -X POST "http://localhost:1337/admin/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"your-admin-email@example.com","password":"your-password"}'
```
Copy the `token` value from the response.

#### Step 2: Export the Token
```bash
export TOKEN="paste-your-token-here"
```

#### Step 3: Test the Audit Log API
```bash
curl -X GET "http://localhost:1337/audit-log/audit-logs" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json"
```

**Expected Response** (empty initially):
```json
{
  "data": [],
  "meta": {
    "pagination": {
      "page": 1,
      "pageSize": 25,
      "pageCount": 0,
      "total": 0
    }
  }
}
```

---

## Test Results Summary

> **📊 For complete test results with detailed outcomes, see [TEST_RESULTS.md](./TEST_RESULTS.md)**

**Quick Summary:**
- ✅ **19/19 tests passed** (100% success rate)
- ✅ All CRUD operations (CREATE, UPDATE, DELETE, PUBLISH) logged successfully
- ✅ All filtering, pagination, and security tests passed

---

## Manual Testing Guide

### Complete Test Procedure

#### Test 1: Empty Audit Log ✅

```bash
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:1337/audit-log/audit-logs
```

Should return empty data array.

#### Test 2: Create Content

1. Go to http://localhost:1337/admin in your browser
2. Login as admin
3. Go to **Content-Type Builder**
4. Create a new collection type:
   - Name: `Article`
   - Fields: `title` (text), `content` (text)
5. Save and wait for restart

#### Test 3: Create an Entry

1. Go to **Content Manager** → **Article**
2. Click **Create new entry**
3. Fill in:
   - Title: "First Article"
   - Content: "Testing audit log"
4. Click **Save**
5. Click **Publish**

#### Test 4: Check Audit Logs

```bash
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:1337/audit-log/audit-logs
```

Should now show audit log entries!

#### Test 5: Update Content

1. Go back to your article
2. Change title to "Updated Article"
3. Click **Save**

```bash
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:1337/audit-log/audit-logs
```

Should show the update with changes!

#### Test 6: Test Filtering

**Filter by action:**
```bash
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:1337/audit-log/audit-logs?action=create"
```

**Filter by content type:**
```bash
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:1337/audit-log/audit-logs?contentType=api::article.article"
```

**Pagination:**
```bash
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:1337/audit-log/audit-logs?page=1&pageSize=5"
```

#### Test 7: Security Tests

**Without token (should fail):**
```bash
curl http://localhost:1337/audit-log/audit-logs
```

Expected: `401 Unauthorized` ✅

**Invalid token (should fail):**
```bash
curl -H "Authorization: Bearer invalid-token" \
  http://localhost:1337/audit-log/audit-logs
```

Expected: `401 Unauthorized` ✅

---

## Feature Verification Checklist

### Core Features

- [x] **Automated Logging** - All CRUD operations automatically logged
- [x] **User Tracking** - User ID, name, and email captured
- [x] **Timestamp Recording** - ISO 8601 timestamps for all operations
- [x] **Content Type Tracking** - Full content type identifier captured
- [x] **Record ID Tracking** - Document IDs preserved
- [x] **Payload Capture** - Full payload stored for CREATE operations
- [x] **Change Tracking** - Field-level diffs for UPDATE operations
- [x] **Action Types** - CREATE, UPDATE, DELETE, PUBLISH all supported

### API Features

- [x] **List Endpoint** - GET /audit-log/audit-logs works
- [x] **Single Item Endpoint** - GET /audit-log/audit-logs/:id works
- [x] **Filtering** - By action and contentType
- [x] **Pagination** - Page and pageSize parameters work
- [x] **Sorting** - Latest first (descending timestamp)
- [x] **Response Format** - Consistent data/meta structure

### Security Features

- [x] **Authentication Required** - 401 without token
- [x] **Token Validation** - Invalid tokens rejected
- [x] **Admin Permissions** - Uses admin::hasPermissions policy
- [x] **RBAC Integration** - Permission checking works

---

## Common Test Commands

### Setup
```bash
# Login
curl -X POST "http://localhost:1337/admin/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"your-email@example.com","password":"your-password"}'

# Export token
export TOKEN="your-token-here"
```

### Testing
```bash
# List all audit logs
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:1337/audit-log/audit-logs

# Filter by action
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:1337/audit-log/audit-logs?action=create"

# Pagination
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:1337/audit-log/audit-logs?page=1&pageSize=5"

# Get single log
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:1337/audit-log/audit-logs/1
```

---

## Troubleshooting Tests

### Issue: 401 Unauthorized
**Solution:** Check that your token is valid and not expired. Get a fresh token by logging in again.

### Issue: Empty Results
**Solution:** Create some content first. The audit log will be empty until content operations are performed.

### Issue: Permission Denied
**Solution:** Ensure your admin user has the `plugin::audit-log.read` permission enabled in Settings → Roles.

---

> **📊 For complete test results, metrics, and production readiness assessment, see [TEST_RESULTS.md](./TEST_RESULTS.md)**

