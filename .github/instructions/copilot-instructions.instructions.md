---
applyTo: "**"
---

Provide project context and coding guidelines that AI should follow when generating code, answering questions, or reviewing changes.

## Additional Instructions

1. For any request related to the database:
   - Always check the current database schema carefully before writing or modifying queries, migrations, or models.
   - Do not assume table names, columns, relations, or constraints — verify them against the schema in the workspace.

2. After completing any task:
   - Always review the workspace (files, diffs, logs, or outputs) to detect potential errors, inconsistencies, or unfinished changes.
   - Fix any obvious issues before considering the task done.

3. Always use Vietnamese in all responses, comments, and explanations unless explicitly instructed otherwise.

4. When running in agent mode:
   - If there is sufficient context to perform the task, proceed automatically without asking for confirmation.
   - Only ask clarifying questions when the context is genuinely insufficient or ambiguous.
