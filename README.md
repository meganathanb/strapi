# Strapi Audit Log Plugin

A comprehensive audit logging plugin for Strapi v5 that automatically tracks all content changes.

## 📚 Documentation

This project has three main documentation files:

### 1. [DESIGN_AND_IMPLEMENTATION.md](./DESIGN_AND_IMPLEMENTATION.md)
Complete design, architecture, and implementation guide covering:
- System architecture and design decisions
- Component structure and implementation details
- Configuration options
- API reference
- Development guide
- Troubleshooting

### 2. [TESTING.md](./TESTING.md)
Comprehensive testing guide including:
- Quick start testing guide
- Manual testing procedures
- Feature verification checklist
- Common test commands

### 3. [TEST_RESULTS.md](./TEST_RESULTS.md)
Detailed test execution results:
- Complete test results (19/19 tests passed ✅)
- Test breakdown by category
- Sample outputs and responses
- Performance metrics
- Production readiness assessment

---

## 🚀 Quick Start

### 1. Installation

Add to your Strapi app's dependencies:
```json
{
  "dependencies": {
    "@strapi/plugin-audit-log": "workspace:*"
  }
}
```

### 2. Configuration

Enable in `config/plugins.ts`:
```typescript
export default () => ({
  'audit-log': {
    enabled: true,
    config: {
      enabled: true,
      excludeContentTypes: [
        'plugin::upload.file',
        'plugin::upload.folder',
      ],
      retentionDays: 90,
    },
  },
});
```

### 3. Test It

```bash
# Login
curl -X POST "http://localhost:1337/admin/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"your-email","password":"your-password"}'

# Get audit logs
curl -X GET "http://localhost:1337/audit-log/audit-logs" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## ✨ Features

- 🔍 **Automatic Tracking** - Captures all create, update, delete, publish operations
- 👤 **User Attribution** - Records which user performed each action
- 📊 **Change Detection** - Field-level diffs for updates
- 🔒 **RBAC Integration** - Secure access with Strapi permissions
- ⚙️ **Configurable** - Enable/disable globally or per content type
- 🔎 **Advanced Filtering** - Filter by content type, user, action, date
- 📄 **Pagination** - Efficient querying with built-in pagination
- 🧹 **Auto Cleanup** - Configurable retention period

---

## 📊 Test Results

✅ **All 19 tests passed successfully**

| Category | Status |
|----------|--------|
| Authentication | ✅ 3/3 |
| CRUD Logging | ✅ 5/5 |
| Filtering | ✅ 4/4 |
| Pagination | ✅ 2/2 |
| Security | ✅ 3/3 |
| API Endpoints | ✅ 2/2 |

See [TEST_RESULTS.md](./TEST_RESULTS.md) for detailed results or [TESTING.md](./TESTING.md) for testing guide.

---

## 🏗️ Project Structure

```
packages/plugins/audit-log/
├── server/
│   └── src/
│       ├── bootstrap.ts         # Middleware & initialization
│       ├── config.ts            # Configuration
│       ├── register.ts          # Permissions
│       ├── content-types/       # Schema
│       ├── controllers/         # REST API
│       ├── routes/              # Routes
│       └── services/            # Business logic
└── strapi-server.js
```

---

## 📖 API Endpoints

### List Audit Logs
```
GET /audit-log/audit-logs
```
Query parameters: `contentType`, `userId`, `action`, `startDate`, `endDate`, `page`, `pageSize`, `sort`

### Get Single Audit Log
```
GET /audit-log/audit-logs/:id
```

All endpoints require admin authentication.

---

## 🔧 Building

```bash
cd packages/plugins/audit-log
yarn build
```

---

## 📝 License

MIT - Part of the Strapi monorepo
