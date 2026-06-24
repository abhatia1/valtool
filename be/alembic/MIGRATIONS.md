# Database Migrations with Alembic

This directory contains database migrations managed by Alembic.

## Quick Reference

### Check Current Database Revision
```bash
alembic current
```

### View Migration History
```bash
alembic history
```

### Create a New Migration (Auto-generate from models)
```bash
alembic revision --autogenerate -m "description of changes"
```

### Apply Migrations (Upgrade to Latest)
```bash
alembic upgrade head
```

### Rollback One Migration
```bash
alembic downgrade -1
```

### Rollback to Specific Revision
```bash
alembic downgrade <revision_id>
```

## Workflow for Schema Changes

1. **Modify your models** in `models/database.py`
   - Add/remove columns
   - Add/remove tables
   - Change column types or constraints

2. **Generate a migration**
   ```bash
   alembic revision --autogenerate -m "add user_role column to users"
   ```

3. **Review the generated migration** in `alembic/versions/`
   - Alembic auto-generates migrations but they should always be reviewed
   - Check for any edge cases or data transformations needed

4. **Apply the migration**
   ```bash
   alembic upgrade head
   ```

5. **Test your application** to ensure the migration worked correctly

## Common Scenarios

### Adding a New Column
1. Add the column to your model:
   ```python
   class Dataset(Base):
       # ... existing columns
       new_field = Column(String(255), nullable=True)
   ```

2. Generate migration:
   ```bash
   alembic revision --autogenerate -m "add new_field to datasets"
   ```

3. Apply migration:
   ```bash
   alembic upgrade head
   ```

### Renaming a Column
Alembic cannot auto-detect column renames. You need to manually edit the migration:

```python
def upgrade() -> None:
    op.alter_column('table_name', 'old_name', new_column_name='new_name')

def downgrade() -> None:
    op.alter_column('table_name', 'new_name', new_column_name='old_name')
```

### Adding a Non-Nullable Column to Existing Table
1. First, add the column as nullable:
   ```python
   new_field = Column(String(255), nullable=True)
   ```

2. Generate and apply migration

3. Populate the column with data (if needed)

4. Then make it non-nullable:
   ```python
   new_field = Column(String(255), nullable=False)
   ```

5. Generate and apply another migration

## Important Notes

- **Always review auto-generated migrations** before applying them
- **Test migrations on a copy of production data** before running in production
- **Never edit migrations that have already been applied** to a database
- **Keep migrations in version control** (they are already tracked in git)
- **Migrations run in order** based on the revision chain

## Troubleshooting

### "Target database is not up to date"
This means migrations have been created but not applied:
```bash
alembic upgrade head
```

### "Can't locate revision identified by 'xyz'"
Your local migrations are out of sync with the database. Make sure you have all migration files and run:
```bash
alembic upgrade head
```

### Migration Fails
1. Check the error message carefully
2. You may need to manually fix the database state
3. Use `alembic downgrade` to rollback if needed
4. Edit the migration file to fix the issue
5. Try upgrading again

## Configuration

- **alembic.ini**: Main configuration file
- **alembic/env.py**: Migration environment setup
- **alembic/versions/**: Directory containing all migration scripts

The database URL is configured in `alembic.ini` and should match your application's database configuration.
