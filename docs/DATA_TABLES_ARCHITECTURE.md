# Data Tables Architecture

## Overview

Data tables store dynamic, user-defined data with flexible columns. Each client workspace can have multiple data tables (typically an "Attendee List").

## Database Schema

### Tables
- `data_tables` - Table metadata (name, icon, color, etc.)
- `data_columns` - Column definitions (name, type, config)
- `data_rows` - Row data stored as JSON

## Critical: Row Data Format

**The `data_rows.data` JSON field MUST use column IDs (UUIDs) as keys, NOT column names.**

### Correct Format
```json
{
  "abe82b1a-deed-4580-a257-d2c768ac8aa6": "Dr. Ray Scott",
  "75c41420-c274-428d-890f-e1ecaf6f95df": "scott@example.com"
}
```

### Incorrect Format (will not display in UI)
```json
{
  "Name": "Dr. Ray Scott",
  "Email": "scott@example.com"
}
```

### Why?

The UI component (`data-grid.tsx`) looks up values using `row.data[col.id]`:

```tsx
// data-grid.tsx line 955
<EditableCell
    value={row.data[col.id]}  // Uses column ID, not name!
    column={col}
    onSave={(value) => onUpdateRow(row.id, { [col.id]: value })}
/>
```

### How to Insert Rows Correctly

When inserting rows programmatically:

1. First, fetch the columns to get their IDs:
   ```javascript
   const { data: columns } = await supabase
     .from('data_columns')
     .select('id, name')
     .eq('table_id', tableId);
   ```

2. Build a name-to-ID mapping:
   ```javascript
   const columnMap = {};
   columns.forEach(col => {
     columnMap[col.name] = col.id;
   });
   ```

3. Use column IDs when inserting row data:
   ```javascript
   const rowData = {
     [columnMap['Name']]: 'Dr. Ray Scott',
     [columnMap['Email']]: 'scott@example.com',
   };

   await supabase.from('data_rows').insert({
     table_id: tableId,
     data: rowData
   });
   ```

## Reference Implementation

See `import-csv-dialog.tsx` lines 254-282 for the correct pattern used by the CSV import feature.
