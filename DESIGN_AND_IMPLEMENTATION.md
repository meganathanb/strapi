# Audit Log Plugin - Design & Implementation

## Table of Contents
- [Overview](#overview)
- [Features](#features)
- [Architecture & Design](#architecture--design)
- [Implementation Details](#implementation-details)
- [Configuration](#configuration)
- [API Reference](#api-reference)
- [Development](#development)
- [Troubleshooting](#troubleshooting)

---

## Overview

A comprehensive audit logging plugin for Strapi v5 that automatically tracks all content changes performed through the Content API. This plugin provides a complete, tamper-resistant audit trail for compliance, security monitoring, and debugging.

### Design Goals

1. **Non-Intrusive**: Logging should not interfere with or break existing content operations
2. **Performance**: Minimal overhead on content operations
3. **Scalable**: Handle high-volume applications with thousands of audit entries
4. **Secure**: Protected by role-based access control
5. **Flexible**: Configurable to suit different use cases
6. **Complete**: Capture all relevant metadata for compliance and debugging

---

## Features

- 🔍 **Automatic Tracking**: Captures all create, update, delete, publish, and unpublish operations
- 👤 **User Attribution**: Records which user performed each action
- 📊 **Change Detection**: Automatically calculates and stores field-level changes (diffs)
- 🔒 **Role-Based Access Control**: Secure access to audit logs with permissions
- ⚙️ **Configurable**: Enable/disable logging globally or per content type
- 🔎 **Advanced Filtering**: Filter logs by content type, user, action, and date range
- 📄 **Pagination & Sorting**: Efficient querying with built-in pagination
- 🧹 **Automatic Cleanup**: Configurable retention period for old logs

---

## Architecture & Design

### System Architecture

```
┌─────────────────────────────────────────────────────────┐
│                   Strapi Application                     │
│                                                           │
│  ┌─────────────────┐                                     │
│  │  Content API    │                                     │
│  │   Operations    │                                     │
│  └────────┬────────┘                                     │
│           │                                               │
│           ▼                                               │
│  ┌─────────────────────────────────────────────────┐    │
│  │     Document Service Middleware Layer            │    │
│  │  ┌──────────────────────────────────────────┐   │    │
│  │  │   Audit Log Middleware                   │   │    │
│  │  │  • Intercepts: create/update/delete       │   │    │
│  │  │  • Extracts: user context                │   │    │
│  │  │  • Calculates: field-level changes       │   │    │
│  │  └──────────────────────────────────────────┘   │    │
│  └─────────────────────────────────────────────────┘    │
│           │                                               │
│           ▼                                               │
│  ┌─────────────────────────────────────────────────┐    │
│  │         Audit Log Service                        │    │
│  │  • Creates audit log entries                     │    │
│  │  • Queries audit logs                            │    │
│  │  • Manages retention                             │    │
│  └──────────────┬──────────────────────────────────┘    │
│                 │                                         │
│                 ▼                                         │
│  ┌─────────────────────────────────────────────────┐    │
│  │         Database (audit_logs table)              │    │
│  │  • Stores all audit entries                      │    │
│  │  • Indexed for efficient queries                 │    │
│  └─────────────────────────────────────────────────┘    │
│                                                           │
└─────────────────────────────────────────────────────────┘

         ▲
         │ HTTP GET /audit-log/audit-logs
         │
┌────────┴─────────┐
│   Admin Users    │
│  (with READ      │
│   permission)    │
└──────────────────┘
```

### Key Architectural Decisions

#### 1. Middleware vs Lifecycle Hooks
- **Chosen**: Document Service Middleware (`strapi.documents.use()`)
- **Why**: Higher-level abstraction that handles draft/publish semantics
- **Alternative Considered**: Database lifecycles (`strapi.db.lifecycles`) - too low-level, misses user context

#### 2. Change Detection Strategy
- **Chosen**: Deep object comparison using `lodash.isEqual`
- **Why**: Accurate field-level change detection
- **Trade-off**: Slightly slower but necessary for meaningful audits
- **Optimization**: Skips system fields (id, createdAt, updatedAt)

#### 3. Async vs Sync Logging
- **Chosen**: Asynchronous logging after operation succeeds
- **Why**: Never blocks main operation, ensures reliability
- **Error Handling**: Logging errors are caught and logged but never propagate

#### 4. Read-Only API
- **Chosen**: No create/update/delete endpoints exposed
- **Why**: Prevents tampering with audit trail
- **Access**: Logs created internally only, read via API

---

## Implementation Details

### Component Architecture

#### 1. Content Type Schema (`audit_logs`)

**Location**: `packages/plugins/audit-log/server/src/content-types/audit-log/schema.json`

```json
{
  "kind": "collectionType",
  "collectionName": "audit_logs",
  "info": {
    "singularName": "audit-log",
    "pluralName": "audit-logs",
    "displayName": "Audit Log"
  },
  "options": {
    "draftAndPublish": false
  },
  "pluginOptions": {
    "content-manager": {
      "visible": false
    },
    "content-type-builder": {
      "visible": false
    }
  },
  "attributes": {
    "contentType": { "type": "string", "required": true },
    "recordId": { "type": "string", "required": true },
    "action": {
      "type": "enumeration",
      "enum": ["create", "update", "delete", "publish", "unpublish"],
      "required": true
    },
    "userId": { "type": "integer" },
    "userName": { "type": "string" },
    "userEmail": { "type": "string" },
    "payload": { "type": "json" },
    "changes": { "type": "json" },
    "timestamp": { "type": "datetime", "required": true }
  }
}
```

**Design Rationale**:
- Collection type (not single) for multiple entries
- No draft/publish (immutable once created)
- Hidden from admin UI (prevents tampering)
- JSON fields for flexibility

#### 2. Audit Log Service

**Location**: `packages/plugins/audit-log/server/src/services/audit-log.ts`

**Key Methods**:

```typescript
interface AuditLogService {
  // Create audit log entry
  create(params: CreateAuditLogParams): Promise<AuditLog | null>;
  
  // Query with filters and pagination
  find(params: FindAuditLogsParams): Promise<PaginatedResult<AuditLog>>;
  
  // Get single log
  findOne(id: number): Promise<AuditLog | null>;
  
  // Retention cleanup
  deleteOlderThan(days: number): Promise<number>;
}
```

**Change Detection Algorithm**:
```typescript
const calculateChanges = (oldData, newData) => {
  const changes = {};
  const fieldsToSkip = ['id', 'documentId', 'createdAt', 'updatedAt', 'createdBy', 'updatedBy'];
  
  for (const key of Object.keys(newData)) {
    if (fieldsToSkip.includes(key)) continue;
    
    if (!isEqual(oldData[key], newData[key])) {
      changes[key] = {
        from: oldData[key],
        to: newData[key]
      };
    }
  }
  
  return Object.keys(changes).length > 0 ? changes : null;
};
```

#### 3. Document Middleware

**Location**: `packages/plugins/audit-log/server/src/bootstrap.ts`

**Flow**:
```
1. Request arrives → Middleware intercepts
2. Check if audit is enabled for this content type
3. Extract user context from request
4. For updates/deletes: Fetch old data
5. Execute original operation → await next()
6. After success: Create audit log asynchronously
7. Return result (logging errors don't affect response)
```

**User Context Extraction**:
```typescript
const ctx = strapi.requestContext.get();
const user = ctx?.state?.user;

if (user) {
  userId = user.id;
  userName = `${user.firstname} ${user.lastname}`;
  userEmail = user.email;
}
```

**Content Type Filtering**:
```typescript
const shouldLog = (contentType: string) => {
  // Skip if logging disabled
  if (!config.enabled) return false;
  
  // Skip excluded content types
  if (config.excludeContentTypes.includes(contentType)) return false;
  
  // Skip plugin content types (except user-created)
  if (contentType.startsWith('plugin::') && !contentType.startsWith('api::')) {
    return false;
  }
  
  return true;
};
```

#### 4. REST API Controller & Routes

**Location**: `packages/plugins/audit-log/server/src/controllers/audit-log.ts`

**Controller Structure**:
```typescript
export default {
  async find(ctx) {
    const { query } = ctx.request;
    const filters = buildFilters(query);
    const result = await strapi.plugin('audit-log').service('audit-log').find(filters);
    return result;
  },
  
  async findOne(ctx) {
    const { id } = ctx.params;
    const result = await strapi.plugin('audit-log').service('audit-log').findOne(id);
    if (!result) {
      return ctx.notFound('Audit log not found');
    }
    return { data: result };
  }
};
```

**Routes Structure** (`server/src/routes/index.ts`):
```typescript
export default {
  admin: {
    type: 'admin',
    routes: [
      {
        method: 'GET',
        path: '/audit-logs',
        handler: 'audit-log.find',
        config: {
          policies: [{
            name: 'admin::hasPermissions',
            config: { actions: ['plugin::audit-log.read'] }
          }]
        }
      },
      {
        method: 'GET',
        path: '/audit-logs/:id',
        handler: 'audit-log.findOne',
        config: {
          policies: [{
            name: 'admin::hasPermissions',
            config: { actions: ['plugin::audit-log.read'] }
          }]
        }
      }
    ]
  }
};
```

#### 5. Permission System

**Location**: `packages/plugins/audit-log/server/src/register.ts`

```typescript
export default ({ strapi }) => {
  strapi.admin.services.permission.actionProvider.registerMany([
    {
      section: 'plugins',
      displayName: 'Read',
      uid: 'read',
      pluginName: 'audit-log',
    },
  ]);
};
```

**Integration with Strapi RBAC**:
- Admin routes protected by `admin::hasPermissions` policy
- Permission: `plugin::audit-log.read`
- Configurable per role in admin panel

#### 6. Retention & Cleanup

**Cron Job** (runs daily at 2 AM):
```typescript
strapi.cron.add({
  '0 2 * * *': async () => {
    const { retentionDays } = config;
    if (retentionDays > 0) {
      await auditLogService.deleteOlderThan(retentionDays);
    }
  }
});
```

---

## Configuration

### Installation

1. Add to your Strapi app's `package.json`:
```json
{
  "dependencies": {
    "@strapi/plugin-audit-log": "workspace:*"
  }
}
```

2. Enable in `config/plugins.ts`:
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

### Configuration Options

#### `enabled` (boolean)
- **Default**: `true`
- **Description**: Globally enable or disable audit logging

#### `excludeContentTypes` (array)
- **Default**: `['plugin::upload.file', 'plugin::upload.folder', 'plugin::audit-log.audit-log']`
- **Description**: Array of content type UIDs to exclude from audit logging

#### `retentionDays` (number)
- **Default**: `90`
- **Description**: Number of days to retain audit logs. Set to `0` to disable automatic cleanup.

---

## API Reference

### Base URL
All audit log endpoints are admin routes:
```
http://localhost:1337/audit-log/audit-logs
```

### Authentication
All endpoints require admin authentication:
```bash
Authorization: Bearer <JWT_TOKEN>
```

### Endpoints

#### List Audit Logs
```
GET /audit-log/audit-logs
```

**Query Parameters:**
| Parameter | Type | Description | Default |
|-----------|------|-------------|---------|
| `contentType` | string | Filter by content type UID | - |
| `userId` | number | Filter by user ID | - |
| `action` | string | Filter by action (`create`, `update`, `delete`, `publish`, `unpublish`) | - |
| `startDate` | string | Filter by start date (ISO 8601) | - |
| `endDate` | string | Filter by end date (ISO 8601) | - |
| `page` | number | Page number | 1 |
| `pageSize` | number | Page size (max 100) | 25 |
| `sort` | string | Sort field and direction (e.g., `timestamp:desc`) | `timestamp:desc` |

**Example Request:**
```bash
curl -X GET "http://localhost:1337/audit-log/audit-logs?contentType=api::article.article&action=update&page=1&pageSize=25" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Example Response:**
```json
{
  "data": [
    {
      "id": 1,
      "contentType": "api::article.article",
      "recordId": "abc123",
      "action": "update",
      "userId": 1,
      "userName": "John Doe",
      "userEmail": "john@example.com",
      "payload": null,
      "changes": {
        "title": {
          "from": "Old Title",
          "to": "New Title"
        }
      },
      "timestamp": "2025-10-26T10:30:00.000Z"
    }
  ],
  "meta": {
    "pagination": {
      "page": 1,
      "pageSize": 25,
      "pageCount": 1,
      "total": 1
    }
  }
}
```

#### Get Single Audit Log
```
GET /audit-log/audit-logs/:id
```

**Example Request:**
```bash
curl -X GET "http://localhost:1337/audit-log/audit-logs/1" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Example Response:**
```json
{
  "data": {
    "id": 1,
    "contentType": "api::article.article",
    "action": "create",
    "timestamp": "2025-10-26T10:30:00.000Z"
  }
}
```

### Data Structure

Each audit log entry contains:

| Field | Type | Description |
|-------|------|-------------|
| `id` | number | Unique identifier |
| `contentType` | string | Content type UID (e.g., `api::article.article`) |
| `recordId` | string | ID of the affected record |
| `action` | enum | Action performed: `create`, `update`, `delete`, `publish`, `unpublish` |
| `userId` | number | ID of the user who performed the action (null if system) |
| `userName` | string | Name of the user |
| `userEmail` | string | Email of the user |
| `payload` | json | Full payload for create actions |
| `changes` | json | Field-level changes for update actions |
| `timestamp` | datetime | When the action occurred |

---

## Development

### Building the Plugin

```bash
cd packages/plugins/audit-log
yarn build
```

### Project Structure

```
packages/plugins/audit-log/
├── server/
│   └── src/
│       ├── bootstrap.ts         # Plugin initialization & middleware
│       ├── config.ts            # Configuration schema
│       ├── register.ts          # Permission registration
│       ├── content-types/       # Schema definitions
│       │   └── audit-log/
│       │       └── schema.json
│       ├── controllers/         # REST API controllers
│       │   └── audit-log.ts
│       ├── routes/              # Route definitions
│       │   └── index.ts
│       └── services/            # Business logic
│           └── audit-log.ts
├── strapi-server.js             # Server entry point
└── package.json
```

### Performance Considerations

#### Database Indexes
Recommended indexes for optimal query performance:

```sql
CREATE INDEX idx_audit_logs_content_type ON audit_logs(contentType);
CREATE INDEX idx_audit_logs_user_id ON audit_logs(userId);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_timestamp ON audit_logs(timestamp DESC);
CREATE INDEX idx_audit_logs_composite ON audit_logs(contentType, timestamp DESC);
```

**Note:** These indexes are not automatically created. For production deployments, run these SQL commands manually against your database after the plugin is installed and the `audit_logs` table is created. The exact syntax may vary depending on your database (PostgreSQL, MySQL, SQLite, etc.).

#### Scalability
- **Async Logging**: Non-blocking, minimal overhead
- **Pagination**: Limits data transfer
- **Retention Policy**: Prevents unbounded growth
- **Selective Logging**: Only logs user content by default

---

## Troubleshooting

### Logs Not Being Created

1. Check if the plugin is enabled in `config/plugins.ts`
2. Verify the content type is not in `excludeContentTypes`
3. Check Strapi logs for any errors
4. Ensure the database migration has created the `audit_logs` table

### Permission Denied

1. Ensure the role has the `plugin::audit-log.read` permission
2. Go to Settings → Roles → Select role → Enable "Read" under "Audit Log"
3. Verify the user is authenticated with a valid JWT token

### Performance Issues

1. Add database indexes on frequently filtered fields
2. Reduce `pageSize` in API requests
3. Increase `retentionDays` configuration to reduce database size
4. Consider archiving old logs to separate storage

### No Changes Detected in Updates

This is expected if only system fields (createdAt, updatedAt) changed. The plugin only logs user-content field changes to reduce noise.

---

## Security Considerations

### Data Privacy
- Full payloads are stored, which may contain PII
- Respect retention period and exclude sensitive content types
- Consider implementing field redaction for sensitive data

### Access Control
- Only authorized admins with `plugin::audit-log.read` permission can access logs
- No public API exposure
- Enforced via Strapi's RBAC system

### Tamper Resistance
- Logs are immutable (no update/delete endpoints)
- Can only be deleted via retention cleanup
- Manual database access required to tamper (auditable at DB level)

---

## Use Cases

- **Compliance & Auditing**: Track all content changes for GDPR, HIPAA, SOC 2
- **Security Monitoring**: Monitor suspicious activities or unauthorized access
- **Debugging**: Investigate when and how content was changed
- **User Activity Tracking**: Monitor user behavior and editing patterns
- **Content History**: Maintain complete history of content evolution

---

## Known Limitations

1. No component-level change tracking (logs component as whole object)
2. No built-in data redaction for PII
3. Retention cleanup is all-or-nothing (no selective deletion)

---

## Future Enhancements

- Admin UI dashboard for browsing audit logs
- Export functionality (CSV/JSON)
- Webhooks for external system integration
- Field-level exclusion (skip specific fields)
- Restore functionality (revert content from audit log)
- Advanced filtering (full-text search)
- Metrics and analytics dashboard

---

## License

MIT License - Part of the Strapi monorepo

