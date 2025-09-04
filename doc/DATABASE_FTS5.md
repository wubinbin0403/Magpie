# FTS5 Full-Text Search Management

## Overview
This project uses SQLite's FTS5 extension for full-text search capabilities. Since Drizzle ORM doesn't have native support for FTS5 virtual tables, we manage them manually.

## FTS5 Table Structure

The `links_fts` virtual table is created with this SQL:

```sql
CREATE VIRTUAL TABLE `links_fts` USING fts5(
  title, 
  description, 
  tags, 
  domain,
  category,
  content=links,
  content_rowid=id
);
```

## Synchronization Triggers

Three triggers keep the FTS5 table synchronized with the `links` table:

1. **Insert Trigger**: Adds new records to FTS5 when links are inserted
2. **Update Trigger**: Updates FTS5 records when links are modified  
3. **Delete Trigger**: Removes records from FTS5 when links are deleted

## Field Mapping

The FTS5 table fields map to the `links` table as follows:

| FTS5 Field | Links Table Field | Description |
|------------|------------------|-------------|
| title | title | Link title |
| description | user_description | User-confirmed description |
| tags | user_tags | User-confirmed tags (JSON string) |
| domain | domain | Domain name |
| category | user_category | User-confirmed category |

## Important Notes

1. **Manual Management**: The FTS5 table and triggers are defined in the main SQL migration file (e.g., `0000_*.sql`)

2. **Schema.ts**: The FTS5 table is NOT defined in `schema.ts` to prevent Drizzle from trying to manage it as a regular table

3. **Migration Regeneration**: When regenerating migrations with `pnpm db:generate`, you may need to manually re-add the FTS5 definitions to the new migration file

4. **Field Changes**: If you change the field names in the `links` table (like `user_description`, `user_tags`, `user_category`), you must update:
   - The FTS5 synchronization triggers
   - Any code that queries the FTS5 table
   - The seed script's FTS5 population query

## Maintenance Checklist

When modifying the database schema:

- [ ] Check if FTS5 field mappings need updates
- [ ] Update FTS5 triggers if field names change
- [ ] Update FTS5 population queries in seed scripts
- [ ] Ensure FTS5 definitions are preserved in migration files
- [ ] Test full-text search functionality after changes

## Testing FTS5

To verify FTS5 is working correctly:

```sql
-- Check if FTS5 table exists
.tables links_fts

-- Test search functionality
SELECT * FROM links_fts WHERE links_fts MATCH 'search term';

-- Check trigger synchronization
INSERT INTO links (...) VALUES (...);
SELECT * FROM links_fts WHERE rowid = last_insert_rowid();
```